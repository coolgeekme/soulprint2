#!/usr/bin/env python3
"""
PHASE 5 PART 4 ADD-ON PURCHASE ENDPOINTS TESTING
Testing the newly wired message pack purchase endpoints for SoulPrint Engine.

Test Sequence:
1. GET /api/pricing/message-packs (NO AUTH) - should return 3 packs
2. POST /api/pricing/checkout/message-pack (AUTH) - should create Stripe checkout
3. GET /api/pricing/enforcement/usage (AUTH) - should return usage with premium_messages_balance
4. Verify existing endpoints still work
"""

import requests
import json
import sys
import time
from datetime import datetime

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
ADMIN_EMAIL = "test@soulprint.com"
ADMIN_PASSCODE = "test123"
USER_EMAIL = "testchat@example.com"
USER_PASSCODE = "Test123456"

class TestRunner:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'SoulPrint-Test/1.0'
        })
        self.admin_token = None
        self.user_token = None
        self.test_results = []
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_result(self, test_name, success, details=""):
        result = "✅ PASS" if success else "❌ FAIL"
        self.log(f"{result} - {test_name}")
        if details:
            self.log(f"    Details: {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        return success
        
    def login_user(self, email, passcode, user_type="user"):
        """Login and get JWT token"""
        try:
            response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "passcode": passcode  # Note: using 'passcode' field as specified
            })
            
            if response.status_code == 200:
                data = response.json()
                token = data.get('token')
                if token:
                    self.log(f"✅ {user_type.title()} login successful: {email}")
                    return token
                else:
                    self.log(f"❌ {user_type.title()} login failed - no token in response")
                    return None
            else:
                self.log(f"❌ {user_type.title()} login failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.log(f"❌ {user_type.title()} login error: {str(e)}")
            return None
    
    def test_health_check(self):
        """Test basic health endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/api/health")
            success = response.status_code == 200 and response.json().get('status') == 'ok'
            return self.test_result(
                "Health Check", 
                success,
                f"Status: {response.status_code}, Response: {response.json() if success else response.text}"
            )
        except Exception as e:
            return self.test_result("Health Check", False, f"Exception: {str(e)}")
    
    def test_message_packs_public(self):
        """Test GET /api/pricing/message-packs (NO AUTH REQUIRED)"""
        try:
            response = self.session.get(f"{BASE_URL}/api/pricing/message-packs")
            
            if response.status_code == 200:
                data = response.json()
                packs = data.get('packs', [])
                
                # Check if we have 3 packs
                if len(packs) != 3:
                    return self.test_result(
                        "Message Packs Public Endpoint", 
                        False,
                        f"Expected 3 packs, got {len(packs)}"
                    )
                
                # Check for expected pack IDs
                expected_ids = ['msg-25', 'msg-50', 'msg-100']
                actual_ids = [pack.get('id') for pack in packs]
                
                missing_ids = [id for id in expected_ids if id not in actual_ids]
                if missing_ids:
                    return self.test_result(
                        "Message Packs Public Endpoint", 
                        False,
                        f"Missing pack IDs: {missing_ids}. Got: {actual_ids}"
                    )
                
                # Check pack structure
                for pack in packs:
                    required_fields = ['id', 'name', 'messages', 'price']
                    missing_fields = [field for field in required_fields if field not in pack]
                    if missing_fields:
                        return self.test_result(
                            "Message Packs Public Endpoint", 
                            False,
                            f"Pack {pack.get('id')} missing fields: {missing_fields}"
                        )
                
                return self.test_result(
                    "Message Packs Public Endpoint", 
                    True,
                    f"Found {len(packs)} packs with IDs: {actual_ids}"
                )
            else:
                return self.test_result(
                    "Message Packs Public Endpoint", 
                    False,
                    f"Status: {response.status_code}, Response: {response.text}"
                )
                
        except Exception as e:
            return self.test_result("Message Packs Public Endpoint", False, f"Exception: {str(e)}")
    
    def test_message_pack_checkout_auth_required(self):
        """Test POST /api/pricing/checkout/message-pack without auth (should get 401)"""
        try:
            response = self.session.post(f"{BASE_URL}/api/pricing/checkout/message-pack", json={
                "packId": "msg-50",
                "originUrl": BASE_URL
            })
            
            success = response.status_code == 401
            return self.test_result(
                "Message Pack Checkout - Auth Required", 
                success,
                f"Status: {response.status_code} (expected 401)"
            )
                
        except Exception as e:
            return self.test_result("Message Pack Checkout - Auth Required", False, f"Exception: {str(e)}")
    
    def test_message_pack_checkout_with_auth(self):
        """Test POST /api/pricing/checkout/message-pack with auth"""
        if not self.user_token:
            return self.test_result("Message Pack Checkout - With Auth", False, "No user token available")
        
        try:
            headers = {'Authorization': f'Bearer {self.user_token}'}
            response = self.session.post(f"{BASE_URL}/api/pricing/checkout/message-pack", 
                json={
                    "packId": "msg-50",
                    "originUrl": BASE_URL
                },
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['url', 'session_id']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    return self.test_result(
                        "Message Pack Checkout - With Auth", 
                        False,
                        f"Missing fields in response: {missing_fields}"
                    )
                
                # Check if URL looks like a Stripe checkout URL
                url = data.get('url', '')
                session_id = data.get('session_id', '')
                
                if not url.startswith('https://checkout.stripe.com'):
                    return self.test_result(
                        "Message Pack Checkout - With Auth", 
                        False,
                        f"URL doesn't look like Stripe checkout: {url}"
                    )
                
                if not session_id.startswith('cs_'):
                    return self.test_result(
                        "Message Pack Checkout - With Auth", 
                        False,
                        f"Session ID doesn't look like Stripe session: {session_id}"
                    )
                
                return self.test_result(
                    "Message Pack Checkout - With Auth", 
                    True,
                    f"Created Stripe session: {session_id}"
                )
            else:
                return self.test_result(
                    "Message Pack Checkout - With Auth", 
                    False,
                    f"Status: {response.status_code}, Response: {response.text}"
                )
                
        except Exception as e:
            return self.test_result("Message Pack Checkout - With Auth", False, f"Exception: {str(e)}")
    
    def test_message_pack_checkout_invalid_pack(self):
        """Test POST /api/pricing/checkout/message-pack with invalid packId"""
        if not self.user_token:
            return self.test_result("Message Pack Checkout - Invalid Pack", False, "No user token available")
        
        try:
            headers = {'Authorization': f'Bearer {self.user_token}'}
            response = self.session.post(f"{BASE_URL}/api/pricing/checkout/message-pack", 
                json={
                    "packId": "invalid-pack-id",
                    "originUrl": BASE_URL
                },
                headers=headers
            )
            
            # Should get an error for invalid pack ID
            success = response.status_code >= 400
            return self.test_result(
                "Message Pack Checkout - Invalid Pack", 
                success,
                f"Status: {response.status_code} (expected error for invalid pack)"
            )
                
        except Exception as e:
            return self.test_result("Message Pack Checkout - Invalid Pack", False, f"Exception: {str(e)}")
    
    def test_enforcement_usage_auth_required(self):
        """Test GET /api/pricing/enforcement/usage without auth (should get 401)"""
        try:
            response = self.session.get(f"{BASE_URL}/api/pricing/enforcement/usage")
            
            success = response.status_code == 401
            return self.test_result(
                "Enforcement Usage - Auth Required", 
                success,
                f"Status: {response.status_code} (expected 401)"
            )
                
        except Exception as e:
            return self.test_result("Enforcement Usage - Auth Required", False, f"Exception: {str(e)}")
    
    def test_enforcement_usage_with_auth(self):
        """Test GET /api/pricing/enforcement/usage with auth"""
        if not self.user_token:
            return self.test_result("Enforcement Usage - With Auth", False, "No user token available")
        
        try:
            headers = {'Authorization': f'Bearer {self.user_token}'}
            response = self.session.get(f"{BASE_URL}/api/pricing/enforcement/usage", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for required fields
                required_fields = ['premium_messages_balance', 'media_credits_balance', 'usage']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    return self.test_result(
                        "Enforcement Usage - With Auth", 
                        False,
                        f"Missing fields in response: {missing_fields}"
                    )
                
                # Check usage object structure
                usage = data.get('usage', {})
                expected_usage_fields = ['standard_messages', 'premium_messages', 'images', 'videos', 'pdfs']
                missing_usage_fields = [field for field in expected_usage_fields if field not in usage]
                
                if missing_usage_fields:
                    return self.test_result(
                        "Enforcement Usage - With Auth", 
                        False,
                        f"Missing usage fields: {missing_usage_fields}"
                    )
                
                # Check that premium_messages_balance is a number
                premium_balance = data.get('premium_messages_balance')
                if not isinstance(premium_balance, (int, float)):
                    return self.test_result(
                        "Enforcement Usage - With Auth", 
                        False,
                        f"premium_messages_balance should be a number, got: {type(premium_balance)}"
                    )
                
                # Check that media_credits_balance is a number
                media_balance = data.get('media_credits_balance')
                if not isinstance(media_balance, (int, float)):
                    return self.test_result(
                        "Enforcement Usage - With Auth", 
                        False,
                        f"media_credits_balance should be a number, got: {type(media_balance)}"
                    )
                
                return self.test_result(
                    "Enforcement Usage - With Auth", 
                    True,
                    f"Premium messages: {premium_balance}, Media credits: {media_balance}"
                )
            else:
                return self.test_result(
                    "Enforcement Usage - With Auth", 
                    False,
                    f"Status: {response.status_code}, Response: {response.text}"
                )
                
        except Exception as e:
            return self.test_result("Enforcement Usage - With Auth", False, f"Exception: {str(e)}")
    
    def test_existing_pricing_plans(self):
        """Test GET /api/pricing/plans (should still work)"""
        try:
            response = self.session.get(f"{BASE_URL}/api/pricing/plans")
            
            if response.status_code == 200:
                data = response.json()
                plans = data.get('plans', [])
                
                if len(plans) == 0:
                    return self.test_result(
                        "Existing Pricing Plans", 
                        False,
                        "No plans returned"
                    )
                
                return self.test_result(
                    "Existing Pricing Plans", 
                    True,
                    f"Found {len(plans)} plans"
                )
            else:
                return self.test_result(
                    "Existing Pricing Plans", 
                    False,
                    f"Status: {response.status_code}, Response: {response.text}"
                )
                
        except Exception as e:
            return self.test_result("Existing Pricing Plans", False, f"Exception: {str(e)}")
    
    def test_existing_credit_packs(self):
        """Test GET /api/pricing/credit-packs (should still work)"""
        try:
            response = self.session.get(f"{BASE_URL}/api/pricing/credit-packs")
            
            if response.status_code == 200:
                data = response.json()
                packs = data.get('packs', [])
                
                return self.test_result(
                    "Existing Credit Packs", 
                    True,
                    f"Found {len(packs)} credit packs"
                )
            else:
                return self.test_result(
                    "Existing Credit Packs", 
                    False,
                    f"Status: {response.status_code}, Response: {response.text}"
                )
                
        except Exception as e:
            return self.test_result("Existing Credit Packs", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        self.log("🚀 Starting Phase 5 Part 4 Add-on Purchase Endpoints Testing")
        self.log(f"Base URL: {BASE_URL}")
        
        # Test 1: Health check
        if not self.test_health_check():
            self.log("❌ Health check failed - aborting tests")
            return False
        
        # Test 2: Login users
        self.log("\n📝 Authenticating users...")
        self.admin_token = self.login_user(ADMIN_EMAIL, ADMIN_PASSCODE, "admin")
        self.user_token = self.login_user(USER_EMAIL, USER_PASSCODE, "user")
        
        if not self.user_token:
            self.log("❌ User authentication failed - some tests will be skipped")
        
        # Test 3: Message packs public endpoint (NO AUTH)
        self.log("\n🔍 Testing message packs public endpoint...")
        self.test_message_packs_public()
        
        # Test 4: Message pack checkout endpoints (AUTH REQUIRED)
        self.log("\n💳 Testing message pack checkout endpoints...")
        self.test_message_pack_checkout_auth_required()
        if self.user_token:
            self.test_message_pack_checkout_with_auth()
            self.test_message_pack_checkout_invalid_pack()
        
        # Test 5: Enforcement usage endpoint (AUTH REQUIRED)
        self.log("\n📊 Testing enforcement usage endpoint...")
        self.test_enforcement_usage_auth_required()
        if self.user_token:
            self.test_enforcement_usage_with_auth()
        
        # Test 6: Verify existing endpoints still work
        self.log("\n🔄 Testing existing endpoints...")
        self.test_existing_pricing_plans()
        self.test_existing_credit_packs()
        
        # Summary
        self.print_summary()
        
        return True
    
    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        self.log(f"\n{'='*60}")
        self.log("📋 TEST SUMMARY")
        self.log(f"{'='*60}")
        self.log(f"Total Tests: {total_tests}")
        self.log(f"✅ Passed: {passed_tests}")
        self.log(f"❌ Failed: {failed_tests}")
        self.log(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            self.log(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    self.log(f"  • {result['test']}: {result['details']}")
        
        self.log(f"\n{'='*60}")

def main():
    """Main test execution"""
    try:
        runner = TestRunner()
        success = runner.run_all_tests()
        
        # Exit with appropriate code
        failed_count = sum(1 for result in runner.test_results if not result['success'])
        sys.exit(0 if failed_count == 0 else 1)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()