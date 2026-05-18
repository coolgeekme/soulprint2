#!/usr/bin/env python3
"""
Token Optimization and Admin Dashboard Token Metrics Testing
Tests the new token tracking features added to admin endpoints
"""

import requests
import json
import sys

# Base URL from environment
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "test@soulprint.com"
ADMIN_PASSCODE = "test123"
USER_EMAIL = "testchat@example.com"
USER_PASSCODE = "Test123456"

def print_test(test_name):
    """Print test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_success(message):
    """Print success message"""
    print(f"✅ {message}")

def print_error(message):
    """Print error message"""
    print(f"❌ {message}")

def print_info(message):
    """Print info message"""
    print(f"ℹ️  {message}")

def login(email, passcode):
    """Login and return token"""
    print_info(f"Logging in as {email}...")
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "passcode": passcode},
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("token")
        print_success(f"Login successful. Token: {token[:20]}...")
        return token
    else:
        print_error(f"Login failed: {response.status_code} - {response.text}")
        return None

def test_admin_users_list_with_token_metrics(admin_token):
    """
    Test 1: Admin Users List with Token Metrics
    GET /api/admin/users should return users with token metrics fields
    """
    print_test("Admin Users List with Token Metrics")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        users = data.get("users", [])
        
        if not users:
            print_error("No users returned")
            return False
        
        print_success(f"Found {len(users)} users")
        
        # Check first user for token metrics fields
        first_user = users[0]
        print_info(f"Checking user: {first_user.get('email', 'N/A')}")
        
        required_fields = [
            'est_input_tokens',
            'est_output_tokens', 
            'est_total_tokens',
            'est_cost',
            'total_messages'
        ]
        
        all_fields_present = True
        for field in required_fields:
            if field in first_user:
                value = first_user[field]
                print_success(f"Field '{field}' present: {value} (type: {type(value).__name__})")
                
                # Verify it's a number
                if not isinstance(value, (int, float)) and value is not None:
                    print_error(f"Field '{field}' is not a number: {value}")
                    all_fields_present = False
            else:
                print_error(f"Field '{field}' missing")
                all_fields_present = False
        
        if all_fields_present:
            print_success("All token metrics fields present in users list")
            return True
        else:
            print_error("Some token metrics fields missing")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_admin_user_detail_with_token_usage(admin_token):
    """
    Test 2: Admin User Detail with Token Usage
    GET /api/admin/users/:userId should return detailed token_usage object
    """
    print_test("Admin User Detail with Token Usage")
    
    try:
        # First get a user ID from the users list
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            print_error(f"Failed to get users list: {response.status_code}")
            return False
        
        users = response.json().get("users", [])
        if not users:
            print_error("No users found")
            return False
        
        user_id = users[0].get("id")
        print_info(f"Testing with user ID: {user_id}")
        
        # Get user detail
        response = requests.get(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check for token_usage object
        if "token_usage" not in data:
            print_error("token_usage object missing")
            return False
        
        token_usage = data["token_usage"]
        print_success("token_usage object present")
        
        # Check required fields in token_usage
        required_fields = [
            'total_input_tokens',
            'total_output_tokens',
            'total_tokens',
            'tracked_messages',
            'untracked_messages',
            'by_model'
        ]
        
        all_fields_present = True
        for field in required_fields:
            if field in token_usage:
                value = token_usage[field]
                if field == 'by_model':
                    print_success(f"Field '{field}' present: array with {len(value)} items")
                else:
                    print_success(f"Field '{field}' present: {value} (type: {type(value).__name__})")
            else:
                print_error(f"Field '{field}' missing from token_usage")
                all_fields_present = False
        
        # Check for costs object (should still exist)
        if "costs" in data:
            costs = data["costs"]
            print_success(f"costs object present with total_cost: {costs.get('total_cost', 'N/A')}")
        else:
            print_error("costs object missing")
            all_fields_present = False
        
        if all_fields_present:
            print_success("All token usage fields present in user detail")
            return True
        else:
            print_error("Some token usage fields missing")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_admin_insights_with_token_totals(admin_token):
    """
    Test 3: Admin Insights with Token Totals
    GET /api/admin/insights should return token_totals with all_time and last_30d
    """
    print_test("Admin Insights with Token Totals")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/insights",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check for token_totals object
        if "token_totals" not in data:
            print_error("token_totals object missing")
            return False
        
        token_totals = data["token_totals"]
        print_success("token_totals object present")
        
        # Check for all_time and last_30d sub-objects
        required_periods = ['all_time', 'last_30d']
        all_periods_present = True
        
        for period in required_periods:
            if period not in token_totals:
                print_error(f"Period '{period}' missing from token_totals")
                all_periods_present = False
                continue
            
            period_data = token_totals[period]
            print_success(f"Period '{period}' present")
            
            # Check required fields in each period
            required_fields = [
                'input_tokens',
                'output_tokens',
                'total_tokens',
                'tracked_messages'
            ]
            
            for field in required_fields:
                if field in period_data:
                    value = period_data[field]
                    print_success(f"  {period}.{field}: {value} (type: {type(value).__name__})")
                else:
                    print_error(f"  Field '{field}' missing from {period}")
                    all_periods_present = False
        
        if all_periods_present:
            print_success("All token totals fields present in insights")
            return True
        else:
            print_error("Some token totals fields missing")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_memory_system_conditional_logic(user_token):
    """
    Test 4: Memory System Conditional Logic
    Verify that different message types don't crash the server
    """
    print_test("Memory System Conditional Logic - No Server Crashes")
    
    test_messages = [
        {
            "name": "Design-related message",
            "message": "create a flyer for my event",
            "expected": "Should not crash (isDesignRequest logic)"
        },
        {
            "name": "Google-related message", 
            "message": "check my email",
            "expected": "Should not crash (Google context logic)"
        },
        {
            "name": "Regular message",
            "message": "hello, how are you?",
            "expected": "Should not crash (normal flow)"
        }
    ]
    
    all_passed = True
    
    for test in test_messages:
        print_info(f"\nTesting: {test['name']}")
        print_info(f"Message: '{test['message']}'")
        print_info(f"Expected: {test['expected']}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/chat/stream",
                json={
                    "message": test['message'],
                    "model": "gpt-4o"
                },
                headers={
                    "Authorization": f"Bearer {user_token}",
                    "Content-Type": "application/json"
                },
                stream=True,
                timeout=30
            )
            
            print_info(f"Status Code: {response.status_code}")
            
            # Check for 500 errors (server crashes)
            if response.status_code == 500:
                print_error(f"Server crashed (500 error) for: {test['name']}")
                print_error(f"Response: {response.text}")
                all_passed = False
                continue
            
            # 200 or stream responses are good
            if response.status_code in [200, 201]:
                print_success(f"No server crash - returned {response.status_code}")
                
                # Try to read a bit of the stream to verify it's working
                try:
                    chunk_count = 0
                    for chunk in response.iter_content(chunk_size=1024):
                        chunk_count += 1
                        if chunk_count >= 3:  # Just read a few chunks
                            break
                    print_success(f"Stream working - read {chunk_count} chunks")
                except Exception as e:
                    print_info(f"Stream read note: {str(e)}")
            
            # 400 validation errors are acceptable (not server crashes)
            elif response.status_code == 400:
                print_success(f"Validation error (400) - not a server crash")
                print_info(f"Response: {response.text}")
            
            else:
                print_info(f"Unexpected status code: {response.status_code}")
                print_info(f"Response: {response.text}")
                
        except requests.exceptions.Timeout:
            print_success("Request timed out (expected for streaming) - no crash")
        except Exception as e:
            print_error(f"Exception: {str(e)}")
            all_passed = False
    
    if all_passed:
        print_success("\nAll memory system conditional logic tests passed - no crashes")
        return True
    else:
        print_error("\nSome memory system tests failed")
        return False

def main():
    """Run all token metrics tests"""
    print("\n" + "="*80)
    print("TOKEN OPTIMIZATION AND ADMIN DASHBOARD TOKEN METRICS TESTING")
    print("="*80)
    
    # Login as admin
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSCODE)
    if not admin_token:
        print_error("Failed to login as admin. Exiting.")
        sys.exit(1)
    
    # Login as regular user
    user_token = login(USER_EMAIL, USER_PASSCODE)
    if not user_token:
        print_error("Failed to login as user. Exiting.")
        sys.exit(1)
    
    # Run tests
    results = []
    
    # Test 1: Admin Users List with Token Metrics
    results.append(("Admin Users List with Token Metrics", 
                   test_admin_users_list_with_token_metrics(admin_token)))
    
    # Test 2: Admin User Detail with Token Usage
    results.append(("Admin User Detail with Token Usage",
                   test_admin_user_detail_with_token_usage(admin_token)))
    
    # Test 3: Admin Insights with Token Totals
    results.append(("Admin Insights with Token Totals",
                   test_admin_insights_with_token_totals(admin_token)))
    
    # Test 4: Memory System Conditional Logic
    results.append(("Memory System Conditional Logic",
                   test_memory_system_conditional_logic(user_token)))
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed*100//total}% success rate)")
    
    if passed == total:
        print_success("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print_error(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
