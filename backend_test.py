#!/usr/bin/env python3
"""
Backend API Testing Script for Grace Expiration Notification and Enforcement Status
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:3000"
ADMIN_EMAIL = "test@soulprint.com"
ADMIN_PASSCODE = "test123"
USER_EMAIL = "testchat@example.com"
USER_PASSCODE = "Test123456"

def print_test_header(test_name):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def login(email, passcode):
    """Login and return auth token"""
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "passcode": passcode},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            if token:
                print_result(True, f"Login successful for {email}")
                return token
            else:
                print_result(False, f"Login response missing token: {data}")
                return None
        else:
            print_result(False, f"Login failed with status {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print_result(False, f"Login exception: {str(e)}")
        return None

def test_grace_expired_notification_dry_run_early(admin_token):
    """Test 1: Grace Expired Notification - Dry Run (Early Cohort)"""
    print_test_header("Grace Expired Notification - Dry Run (Early Cohort)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/notify/grace-expired",
            json={"cohort": "early", "dry_run": True},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            },
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            required_fields = ["dry_run", "total_in_cohort", "already_subscribed", "already_notified", "will_send", "users"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print_result(False, f"Missing required fields: {missing_fields}")
                return False
            
            if data.get("dry_run") != True:
                print_result(False, f"dry_run should be true, got: {data.get('dry_run')}")
                return False
            
            if not isinstance(data.get("total_in_cohort"), int):
                print_result(False, f"total_in_cohort should be int, got: {type(data.get('total_in_cohort'))}")
                return False
            
            if not isinstance(data.get("users"), list):
                print_result(False, f"users should be list, got: {type(data.get('users'))}")
                return False
            
            print_result(True, f"Dry run successful - Early cohort: {data.get('total_in_cohort')} total, {data.get('will_send')} will send")
            return True
        else:
            print_result(False, f"Request failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_grace_expired_notification_dry_run_all(admin_token):
    """Test 2: Grace Expired Notification - Dry Run (All Cohorts)"""
    print_test_header("Grace Expired Notification - Dry Run (All Cohorts)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/notify/grace-expired",
            json={"cohort": "all", "dry_run": True},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            },
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            required_fields = ["dry_run", "total_in_cohort", "already_subscribed", "already_notified", "will_send", "users"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print_result(False, f"Missing required fields: {missing_fields}")
                return False
            
            if data.get("dry_run") != True:
                print_result(False, f"dry_run should be true, got: {data.get('dry_run')}")
                return False
            
            print_result(True, f"Dry run successful - All cohorts: {data.get('total_in_cohort')} total, {data.get('will_send')} will send")
            return True
        else:
            print_result(False, f"Request failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_enforcement_status_api(user_token):
    """Test 3: Enforcement Status API (Regular User)"""
    print_test_header("Enforcement Status API (Regular User)")
    
    # Try both possible endpoints
    endpoints = [
        "/api/enforcement/status",
        "/api/pricing/enforcement"
    ]
    
    for endpoint in endpoints:
        print(f"\nTrying endpoint: {endpoint}")
        try:
            response = requests.get(
                f"{BASE_URL}{endpoint}",
                headers={
                    "Authorization": f"Bearer {user_token}"
                },
                timeout=10
            )
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                
                # Verify response structure
                required_fields = ["cohort", "enforcement_active", "effective_plan", "effective_features"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    print_result(False, f"Missing required fields: {missing_fields}")
                    continue
                
                # Check for grace expired fields if applicable
                if data.get("grace_expired"):
                    if "choose_plan_prompt" not in data:
                        print_result(False, "grace_expired is true but choose_plan_prompt is missing")
                        continue
                
                print_result(True, f"Enforcement status retrieved successfully from {endpoint}")
                print(f"  - Cohort: {data.get('cohort')}")
                print(f"  - Enforcement Active: {data.get('enforcement_active')}")
                print(f"  - Effective Plan: {data.get('effective_plan')}")
                print(f"  - Grace Expired: {data.get('grace_expired', False)}")
                return True
            elif response.status_code == 404:
                print(f"Endpoint {endpoint} not found, trying next...")
                continue
            else:
                print_result(False, f"Request failed with status {response.status_code}: {response.text}")
                continue
                
        except Exception as e:
            print_result(False, f"Exception: {str(e)}")
            continue
    
    print_result(False, "All enforcement status endpoints failed")
    return False

def test_auth_protection(admin_token):
    """Test 4: Auth Protection - POST without auth should return 401"""
    print_test_header("Auth Protection - POST /api/admin/notify/grace-expired without auth")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/notify/grace-expired",
            json={"cohort": "early", "dry_run": True},
            headers={
                "Content-Type": "application/json"
                # No Authorization header
            },
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print_result(True, "Auth protection working - 401 returned without auth token")
            return True
        else:
            print_result(False, f"Expected 401, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print(f"\n{'#'*80}")
    print(f"# GRACE EXPIRATION NOTIFICATION & ENFORCEMENT STATUS API TESTS")
    print(f"# Base URL: {BASE_URL}")
    print(f"# Timestamp: {datetime.now().isoformat()}")
    print(f"{'#'*80}")
    
    results = {
        "total": 0,
        "passed": 0,
        "failed": 0
    }
    
    # Login as admin
    print_test_header("Admin Login")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSCODE)
    if not admin_token:
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Login as regular user
    print_test_header("Regular User Login")
    user_token = login(USER_EMAIL, USER_PASSCODE)
    if not user_token:
        print("\n❌ CRITICAL: User login failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run tests
    tests = [
        ("Grace Expired Notification - Dry Run (Early)", lambda: test_grace_expired_notification_dry_run_early(admin_token)),
        ("Grace Expired Notification - Dry Run (All)", lambda: test_grace_expired_notification_dry_run_all(admin_token)),
        ("Enforcement Status API", lambda: test_enforcement_status_api(user_token)),
        ("Auth Protection", lambda: test_auth_protection(admin_token)),
    ]
    
    for test_name, test_func in tests:
        results["total"] += 1
        try:
            if test_func():
                results["passed"] += 1
            else:
                results["failed"] += 1
        except Exception as e:
            print_result(False, f"Test exception: {str(e)}")
            results["failed"] += 1
    
    # Print summary
    print(f"\n{'='*80}")
    print(f"TEST SUMMARY")
    print(f"{'='*80}")
    print(f"Total Tests: {results['total']}")
    print(f"Passed: {results['passed']} ✅")
    print(f"Failed: {results['failed']} ❌")
    print(f"Success Rate: {(results['passed']/results['total']*100):.1f}%")
    print(f"{'='*80}\n")
    
    # Exit with appropriate code
    sys.exit(0 if results['failed'] == 0 else 1)

if __name__ == "__main__":
    main()
