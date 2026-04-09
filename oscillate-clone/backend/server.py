from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, io, base64, re
from pathlib import Path
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict
from datetime import datetime, timezone
import qrcode
import asyncio
import resend
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- DB ---
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# --- Rate Limiter ---
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")

# --- POS PINs from env ---
GOD_PIN = os.environ.get('GOD_PIN', '1812')
POS_PINS = {
    GOD_PIN: {"role": "god", "label": "GOD MODE"},
    os.environ.get('POS_MASTER_PIN', '9969'): {"role": "master", "label": "MASTER POS"},
    os.environ.get('POS_S1_PIN', '0051'): {"role": "s1", "label": "STATION 1 · GATE"},
    os.environ.get('POS_S2_PIN', '0052'): {"role": "s2", "label": "STATION 2 · COVER CHARGE"},
}
ADMIN_PIN = os.environ.get('ADMIN_PIN', '9969')
STRIPE_KEY = os.environ.get('STRIPE_API_KEY', '')
RESEND_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_KEY:
    resend.api_key = RESEND_KEY

# --- Helpers ---
def gen_ticket_id():
    return f"OSC-{uuid.uuid4().hex[:8].upper()}"

def generate_qr_base64(data: str) -> str:
    """Generate QR code as base64 PNG string."""
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def sanitize(val: str, max_len: int = 200) -> str:
    """Basic input sanitization: strip, limit length, remove control chars."""
    if not val:
        return ""
    val = val.strip()[:max_len]
    val = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', val)
    return val

async def send_ticket_email(buyer_email: str, buyer_name: str, ticket_id: str, event_name: str, tier_name: str, qr_b64: str):
    """Send ticket confirmation email with QR code. Non-blocking, graceful fail."""
    if not RESEND_KEY:
        logger.info("No RESEND_KEY, skipping email")
        return
    html = f"""
    <div style="font-family:monospace;background:#0A0A0A;color:#fff;padding:40px;max-width:600px;margin:0 auto">
      <div style="text-align:center;margin-bottom:30px">
        <div style="font-size:11px;letter-spacing:6px;color:#FF3B00;margin-bottom:4px">OSCILLATE</div>
        <div style="font-size:9px;letter-spacing:4px;color:#666">TECHNO COLLECTIVE</div>
      </div>
      <div style="border:1px solid #333;padding:30px;text-align:center">
        <div style="font-size:28px;font-weight:bold;margin-bottom:12px;letter-spacing:2px">BOOKING CONFIRMED</div>
        <div style="margin:20px 0"><img src="cid:qr" width="200" height="200" style="background:#fff;padding:8px" alt="QR"/></div>
        <div style="font-size:16px;color:#FF3B00;margin-bottom:8px;letter-spacing:2px">{ticket_id}</div>
        <div style="font-size:14px;margin-bottom:4px">{event_name}</div>
        <div style="font-size:12px;color:#888">{tier_name} &middot; {buyer_name}</div>
      </div>
      <div style="text-align:center;margin-top:20px;font-size:10px;color:#555;letter-spacing:1px">
        SHOW THIS QR CODE AT THE GATE FOR ENTRY
      </div>
    </div>
    """
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [buyer_email],
            "subject": f"OSCILLATE — Ticket Confirmed: {event_name}",
            "html": html,
        }
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {buyer_email} for ticket {ticket_id}")
    except Exception as e:
        logger.error(f"Email send failed: {e}")

# --- Validated Models ---
class POSAuth(BaseModel):
    pin: str = Field(..., min_length=4, max_length=8)

class TicketIssue(BaseModel):
    pin: str = Field(..., min_length=4, max_length=8)
    event_id: str = Field("", max_length=50)
    event_name: str = Field("", max_length=200)
    ticket_type: str = Field("GA", max_length=50)
    ticket_price: float = Field(0, ge=0, le=100000)
    payment_method: str = Field("cash", max_length=20)
    buyer_name: str = Field("", max_length=200)
    buyer_email: str = Field("", max_length=200)
    buyer_phone: str = Field("", max_length=20)
    quantity: int = Field(1, ge=1, le=20)
    source: str = Field("pos", max_length=20)
    action: str = Field("issue", max_length=30)
    promoter_name: str = Field("", max_length=200)

    @field_validator('payment_method')
    @classmethod
    def validate_method(cls, v):
        allowed = {"cash", "comp", "razorpay", "upi", "promoter", "stripe", "online"}
        if v.lower() not in allowed:
            raise ValueError(f"Invalid payment method. Allowed: {allowed}")
        return v.lower()

class CoverChargeRecord(BaseModel):
    pin: str = Field(..., min_length=4, max_length=8)
    guest_name: str = Field("", max_length=200)
    amount: float = Field(0, ge=0, le=50000)
    payment_method: str = Field("cash", max_length=20)
    event_id: str = Field("", max_length=50)

class ScanRequest(BaseModel):
    pin: str = Field(..., min_length=4, max_length=8)
    ticket_id: str = Field(..., min_length=4, max_length=20)

class NewsletterSignup(BaseModel):
    email: str = Field(..., max_length=200)
    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError("Invalid email")
        return v.lower().strip()

class CheckoutRequest(BaseModel):
    event_id: str = Field(..., max_length=50)
    tier_name: str = Field(..., max_length=50)
    buyer_name: str = Field(..., min_length=1, max_length=200)
    buyer_email: str = Field(..., max_length=200)
    buyer_phone: str = Field("", max_length=20)
    quantity: int = Field(1, ge=1, le=10)
    origin_url: str = Field(..., max_length=500)

    @field_validator('buyer_email')
    @classmethod
    def validate_email(cls, v):
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError("Invalid email")
        return v.lower().strip()

class AdminAuth(BaseModel):
    pin: str = Field(..., min_length=4, max_length=8)

class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    date: str = Field(..., max_length=50)
    date_iso: str = Field(..., max_length=20)
    venue: str = Field("TBA", max_length=200)
    city: str = Field(..., max_length=100)
    genre: str = Field("TECHNO", max_length=50)
    subgenre: str = Field("", max_length=50)
    price: str = Field("", max_length=20)
    lineup: List[str] = []
    flyer_url: str = Field("", max_length=500)
    ticket_url: str = Field("#", max_length=500)
    is_featured: bool = False
    tiers: list = []
    set_times: list = []

class ArtistCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field("Resident", max_length=50)
    bio: str = Field("", max_length=2000)
    genres: List[str] = []
    order: int = Field(0, ge=0, le=100)

# --- Seed Data ---
EVENTS_DATA = [
    {"id":"evt-future666","code":"F666","title":"CHAPTER IV — FUTURE.666","date":"SAT MAR 15, 2026","date_iso":"2026-03-15","venue":"TBA","city":"BENGALURU","genre":"TECHNO","subgenre":"INTERNATIONAL","price":"₹699","lineup":["FUTURE.666","UPHORIA","MALWARE","ODDIBLE"],"flyer_url":"https://customer-assets.emergentagent.com/job_pos-system-96/artifacts/mlj6aoub_5a65f9b4-4d59-4b22-a801-3895bae9d47f.JPG","ticket_url":"#","is_featured":False,"is_past":True,"tiers":[{"name":"EARLY BIRD","price":699,"capacity":100,"sold":100},{"name":"STANDARD","price":999,"capacity":150,"sold":150}],"set_times":[{"artist":"ODDIBLE","time":"21:00 — 22:30","note":"Opening"},{"artist":"MALWARE","time":"22:30 — 00:00","note":""},{"artist":"UPHORIA","time":"00:00 — 01:30","note":""},{"artist":"FUTURE.666","time":"01:30 — 03:30","note":"Headliner"}]},
    {"id":"evt-uberkikz","code":"UBK","title":"ÜBERKIKZ × OSCILLATE","date":"SAT APR 11, 2026","date_iso":"2026-04-11","venue":"TBA","city":"BENGALURU","genre":"TECHNO","subgenre":"INTERNATIONAL","price":"₹569","lineup":["MARLON","ANNABSTRACTS","ODDIBLE","ÜBERKIKZ"],"flyer_url":"https://oscillate-eta.vercel.app/flyers/uberkikz.jpg","ticket_url":"#","is_featured":True,"tiers":[{"name":"EARLY BIRD","price":569,"capacity":100,"sold":73},{"name":"STANDARD","price":799,"capacity":150,"sold":0},{"name":"PREMIUM","price":1299,"capacity":50,"sold":0}],"set_times":[{"artist":"MARLON","time":"21:00 — 22:30","note":"Opening"},{"artist":"ANNABSTRACTS","time":"22:30 — 00:00","note":""},{"artist":"ODDIBLE","time":"00:00 — 01:30","note":""},{"artist":"ÜBERKIKZ","time":"01:30 — 03:00","note":"Headliner"}]},
]
ARTISTS_DATA = [
    {"id":"art-1","name":"ODDIBLE","role":"Resident","bio":"Oddible bridges the gap between raw energy and surgical precision.","genres":["MINIMAL TECHNO","GROOVE","ACID"],"order":1},
    {"id":"art-2","name":"MALWARE","role":"Resident","bio":"The most consistent presence in OSCILLATE's history. Dark, mechanical, uncompromising.","genres":["DARK TECHNO","HYPNOTIC","INDUSTRIAL"],"order":2},
    {"id":"art-3","name":"ANNABSTRACTS","role":"Resident","bio":"Abstract rhythms and warehouse techno. A name to watch.","genres":["ABSTRACT TECHNO","WAREHOUSE"],"order":3},
    {"id":"art-4","name":"UPHORIA","role":"Resident","bio":"OSCILLATE's anchor. Commands peak-hour dancefloors with industrial techno and hypnotic groove.","genres":["TECHNO","INDUSTRIAL","PEAK HOUR"],"order":4},
    {"id":"art-5","name":"MARLON","role":"Guest","bio":"Master of mood. Opening sets that move toward the dark.","genres":["TECHNO","ATMOSPHERIC"],"order":5},
    {"id":"art-6","name":"FLUID STATE","role":"Resident","bio":"Fluid, evolving soundscapes.","genres":["TECHNO","AMBIENT"],"order":6},
    {"id":"art-7","name":"KAMARI","role":"Resident","bio":"Relentless forward motion.","genres":["TECHNO","WAREHOUSE"],"order":7},
    {"id":"art-8","name":"INSIN","role":"Resident","bio":"Dark minimal explorations.","genres":["DARK MINIMAL","TECHNO"],"order":8},
    {"id":"art-9","name":"ANUSHA","role":"Resident","bio":"Hypnotic minimalism and pounding techno.","genres":["MINIMAL","HYPNOTIC"],"order":9},
    {"id":"art-10","name":"ZEKT","role":"Resident","bio":"Driving industrial frequencies.","genres":["INDUSTRIAL","TECHNO"],"order":10},
]
GALLERY_DATA = [
    {"id":"gal-1","url":"https://oscillate-eta.vercel.app/photos/gig-crowd-blast.jpg","caption":"SIGNAL 001","order":1},
    {"id":"gal-2","url":"https://oscillate-eta.vercel.app/photos/gig-fog-beam.jpg","caption":"FOG & BEAM","order":2},
    {"id":"gal-3","url":"https://oscillate-eta.vercel.app/photos/gig-crowd-booth.jpg","caption":"THE BOOTH","order":3},
    {"id":"gal-4","url":"https://oscillate-eta.vercel.app/photos/gig-fog-crowd.jpg","caption":"UNDERGROUND","order":4},
    {"id":"gal-5","url":"https://oscillate-eta.vercel.app/photos/gig-dj-crowd.jpg","caption":"DJ SET","order":5},
    {"id":"gal-6","url":"https://oscillate-eta.vercel.app/photos/gig-red-dancer.jpg","caption":"MOVEMENT","order":6},
    {"id":"gal-7","url":"https://oscillate-eta.vercel.app/photos/gig-cdj.jpg","caption":"CDJ","order":7},
    {"id":"gal-8","url":"https://oscillate-eta.vercel.app/photos/gig-dancer.jpg","caption":"DANCER","order":8},
    {"id":"gal-9","url":"https://oscillate-eta.vercel.app/photos/gig-amber-dj.jpg","caption":"AMBER SET","order":9},
    {"id":"gal-10","url":"https://oscillate-eta.vercel.app/photos/gig-beam.jpg","caption":"BEAM","order":10},
    {"id":"gal-11","url":"https://oscillate-eta.vercel.app/photos/gig-hands.jpg","caption":"HANDS UP","order":11},
    {"id":"gal-12","url":"https://oscillate-eta.vercel.app/photos/gig-room-sign.jpg","caption":"THE ROOM","order":12},
]
MERCH_DATA = []

# --- Startup ---
@app.on_event("startup")
async def seed_database():
    for col, data in [("events", EVENTS_DATA), ("artists", ARTISTS_DATA), ("gallery", GALLERY_DATA)]:
        if await db[col].count_documents({}) == 0 and data:
            await db[col].insert_many(data)
    logger.info("Database seeded.")

# ===== PUBLIC ROUTES (rate limited) =====

@api_router.get("/")
@limiter.limit("60/minute")
async def root(request: Request):
    return {"message": "OSCILLATE API"}

@api_router.get("/events")
@limiter.limit("60/minute")
async def get_events(request: Request, city: Optional[str] = None, genre: Optional[str] = None):
    query = {}
    if city:
        query["city"] = {"$regex": sanitize(city, 50), "$options": "i"}
    if genre:
        query["genre"] = {"$regex": sanitize(genre, 50), "$options": "i"}
    return await db.events.find(query, {"_id": 0}).sort("date_iso", 1).to_list(100)

@api_router.get("/events/{event_id}")
@limiter.limit("60/minute")
async def get_event_detail(request: Request, event_id: str):
    event = await db.events.find_one({"id": sanitize(event_id, 50)}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@api_router.get("/events/featured/next")
@limiter.limit("60/minute")
async def get_featured_event(request: Request):
    event = await db.events.find_one({"is_featured": True}, {"_id": 0})
    if not event:
        event = await db.events.find_one({}, {"_id": 0})
    return event

@api_router.get("/artists")
@limiter.limit("60/minute")
async def get_artists(request: Request):
    return await db.artists.find({}, {"_id": 0}).sort("order", 1).to_list(100)

@api_router.get("/artists/{artist_id}")
@limiter.limit("60/minute")
async def get_artist_detail(request: Request, artist_id: str):
    artist = await db.artists.find_one({"id": sanitize(artist_id, 50)}, {"_id": 0})
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")
    return artist

@api_router.get("/gallery")
@limiter.limit("60/minute")
async def get_gallery(request: Request):
    return await db.gallery.find({}, {"_id": 0}).sort("order", 1).to_list(100)

@api_router.get("/stats")
@limiter.limit("60/minute")
async def get_stats(request: Request):
    events_count = await db.events.count_documents({})
    artists_count = await db.artists.count_documents({})
    cities = await db.events.distinct("city")
    tickets_sold = await db.tickets.count_documents({})
    return {"events_hosted": max(events_count, 18), "artists_platformed": max(artists_count, 40), "community": "5K+", "cities": len(set(cities)) if cities else 3, "tickets_sold": tickets_sold}

@api_router.get("/merch")
@limiter.limit("60/minute")
async def get_merch(request: Request, category: Optional[str] = None):
    query = {}
    if category and category != "all":
        query["category"] = sanitize(category, 30)
    return await db.merch.find(query, {"_id": 0}).to_list(100)

@api_router.post("/newsletter")
@limiter.limit("5/minute")
async def newsletter_signup(request: Request, signup: NewsletterSignup):
    existing = await db.newsletter.find_one({"email": signup.email})
    if existing:
        return {"message": "Already subscribed", "email": signup.email}
    await db.newsletter.insert_one({"email": signup.email, "subscribed_at": datetime.now(timezone.utc).isoformat()})
    return {"message": "Subscribed", "email": signup.email}

# ===== QR CODE ENDPOINT =====

@api_router.get("/ticket/{ticket_id}/qr")
@limiter.limit("30/minute")
async def get_ticket_qr(request: Request, ticket_id: str):
    """Return QR code image for a ticket."""
    ticket = await db.tickets.find_one({"id": sanitize(ticket_id, 20)}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    qr_b64 = ticket.get("qr_code")
    if not qr_b64:
        qr_b64 = generate_qr_base64(ticket_id)
        await db.tickets.update_one({"id": ticket_id}, {"$set": {"qr_code": qr_b64}})
    img_bytes = base64.b64decode(qr_b64)
    return Response(content=img_bytes, media_type="image/png")

# ===== STRIPE CHECKOUT (Online ticket purchasing) =====

@api_router.post("/checkout/create")
@limiter.limit("10/minute")
async def create_checkout(request: Request, req: CheckoutRequest):
    """Create Stripe checkout session for online ticket purchase. Amount is server-defined."""
    event = await db.events.find_one({"id": sanitize(req.event_id, 50)}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    tier = next((t for t in event.get("tiers", []) if t["name"] == req.tier_name), None)
    if not tier:
        raise HTTPException(status_code=400, detail="Invalid tier")
    # Server-side price (SECURITY: never accept price from frontend)
    unit_price = float(tier["price"])
    total = unit_price * req.quantity
    origin = sanitize(req.origin_url, 500).rstrip("/")
    success_url = f"{origin}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/event/{req.event_id}"
    metadata = {
        "event_id": req.event_id,
        "event_name": event.get("title", ""),
        "tier_name": req.tier_name,
        "buyer_name": sanitize(req.buyer_name),
        "buyer_email": req.buyer_email,
        "buyer_phone": sanitize(req.buyer_phone),
        "quantity": str(req.quantity),
    }
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_KEY, webhook_url=webhook_url)
    checkout_req = CheckoutSessionRequest(
        amount=total, currency="inr",
        success_url=success_url, cancel_url=cancel_url,
        metadata=metadata
    )
    session = await stripe_checkout.create_checkout_session(checkout_req)
    # Record payment transaction
    tx = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "event_id": req.event_id,
        "tier_name": req.tier_name,
        "buyer_name": sanitize(req.buyer_name),
        "buyer_email": req.buyer_email,
        "quantity": req.quantity,
        "amount": total,
        "currency": "inr",
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata,
    }
    await db.payment_transactions.insert_one(tx)
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/checkout/status/{session_id}")
@limiter.limit("30/minute")
async def get_checkout_status(request: Request, session_id: str):
    """Poll Stripe checkout status and issue ticket if paid."""
    sid = sanitize(session_id, 200)
    tx = await db.payment_transactions.find_one({"session_id": sid}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    # If already completed, return cached
    if tx.get("payment_status") == "paid" and tx.get("ticket_id"):
        ticket = await db.tickets.find_one({"id": tx["ticket_id"]}, {"_id": 0})
        return {"payment_status": "paid", "ticket": ticket}
    # Poll Stripe
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_KEY, webhook_url=webhook_url)
    status = await stripe_checkout.get_checkout_status(sid)
    # Update transaction
    await db.payment_transactions.update_one(
        {"session_id": sid},
        {"$set": {"payment_status": status.payment_status, "status": status.status}}
    )
    if status.payment_status == "paid" and not tx.get("ticket_id"):
        # Issue ticket(s) with QR
        meta = tx.get("metadata", {})
        tickets_issued = []
        for _ in range(tx.get("quantity", 1)):
            tid = gen_ticket_id()
            qr_b64 = generate_qr_base64(tid)
            doc = {
                "id": tid, "event_id": meta.get("event_id", ""),
                "event_name": meta.get("event_name", ""),
                "ticket_type": meta.get("tier_name", ""),
                "ticket_price": tx.get("amount", 0) / max(tx.get("quantity", 1), 1),
                "payment_method": "stripe", "buyer_name": meta.get("buyer_name", ""),
                "buyer_email": meta.get("buyer_email", ""),
                "quantity": 1, "source": "online", "action": "purchase",
                "amount": tx.get("amount", 0) / max(tx.get("quantity", 1), 1),
                "issued_at": datetime.now(timezone.utc).isoformat(),
                "checked_in": False, "qr_code": qr_b64,
                "session_id": sid,
            }
            await db.tickets.insert_one(doc)
            tickets_issued.append(tid)
        await db.payment_transactions.update_one(
            {"session_id": sid},
            {"$set": {"ticket_id": tickets_issued[0] if len(tickets_issued) == 1 else tickets_issued[0], "ticket_ids": tickets_issued}}
        )
        # Send confirmation email (non-blocking)
        asyncio.create_task(send_ticket_email(
            meta.get("buyer_email", ""), meta.get("buyer_name", ""),
            tickets_issued[0], meta.get("event_name", ""), meta.get("tier_name", ""),
            generate_qr_base64(tickets_issued[0])
        ))
        ticket = await db.tickets.find_one({"id": tickets_issued[0]}, {"_id": 0})
        return {"payment_status": "paid", "ticket": ticket, "ticket_ids": tickets_issued}
    return {"payment_status": status.payment_status, "status": status.status}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks."""
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_KEY, webhook_url=webhook_url)
    try:
        event = await stripe_checkout.handle_webhook(body, sig)
        if event.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"payment_status": "paid", "status": "complete"}}
            )
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# ===== POS ROUTES (rate limited) =====

@api_router.post("/pos/auth")
@limiter.limit("10/minute")
async def pos_authenticate(request: Request, auth: POSAuth):
    pin_config = POS_PINS.get(auth.pin)
    if not pin_config:
        raise HTTPException(status_code=401, detail="Invalid PIN")
    return {"authenticated": True, "role": pin_config["role"], "label": pin_config["label"], "pin": auth.pin}

@api_router.post("/pos/issue-ticket")
@limiter.limit("30/minute")
async def issue_ticket(request: Request, ticket: TicketIssue):
    if ticket.pin not in POS_PINS:
        raise HTTPException(status_code=401, detail="Invalid PIN")
    tid = gen_ticket_id()
    qr_b64 = generate_qr_base64(tid)
    doc = {
        "id": tid, "event_id": sanitize(ticket.event_id),
        "event_name": sanitize(ticket.event_name),
        "ticket_type": sanitize(ticket.ticket_type),
        "ticket_price": ticket.ticket_price,
        "payment_method": ticket.payment_method,
        "buyer_name": sanitize(ticket.buyer_name),
        "buyer_email": sanitize(ticket.buyer_email),
        "buyer_phone": sanitize(ticket.buyer_phone),
        "quantity": ticket.quantity, "source": sanitize(ticket.source),
        "action": sanitize(ticket.action),
        "promoter_name": sanitize(ticket.promoter_name),
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "checked_in": False,
        "amount": (0.0 if ticket.payment_method == "comp" else ticket.ticket_price) * ticket.quantity,
        "qr_code": qr_b64,
    }
    await db.tickets.insert_one(doc)
    # Send email if buyer email provided
    if ticket.buyer_email:
        asyncio.create_task(send_ticket_email(
            ticket.buyer_email, sanitize(ticket.buyer_name), tid,
            sanitize(ticket.event_name), sanitize(ticket.ticket_type), qr_b64
        ))
    return {k: v for k, v in doc.items() if k != "_id"}

# ===== MERCH CHECKOUT =====

class MerchCheckoutRequest(BaseModel):
    items: List[Dict] = Field(..., min_length=1)
    buyer_name: str = Field(..., min_length=1, max_length=200)
    buyer_email: str = Field(..., max_length=200)
    origin_url: str = Field(..., max_length=500)
    @field_validator('buyer_email')
    @classmethod
    def validate_email(cls, v):
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError("Invalid email")
        return v.lower().strip()

@api_router.post("/merch/checkout")
@limiter.limit("10/minute")
async def merch_checkout(request: Request, req: MerchCheckoutRequest):
    """Create Stripe checkout for merch items. Server-side pricing."""
    total = 0.0
    item_details = []
    for item in req.items:
        merch = await db.merch.find_one({"id": sanitize(item.get("id", ""), 50)}, {"_id": 0})
        if not merch:
            raise HTTPException(status_code=400, detail=f"Item {item.get('id')} not found")
        qty = min(int(item.get("qty", 1)), 10)
        price = float(merch["price"])
        total += price * qty
        item_details.append({"id": merch["id"], "name": merch["name"], "size": item.get("size", ""), "qty": qty, "price": price})
    origin = sanitize(req.origin_url, 500).rstrip("/")
    success_url = f"{origin}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/#merch"
    metadata = {"type": "merch", "buyer_name": sanitize(req.buyer_name), "buyer_email": req.buyer_email, "items_json": str(item_details)[:500]}
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_KEY, webhook_url=webhook_url)
    checkout_req = CheckoutSessionRequest(amount=total, currency="inr", success_url=success_url, cancel_url=cancel_url, metadata=metadata)
    session = await stripe_checkout.create_checkout_session(checkout_req)
    tx = {"id": str(uuid.uuid4()), "session_id": session.session_id, "type": "merch", "buyer_name": sanitize(req.buyer_name), "buyer_email": req.buyer_email, "items": item_details, "amount": total, "currency": "inr", "payment_status": "pending", "status": "initiated", "created_at": datetime.now(timezone.utc).isoformat(), "metadata": metadata}
    await db.payment_transactions.insert_one(tx)
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/pos/door-data")
@limiter.limit("30/minute")
async def get_door_data(request: Request, event_id: Optional[str] = None):
    query = {}
    if event_id:
        query["event_id"] = sanitize(event_id, 50)
    tickets = await db.tickets.find(query, {"_id": 0}).sort("issued_at", -1).to_list(1000)
    total = len(tickets)
    checked_in = sum(1 for t in tickets if t.get("checked_in"))
    revenue = sum(t.get("amount", 0) for t in tickets)
    cover_records = await db.cover_charges.find(query, {"_id": 0}).to_list(1000)
    cover_revenue = sum(c.get("amount", 0) for c in cover_records)
    return {"tickets": tickets, "total": total, "checked_in": checked_in, "pending": total - checked_in, "ticket_revenue": revenue, "cover_revenue": cover_revenue, "cover_count": len(cover_records)}

@api_router.get("/pos/promoter-sales")
@limiter.limit("30/minute")
async def get_promoter_sales(request: Request, event_id: Optional[str] = None):
    query = {"promoter_name": {"$ne": ""}}
    if event_id:
        query["event_id"] = sanitize(event_id, 50)
    tickets = await db.tickets.find(query, {"_id": 0}).sort("issued_at", -1).to_list(1000)
    promoters = {}
    for t in tickets:
        pn = t.get("promoter_name", "")
        if pn:
            if pn not in promoters:
                promoters[pn] = {"promoter": pn, "qty": 0, "paid": 0}
            promoters[pn]["qty"] += t.get("quantity", 1)
            promoters[pn]["paid"] += t.get("amount", 0)
    return {"promoters": list(promoters.values()), "total_tickets": tickets}

@api_router.post("/pos/scan")
@limiter.limit("30/minute")
async def scan_ticket(request: Request, req: ScanRequest):
    if req.pin not in POS_PINS:
        raise HTTPException(status_code=401, detail="Invalid PIN")
    tid = sanitize(req.ticket_id, 20)
    ticket = await db.tickets.find_one({"id": tid}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.get("checked_in"):
        return {"status": "already_checked_in", "ticket": ticket}
    await db.tickets.update_one({"id": tid}, {"$set": {"checked_in": True, "checked_in_at": datetime.now(timezone.utc).isoformat()}})
    ticket["checked_in"] = True
    return {"status": "checked_in", "ticket": ticket}

@api_router.post("/pos/cover-charge")
@limiter.limit("30/minute")
async def add_cover_charge(request: Request, record: CoverChargeRecord):
    if record.pin not in POS_PINS:
        raise HTTPException(status_code=401, detail="Invalid PIN")
    doc = {"id": str(uuid.uuid4()), "guest_name": sanitize(record.guest_name), "amount": record.amount, "payment_method": sanitize(record.payment_method), "event_id": sanitize(record.event_id), "charged_at": datetime.now(timezone.utc).isoformat()}
    await db.cover_charges.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api_router.get("/pos/cover-data")
@limiter.limit("30/minute")
async def get_cover_data(request: Request, event_id: Optional[str] = None):
    query = {}
    if event_id:
        query["event_id"] = sanitize(event_id, 50)
    records = await db.cover_charges.find(query, {"_id": 0}).sort("charged_at", -1).to_list(1000)
    total_revenue = sum(r.get("amount", 0) for r in records)
    return {"records": records, "count": len(records), "total_revenue": total_revenue}

# ===== ADMIN ROUTES =====

def verify_admin(pin: str):
    if pin != ADMIN_PIN and pin != GOD_PIN:
        raise HTTPException(status_code=401, detail="Unauthorized")

@api_router.post("/admin/events")
@limiter.limit("10/minute")
async def admin_create_event(request: Request, event: EventCreate, pin: str = ""):
    verify_admin(pin)
    doc = {"id": f"evt-{uuid.uuid4().hex[:8]}", **event.model_dump()}
    await db.events.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api_router.put("/admin/events/{event_id}")
@limiter.limit("10/minute")
async def admin_update_event(request: Request, event_id: str, event: EventCreate, pin: str = ""):
    verify_admin(pin)
    result = await db.events.update_one({"id": sanitize(event_id, 50)}, {"$set": event.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"updated": True}

@api_router.delete("/admin/events/{event_id}")
@limiter.limit("10/minute")
async def admin_delete_event(request: Request, event_id: str, pin: str = ""):
    verify_admin(pin)
    result = await db.events.delete_one({"id": sanitize(event_id, 50)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"deleted": True}

@api_router.post("/admin/artists")
@limiter.limit("10/minute")
async def admin_create_artist(request: Request, artist: ArtistCreate, pin: str = ""):
    verify_admin(pin)
    doc = {"id": f"art-{uuid.uuid4().hex[:6]}", **artist.model_dump()}
    await db.artists.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api_router.delete("/admin/artists/{artist_id}")
@limiter.limit("10/minute")
async def admin_delete_artist(request: Request, artist_id: str, pin: str = ""):
    verify_admin(pin)
    result = await db.artists.delete_one({"id": sanitize(artist_id, 50)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Artist not found")
    return {"deleted": True}

# ===== SEARCH =====

@api_router.get("/search")
@limiter.limit("60/minute")
async def search(request: Request, q: str = ""):
    query = sanitize(q, 100)
    if not query or len(query) < 2:
        return {"events": [], "artists": []}
    regex = {"$regex": query, "$options": "i"}
    events = await db.events.find({"$or": [{"title": regex}, {"city": regex}, {"genre": regex}, {"venue": regex}]}, {"_id": 0}).to_list(20)
    artists = await db.artists.find({"$or": [{"name": regex}, {"role": regex}, {"bio": regex}]}, {"_id": 0}).to_list(20)
    return {"events": events, "artists": artists}

# ===== ANALYTICS =====

@api_router.get("/analytics")
@limiter.limit("30/minute")
async def get_analytics(request: Request, pin: str = ""):
    if pin not in POS_PINS and pin != GOD_PIN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    # Revenue by payment method
    tickets = await db.tickets.find({}, {"_id": 0, "payment_method": 1, "amount": 1, "checked_in": 1, "checked_in_at": 1, "issued_at": 1, "event_name": 1, "source": 1, "promoter_name": 1, "ticket_type": 1}).to_list(5000)
    revenue_by_method = {}
    revenue_by_event = {}
    checkin_timeline = []
    source_breakdown = {"pos": 0, "online": 0, "door": 0, "promoter": 0}
    for t in tickets:
        m = t.get("payment_method", "unknown")
        amt = t.get("amount", 0)
        revenue_by_method[m] = revenue_by_method.get(m, 0) + amt
        ev = t.get("event_name", "Unknown")[:30]
        revenue_by_event[ev] = revenue_by_event.get(ev, 0) + amt
        src = t.get("source", "pos")
        if src in source_breakdown:
            source_breakdown[src] += 1
        if t.get("checked_in_at"):
            checkin_timeline.append({"time": t["checked_in_at"], "event": ev})
    # Promoter leaderboard
    promoter_tickets = [t for t in tickets if t.get("promoter_name")]
    promoter_map = {}
    for t in promoter_tickets:
        pn = t["promoter_name"]
        if pn not in promoter_map:
            promoter_map[pn] = {"name": pn, "tickets": 0, "revenue": 0}
        promoter_map[pn]["tickets"] += 1
        promoter_map[pn]["revenue"] += t.get("amount", 0)
    promoter_board = sorted(promoter_map.values(), key=lambda x: x["revenue"], reverse=True)[:20]
    # Cover charges
    covers = await db.cover_charges.find({}, {"_id": 0}).to_list(5000)
    cover_revenue = sum(c.get("amount", 0) for c in covers)
    total_checked_in = sum(1 for t in tickets if t.get("checked_in"))
    return {
        "total_tickets": len(tickets),
        "total_revenue": sum(t.get("amount", 0) for t in tickets),
        "total_checked_in": total_checked_in,
        "cover_revenue": cover_revenue,
        "cover_count": len(covers),
        "revenue_by_method": [{"method": k, "revenue": v} for k, v in revenue_by_method.items()],
        "revenue_by_event": [{"event": k, "revenue": v} for k, v in revenue_by_event.items()],
        "promoter_leaderboard": promoter_board,
        "source_breakdown": source_breakdown,
        "checkin_timeline": checkin_timeline[-50:],
    }

# ===== EVENT ATTENDANCE =====

@api_router.post("/events/{event_id}/interested")
@limiter.limit("10/minute")
async def mark_interested(request: Request, event_id: str):
    eid = sanitize(event_id, 50)
    await db.events.update_one({"id": eid}, {"$inc": {"interested_count": 1}})
    event = await db.events.find_one({"id": eid}, {"_id": 0, "interested_count": 1})
    return {"interested_count": event.get("interested_count", 0) if event else 0}

# ===== WHATSAPP TICKET LINK =====

@api_router.get("/ticket/{ticket_id}/whatsapp")
@limiter.limit("20/minute")
async def get_whatsapp_link(request: Request, ticket_id: str, phone: str = ""):
    tid = sanitize(ticket_id, 20)
    ticket = await db.tickets.find_one({"id": tid}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    msg = f"OSCILLATE TICKET CONFIRMED\n\nTicket: {tid}\nEvent: {ticket.get('event_name','')}\nType: {ticket.get('ticket_type','')}\nName: {ticket.get('buyer_name','')}\n\nShow this ticket ID at the gate.\nDownload QR: {str(request.base_url).rstrip('/')}/api/ticket/{tid}/qr"
    encoded = msg.replace("\n", "%0A").replace(" ", "%20")
    ph = sanitize(phone, 15).replace("+", "").replace(" ", "")
    wa_url = f"https://wa.me/{ph}?text={encoded}" if ph else f"https://wa.me/?text={encoded}"
    return {"whatsapp_url": wa_url, "message": msg}

# ===== APP CONFIG =====
app.include_router(api_router)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(self), microphone=()"
    return response

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
