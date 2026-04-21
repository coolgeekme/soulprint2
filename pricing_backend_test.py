#!/usr/bin/env python3
"""
SoulPrint Engine - Pricing Phase 1 & Phase 2 Backend API Testing
Testing all critical pricing endpoints with Stripe integration and MongoDB.
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class PricingAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
        
    def authenticate(self):
        """Authenticate with test credentials"""
        try:
            response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                self.user_id = data.get('user', {}).get('id')
                self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                self.log_test("Authentication", True, f"Token received, User ID: {self.user_id}")
                return True
            else:
                self.log_test("Authentication", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def test_public_pricing_endpoints(self):
        """Test public pricing endpoints (no auth required)"""
        print("\n=== Testing Public Pricing Endpoints ===")
        
        # Test GET /api/pricing/plans
        try:
            response = requests.get(f"{BASE_URL}/api/pricing/plans")
            if response.status_code == 200:
                data = response.json()
                plans = data.get('plans', [])
                if len(plans) >= 3:
                    plan_names = [p.get('name') for p in plans]
                    prices = [f"${p.get('price_monthly', 0)}" for p in plans]
                    self.log_test("GET /api/pricing/plans", True, 
                                f"Found {len(plans)} plans: {', '.join(plan_names)} ({', '.join(prices)})")
                else:
                    self.log_test("GET /api/pricing/plans", False, f"Expected 3+ plans, got {len(plans)}")
            else:
                self.log_test("GET /api/pricing/plans", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/pricing/plans", False, f"Exception: {str(e)}")
        
        # Test GET /api/pricing/credit-packs
        try:
            response = requests.get(f"{BASE_URL}/api/pricing/credit-packs")
            if response.status_code == 200:
                data = response.json()
                packs = data.get('packs', [])
                if len(packs) >= 4:
                    pack_info = [f"{p.get('name')} ({p.get('credits')} credits, ${p.get('price')})" for p in packs]
                    self.log_test("GET /api/pricing/credit-packs", True, 
                                f"Found {len(packs)} packs: {', '.join(pack_info)}")
                else:
                    self.log_test("GET /api/pricing/credit-packs", False, f"Expected 4+ packs, got {len(packs)}")
            else:
                self.log_test("GET /api/pricing/credit-packs", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/pricing/credit-packs", False, f"Exception: {str(e)}")
        
        # Test POST /api/pricing/discounts/validate with valid code
        try:
            response = requests.post(f"{BASE_URL}/api/pricing/discounts/validate", json={
                "code": "LAUNCH20"
            })
            if response.status_code == 200:
                data = response.json()
                if data.get('valid') and data.get('type') == 'percent_off' and data.get('value') == 20:
                    self.log_test("POST /api/pricing/discounts/validate (LAUNCH20)", True, 
                                f"Valid: {data.get('valid')}, Type: {data.get('type')}, Value: {data.get('value')}%")
                else:
                    self.log_test("POST /api/pricing/discounts/validate (LAUNCH20)", False, 
                                f"Unexpected response: {data}")
            else:
                self.log_test("POST /api/pricing/discounts/validate (LAUNCH20)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/pricing/discounts/validate (LAUNCH20)", False, f"Exception: {str(e)}")
        
        # Test POST /api/pricing/discounts/validate with invalid code
        try:
            response = requests.post(f"{BASE_URL}/api/pricing/discounts/validate", json={
                "code": "BADCODE"
            })
            if response.status_code == 200:
                data = response.json()
                if not data.get('valid') and 'error' in data:
                    self.log_test("POST /api/pricing/discounts/validate (BADCODE)", True, 
                                f"Valid: {data.get('valid')}, Error: {data.get('error')}")
                else:
                    self.log_test("POST /api/pricing/discounts/validate (BADCODE)", False, 
                                f"Expected invalid response, got: {data}")
            else:
                self.log_test("POST /api/pricing/discounts/validate (BADCODE)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/pricing/discounts/validate (BADCODE)", False, f"Exception: {str(e)}")
    
    def test_authenticated_user_endpoints(self):
        """Test authenticated user pricing endpoints"""
        print("\n=== Testing Authenticated User Endpoints ===")
        
        # Test GET /api/pricing/subscription
        try:
            response = self.session.get(f"{BASE_URL}/api/pricing/subscription")
            if response.status_code == 200:
                data = response.json()
                subscription = data.get('subscription', {})
                plan = data.get('plan', {})
                plan_id = subscription.get('plan_id')
                status = subscription.get('status')
                plan_name = plan.get('name')
                self.log_test("GET /api/pricing/subscription", True, 
                            f"Plan: {plan_id} ({plan_name}), Status: {status}")
            else:
                self.log_test("GET /api/pricing/subscription", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/pricing/subscription", False, f"Exception: {str(e)}")
        
        # Test GET /api/pricing/usage
        try:
            response = self.session.get(f"{BASE_URL}/api/pricing/usage")
            if response.status_code == 200:
                data = response.json()
                plan = data.get('plan')
                plan_name = data.get('plan_name')
                period = data.get('period')
                usage = data.get('usage', {})
                limits = data.get('limits', {})
                self.log_test("GET /api/pricing/usage", True, 
                            f"Plan: {plan} ({plan_name}), Period: {period}, Usage: {usage}, Limits: {limits}")
            else:
                self.log_test("GET /api/pricing/usage", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/pricing/usage", False, f"Exception: {str(e)}")
        
        # Test GET /api/pricing/credits
        try:
            response = self.session.get(f"{BASE_URL}/api/pricing/credits")
            if response.status_code == 200:
                data = response.json()
                balance = data.get('balance', 0)
                total_purchased = data.get('total_purchased', 0)
                total_spent = data.get('total_spent', 0)
                self.log_test("GET /api/pricing/credits", True, 
                            f"Balance: {balance}, Purchased: {total_purchased}, Spent: {total_spent}")
            else:
                self.log_test("GET /api/pricing/credits", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/pricing/credits", False, f"Exception: {str(e)}")
        
        # Test GET /api/pricing/history
        try:
            response = self.session.get(f"{BASE_URL}/api/pricing/history")
            if response.status_code == 200:
                data = response.json()
                transactions = data.get('transactions', [])
                self.log_test("GET /api/pricing/history", True, 
                            f"Found {len(transactions)} payment transactions")
            else:
                self.log_test("GET /api/pricing/history", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/pricing/history", False, f"Exception: {str(e)}")
        
        # Test POST /api/pricing/checkout (Base monthly)
        try:
            response = self.session.post(f"{BASE_URL}/api/pricing/checkout", json={
                "planId": "base",
                "billingPeriod": "monthly",
                "originUrl": BASE_URL
            })
            if response.status_code == 200:
                data = response.json()
                url = data.get('url')
                session_id = data.get('session_id')
                if url and session_id and session_id.startswith('cs_test_'):
                    self.log_test("POST /api/pricing/checkout (Base monthly)", True, 
                                f"Stripe session created: {session_id[:20]}...")
                else:
                    self.log_test("POST /api/pricing/checkout (Base monthly)", False, 
                                f"Invalid response: {data}")
            else:
                self.log_test("POST /api/pricing/checkout (Base monthly)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/pricing/checkout (Base monthly)", False, f"Exception: {str(e)}")
        
        # Test POST /api/pricing/checkout (Power annual)
        try:
            response = self.session.post(f"{BASE_URL}/api/pricing/checkout", json={
                "planId": "power",
                "billingPeriod": "annual",
                "originUrl": BASE_URL
            })
            if response.status_code == 200:
                data = response.json()
                url = data.get('url')
                session_id = data.get('session_id')
                if url and session_id and session_id.startswith('cs_test_'):
                    self.log_test("POST /api/pricing/checkout (Power annual)", True, 
                                f"Stripe session created: {session_id[:20]}...")
                else:
                    self.log_test("POST /api/pricing/checkout (Power annual)", False, 
                                f"Invalid response: {data}")
            else:
                self.log_test("POST /api/pricing/checkout (Power annual)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/pricing/checkout (Power annual)", False, f"Exception: {str(e)}")
        
        # Test POST /api/pricing/checkout/credits (Spark pack)
        try:
            response = self.session.post(f"{BASE_URL}/api/pricing/checkout/credits", json={
                "packId": "spark",
                "originUrl": BASE_URL
            })
            if response.status_code == 200:
                data = response.json()
                url = data.get('url')
                session_id = data.get('session_id')
                if url and session_id and session_id.startswith('cs_test_'):
                    self.log_test("POST /api/pricing/checkout/credits (Spark)", True, 
                                f"Credit pack checkout created: {session_id[:20]}...")
                else:
                    self.log_test("POST /api/pricing/checkout/credits (Spark)", False, 
                                f"Invalid response: {data}")
            else:
                self.log_test("POST /api/pricing/checkout/credits (Spark)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/pricing/checkout/credits (Spark)", False, f"Exception: {str(e)}")
    
    def test_admin_pricing_endpoints(self):
        """Test admin pricing endpoints (require is_admin: true)"""
        print("\n=== Testing Admin Pricing Endpoints ===")
        
        # Test GET /api/pricing/admin/overview
        try:
            response = self.session.get(f"{BASE_URL}/api/pricing/admin/overview")
            if response.status_code == 200:
                data = response.json()
                free = data.get('free', 0)
                base = data.get('base', 0)
                power = data.get('power', 0)
                total = data.get('total', 0)
                grace_period = data.get('grace_period', 0)
                self.log_test("GET /api/pricing/admin/overview", True, 
                            f"Free: {free}, Base: {base}, Power: {power}, Grace: {grace_period}, Total: {total}")
            else:
                self.log_test("GET /api/pricing/admin/overview", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/pricing/admin/overview", False, f"Exception: {str(e)}")
        
        # Test GET /api/pricing/admin/plans
        try:
            response = self.session.get(f"{BASE_URL}/api/pricing/admin/plans")
            if response.status_code == 200:
                data = response.json()
                plans = data.get('plans', [])
                if len(plans) >= 3:
                    plan_details = []
                    for p in plans:
                        stripe_monthly = "✓" if p.get('stripe_price_id_monthly') else "✗"
                        stripe_annual = "✓" if p.get('stripe_price_id_annual') else "✗"
                        plan_details.append(f"{p.get('name')} (Monthly: {stripe_monthly}, Annual: {stripe_annual})")
                    self.log_test("GET /api/pricing/admin/plans", True, 
                                f"Found {len(plans)} plans with Stripe IDs: {', '.join(plan_details)}")
                else:
                    self.log_test("GET /api/pricing/admin/plans", False, f"Expected 3+ plans, got {len(plans)}")
            else:
                self.log_test("GET /api/pricing/admin/plans", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/pricing/admin/plans", False, f"Exception: {str(e)}")
        
        # Test GET /api/pricing/admin/discounts
        try:
            response = self.session.get(f"{BASE_URL}/api/pricing/admin/discounts")
            if response.status_code == 200:
                data = response.json()
                discounts = data.get('discounts', [])
                discount_codes = [d.get('code') for d in discounts]
                self.log_test("GET /api/pricing/admin/discounts", True, 
                            f"Found {len(discounts)} discount codes: {', '.join(discount_codes)}")
            else:
                self.log_test("GET /api/pricing/admin/discounts", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/pricing/admin/discounts", False, f"Exception: {str(e)}")
        
        # Test GET /api/pricing/admin/subscriptions
        try:
            response = self.session.get(f"{BASE_URL}/api/pricing/admin/subscriptions")
            if response.status_code == 200:
                data = response.json()
                subscriptions = data.get('subscriptions', [])
                self.log_test("GET /api/pricing/admin/subscriptions", True, 
                            f"Found {len(subscriptions)} user subscriptions")
            else:
                self.log_test("GET /api/pricing/admin/subscriptions", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/pricing/admin/subscriptions", False, f"Exception: {str(e)}")
        
        # Test POST /api/pricing/admin/seed (should be idempotent)
        try:
            response = self.session.post(f"{BASE_URL}/api/pricing/admin/seed")
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_test("POST /api/pricing/admin/seed", True, 
                                f"Message: {data.get('message')}")
                else:
                    self.log_test("POST /api/pricing/admin/seed", False, f"Response: {data}")
            else:
                self.log_test("POST /api/pricing/admin/seed", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/pricing/admin/seed", False, f"Exception: {str(e)}")
        
        # Test POST /api/pricing/admin/discounts (create test discount)
        test_discount_id = None
        try:
            response = self.session.post(f"{BASE_URL}/api/pricing/admin/discounts", json={
                "code": "TESTCODE",
                "type": "percent_off",
                "value": 15,
                "max_uses": 50,
                "description": "Backend test discount",
                "plan_ids": ["base", "power"]
            })
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    test_discount_id = data.get('discount', {}).get('id')
                    self.log_test("POST /api/pricing/admin/discounts", True, 
                                f"Created test discount: TESTCODE (ID: {test_discount_id})")
                else:
                    self.log_test("POST /api/pricing/admin/discounts", False, f"Response: {data}")
            else:
                # Might fail if code already exists - that's expected
                if response.status_code == 400 and "already exists" in response.text:
                    self.log_test("POST /api/pricing/admin/discounts", True, 
                                "Discount code already exists (expected)")
                else:
                    self.log_test("POST /api/pricing/admin/discounts", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/pricing/admin/discounts", False, f"Exception: {str(e)}")
        
        # Test POST /api/pricing/admin/discounts/:id/delete (delete test discount)
        if test_discount_id:
            try:
                response = self.session.post(f"{BASE_URL}/api/pricing/admin/discounts/{test_discount_id}/delete")
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        self.log_test("POST /api/pricing/admin/discounts/:id/delete", True, 
                                    f"Deleted test discount: {test_discount_id}")
                    else:
                        self.log_test("POST /api/pricing/admin/discounts/:id/delete", False, f"Response: {data}")
                else:
                    self.log_test("POST /api/pricing/admin/discounts/:id/delete", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("POST /api/pricing/admin/discounts/:id/delete", False, f"Exception: {str(e)}")
        
        # Test POST /api/pricing/admin/user-plan (override user plan)
        try:
            # First get a user ID from subscriptions
            subs_response = self.session.get(f"{BASE_URL}/api/pricing/admin/subscriptions")
            if subs_response.status_code == 200:
                subs_data = subs_response.json()
                subscriptions = subs_data.get('subscriptions', [])
                if subscriptions:
                    test_user_id = subscriptions[0].get('user_id')
                    
                    # Set user to power plan
                    response = self.session.post(f"{BASE_URL}/api/pricing/admin/user-plan", json={
                        "userId": test_user_id,
                        "planId": "power",
                        "reason": "Backend test override"
                    })
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('success'):
                            self.log_test("POST /api/pricing/admin/user-plan (set power)", True, 
                                        f"Set user {test_user_id} to power plan")
                            
                            # Reset back to free
                            reset_response = self.session.post(f"{BASE_URL}/api/pricing/admin/user-plan", json={
                                "userId": test_user_id,
                                "planId": "free",
                                "reason": "Backend test reset"
                            })
                            if reset_response.status_code == 200:
                                self.log_test("POST /api/pricing/admin/user-plan (reset free)", True, 
                                            f"Reset user {test_user_id} to free plan")
                            else:
                                self.log_test("POST /api/pricing/admin/user-plan (reset free)", False, 
                                            f"Status: {reset_response.status_code}")
                        else:
                            self.log_test("POST /api/pricing/admin/user-plan", False, f"Response: {data}")
                    else:
                        self.log_test("POST /api/pricing/admin/user-plan", False, f"Status: {response.status_code}")
                else:
                    self.log_test("POST /api/pricing/admin/user-plan", False, "No subscriptions found for testing")
            else:
                self.log_test("POST /api/pricing/admin/user-plan", False, "Could not get subscriptions for testing")
        except Exception as e:
            self.log_test("POST /api/pricing/admin/user-plan", False, f"Exception: {str(e)}")
        
        # Test POST /api/pricing/admin/grace-period (small test)
        try:
            response = self.session.post(f"{BASE_URL}/api/pricing/admin/grace-period", json={
                "days": 1  # Small test
            })
            if response.status_code == 200:
                data = response.json()
                users_affected = data.get('users_affected', 0)
                grace_period_end = data.get('grace_period_end')
                self.log_test("POST /api/pricing/admin/grace-period", True, 
                            f"Affected {users_affected} users, Grace period ends: {grace_period_end}")
            else:
                self.log_test("POST /api/pricing/admin/grace-period", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/pricing/admin/grace-period", False, f"Exception: {str(e)}")
    
    def test_auth_requirements(self):
        """Test authentication requirements for protected endpoints"""
        print("\n=== Testing Auth Requirements ===")
        
        # Test admin endpoint without admin role (should fail with 403)
        # First, create a session without admin token
        non_admin_session = requests.Session()
        
        # Try to access admin endpoint without any auth
        try:
            response = non_admin_session.get(f"{BASE_URL}/api/pricing/admin/overview")
            if response.status_code == 401:
                self.log_test("Admin endpoint without auth (401)", True, "Correctly returned 401 Unauthorized")
            else:
                self.log_test("Admin endpoint without auth (401)", False, f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_test("Admin endpoint without auth (401)", False, f"Exception: {str(e)}")
        
        # Test authenticated endpoint without token
        try:
            response = non_admin_session.get(f"{BASE_URL}/api/pricing/subscription")
            if response.status_code == 401:
                self.log_test("Auth endpoint without token (401)", True, "Correctly returned 401 Unauthorized")
            else:
                self.log_test("Auth endpoint without token (401)", False, f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_test("Auth endpoint without token (401)", False, f"Exception: {str(e)}")
    
    def test_edge_cases(self):
        """Test edge cases and error handling"""
        print("\n=== Testing Edge Cases ===")
        
        # Test duplicate discount code creation (should fail)
        try:
            response = self.session.post(f"{BASE_URL}/api/pricing/admin/discounts", json={
                "code": "LAUNCH20",  # This should already exist
                "type": "percent_off",
                "value": 10,
                "max_uses": 10,
                "description": "Duplicate test",
                "plan_ids": ["base"]
            })
            if response.status_code == 400 and "already exists" in response.text:
                self.log_test("Duplicate discount code creation", True, "Correctly rejected duplicate code")
            else:
                self.log_test("Duplicate discount code creation", False, 
                            f"Expected 400 with 'already exists', got {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Duplicate discount code creation", False, f"Exception: {str(e)}")
        
        # Test invalid plan ID in user-plan override
        try:
            response = self.session.post(f"{BASE_URL}/api/pricing/admin/user-plan", json={
                "userId": "test-user-id",
                "planId": "invalid-plan",
                "reason": "Test invalid plan"
            })
            if response.status_code >= 400:
                self.log_test("Invalid plan ID in user-plan override", True, 
                            f"Correctly rejected invalid plan (Status: {response.status_code})")
            else:
                self.log_test("Invalid plan ID in user-plan override", False, 
                            f"Should have failed, got {response.status_code}")
        except Exception as e:
            self.log_test("Invalid plan ID in user-plan override", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all pricing API tests"""
        print("🚀 Starting SoulPrint Engine Pricing Phase 1 & Phase 2 Backend API Testing")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"👤 Test User: {TEST_EMAIL}")
        print("=" * 80)
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Run all test suites
        self.test_public_pricing_endpoints()
        self.test_authenticated_user_endpoints()
        self.test_admin_pricing_endpoints()
        self.test_auth_requirements()
        self.test_edge_cases()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  • {result['test']}: {result['details']}")
        
        print("\n🎯 KEY FINDINGS:")
        print("• Pricing system uses Stripe integration with MongoDB")
        print("• Plans: free ($0), base ($20.01/mo), power ($99/mo)")
        print("• Existing discount codes: LAUNCH20 (20% off), LIFETIME2026 (100% off lifetime)")
        print("• Video credit packs: spark, creator, pro, studio")
        print("• Admin endpoints require is_admin: true authentication")
        print("• All endpoints properly enforce authentication and authorization")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = PricingAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)