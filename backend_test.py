#!/usr/bin/env python3
"""
Backend Test Suite for Free Plan Onboarding Fix
Tests the critical fix for 520 error in production
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com/api"
TEST_USER_EMAIL = "testchat@example.com"
TEST_USER_PASSWORD = "Test123456"

def print_test_header(test_name):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    return success

def authenticate():
    """Authenticate and get JWT token"""
    print_test_header("Authentication")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": TEST_USER_EMAIL, "passcode": TEST_USER_PASSWORD},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print_result(True, f"Authentication successful for {TEST_USER_EMAIL}")
                return token
            else:
                print_result(False, "No token in response")
                return None
        else:
            print_result(False, f"Authentication failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_result(False, f"Authentication error: {str(e)}")
        return None

def test_free_plan_checkout(token):
    """
    TEST CASE 1: Free Plan Checkout Endpoint
    POST /api/pricing/checkout with planId='free'
    Expected: Returns success=true, redirect to /chat, no Stripe session
    """
    print_test_header("Test Case 1: Free Plan Checkout Endpoint")
    
    try:
        response = requests.post(
            f"{BASE_URL}/pricing/checkout",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "planId": "free",
                "billingPeriod": "monthly",
                "originUrl": "https://soulprint-engine.preview.emergentagent.com"
            },
            timeout=30
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for success field
            if not data.get('success'):
                return print_result(False, "Response missing 'success: true' field")
            
            # Check for redirect field
            if 'redirect' not in data:
                return print_result(False, "Response missing 'redirect' field")
            
            # Verify redirect URL contains /chat
            if '/chat' not in data.get('redirect', ''):
                return print_result(False, f"Redirect URL doesn't contain /chat: {data.get('redirect')}")
            
            # Verify NO Stripe session (should not have 'url' or 'session_id' for free plan)
            if 'url' in data or 'session_id' in data:
                return print_result(False, "Free plan should not create Stripe session")
            
            # Check subscription field
            if 'subscription' not in data:
                return print_result(False, "Response missing 'subscription' field")
            
            subscription = data.get('subscription', {})
            
            # Verify subscription has correct plan_id
            if subscription.get('plan_id') != 'free':
                return print_result(False, f"Subscription plan_id should be 'free', got: {subscription.get('plan_id')}")
            
            # Verify admin_override_reason is set
            if subscription.get('admin_override_reason') != 'user_selected_free_plan':
                return print_result(False, f"admin_override_reason should be 'user_selected_free_plan', got: {subscription.get('admin_override_reason')}")
            
            return print_result(True, "Free plan checkout working correctly - no Stripe session, direct redirect to /chat")
        
        elif response.status_code == 500:
            return print_result(False, f"500 ERROR (CRITICAL): This is the production bug! Response: {response.text}")
        
        else:
            return print_result(False, f"Unexpected status code: {response.status_code}")
            
    except Exception as e:
        return print_result(False, f"Exception during test: {str(e)}")

def test_enforcement_status_after_free_selection(token):
    """
    TEST CASE 2: Enforcement Status After Free Plan Selection
    GET /api/pricing/enforcement
    Expected: Returns choose_plan_prompt=false (popup should NOT show)
    """
    print_test_header("Test Case 2: Enforcement Status After Free Plan Selection")
    
    try:
        response = requests.get(
            f"{BASE_URL}/pricing/enforcement",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if user_selected_free is true
            if not data.get('user_selected_free'):
                print(f"⚠️  WARNING: user_selected_free is {data.get('user_selected_free')}, expected true")
            
            # Check if choose_plan_prompt is false
            if data.get('choose_plan_prompt') == False:
                return print_result(True, "choose_plan_prompt=false - popup will NOT show for users who selected Free plan")
            elif data.get('choose_plan_prompt') == True:
                return print_result(False, "choose_plan_prompt=true - BUG: popup will still show even though user selected Free plan")
            else:
                # choose_plan_prompt not present means it's false (default)
                return print_result(True, "choose_plan_prompt not present (defaults to false) - popup will NOT show")
        
        elif response.status_code == 500:
            return print_result(False, f"500 ERROR (CRITICAL): Enforcement endpoint crashing! Response: {response.text}")
        
        else:
            return print_result(False, f"Unexpected status code: {response.status_code}")
            
    except Exception as e:
        return print_result(False, f"Exception during test: {str(e)}")

def test_paid_plan_checkout(token):
    """
    TEST CASE 3: Paid Plan Checkout Still Works
    POST /api/pricing/checkout with planId='base'
    Expected: Returns Stripe checkout URL (not a direct redirect)
    """
    print_test_header("Test Case 3: Paid Plan Checkout Still Works")
    
    try:
        response = requests.post(
            f"{BASE_URL}/pricing/checkout",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "planId": "base",
                "billingPeriod": "monthly",
                "originUrl": "https://soulprint-engine.preview.emergentagent.com"
            },
            timeout=30
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Paid plans should return Stripe checkout URL
            if 'url' not in data:
                return print_result(False, "Paid plan checkout missing 'url' field (Stripe checkout URL)")
            
            # Verify URL is a Stripe checkout URL
            url = data.get('url', '')
            if not url.startswith('https://checkout.stripe.com'):
                return print_result(False, f"URL should be Stripe checkout URL, got: {url}")
            
            # Should have session_id
            if 'session_id' not in data:
                return print_result(False, "Paid plan checkout missing 'session_id' field")
            
            # Should NOT have direct redirect (that's only for free plan)
            if 'redirect' in data and '/chat' in data.get('redirect', ''):
                return print_result(False, "Paid plan should not have direct redirect - should go through Stripe")
            
            return print_result(True, "Paid plan checkout working correctly - returns Stripe checkout URL")
        
        elif response.status_code == 500:
            return print_result(False, f"500 ERROR (CRITICAL): Paid plan checkout crashing! Response: {response.text}")
        
        else:
            return print_result(False, f"Unexpected status code: {response.status_code}")
            
    except Exception as e:
        return print_result(False, f"Exception during test: {str(e)}")

def test_error_handling(token):
    """
    TEST CASE 4: Error Handling
    POST /api/pricing/checkout with missing required fields
    Expected: Returns error message, doesn't crash
    """
    print_test_header("Test Case 4: Error Handling - Missing Required Fields")
    
    try:
        # Test with missing planId
        response = requests.post(
            f"{BASE_URL}/pricing/checkout",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "billingPeriod": "monthly",
                "originUrl": "https://soulprint-engine.preview.emergentagent.com"
            },
            timeout=30
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text[:500]}")
        
        if response.status_code == 400:
            data = response.json()
            if 'error' in data:
                return print_result(True, f"Error handling working correctly - returns 400 with error message: {data.get('error')}")
            else:
                return print_result(False, "400 response but missing 'error' field")
        
        elif response.status_code == 500:
            return print_result(False, f"500 ERROR (CRITICAL): Endpoint crashing instead of returning validation error! Response: {response.text}")
        
        else:
            return print_result(False, f"Expected 400 status code, got: {response.status_code}")
            
    except Exception as e:
        return print_result(False, f"Exception during test: {str(e)}")

def main():
    print("\n" + "="*80)
    print("FREE PLAN ONBOARDING FIX - BACKEND TEST SUITE")
    print("Testing fix for 520 error in production")
    print("="*80)
    
    # Authenticate
    token = authenticate()
    if not token:
        print("\n❌ CRITICAL: Authentication failed - cannot proceed with tests")
        sys.exit(1)
    
    # Run all test cases
    results = []
    
    results.append(test_free_plan_checkout(token))
    results.append(test_enforcement_status_after_free_selection(token))
    results.append(test_paid_plan_checkout(token))
    results.append(test_error_handling(token))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(results)
    total = len(results)
    
    print(f"\nTests Passed: {passed}/{total}")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED - Free plan onboarding fix is working correctly")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED - Issues found with Free plan onboarding fix")
        sys.exit(1)

if __name__ == "__main__":
    main()
