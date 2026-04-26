#!/usr/bin/env python3
"""
Backend Testing Script for Pricing & Subscription System
Tests the DB schema migration and endpoint functionality
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from review request
ADMIN_CREDENTIALS = {
    "email": "test@soulprint.com",
    "passcode": "test123"
}

USER_CREDENTIALS = {
    "email": "testchat@example.com", 
    "passcode": "Test123456"
}

class PricingSystemTester:
    def __init__(self):
        self.admin_token = None
        self.user_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def login(self, credentials: Dict[str, str], user_type: str) -> Optional[str]:
        """Login and return auth token"""
        try:
            response = requests.post(
                f"{API_BASE}/auth/login",
                json=credentials,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("token")
                if token:
                    self.log_test(f"{user_type} Login", True, f"Token received")
                    return token
                else:
                    self.log_test(f"{user_type} Login", False, "No token in response")
                    return None
            else:
                self.log_test(f"{user_type} Login", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_test(f"{user_type} Login", False, f"Exception: {str(e)}")
            return None
    
    def make_request(self, method: str, endpoint: str, token: Optional[str] = None, 
                    data: Optional[Dict] = None, expect_status: int = 200) -> Optional[Dict]:
        """Make HTTP request with optional auth"""
        try:
            headers = {"Content-Type": "application/json"}
            if token:
                headers["Authorization"] = f"Bearer {token}"
                
            url = f"{API_BASE}/{endpoint}"
            
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            if response.status_code == expect_status:
                try:
                    return response.json()
                except:
                    return {"status_code": response.status_code, "text": response.text}
            else:
                print(f"    Unexpected status {response.status_code}, expected {expect_status}")
                print(f"    Response: {response.text[:200]}")
                return None
                
        except Exception as e:
            print(f"    Request failed: {str(e)}")
            return None

    def test_health_check(self):
        """Test basic health check endpoint"""
        response = self.make_request("GET", "health")
        if response and response.get("status") == "ok":
            self.log_test("Health Check", True, "GET /api/health returns {status: 'ok'}")
        else:
            self.log_test("Health Check", False, f"Unexpected response: {response}")

    def test_pricing_plans_schema(self):
        """Test GET /api/pricing/plans for new schema structure"""
        response = self.make_request("GET", "pricing/plans")
        
        if not response or "plans" not in response:
            self.log_test("Pricing Plans Schema", False, "No plans in response")
            return
            
        plans = response["plans"]
        if len(plans) != 3:
            self.log_test("Pricing Plans Schema", False, f"Expected 3 plans, got {len(plans)}")
            return
            
        # Check for required plans
        plan_names = [p.get("name") for p in plans]
        expected_plans = ["Free", "Base", "Power"]
        
        if not all(name in plan_names for name in expected_plans):
            self.log_test("Pricing Plans Schema", False, f"Missing plans. Got: {plan_names}")
            return
            
        # Check NEW schema fields
        schema_issues = []
        for plan in plans:
            plan_name = plan.get("name", "Unknown")
            
            # Check for NEW schema: features.chat_model_tier
            features = plan.get("features", {})
            if "chat_model_tier" not in features:
                schema_issues.append(f"{plan_name} missing features.chat_model_tier")
            elif features["chat_model_tier"] not in ["standard", "all"]:
                schema_issues.append(f"{plan_name} invalid chat_model_tier: {features['chat_model_tier']}")
                
            # Check for DEPRECATED fields that should NOT exist
            deprecated_fields = ["chat_models", "premium_chat_models", "api_access", "data_retention_days"]
            for field in deprecated_fields:
                if field in features:
                    schema_issues.append(f"{plan_name} contains deprecated field: {field}")
                    
            # Check Base plan specific requirement
            if plan_name == "Base":
                if features.get("premium_chat_msgs_per_month") != 50:
                    schema_issues.append(f"Base plan premium_chat_msgs_per_month should be 50, got {features.get('premium_chat_msgs_per_month')}")
                    
            # Check for preserved Stripe IDs (Base and Power should have them)
            if plan_name in ["Base", "Power"]:
                if not plan.get("stripe_price_id_monthly") and not plan.get("stripe_price_id_annual"):
                    schema_issues.append(f"{plan_name} missing Stripe price IDs")
        
        if schema_issues:
            self.log_test("Pricing Plans Schema", False, f"Schema issues: {'; '.join(schema_issues)}")
        else:
            self.log_test("Pricing Plans Schema", True, "All 3 plans have correct NEW schema with chat_model_tier, no deprecated fields, Base has premium_chat_msgs_per_month: 50")

    def test_pricing_gate_without_auth(self):
        """Test GET /api/pricing/gate without authentication"""
        response = self.make_request("GET", "pricing/gate")
        
        if not response:
            self.log_test("Pricing Gate (No Auth)", False, "No response received")
            return
            
        expected_fields = ["visible", "launch_date", "role"]
        if not all(field in response for field in expected_fields):
            self.log_test("Pricing Gate (No Auth)", False, f"Missing fields. Got: {list(response.keys())}")
            return
            
        if (response.get("visible") == False and 
            response.get("launch_date") == "2026-05-01T00:00:00Z" and 
            response.get("role") is None):
            self.log_test("Pricing Gate (No Auth)", True, "Returns {visible: false, launch_date: '2026-05-01T00:00:00Z', role: null}")
        else:
            self.log_test("Pricing Gate (No Auth)", False, f"Unexpected response: {response}")

    def test_pricing_gate_with_admin_auth(self):
        """Test GET /api/pricing/gate with admin authentication"""
        if not self.admin_token:
            self.log_test("Pricing Gate (Admin Auth)", False, "No admin token available")
            return
            
        response = self.make_request("GET", "pricing/gate", token=self.admin_token)
        
        if not response:
            self.log_test("Pricing Gate (Admin Auth)", False, "No response received")
            return
            
        if response.get("visible") == True:
            self.log_test("Pricing Gate (Admin Auth)", True, f"Admin sees visible: true, role: {response.get('role')}")
        else:
            self.log_test("Pricing Gate (Admin Auth)", False, f"Admin should see visible: true, got: {response}")

    def test_pricing_subscription_with_auth(self):
        """Test GET /api/pricing/subscription with authentication"""
        if not self.user_token:
            self.log_test("Pricing Subscription (Auth)", False, "No user token available")
            return
            
        response = self.make_request("GET", "pricing/subscription", token=self.user_token)
        
        if not response:
            self.log_test("Pricing Subscription (Auth)", False, "No response received")
            return
            
        if "subscription" in response and "plan" in response:
            subscription = response["subscription"]
            plan = response["plan"]
            self.log_test("Pricing Subscription (Auth)", True, 
                         f"Returns subscription (plan_id: {subscription.get('plan_id')}, status: {subscription.get('status')}) and plan details")
        else:
            self.log_test("Pricing Subscription (Auth)", False, f"Missing subscription or plan data: {list(response.keys())}")

    def test_pricing_usage_with_auth(self):
        """Test GET /api/pricing/usage with authentication"""
        if not self.user_token:
            self.log_test("Pricing Usage (Auth)", False, "No user token available")
            return
            
        response = self.make_request("GET", "pricing/usage", token=self.user_token)
        
        if not response:
            self.log_test("Pricing Usage (Auth)", False, "No response received")
            return
            
        expected_fields = ["plan", "plan_name", "period", "usage", "limits", "subscription_status"]
        if all(field in response for field in expected_fields):
            self.log_test("Pricing Usage (Auth)", True, 
                         f"Returns usage summary (plan: {response.get('plan')}, period: {response.get('period')})")
        else:
            self.log_test("Pricing Usage (Auth)", False, f"Missing expected fields. Got: {list(response.keys())}")

    def test_pricing_subscription_without_auth(self):
        """Test that pricing endpoints require authentication"""
        try:
            response = requests.get(f"{API_BASE}/pricing/subscription", timeout=30)
            if response.status_code == 401:
                self.log_test("Pricing Auth Required", True, "GET /api/pricing/subscription returns 401 without auth")
            else:
                self.log_test("Pricing Auth Required", False, f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_test("Pricing Auth Required", False, f"Request failed: {str(e)}")

    def test_pricing_usage_without_auth(self):
        """Test that usage endpoint requires authentication"""
        try:
            response = requests.get(f"{API_BASE}/pricing/usage", timeout=30)
            if response.status_code == 401:
                self.log_test("Pricing Usage Auth Required", True, "GET /api/pricing/usage returns 401 without auth")
            else:
                self.log_test("Pricing Usage Auth Required", False, f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_test("Pricing Usage Auth Required", False, f"Request failed: {str(e)}")

    def run_all_tests(self):
        """Run all pricing system tests"""
        print("🧪 PRICING & SUBSCRIPTION SYSTEM TESTING")
        print("=" * 60)
        
        # Step 1: Basic health check
        self.test_health_check()
        
        # Step 2: Test authentication
        print("\n📋 AUTHENTICATION TESTS")
        self.admin_token = self.login(ADMIN_CREDENTIALS, "Admin")
        self.user_token = self.login(USER_CREDENTIALS, "User")
        
        # Step 3: Test public endpoints
        print("\n📋 PUBLIC ENDPOINT TESTS")
        self.test_pricing_plans_schema()
        self.test_pricing_gate_without_auth()
        
        # Step 4: Test authenticated endpoints
        print("\n📋 AUTHENTICATED ENDPOINT TESTS")
        self.test_pricing_subscription_without_auth()
        self.test_pricing_usage_without_auth()
        
        if self.user_token:
            self.test_pricing_subscription_with_auth()
            self.test_pricing_usage_with_auth()
            
        if self.admin_token:
            self.test_pricing_gate_with_admin_auth()
        
        # Step 5: Summary
        print("\n📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"Tests Passed: {passed}/{total} ({success_rate:.1f}%)")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED - Pricing & Subscription system is working correctly!")
        else:
            print("⚠️  Some tests failed - see details above")
            failed_tests = [r for r in self.test_results if not r["success"]]
            for test in failed_tests:
                print(f"   ❌ {test['test']}: {test['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = PricingSystemTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)