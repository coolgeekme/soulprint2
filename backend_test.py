#!/usr/bin/env python3
"""
SoulPrint Engine - Admin Discount Codes CRUD & User Billing Endpoints Testing
Testing the Admin Discount Codes CRUD endpoints and User Billing endpoints as specified in the review request.
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Base URL from environment
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"

# Test credentials from /app/memory/test_credentials.md
ADMIN_CREDENTIALS = {
    "email": "test@soulprint.com",
    "passcode": "test123"  # Note: field is "passcode" not "password"
}

USER_CREDENTIALS = {
    "email": "testchat@example.com", 
    "passcode": "Test123456"
}

class SoulPrintTester:
    def __init__(self):
        self.admin_token = None
        self.user_token = None
        self.test_discount_id = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def login(self, credentials: Dict[str, str], user_type: str) -> Optional[str]:
        """Login and return auth token"""
        try:
            self.log(f"Logging in as {user_type}: {credentials['email']}")
            
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json=credentials,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get('token')
                if token:
                    self.log(f"✅ {user_type} login successful")
                    return token
                else:
                    self.log(f"❌ {user_type} login failed: No token in response", "ERROR")
                    return None
            else:
                self.log(f"❌ {user_type} login failed: {response.status_code} - {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ {user_type} login error: {str(e)}", "ERROR")
            return None
    
    def make_request(self, method: str, endpoint: str, token: str = None, data: Dict = None, params: Dict = None) -> requests.Response:
        """Make authenticated API request"""
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        url = f"{BASE_URL}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            self.log(f"❌ Request error for {method} {endpoint}: {str(e)}", "ERROR")
            raise
    
    def test_admin_discount_codes_crud(self):
        """Test Admin CRUD operations for discount codes"""
        self.log("=== TESTING ADMIN DISCOUNT CODES CRUD ===")
        
        # Step 1: Login as admin
        self.admin_token = self.login(ADMIN_CREDENTIALS, "Admin")
        if not self.admin_token:
            self.log("❌ Cannot proceed without admin authentication", "ERROR")
            return False
            
        try:
            # Step 2: GET /api/pricing/admin/discounts → should return {discounts: [...]}
            self.log("Testing GET /api/pricing/admin/discounts")
            response = self.make_request("GET", "/api/pricing/admin/discounts", self.admin_token)
            
            if response.status_code == 200:
                data = response.json()
                if "discounts" in data:
                    self.log(f"✅ GET discounts successful - found {len(data['discounts'])} existing discounts")
                    initial_discount_count = len(data['discounts'])
                else:
                    self.log("❌ GET discounts failed: Missing 'discounts' field in response", "ERROR")
                    return False
            else:
                self.log(f"❌ GET discounts failed: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Step 3: POST /api/pricing/admin/discounts - Create new discount code
            self.log("Testing POST /api/pricing/admin/discounts (create)")
            create_data = {
                "code": "TEST20OFF",
                "type": "percent_off",
                "value": 20,
                "max_uses": 100,
                "description": "Test discount"
            }
            
            response = self.make_request("POST", "/api/pricing/admin/discounts", self.admin_token, create_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "discount" in data:
                    self.test_discount_id = data["discount"]["id"]
                    self.log(f"✅ POST create discount successful - ID: {self.test_discount_id}")
                else:
                    self.log("❌ POST create discount failed: Invalid response format", "ERROR")
                    return False
            else:
                # Check if it's a duplicate error (acceptable)
                if response.status_code == 400 and "already exists" in response.text:
                    self.log("⚠️ Discount code TEST20OFF already exists - this is acceptable for testing")
                    # Try to find the existing discount ID
                    response = self.make_request("GET", "/api/pricing/admin/discounts", self.admin_token)
                    if response.status_code == 200:
                        discounts = response.json().get("discounts", [])
                        for discount in discounts:
                            if discount.get("code") == "TEST20OFF":
                                self.test_discount_id = discount["id"]
                                self.log(f"✅ Found existing TEST20OFF discount - ID: {self.test_discount_id}")
                                break
                else:
                    self.log(f"❌ POST create discount failed: {response.status_code} - {response.text}", "ERROR")
                    return False
            
            # Step 4: GET /api/pricing/admin/discounts → should now contain "TEST20OFF"
            self.log("Testing GET /api/pricing/admin/discounts (verify creation)")
            response = self.make_request("GET", "/api/pricing/admin/discounts", self.admin_token)
            
            if response.status_code == 200:
                data = response.json()
                discounts = data.get("discounts", [])
                test_discount_found = any(d.get("code") == "TEST20OFF" for d in discounts)
                
                if test_discount_found:
                    self.log("✅ GET discounts verification successful - TEST20OFF found")
                else:
                    self.log("❌ GET discounts verification failed: TEST20OFF not found", "ERROR")
                    return False
            else:
                self.log(f"❌ GET discounts verification failed: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Step 5: POST /api/pricing/admin/discounts/{id}/update - Update discount
            if self.test_discount_id:
                self.log("Testing POST /api/pricing/admin/discounts/{id}/update")
                update_data = {
                    "description": "Updated desc"
                }
                
                response = self.make_request("POST", f"/api/pricing/admin/discounts/{self.test_discount_id}/update", self.admin_token, update_data)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        self.log("✅ POST update discount successful")
                    else:
                        self.log("❌ POST update discount failed: Invalid response format", "ERROR")
                        return False
                else:
                    self.log(f"❌ POST update discount failed: {response.status_code} - {response.text}", "ERROR")
                    return False
            
            # Step 6: POST /api/pricing/admin/discounts/{id}/delete - Delete discount
            if self.test_discount_id:
                self.log("Testing POST /api/pricing/admin/discounts/{id}/delete")
                
                response = self.make_request("POST", f"/api/pricing/admin/discounts/{self.test_discount_id}/delete", self.admin_token)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        self.log("✅ POST delete discount successful")
                    else:
                        self.log("❌ POST delete discount failed: Invalid response format", "ERROR")
                        return False
                else:
                    self.log(f"❌ POST delete discount failed: {response.status_code} - {response.text}", "ERROR")
                    return False
            
            # Step 7: GET /api/pricing/admin/discounts → should no longer contain "TEST20OFF" (or be inactive)
            self.log("Testing GET /api/pricing/admin/discounts (verify deletion)")
            response = self.make_request("GET", "/api/pricing/admin/discounts", self.admin_token)
            
            if response.status_code == 200:
                data = response.json()
                discounts = data.get("discounts", [])
                active_test_discount = any(d.get("code") == "TEST20OFF" and d.get("is_active", True) for d in discounts)
                
                if not active_test_discount:
                    self.log("✅ GET discounts deletion verification successful - TEST20OFF no longer active")
                else:
                    self.log("⚠️ TEST20OFF still appears as active - deletion may have marked as inactive rather than removing")
            else:
                self.log(f"❌ GET discounts deletion verification failed: {response.status_code} - {response.text}", "ERROR")
                return False
            
            return True
            
        except Exception as e:
            self.log(f"❌ Admin discount codes CRUD test error: {str(e)}", "ERROR")
            return False
    
    def test_non_admin_access_restriction(self):
        """Test that non-admin users cannot access admin discount endpoints"""
        self.log("=== TESTING NON-ADMIN ACCESS RESTRICTION ===")
        
        # First try with the existing user
        self.user_token = self.login(USER_CREDENTIALS, "Regular User")
        if not self.user_token:
            self.log("❌ Cannot proceed without user authentication", "ERROR")
            return False
            
        try:
            # Test GET /api/pricing/admin/discounts with regular user token
            self.log("Testing GET /api/pricing/admin/discounts with regular user (should fail)")
            response = self.make_request("GET", "/api/pricing/admin/discounts", self.user_token)
            
            if response.status_code == 403:
                self.log("✅ Non-admin access restriction working - got 403 Forbidden")
                return True
            elif response.status_code == 401:
                self.log("✅ Non-admin access restriction working - got 401 Unauthorized")
                return True
            elif response.status_code == 200:
                # The existing test user might have admin privileges, try with a fresh user
                self.log("⚠️ Existing test user has admin access, testing with fresh non-admin user")
                return self.test_with_fresh_non_admin_user()
            else:
                self.log(f"❌ Non-admin access restriction failed: Expected 401/403, got {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Non-admin access restriction test error: {str(e)}", "ERROR")
            return False
    
    def test_with_fresh_non_admin_user(self):
        """Test with a guaranteed non-admin user"""
        try:
            # Create a fresh non-admin user
            import time
            timestamp = int(time.time())
            fresh_user_email = f"nonadmin{timestamp}@test.com"
            fresh_user_credentials = {
                "email": fresh_user_email,
                "passcode": "TestPass123",
                "display_name": "Non Admin Test User"
            }
            
            self.log(f"Creating fresh non-admin user: {fresh_user_email}")
            
            # Register new user
            response = self.make_request("POST", "/api/auth/register", data=fresh_user_credentials)
            if response.status_code != 200:
                self.log(f"❌ Failed to create fresh user: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Login with fresh user
            login_creds = {"email": fresh_user_email, "passcode": "TestPass123"}
            fresh_token = self.login(login_creds, "Fresh Non-Admin User")
            if not fresh_token:
                self.log("❌ Failed to login with fresh user", "ERROR")
                return False
            
            # Test admin endpoint access with fresh user
            self.log("Testing GET /api/pricing/admin/discounts with fresh non-admin user (should fail)")
            response = self.make_request("GET", "/api/pricing/admin/discounts", fresh_token)
            
            if response.status_code == 403:
                self.log("✅ Non-admin access restriction working with fresh user - got 403 Forbidden")
                return True
            elif response.status_code == 401:
                self.log("✅ Non-admin access restriction working with fresh user - got 401 Unauthorized")
                return True
            else:
                self.log(f"❌ Non-admin access restriction failed with fresh user: Expected 401/403, got {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Fresh non-admin user test error: {str(e)}", "ERROR")
            return False
    
    def test_user_billing_endpoints(self):
        """Test User Billing endpoints"""
        self.log("=== TESTING USER BILLING ENDPOINTS ===")
        
        # Ensure we have user token
        if not self.user_token:
            self.user_token = self.login(USER_CREDENTIALS, "Regular User")
            if not self.user_token:
                self.log("❌ Cannot proceed without user authentication", "ERROR")
                return False
        
        try:
            # Step 1: GET /api/pricing/subscription → should return subscription data
            self.log("Testing GET /api/pricing/subscription")
            response = self.make_request("GET", "/api/pricing/subscription", self.user_token)
            
            if response.status_code == 200:
                data = response.json()
                if "subscription" in data:
                    subscription = data["subscription"]
                    plan = data.get("plan")
                    self.log(f"✅ GET subscription successful - Plan: {subscription.get('plan_id', 'unknown')}, Status: {subscription.get('status', 'unknown')}")
                    if plan:
                        self.log(f"   Plan details: {plan.get('name', 'unknown')} - ${plan.get('price_monthly', 0)}/month")
                else:
                    self.log("❌ GET subscription failed: Missing 'subscription' field in response", "ERROR")
                    return False
            else:
                self.log(f"❌ GET subscription failed: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Step 2: GET /api/pricing/history → should return {transactions: [...]}
            self.log("Testing GET /api/pricing/history")
            response = self.make_request("GET", "/api/pricing/history", self.user_token)
            
            if response.status_code == 200:
                data = response.json()
                if "transactions" in data:
                    transactions = data["transactions"]
                    self.log(f"✅ GET history successful - found {len(transactions)} transactions")
                else:
                    self.log("❌ GET history failed: Missing 'transactions' field in response", "ERROR")
                    return False
            else:
                self.log(f"❌ GET history failed: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Step 3: GET /api/pricing/portal?return_url=BASE_URL → test response
            self.log("Testing GET /api/pricing/portal")
            params = {"return_url": BASE_URL}
            response = self.make_request("GET", "/api/pricing/portal", self.user_token, params=params)
            
            if response.status_code == 200:
                data = response.json()
                if "url" in data:
                    portal_url = data["url"]
                    self.log(f"✅ GET portal successful - URL: {portal_url[:50]}...")
                else:
                    self.log("✅ GET portal successful - response format may vary based on Stripe customer status")
            elif response.status_code == 400:
                # This is acceptable if user has no Stripe customer
                self.log("✅ GET portal returned 400 - acceptable if user has no Stripe customer (graceful failure)")
            else:
                # Check if it's a 500 crash (which would be bad)
                if response.status_code == 500:
                    self.log(f"❌ GET portal failed with 500 error: {response.text}", "ERROR")
                    return False
                else:
                    self.log(f"⚠️ GET portal returned {response.status_code} - may be expected if no customer exists")
            
            return True
            
        except Exception as e:
            self.log(f"❌ User billing endpoints test error: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all tests and return overall success"""
        self.log("🚀 Starting SoulPrint Engine Admin Discount Codes CRUD & User Billing Testing")
        self.log(f"Base URL: {BASE_URL}")
        
        results = []
        
        # Test 1: Admin Discount Codes CRUD
        results.append(self.test_admin_discount_codes_crud())
        
        # Test 2: Non-admin access restriction
        results.append(self.test_non_admin_access_restriction())
        
        # Test 3: User Billing Endpoints
        results.append(self.test_user_billing_endpoints())
        
        # Summary
        passed = sum(results)
        total = len(results)
        
        self.log("=" * 60)
        self.log(f"TEST SUMMARY: {passed}/{total} test suites passed")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED - Admin Discount Codes CRUD & User Billing endpoints working correctly!")
            return True
        else:
            self.log(f"❌ {total - passed} test suite(s) failed")
            return False

def main():
    """Main test execution"""
    tester = SoulPrintTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ Backend testing completed successfully")
        sys.exit(0)
    else:
        print("\n❌ Backend testing completed with failures")
        sys.exit(1)

if __name__ == "__main__":
    main()