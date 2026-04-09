#!/usr/bin/env python3
"""
OSCILLATE Customer Cleanup Validation Test - Iteration 6
Focused testing for customer-ready cleanup requirements
"""

import requests
import sys
import json
from datetime import datetime

class CleanupValidationTester:
    def __init__(self, base_url="https://pos-system-96.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.issues = []

    def test(self, name, condition, details=""):
        """Test a condition and log result"""
        self.tests_run += 1
        if condition:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.issues.append(f"{name}: {details}")

    def get_json(self, endpoint):
        """Get JSON data from endpoint"""
        try:
            response = requests.get(f"{self.api_url}/{endpoint}", timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"⚠️  {endpoint} returned {response.status_code}")
                return None
        except Exception as e:
            print(f"⚠️  {endpoint} error: {e}")
            return None

    def validate_cleanup(self):
        """Validate customer cleanup requirements"""
        print("🧹 OSCILLATE Customer Cleanup Validation")
        print("=" * 50)
        
        # Test 1: Only 2 events should remain
        print("\n📅 Event Cleanup Validation:")
        events = self.get_json("events")
        if events is not None:
            self.test("Events API accessible", True)
            self.test("Only 2 events remain", len(events) == 2, f"Found {len(events)} events")
            
            if len(events) == 2:
                titles = [e.get('title', '') for e in events]
                self.test("FUTURE.666 event present", 'CHAPTER IV — FUTURE.666' in titles)
                self.test("ÜBERKIKZ event present", 'ÜBERKIKZ × OSCILLATE' in titles)
                
                # Check past/upcoming status
                future666 = next((e for e in events if 'FUTURE.666' in e.get('title', '')), None)
                uberkikz = next((e for e in events if 'ÜBERKIKZ' in e.get('title', '')), None)
                
                if future666:
                    self.test("FUTURE.666 marked as past", future666.get('is_past', False))
                if uberkikz:
                    self.test("ÜBERKIKZ has flyer image", bool(uberkikz.get('flyer_url')))
                    self.test("ÜBERKIKZ not marked as past", not uberkikz.get('is_past', False))
        else:
            self.test("Events API accessible", False, "API call failed")
        
        # Test 2: Merch section should be empty
        print("\n🛍️  Merch Section Cleanup:")
        merch = self.get_json("merch")
        if merch is not None:
            self.test("Merch API accessible", True)
            self.test("Merch section empty", len(merch) == 0, f"Found {len(merch)} merch items")
        else:
            self.test("Merch API accessible", False, "API call failed")
        
        # Test 3: Core functionality still works
        print("\n⚙️  Core Functionality Check:")
        
        # Artists should still be 10
        artists = self.get_json("artists")
        if artists:
            self.test("10 artists present", len(artists) == 10, f"Found {len(artists)} artists")
        
        # Gallery should still be 12 images
        gallery = self.get_json("gallery")
        if gallery:
            self.test("12 gallery images present", len(gallery) == 12, f"Found {len(gallery)} images")
        
        # Stats endpoint
        stats = self.get_json("stats")
        self.test("Stats API accessible", stats is not None)
        
        # Featured event
        featured = self.get_json("events/featured/next")
        self.test("Featured event API accessible", featured is not None)
        
        # Test 4: POS system still works
        print("\n💳 POS System Check:")
        try:
            # Test POS auth
            auth_response = requests.post(f"{self.api_url}/pos/auth", 
                                        json={"pin": "1812"}, timeout=10)
            self.test("GOD PIN authentication", auth_response.status_code == 200)
            
            auth_response = requests.post(f"{self.api_url}/pos/auth", 
                                        json={"pin": "9969"}, timeout=10)
            self.test("Master PIN authentication", auth_response.status_code == 200)
            
            auth_response = requests.post(f"{self.api_url}/pos/auth", 
                                        json={"pin": "0051"}, timeout=10)
            self.test("S1 PIN authentication", auth_response.status_code == 200)
            
            auth_response = requests.post(f"{self.api_url}/pos/auth", 
                                        json={"pin": "0052"}, timeout=10)
            self.test("S2 PIN authentication", auth_response.status_code == 200)
            
        except Exception as e:
            self.test("POS authentication", False, str(e))
        
        # Test 5: Stripe checkout still works
        print("\n💰 Stripe Checkout Check:")
        try:
            checkout_data = {
                "event_id": "evt-uberkikz",
                "tier_name": "EARLY BIRD",
                "buyer_name": "Test User",
                "buyer_email": "test@example.com",
                "quantity": 1,
                "origin_url": self.base_url
            }
            checkout_response = requests.post(f"{self.api_url}/checkout/create", 
                                            json=checkout_data, timeout=10)
            self.test("Stripe checkout creation", checkout_response.status_code == 200)
            
            if checkout_response.status_code == 200:
                data = checkout_response.json()
                self.test("Checkout URL generated", bool(data.get('url')))
                
        except Exception as e:
            self.test("Stripe checkout", False, str(e))
        
        # Test 6: Search still works
        print("\n🔍 Search Functionality:")
        search_result = self.get_json("search?q=ÜBERKIKZ")
        self.test("Search API accessible", search_result is not None)
        
        # Test 7: Newsletter still works
        print("\n📧 Newsletter Signup:")
        try:
            test_email = f"test_{datetime.now().strftime('%H%M%S')}@example.com"
            newsletter_response = requests.post(f"{self.api_url}/newsletter", 
                                              json={"email": test_email}, timeout=10)
            self.test("Newsletter signup", newsletter_response.status_code == 200)
        except Exception as e:
            self.test("Newsletter signup", False, str(e))

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print(f"📊 CLEANUP VALIDATION SUMMARY")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.issues:
            print(f"\n❌ ISSUES FOUND:")
            for issue in self.issues:
                print(f"   • {issue}")
            return False
        else:
            print(f"\n✅ ALL CLEANUP REQUIREMENTS VALIDATED")
            return True

def main():
    tester = CleanupValidationTester()
    tester.validate_cleanup()
    success = tester.print_summary()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())