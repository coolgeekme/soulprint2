#!/usr/bin/env python3
"""
Backend Testing Script for Phase 4 Grace Period Access Check API
Tests the /api/pricing/access-check endpoint with different authentication scenarios
"""

import requests
import json
import sys
from datetime import datetime

# Base URL from environment
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"

def log_test(test_name, success, details=""):
    """Log test results with consistent formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"    {details}")
    return success

def make_request(method, endpoint, headers=None, json_data=None):
    """Make HTTP request with error handling"""
    try:
        url = f"{BASE_URL}{endpoint}"
        response = requests.request(method, url, headers=headers, json=json_data, timeout=30)
        return response
    except Exception as e:
        print(f"    Request failed: {str(e)}")
        return None

def test_unauthenticated_access():
    """Test 1: GET /api/pricing/access-check without authentication should return 401"""
    print("\n=== Test 1: Unauthenticated Access ===")
    
    response = make_request("GET", "/api/pricing/access-check")
    if not response:
        return log_test("Unauthenticated request", False, "Request failed")
    
    if response.status_code == 401:
        return log_test("Unauthenticated request returns 401", True, f"Status: {response.status_code}")
    else:
        return log_test("Unauthenticated request returns 401", False, f"Expected 401, got {response.status_code}")

def login_user(email, password):
    """Helper function to login and get auth token"""
    login_data = {"email": email, "password": password}
    response = make_request("POST", "/api/auth/login", json_data=login_data)
    
    if not response or response.status_code != 200:
        print(f"    Login failed: {response.status_code if response else 'No response'}")
        return None
    
    try:
        data = response.json()
        return data.get("token")
    except:
        print("    Failed to parse login response")
        return None

def test_regular_user_gated():
    """Test 2: Regular user should get gated response since pricing is not active until May 2026"""
    print("\n=== Test 2: Regular User (Pricing Gated) ===")
    
    # Login as regular user
    token = login_user("testchat@example.com", "Test123456")
    if not token:
        return log_test("Regular user login", False, "Failed to get auth token")
    
    log_test("Regular user login", True, "Token received")
    
    # Test access-check endpoint
    headers = {"Authorization": f"Bearer {token}"}
    response = make_request("GET", "/api/pricing/access-check", headers=headers)
    
    if not response:
        return log_test("Regular user access-check request", False, "Request failed")
    
    if response.status_code != 200:
        return log_test("Regular user access-check status", False, f"Expected 200, got {response.status_code}")
    
    try:
        data = response.json()
        print(f"    Response: {json.dumps(data, indent=2)}")
        
        # Should return gated response for regular users
        if data.get("gated") == True and "Pricing not yet active" in data.get("message", ""):
            return log_test("Regular user gets gated response", True, "Pricing correctly gated for non-admin users")
        else:
            return log_test("Regular user gets gated response", False, f"Expected gated response, got: {data}")
    
    except Exception as e:
        return log_test("Regular user response parsing", False, f"Failed to parse response: {str(e)}")

def test_admin_user_bypass():
    """Test 3: Admin user should bypass gate and get full plan data"""
    print("\n=== Test 3: Admin User (Bypasses Gate) ===")
    
    # Login as admin user
    token = login_user("test@soulprint.com", "test123")
    if not token:
        return log_test("Admin user login", False, "Failed to get auth token")
    
    log_test("Admin user login", True, "Token received")
    
    # Test access-check endpoint
    headers = {"Authorization": f"Bearer {token}"}
    response = make_request("GET", "/api/pricing/access-check", headers=headers)
    
    if not response:
        return log_test("Admin user access-check request", False, "Request failed")
    
    if response.status_code != 200:
        return log_test("Admin user access-check status", False, f"Expected 200, got {response.status_code}")
    
    try:
        data = response.json()
        print(f"    Response: {json.dumps(data, indent=2)}")
        
        # Should NOT be gated for admin users
        if data.get("gated") == True:
            return log_test("Admin user bypasses gate", False, "Admin user should not be gated")
        
        # Should have full plan data structure
        required_fields = ["plan_id", "plan_name", "status", "features", "usage", "premium_model_ids", "standard_model_ids", "warnings"]
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return log_test("Admin user gets full plan data", False, f"Missing fields: {missing_fields}")
        
        # Check features structure
        features = data.get("features", {})
        required_feature_fields = ["chat_model_tier", "premium_chat", "images_per_month", "voice_chat"]
        missing_feature_fields = [field for field in required_feature_fields if field not in features]
        
        if missing_feature_fields:
            return log_test("Admin user features structure", False, f"Missing feature fields: {missing_feature_fields}")
        
        # Check usage structure
        usage = data.get("usage", {})
        required_usage_fields = ["images", "premium_chats", "voice_minutes", "videos"]
        missing_usage_fields = [field for field in required_usage_fields if field not in usage]
        
        if missing_usage_fields:
            return log_test("Admin user usage structure", False, f"Missing usage fields: {missing_usage_fields}")
        
        # Check model arrays
        premium_models = data.get("premium_model_ids", [])
        standard_models = data.get("standard_model_ids", [])
        
        if not isinstance(premium_models, list) or not isinstance(standard_models, list):
            return log_test("Admin user model arrays", False, "premium_model_ids and standard_model_ids should be arrays")
        
        warnings = data.get("warnings", [])
        if not isinstance(warnings, list):
            return log_test("Admin user warnings array", False, "warnings should be an array")
        
        return log_test("Admin user gets full plan data", True, "All required fields present with correct structure")
    
    except Exception as e:
        return log_test("Admin user response parsing", False, f"Failed to parse response: {str(e)}")

def test_existing_endpoints():
    """Test 4: Verify existing endpoints still work"""
    print("\n=== Test 4: Existing Endpoints Still Working ===")
    
    # Test pricing plans endpoint (public)
    response = make_request("GET", "/api/pricing/plans")
    if not response or response.status_code != 200:
        log_test("GET /api/pricing/plans", False, f"Status: {response.status_code if response else 'No response'}")
    else:
        try:
            data = response.json()
            if "plans" in data and isinstance(data["plans"], list):
                log_test("GET /api/pricing/plans", True, f"Returns {len(data['plans'])} plans")
            else:
                log_test("GET /api/pricing/plans", False, "Invalid response structure")
        except:
            log_test("GET /api/pricing/plans", False, "Failed to parse response")
    
    # Test auth login endpoint
    login_data = {"email": "testchat@example.com", "password": "Test123456"}
    response = make_request("POST", "/api/auth/login", json_data=login_data)
    if not response or response.status_code != 200:
        log_test("POST /api/auth/login", False, f"Status: {response.status_code if response else 'No response'}")
    else:
        try:
            data = response.json()
            if "token" in data:
                log_test("POST /api/auth/login", True, "Token returned successfully")
            else:
                log_test("POST /api/auth/login", False, "No token in response")
        except:
            log_test("POST /api/auth/login", False, "Failed to parse response")

def main():
    """Run all tests"""
    print("🧪 PHASE 4 GRACE PERIOD ACCESS CHECK API TESTING")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    results = []
    
    try:
        # Run all test scenarios
        results.append(test_unauthenticated_access())
        results.append(test_regular_user_gated())
        results.append(test_admin_user_bypass())
        results.append(test_existing_endpoints())
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in results if r)
        total = len(results)
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"Tests Passed: {passed}/{total} ({success_rate:.1f}%)")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED - Phase 4 Grace Period Access Check API is working correctly!")
            return 0
        else:
            print("⚠️  SOME TESTS FAILED - See details above")
            return 1
            
    except KeyboardInterrupt:
        print("\n\n⚠️  Testing interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n❌ Testing failed with error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())