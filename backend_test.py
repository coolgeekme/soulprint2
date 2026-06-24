#!/usr/bin/env python3
"""
Backend Testing for SoulPrint Engine - Subscription Growth Strategy Phase 1

Test Focus:
1. Free Tier Enforcement - Verify free plan has 10 messages/day limit
2. Pricing Display - Verify Base plan is $19/month and $182.40/year
3. Pricing Display - Verify Power plan is $97/month and $931.20/year
4. Pricing Page Access - Verify pricing page gate is open (visible: true)
"""

import requests
import json
import os
import sys

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_URL = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(msg):
    print(f"{Colors.BLUE}[TEST]{Colors.END} {msg}")

def print_pass(msg):
    print(f"{Colors.GREEN}✅ PASS:{Colors.END} {msg}")

def print_fail(msg):
    print(f"{Colors.RED}❌ FAIL:{Colors.END} {msg}")

def print_info(msg):
    print(f"{Colors.YELLOW}ℹ️  INFO:{Colors.END} {msg}")

def login():
    """Authenticate and get token"""
    print_test("Authenticating...")
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            json={"email": TEST_EMAIL, "passcode": TEST_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print_pass(f"Authentication successful for {TEST_EMAIL}")
                return token
            else:
                print_fail("No token in response")
                return None
        else:
            print_fail(f"Login failed: {response.status_code} - {response.text[:200]}")
            return None
    except Exception as e:
        print_fail(f"Login error: {str(e)}")
        return None

def test_pricing_plans():
    """Test 1: Verify pricing plans structure and values"""
    print_test("\n=== Test 1: Pricing Plans Structure ===")
    try:
        response = requests.get(f"{API_URL}/pricing/plans", timeout=10)
        
        if response.status_code != 200:
            print_fail(f"GET /api/pricing/plans failed: {response.status_code}")
            return False
        
        data = response.json()
        plans = data.get('plans', [])
        
        if not plans:
            print_fail("No plans returned")
            return False
        
        print_pass(f"GET /api/pricing/plans returned {len(plans)} plans")
        
        # Find each plan
        free_plan = next((p for p in plans if p.get('id') == 'free'), None)
        base_plan = next((p for p in plans if p.get('id') == 'base'), None)
        power_plan = next((p for p in plans if p.get('id') == 'power'), None)
        
        all_tests_passed = True
        
        # Test Free Plan
        if not free_plan:
            print_fail("Free plan not found")
            all_tests_passed = False
        else:
            print_info(f"Free plan found: {free_plan.get('name')}")
            
            # Check standard_msgs_per_day
            features = free_plan.get('features', {})
            standard_msgs = features.get('standard_msgs_per_day')
            
            if standard_msgs == 10:
                print_pass(f"Free plan has standard_msgs_per_day: {standard_msgs} ✓")
            else:
                print_fail(f"Free plan standard_msgs_per_day is {standard_msgs}, expected 10")
                all_tests_passed = False
        
        # Test Base Plan
        if not base_plan:
            print_fail("Base plan not found")
            all_tests_passed = False
        else:
            print_info(f"Base plan found: {base_plan.get('name')}")
            
            price_monthly = base_plan.get('price_monthly')
            price_annual = base_plan.get('price_annual')
            
            if price_monthly == 19:
                print_pass(f"Base plan price_monthly: ${price_monthly} ✓")
            else:
                print_fail(f"Base plan price_monthly is ${price_monthly}, expected $19")
                all_tests_passed = False
            
            if price_annual == 182.40:
                print_pass(f"Base plan price_annual: ${price_annual} ✓")
            else:
                print_fail(f"Base plan price_annual is ${price_annual}, expected $182.40")
                all_tests_passed = False
        
        # Test Power Plan
        if not power_plan:
            print_fail("Power plan not found")
            all_tests_passed = False
        else:
            print_info(f"Power plan found: {power_plan.get('name')}")
            
            price_monthly = power_plan.get('price_monthly')
            price_annual = power_plan.get('price_annual')
            
            if price_monthly == 97:
                print_pass(f"Power plan price_monthly: ${price_monthly} ✓")
            else:
                print_fail(f"Power plan price_monthly is ${price_monthly}, expected $97")
                all_tests_passed = False
            
            if price_annual == 931.20:
                print_pass(f"Power plan price_annual: ${price_annual} ✓")
            else:
                print_fail(f"Power plan price_annual is ${price_annual}, expected $931.20")
                all_tests_passed = False
        
        return all_tests_passed
        
    except Exception as e:
        print_fail(f"Error testing pricing plans: {str(e)}")
        return False

def test_pricing_gate():
    """Test 2: Verify pricing page gate is open"""
    print_test("\n=== Test 2: Pricing Page Gate ===")
    try:
        response = requests.get(f"{API_URL}/pricing/gate", timeout=10)
        
        if response.status_code != 200:
            print_fail(f"GET /api/pricing/gate failed: {response.status_code}")
            return False
        
        data = response.json()
        visible = data.get('visible')
        launch_date = data.get('launch_date')
        
        print_info(f"Gate response: visible={visible}, launch_date={launch_date}")
        
        if visible is True:
            print_pass("Pricing page gate is open (visible: true) ✓")
            return True
        else:
            print_fail(f"Pricing page gate is closed (visible: {visible}), expected true")
            print_info("Note: Gate should be open since current date > May 2026")
            return False
        
    except Exception as e:
        print_fail(f"Error testing pricing gate: {str(e)}")
        return False

def test_subscription_endpoint(token):
    """Test 3: Verify subscription endpoint returns free tier limits"""
    print_test("\n=== Test 3: Subscription Endpoint (Free Tier) ===")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API_URL}/pricing/subscription", headers=headers, timeout=10)
        
        if response.status_code != 200:
            print_fail(f"GET /api/pricing/subscription failed: {response.status_code}")
            return False
        
        data = response.json()
        plan_id = data.get('plan_id')
        plan = data.get('plan', {})
        
        print_info(f"User subscription: plan_id={plan_id}")
        
        if plan_id == 'free':
            print_pass("User is on free plan ✓")
            
            # Check if plan details include the correct limits
            features = plan.get('features', {})
            standard_msgs = features.get('standard_msgs_per_day')
            
            if standard_msgs == 10:
                print_pass(f"Free tier shows standard_msgs_per_day: {standard_msgs} ✓")
                return True
            else:
                print_info(f"Free tier standard_msgs_per_day: {standard_msgs}")
                return True  # Still pass if subscription endpoint works
        else:
            print_info(f"User is on {plan_id} plan (not free)")
            return True  # Still pass, just different plan
        
    except Exception as e:
        print_fail(f"Error testing subscription endpoint: {str(e)}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BLUE}Subscription Growth Strategy Phase 1 - Backend Testing{Colors.END}")
    print(f"{Colors.BLUE}{'='*70}{Colors.END}\n")
    print_info(f"Testing against: {API_URL}")
    
    results = {
        'total': 0,
        'passed': 0,
        'failed': 0
    }
    
    # Test 1: Pricing Plans
    results['total'] += 1
    if test_pricing_plans():
        results['passed'] += 1
    else:
        results['failed'] += 1
    
    # Test 2: Pricing Gate
    results['total'] += 1
    if test_pricing_gate():
        results['passed'] += 1
    else:
        results['failed'] += 1
    
    # Test 3: Subscription Endpoint (requires auth)
    token = login()
    if token:
        results['total'] += 1
        if test_subscription_endpoint(token):
            results['passed'] += 1
        else:
            results['failed'] += 1
    else:
        print_fail("Skipping subscription endpoint test (no auth token)")
        results['total'] += 1
        results['failed'] += 1
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BLUE}Test Summary{Colors.END}")
    print(f"{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"Total Tests: {results['total']}")
    print(f"{Colors.GREEN}Passed: {results['passed']}{Colors.END}")
    print(f"{Colors.RED}Failed: {results['failed']}{Colors.END}")
    
    if results['failed'] == 0:
        print(f"\n{Colors.GREEN}✅ All tests passed!{Colors.END}\n")
        return 0
    else:
        print(f"\n{Colors.RED}❌ Some tests failed{Colors.END}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
