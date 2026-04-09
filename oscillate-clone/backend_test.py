#!/usr/bin/env python3
"""
OSCILLATE Backend API Testing - Customer Cleanup Validation (Iteration 6)
Tests all core functionality after cleanup: events, POS, checkout, admin
- Only 2 events (FUTURE.666 past + ÜBERKIKZ upcoming)
- No merch section
- All core functionality intact
"""

import requests
import sys
import json
import time
import base64
from datetime import datetime

class OSCILLATEAPITester:
    def __init__(self, base_url="https://pos-system-96.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # POS PIN configurations for testing
        self.pos_pins = {
            "1812": {"role": "god", "label": "GOD MODE"},
            "9969": {"role": "master", "label": "MASTER POS"},
            "0051": {"role": "s1", "label": "STATION 1 · GATE"},
            "0052": {"role": "s2", "label": "STATION 2 · COVER CHARGE"},
        }

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.failed_tests.append({"test": name, "error": details})

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200 and "OSCILLATE API" in response.text
            self.log_test("API Root", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("API Root", False, str(e))
            return False

    def test_events_endpoint(self):
        """Test events endpoint"""
        try:
            response = requests.get(f"{self.api_url}/events", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = isinstance(data, list) and len(data) >= 6
                self.log_test("Events Endpoint", success, f"Found {len(data)} events" if success else "Invalid data structure")
                return data if success else []
            else:
                self.log_test("Events Endpoint", False, f"Status: {response.status_code}")
                return []
        except Exception as e:
            self.log_test("Events Endpoint", False, str(e))
            return []

    def test_events_featured(self):
        """Test featured event endpoint"""
        try:
            response = requests.get(f"{self.api_url}/events/featured/next", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = isinstance(data, dict) and "title" in data
                self.log_test("Featured Event", success, f"Featured: {data.get('title', 'N/A')}" if success else "Invalid data")
                return data if success else {}
            else:
                self.log_test("Featured Event", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("Featured Event", False, str(e))
            return {}

    def test_artists_endpoint(self):
        """Test artists endpoint"""
        try:
            response = requests.get(f"{self.api_url}/artists", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = isinstance(data, list) and len(data) >= 10
                self.log_test("Artists Endpoint", success, f"Found {len(data)} artists" if success else "Invalid data")
                return data if success else []
            else:
                self.log_test("Artists Endpoint", False, f"Status: {response.status_code}")
                return []
        except Exception as e:
            self.log_test("Artists Endpoint", False, str(e))
            return []

    def test_gallery_endpoint(self):
        """Test gallery endpoint"""
        try:
            response = requests.get(f"{self.api_url}/gallery", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = isinstance(data, list) and len(data) >= 12
                self.log_test("Gallery Endpoint", success, f"Found {len(data)} images" if success else "Invalid data")
                return data if success else []
            else:
                self.log_test("Gallery Endpoint", False, f"Status: {response.status_code}")
                return []
        except Exception as e:
            self.log_test("Gallery Endpoint", False, str(e))
            return []

    def test_stats_endpoint(self):
        """Test stats endpoint"""
        try:
            response = requests.get(f"{self.api_url}/stats", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                required_keys = ["events_hosted", "artists_platformed", "community", "cities"]
                success = all(key in data for key in required_keys)
                self.log_test("Stats Endpoint", success, f"Stats: {data}" if success else "Missing required keys")
                return data if success else {}
            else:
                self.log_test("Stats Endpoint", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("Stats Endpoint", False, str(e))
            return {}

    def test_merch_endpoint(self):
        """Test merch endpoint"""
        try:
            response = requests.get(f"{self.api_url}/merch", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = isinstance(data, list) and len(data) >= 9
                self.log_test("Merch Endpoint", success, f"Found {len(data)} merch items" if success else "Invalid data structure")
                return data if success else []
            else:
                self.log_test("Merch Endpoint", False, f"Status: {response.status_code}")
                return []
        except Exception as e:
            self.log_test("Merch Endpoint", False, str(e))
            return []

    def test_merch_category_filter(self):
        """Test merch category filtering"""
        categories = ["tees", "hoodies", "accessories"]
        for category in categories:
            try:
                response = requests.get(f"{self.api_url}/merch?category={category}", timeout=10)
                success = response.status_code == 200
                if success:
                    data = response.json()
                    # Check that all items belong to the requested category
                    category_items = [item for item in data if item.get("category") == category]
                    success = len(category_items) == len(data) and len(data) > 0
                    self.log_test(f"Merch Filter {category.title()}", success, f"Found {len(data)} {category} items")
                else:
                    self.log_test(f"Merch Filter {category.title()}", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test(f"Merch Filter {category.title()}", False, str(e))

    def test_pos_auth_god(self):
        """Test POS authentication with GOD PIN 1812"""
        try:
            response = requests.post(f"{self.api_url}/pos/auth", 
                                   json={"pin": "1812"}, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = (data.get("authenticated") == True and 
                          data.get("role") == "god" and 
                          data.get("label") == "GOD MODE")
                self.log_test("POS Auth GOD PIN", success, f"Role: {data.get('role', 'N/A')}, Label: {data.get('label', 'N/A')}" if success else "Invalid response")
                return data if success else {}
            else:
                self.log_test("POS Auth GOD PIN", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("POS Auth GOD PIN", False, str(e))
            return {}

    def test_pos_auth_master(self):
        """Test POS authentication with Master PIN 9969"""
        try:
            response = requests.post(f"{self.api_url}/pos/auth", 
                                   json={"pin": "9969"}, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = (data.get("authenticated") == True and 
                          data.get("role") == "master" and 
                          data.get("label") == "MASTER POS")
                self.log_test("POS Auth Master PIN", success, f"Role: {data.get('role', 'N/A')}, Label: {data.get('label', 'N/A')}" if success else "Invalid response")
                return data if success else {}
            else:
                self.log_test("POS Auth Master PIN", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("POS Auth Master PIN", False, str(e))
            return {}

    def test_pos_auth_s1(self):
        """Test POS authentication with S1 PIN 0051"""
        try:
            response = requests.post(f"{self.api_url}/pos/auth", 
                                   json={"pin": "0051"}, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = (data.get("authenticated") == True and 
                          data.get("role") == "s1" and 
                          data.get("label") == "STATION 1 · GATE")
                self.log_test("POS Auth S1 PIN", success, f"Role: {data.get('role', 'N/A')}, Label: {data.get('label', 'N/A')}" if success else "Invalid response")
                return data if success else {}
            else:
                self.log_test("POS Auth S1 PIN", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("POS Auth S1 PIN", False, str(e))
            return {}

    def test_pos_auth_s2(self):
        """Test POS authentication with S2 PIN 0052"""
        try:
            response = requests.post(f"{self.api_url}/pos/auth", 
                                   json={"pin": "0052"}, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = (data.get("authenticated") == True and 
                          data.get("role") == "s2" and 
                          data.get("label") == "STATION 2 · COVER CHARGE")
                self.log_test("POS Auth S2 PIN", success, f"Role: {data.get('role', 'N/A')}, Label: {data.get('label', 'N/A')}" if success else "Invalid response")
                return data if success else {}
            else:
                self.log_test("POS Auth S2 PIN", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("POS Auth S2 PIN", False, str(e))
            return {}

    def test_pos_auth_invalid(self):
        """Test POS authentication with invalid PIN"""
        try:
            response = requests.post(f"{self.api_url}/pos/auth", 
                                   json={"pin": "0000"}, 
                                   timeout=10)
            success = response.status_code == 401
            self.log_test("POS Auth Invalid PIN", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POS Auth Invalid PIN", False, str(e))

    def test_analytics_endpoint(self):
        """Test analytics endpoint with GOD PIN"""
        try:
            response = requests.get(f"{self.api_url}/analytics?pin=1812", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                required_keys = ["total_tickets", "total_revenue", "total_checked_in", "cover_revenue", 
                               "revenue_by_method", "revenue_by_event", "promoter_leaderboard", 
                               "source_breakdown", "checkin_timeline"]
                success = all(key in data for key in required_keys)
                if success:
                    # Verify data structure
                    success = (isinstance(data.get("revenue_by_method"), list) and
                              isinstance(data.get("revenue_by_event"), list) and
                              isinstance(data.get("promoter_leaderboard"), list) and
                              isinstance(data.get("source_breakdown"), dict))
                self.log_test("Analytics Endpoint", success, f"Total tickets: {data.get('total_tickets', 0)}, Revenue: ₹{data.get('total_revenue', 0)}" if success else "Missing required keys or invalid structure")
                return data if success else {}
            else:
                self.log_test("Analytics Endpoint", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("Analytics Endpoint", False, str(e))
            return {}

    def test_analytics_unauthorized(self):
        """Test analytics endpoint without proper PIN"""
        try:
            response = requests.get(f"{self.api_url}/analytics?pin=0000", timeout=10)
            success = response.status_code == 401
            self.log_test("Analytics Unauthorized", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Analytics Unauthorized", False, str(e))

    def test_search_endpoint(self):
        """Test search endpoint"""
        try:
            response = requests.get(f"{self.api_url}/search?q=techno", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = ("events" in data and "artists" in data and
                          isinstance(data.get("events"), list) and
                          isinstance(data.get("artists"), list))
                if success:
                    # Check if search returns relevant results
                    events_count = len(data.get("events", []))
                    artists_count = len(data.get("artists", []))
                    success = events_count > 0 or artists_count > 0
                self.log_test("Search Endpoint", success, f"Found {events_count} events, {artists_count} artists" if success else "No results or invalid structure")
                return data if success else {}
            else:
                self.log_test("Search Endpoint", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("Search Endpoint", False, str(e))
            return {}

    def test_search_empty_query(self):
        """Test search endpoint with empty query"""
        try:
            response = requests.get(f"{self.api_url}/search?q=", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = (data.get("events") == [] and data.get("artists") == [])
                self.log_test("Search Empty Query", success, "Returns empty arrays for empty query" if success else "Should return empty arrays")
            else:
                self.log_test("Search Empty Query", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Search Empty Query", False, str(e))

    def test_whatsapp_ticket_link(self):
        """Test WhatsApp ticket link generation"""
        # First create a ticket
        ticket_result = self.test_pos_issue_ticket()
        if not ticket_result or "id" not in ticket_result:
            self.log_test("WhatsApp Ticket Link", False, "Could not create ticket for WhatsApp test")
            return
            
        try:
            ticket_id = ticket_result["id"]
            response = requests.get(f"{self.api_url}/ticket/{ticket_id}/whatsapp?phone=919876543210", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = ("whatsapp_url" in data and "message" in data and
                          "wa.me" in data.get("whatsapp_url", "") and
                          ticket_id in data.get("message", ""))
                self.log_test("WhatsApp Ticket Link", success, f"Generated WhatsApp link for {ticket_id}" if success else "Invalid response structure")
                return data if success else {}
            else:
                self.log_test("WhatsApp Ticket Link", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("WhatsApp Ticket Link", False, str(e))
            return {}

    def test_whatsapp_ticket_no_phone(self):
        """Test WhatsApp ticket link without phone number"""
        # First create a ticket
        ticket_result = self.test_pos_issue_ticket()
        if not ticket_result or "id" not in ticket_result:
            self.log_test("WhatsApp Ticket No Phone", False, "Could not create ticket for WhatsApp test")
            return
            
        try:
            ticket_id = ticket_result["id"]
            response = requests.get(f"{self.api_url}/ticket/{ticket_id}/whatsapp", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = ("whatsapp_url" in data and "wa.me/?text=" in data.get("whatsapp_url", ""))
                self.log_test("WhatsApp Ticket No Phone", success, "Generated generic WhatsApp link" if success else "Invalid response")
            else:
                self.log_test("WhatsApp Ticket No Phone", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("WhatsApp Ticket No Phone", False, str(e))

    def test_event_interested(self):
        """Test event interested endpoint"""
        try:
            response = requests.post(f"{self.api_url}/events/evt-uberkikz/interested", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = "interested_count" in data and isinstance(data.get("interested_count"), int)
                self.log_test("Event Interested", success, f"Interested count: {data.get('interested_count', 0)}" if success else "Invalid response")
                return data if success else {}
            else:
                self.log_test("Event Interested", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("Event Interested", False, str(e))
            return {}

    def test_security_headers(self):
        """Test security headers are present"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            if success:
                headers = response.headers
                required_headers = [
                    "X-Content-Type-Options",
                    "X-Frame-Options", 
                    "X-XSS-Protection",
                    "Referrer-Policy",
                    "Permissions-Policy"
                ]
                missing_headers = [h for h in required_headers if h not in headers]
                success = len(missing_headers) == 0
                self.log_test("Security Headers", success, f"All security headers present" if success else f"Missing: {missing_headers}")
                
                # Log header values for verification
                if success:
                    print(f"    Security headers: X-Content-Type-Options={headers.get('X-Content-Type-Options')}, X-Frame-Options={headers.get('X-Frame-Options')}")
            else:
                self.log_test("Security Headers", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Security Headers", False, str(e))

    def test_pos_issue_ticket(self):
        """Test POS issue ticket functionality"""
        try:
            ticket_data = {
                "pin": "9969",
                "event_id": "evt-uberkikz",
                "event_name": "ÜBERKIKZ × OSCILLATE",
                "ticket_type": "EARLY BIRD",
                "ticket_price": 569,
                "payment_method": "cash",
                "buyer_name": "TEST BUYER",
                "buyer_email": "test@oscillate.test",
                "quantity": 1,
                "source": "pos"
            }
            
            response = requests.post(f"{self.api_url}/pos/issue-ticket", 
                                   json=ticket_data, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = ("id" in data and 
                          data.get("buyer_name") == "TEST BUYER" and
                          data.get("amount") == 569)
                self.log_test("POS Issue Ticket", success, f"Ticket ID: {data.get('id', 'N/A')}" if success else "Invalid response")
                return data if success else {}
            else:
                self.log_test("POS Issue Ticket", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("POS Issue Ticket", False, str(e))
            return {}

    def test_pos_door_data(self):
        """Test POS door data endpoint"""
        try:
            response = requests.get(f"{self.api_url}/pos/door-data", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                required_keys = ["tickets", "total", "checked_in", "pending", "ticket_revenue"]
                success = all(key in data for key in required_keys)
                self.log_test("POS Door Data", success, f"Total tickets: {data.get('total', 0)}, Revenue: ₹{data.get('ticket_revenue', 0)}" if success else "Missing required keys")
                return data if success else {}
            else:
                self.log_test("POS Door Data", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("POS Door Data", False, str(e))
            return {}

    def test_pos_cover_charge(self):
        """Test POS cover charge functionality"""
        try:
            cover_data = {
                "pin": "0052",
                "guest_name": "TEST GUEST",
                "amount": 500,
                "payment_method": "cash",
                "event_id": "evt-uberkikz"
            }
            
            response = requests.post(f"{self.api_url}/pos/cover-charge", 
                                   json=cover_data, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = ("id" in data and 
                          data.get("guest_name") == "TEST GUEST" and
                          data.get("amount") == 500)
                self.log_test("POS Cover Charge", success, f"Charge ID: {data.get('id', 'N/A')}" if success else "Invalid response")
                return data if success else {}
            else:
                self.log_test("POS Cover Charge", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("POS Cover Charge", False, str(e))
            return {}

    def test_pos_scan_ticket(self):
        """Test POS scan ticket functionality"""
        # First create a ticket to scan
        ticket_result = self.test_pos_issue_ticket()
        if not ticket_result or "id" not in ticket_result:
            self.log_test("POS Scan Ticket", False, "Could not create ticket for scanning")
            return
            
        try:
            scan_data = {
                "pin": "9969",
                "ticket_id": ticket_result["id"]
            }
            
            response = requests.post(f"{self.api_url}/pos/scan", 
                                   json=scan_data, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = (data.get("status") == "checked_in" and 
                          "ticket" in data)
                self.log_test("POS Scan Ticket", success, f"Status: {data.get('status', 'N/A')}" if success else "Invalid response")
            else:
                self.log_test("POS Scan Ticket", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POS Scan Ticket", False, str(e))

    def test_newsletter_signup(self):
        """Test newsletter signup"""
        try:
            test_email = f"test{datetime.now().strftime('%H%M%S')}@oscillate.test"
            response = requests.post(f"{self.api_url}/newsletter", 
                                   json={"email": test_email}, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = "message" in data and data.get("email") == test_email
                self.log_test("Newsletter Signup", success, f"Subscribed: {test_email}")
            else:
                self.log_test("Newsletter Signup", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Newsletter Signup", False, str(e))

    def test_newsletter_invalid_email(self):
        """Test newsletter signup with invalid email"""
        try:
            response = requests.post(f"{self.api_url}/newsletter", 
                                   json={"email": "invalid-email"}, 
                                   timeout=10)
            success = response.status_code == 422  # Validation error
            self.log_test("Newsletter Invalid Email", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Newsletter Invalid Email", False, str(e))

    def test_event_detail(self):
        """Test event detail endpoint"""
        try:
            response = requests.get(f"{self.api_url}/events/evt-uberkikz", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                required_keys = ["id", "title", "date", "venue", "city", "lineup", "tiers", "set_times"]
                success = all(key in data for key in required_keys)
                if success:
                    success = (data.get("id") == "evt-uberkikz" and 
                              data.get("title") == "ÜBERKIKZ × OSCILLATE" and
                              isinstance(data.get("tiers"), list) and len(data.get("tiers", [])) > 0)
                self.log_test("Event Detail", success, f"Event: {data.get('title', 'N/A')}" if success else "Missing required fields")
                return data if success else {}
            else:
                self.log_test("Event Detail", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("Event Detail", False, str(e))
            return {}

    def test_event_detail_not_found(self):
        """Test event detail with invalid event ID"""
        try:
            response = requests.get(f"{self.api_url}/events/invalid-event", timeout=10)
            success = response.status_code == 404
            self.log_test("Event Detail Not Found", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Event Detail Not Found", False, str(e))

    def test_stripe_checkout_create(self):
        """Test Stripe checkout creation"""
        try:
            checkout_data = {
                "event_id": "evt-uberkikz",
                "tier_name": "EARLY BIRD",
                "buyer_name": "Test Buyer",
                "buyer_email": "test@oscillate.test",
                "quantity": 1,
                "origin_url": "https://pos-system-96.preview.emergentagent.com"
            }
            
            response = requests.post(f"{self.api_url}/checkout/create", 
                                   json=checkout_data, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = "url" in data and "session_id" in data
                self.log_test("Stripe Checkout Create", success, f"Session ID: {data.get('session_id', 'N/A')[:20]}..." if success else "Missing required fields")
                return data if success else {}
            else:
                self.log_test("Stripe Checkout Create", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("Stripe Checkout Create", False, str(e))
            return {}

    def test_stripe_checkout_invalid_event(self):
        """Test Stripe checkout with invalid event ID"""
        try:
            checkout_data = {
                "event_id": "invalid-event",
                "tier_name": "EARLY BIRD",
                "buyer_name": "Test Buyer",
                "buyer_email": "test@oscillate.test",
                "quantity": 1,
                "origin_url": "https://pos-system-96.preview.emergentagent.com"
            }
            
            response = requests.post(f"{self.api_url}/checkout/create", 
                                   json=checkout_data, 
                                   timeout=10)
            success = response.status_code == 404
            self.log_test("Stripe Checkout Invalid Event", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Stripe Checkout Invalid Event", False, str(e))

    def test_stripe_checkout_invalid_tier(self):
        """Test Stripe checkout with invalid tier"""
        try:
            checkout_data = {
                "event_id": "evt-uberkikz",
                "tier_name": "INVALID TIER",
                "buyer_name": "Test Buyer",
                "buyer_email": "test@oscillate.test",
                "quantity": 1,
                "origin_url": "https://pos-system-96.preview.emergentagent.com"
            }
            
            response = requests.post(f"{self.api_url}/checkout/create", 
                                   json=checkout_data, 
                                   timeout=10)
            success = response.status_code == 400
            self.log_test("Stripe Checkout Invalid Tier", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Stripe Checkout Invalid Tier", False, str(e))

    def test_qr_code_generation(self):
        """Test QR code generation for tickets"""
        # First create a ticket
        ticket_result = self.test_pos_issue_ticket()
        if not ticket_result or "id" not in ticket_result:
            self.log_test("QR Code Generation", False, "Could not create ticket for QR testing")
            return
            
        try:
            ticket_id = ticket_result["id"]
            response = requests.get(f"{self.api_url}/ticket/{ticket_id}/qr", timeout=10)
            success = response.status_code == 200
            if success:
                # Check if response is a PNG image
                success = response.headers.get("content-type") == "image/png"
                if success:
                    # Verify it's a valid PNG by checking the header
                    png_header = b'\x89PNG\r\n\x1a\n'
                    success = response.content.startswith(png_header)
                self.log_test("QR Code Generation", success, f"Ticket ID: {ticket_id}" if success else "Invalid PNG format")
            else:
                self.log_test("QR Code Generation", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("QR Code Generation", False, str(e))

    def test_qr_code_not_found(self):
        """Test QR code endpoint with invalid ticket ID"""
        try:
            response = requests.get(f"{self.api_url}/ticket/INVALID-ID/qr", timeout=10)
            success = response.status_code == 404
            self.log_test("QR Code Not Found", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("QR Code Not Found", False, str(e))

    def test_admin_create_event(self):
        """Test admin event creation"""
        try:
            event_data = {
                "title": "TEST EVENT",
                "date": "SAT DEC 31, 2026",
                "date_iso": "2026-12-31",
                "venue": "TEST VENUE",
                "city": "BENGALURU",
                "genre": "TECHNO",
                "subgenre": "TEST",
                "price": "₹999",
                "lineup": ["TEST ARTIST"],
                "flyer_url": "",
                "ticket_url": "#",
                "is_featured": False,
                "tiers": [{"name": "STANDARD", "price": 999, "capacity": 100, "sold": 0}],
                "set_times": []
            }
            
            response = requests.post(f"{self.api_url}/admin/events?pin=9969", 
                                   json=event_data, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = "id" in data and data.get("title") == "TEST EVENT"
                self.log_test("Admin Create Event", success, f"Event ID: {data.get('id', 'N/A')}" if success else "Invalid response")
                return data if success else {}
            else:
                self.log_test("Admin Create Event", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("Admin Create Event", False, str(e))
            return {}

    def test_admin_create_artist(self):
        """Test admin artist creation"""
        try:
            artist_data = {
                "name": "TEST ARTIST",
                "role": "Guest",
                "bio": "Test artist bio",
                "genres": ["TECHNO", "TEST"],
                "order": 99
            }
            
            response = requests.post(f"{self.api_url}/admin/artists?pin=9969", 
                                   json=artist_data, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = "id" in data and data.get("name") == "TEST ARTIST"
                self.log_test("Admin Create Artist", success, f"Artist ID: {data.get('id', 'N/A')}" if success else "Invalid response")
                return data if success else {}
            else:
                self.log_test("Admin Create Artist", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("Admin Create Artist", False, str(e))
            return {}

    def test_admin_delete_event(self):
        """Test admin event deletion"""
        # First create an event to delete
        event_result = self.test_admin_create_event()
        if not event_result or "id" not in event_result:
            self.log_test("Admin Delete Event", False, "Could not create event for deletion test")
            return
            
        try:
            event_id = event_result["id"]
            response = requests.delete(f"{self.api_url}/admin/events/{event_id}?pin=9969", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = data.get("deleted") == True
                self.log_test("Admin Delete Event", success, f"Event ID: {event_id}" if success else "Invalid response")
            else:
                self.log_test("Admin Delete Event", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Admin Delete Event", False, str(e))

    def test_admin_unauthorized(self):
        """Test admin endpoints with wrong PIN"""
        try:
            event_data = {
                "title": "UNAUTHORIZED TEST",
                "date": "SAT DEC 31, 2026",
                "date_iso": "2026-12-31",
                "venue": "TEST VENUE",
                "city": "BENGALURU"
            }
            
            response = requests.post(f"{self.api_url}/admin/events?pin=0000", 
                                   json=event_data, 
                                   timeout=10)
            success = response.status_code == 401
            self.log_test("Admin Unauthorized", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Admin Unauthorized", False, str(e))

    def test_ticket_qr_field(self):
        """Test that issued tickets have qr_code field"""
        ticket_result = self.test_pos_issue_ticket()
        if not ticket_result:
            self.log_test("Ticket QR Field", False, "Could not create ticket for QR field test")
            return
            
        try:
            success = "qr_code" in ticket_result and ticket_result["qr_code"]
            if success:
                # Verify it's a valid base64 string
                try:
                    base64.b64decode(ticket_result["qr_code"])
                    success = True
                except:
                    success = False
            self.log_test("Ticket QR Field", success, f"QR code present: {bool(ticket_result.get('qr_code'))}")
        except Exception as e:
            self.log_test("Ticket QR Field", False, str(e))

    def test_merch_checkout_create(self):
        """Test merch checkout creation"""
        try:
            checkout_data = {
                "items": [
                    {"id": "tee-001", "size": "M", "qty": 1},
                    {"id": "hood-001", "size": "L", "qty": 2}
                ],
                "buyer_name": "Test Buyer",
                "buyer_email": "test@oscillate.test",
                "origin_url": "https://pos-system-96.preview.emergentagent.com"
            }
            
            response = requests.post(f"{self.api_url}/merch/checkout", 
                                   json=checkout_data, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = "url" in data and "session_id" in data
                self.log_test("Merch Checkout Create", success, f"Session ID: {data.get('session_id', 'N/A')[:20]}..." if success else "Missing required fields")
                return data if success else {}
            else:
                self.log_test("Merch Checkout Create", False, f"Status: {response.status_code}")
                return {}
        except Exception as e:
            self.log_test("Merch Checkout Create", False, str(e))
            return {}

    def test_merch_checkout_invalid_item(self):
        """Test merch checkout with invalid item ID"""
        try:
            checkout_data = {
                "items": [{"id": "invalid-item", "size": "M", "qty": 1}],
                "buyer_name": "Test Buyer",
                "buyer_email": "test@oscillate.test",
                "origin_url": "https://pos-system-96.preview.emergentagent.com"
            }
            
            response = requests.post(f"{self.api_url}/merch/checkout", 
                                   json=checkout_data, 
                                   timeout=10)
            success = response.status_code == 400
            self.log_test("Merch Checkout Invalid Item", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Merch Checkout Invalid Item", False, str(e))

    def run_all_tests(self):
        """Run all backend tests"""
        print("🎵 OSCILLATE Backend API Testing - Iteration 5 FINAL")
        print("=" * 60)
        
        # Basic API tests
        print("\n📡 Basic API Tests:")
        self.test_api_root()
        
        # Landing page data tests
        print("\n🏠 Landing Page Data Tests:")
        events = self.test_events_endpoint()
        self.test_events_featured()
        artists = self.test_artists_endpoint()
        gallery = self.test_gallery_endpoint()
        stats = self.test_stats_endpoint()
        
        # Event detail tests (NEW)
        print("\n📄 Event Detail Tests:")
        self.test_event_detail()
        self.test_event_detail_not_found()
        
        # Merch tests
        print("\n🛍️ Merch Section Tests:")
        merch = self.test_merch_endpoint()
        self.test_merch_category_filter()
        
        # Merch checkout tests (NEW for Iteration 4)
        print("\n🛒 Merch Checkout Tests:")
        self.test_merch_checkout_create()
        self.test_merch_checkout_invalid_item()
        
        # Stripe checkout tests (NEW)
        print("\n💳 Stripe Checkout Tests:")
        self.test_stripe_checkout_create()
        self.test_stripe_checkout_invalid_event()
        self.test_stripe_checkout_invalid_tier()
        
        # QR code tests (NEW)
        print("\n📱 QR Code Tests:")
        self.test_qr_code_generation()
        self.test_qr_code_not_found()
        self.test_ticket_qr_field()
        
        # Admin CRUD tests (NEW)
        print("\n👑 Admin CRUD Tests:")
        self.test_admin_create_event()
        self.test_admin_create_artist()
        self.test_admin_delete_event()
        self.test_admin_unauthorized()
        
        # POS authentication tests
        print("\n🔐 POS Authentication Tests:")
        self.test_pos_auth_god()
        self.test_pos_auth_master()
        self.test_pos_auth_s1()
        self.test_pos_auth_s2()
        self.test_pos_auth_invalid()
        
        # Analytics tests (NEW for Iteration 5)
        print("\n📊 Analytics Tests:")
        self.test_analytics_endpoint()
        self.test_analytics_unauthorized()
        
        # Search tests (NEW for Iteration 5)
        print("\n🔍 Search Tests:")
        self.test_search_endpoint()
        self.test_search_empty_query()
        
        # WhatsApp integration tests (NEW for Iteration 5)
        print("\n📱 WhatsApp Integration Tests:")
        self.test_whatsapp_ticket_link()
        self.test_whatsapp_ticket_no_phone()
        
        # Event interaction tests (NEW for Iteration 5)
        print("\n❤️ Event Interaction Tests:")
        self.test_event_interested()
        
        # Security tests (NEW for Iteration 5)
        print("\n🔒 Security Tests:")
        self.test_security_headers()
        
        # POS functionality tests
        print("\n💻 POS Functionality Tests:")
        self.test_pos_issue_ticket()
        door_data = self.test_pos_door_data()
        self.test_pos_cover_charge()
        self.test_pos_scan_ticket()
        
        # Newsletter tests (with validation)
        print("\n📧 Newsletter Tests:")
        self.test_newsletter_signup()
        self.test_newsletter_invalid_email()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['error']}")
        
        # Data validation summary
        print(f"\n📋 Data Summary:")
        print(f"  - Events: {len(events) if isinstance(events, list) else 0}")
        print(f"  - Artists: {len(artists) if isinstance(artists, list) else 0}")
        print(f"  - Gallery Images: {len(gallery) if isinstance(gallery, list) else 0}")
        print(f"  - Merch Items: {len(merch) if isinstance(merch, list) else 0}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = OSCILLATEAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())