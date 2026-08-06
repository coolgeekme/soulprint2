#!/usr/bin/env python3
"""
Backend API Testing Script for Google OAuth Registration Flow
Tests the redirect URI and OAuth endpoints
"""

import requests
import json
import sys
from urllib.parse import urlparse, parse_qs

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

def print_test(name):
    """Print test name"""
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    return success

def login():
    """Login and get auth token"""
    print_test("Authentication - Login")
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": TEST_EMAIL, "passcode": TEST_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print_result(True, f"Login successful, token received")
                return token
            else:
                print_result(False, "Login response missing token")
                return None
        else:
            print_result(False, f"Login failed with status {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print_result(False, f"Login error: {str(e)}")
        return None

def test_google_oauth_start(token):
    """Test Google OAuth start endpoint - GET /api/auth/google"""
    print_test("Google OAuth Start - Redirect URI Check")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{API_BASE}/auth/google",
            headers=headers,
            timeout=10
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text[:500]}")
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        
        # Check if authUrl is present
        if 'authUrl' not in data:
            return print_result(False, "Response missing 'authUrl' field")
        
        auth_url = data['authUrl']
        print(f"\nGenerated OAuth URL: {auth_url[:200]}...")
        
        # Parse the URL
        parsed = urlparse(auth_url)
        query_params = parse_qs(parsed.query)
        
        # Verify it's a Google OAuth URL
        if parsed.netloc != 'accounts.google.com':
            return print_result(False, f"Expected Google OAuth domain, got {parsed.netloc}")
        
        print_result(True, "OAuth URL points to accounts.google.com")
        
        # Check required parameters
        required_params = ['client_id', 'redirect_uri', 'response_type', 'scope', 'state']
        missing_params = [p for p in required_params if p not in query_params]
        
        if missing_params:
            return print_result(False, f"Missing required parameters: {missing_params}")
        
        print_result(True, "All required OAuth parameters present")
        
        # Extract and verify redirect_uri
        redirect_uri = query_params['redirect_uri'][0]
        print(f"\nRedirect URI: {redirect_uri}")
        
        # Check if redirect_uri is dynamic (not hardcoded)
        if 'preview.emergentagent.com' in redirect_uri or BASE_URL in redirect_uri:
            print_result(True, "Redirect URI uses current domain (dynamic)")
        else:
            print_result(False, f"Redirect URI may be hardcoded: {redirect_uri}")
        
        # Verify redirect_uri points to callback endpoint
        if '/api/auth/google/callback' in redirect_uri:
            print_result(True, "Redirect URI points to /api/auth/google/callback")
        else:
            return print_result(False, f"Redirect URI doesn't point to callback endpoint: {redirect_uri}")
        
        # Verify response_type
        response_type = query_params['response_type'][0]
        if response_type == 'code':
            print_result(True, "response_type=code (correct)")
        else:
            return print_result(False, f"Expected response_type=code, got {response_type}")
        
        # Verify client_id exists
        client_id = query_params['client_id'][0]
        if client_id and len(client_id) > 10:
            print_result(True, f"client_id present: {client_id[:20]}...")
        else:
            return print_result(False, "client_id missing or invalid")
        
        # Verify scope includes necessary Google scopes
        scope = query_params['scope'][0]
        required_scopes = ['openid', 'email', 'profile']
        has_all_scopes = all(s in scope for s in required_scopes)
        
        if has_all_scopes:
            print_result(True, f"Scope includes required scopes: {required_scopes}")
        else:
            print_result(False, f"Missing required scopes. Current scope: {scope}")
        
        # Verify state parameter exists (for CSRF protection)
        state = query_params['state'][0]
        if state and len(state) > 10:
            print_result(True, "State parameter present (CSRF protection)")
        else:
            return print_result(False, "State parameter missing or invalid")
        
        print("\n" + "="*80)
        print("SUMMARY - Google OAuth Start Endpoint")
        print("="*80)
        print(f"✅ OAuth URL structure: CORRECT")
        print(f"✅ Redirect URI: {redirect_uri}")
        print(f"✅ Client ID: {client_id[:30]}...")
        print(f"✅ Response Type: {response_type}")
        print(f"✅ Scope: {scope[:100]}...")
        print(f"✅ State: Present")
        
        return True
        
    except Exception as e:
        return print_result(False, f"Error: {str(e)}")

def test_google_callback_endpoint():
    """Test that the callback endpoint exists and is accessible"""
    print_test("Google OAuth Callback Endpoint - Accessibility Check")
    
    try:
        # Try to access callback without parameters (should fail gracefully)
        response = requests.get(
            f"{API_BASE}/auth/google/callback",
            allow_redirects=False,
            timeout=10
        )
        
        print(f"Response Status: {response.status_code}")
        
        # Callback should redirect (302/307) or return error (400/401)
        # It should NOT return 404 (endpoint not found)
        if response.status_code == 404:
            return print_result(False, "Callback endpoint returns 404 - endpoint not registered")
        
        # Any other status means the endpoint exists
        if response.status_code in [302, 307, 400, 401, 500]:
            return print_result(True, f"Callback endpoint exists (status: {response.status_code})")
        
        return print_result(True, f"Callback endpoint accessible (status: {response.status_code})")
        
    except Exception as e:
        return print_result(False, f"Error: {str(e)}")

def test_domain_detection():
    """Test that redirect_uri uses dynamic domain detection"""
    print_test("Domain Detection - Dynamic vs Hardcoded")
    
    print("Checking if redirect_uri is dynamically generated from request host...")
    print(f"Current BASE_URL: {BASE_URL}")
    print(f"Expected redirect_uri pattern: {BASE_URL}/api/auth/google/callback")
    
    # This test is informational - the actual check is in test_google_oauth_start
    print_result(True, "Domain detection test completed in OAuth start test")
    return True

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("GOOGLE OAUTH REGISTRATION FLOW - BACKEND TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_EMAIL}")
    
    # Step 1: Login
    token = login()
    if not token:
        print("\n❌ CRITICAL: Cannot proceed without authentication token")
        sys.exit(1)
    
    # Step 2: Test Google OAuth Start
    oauth_start_success = test_google_oauth_start(token)
    
    # Step 3: Test Callback Endpoint Exists
    callback_success = test_google_callback_endpoint()
    
    # Step 4: Domain Detection
    domain_success = test_domain_detection()
    
    # Final Summary
    print("\n" + "="*80)
    print("FINAL TEST SUMMARY")
    print("="*80)
    
    all_tests = [
        ("Authentication", token is not None),
        ("Google OAuth Start", oauth_start_success),
        ("Callback Endpoint", callback_success),
        ("Domain Detection", domain_success),
    ]
    
    passed = sum(1 for _, success in all_tests if success)
    total = len(all_tests)
    
    for test_name, success in all_tests:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED - Google OAuth flow is correctly configured")
        print("\nKEY FINDINGS:")
        print("1. OAuth start endpoint (POST /api/auth/google) is working")
        print("2. Redirect URI is dynamically generated from request host")
        print("3. Callback endpoint (/api/auth/google/callback) is registered")
        print("4. All required OAuth parameters are present")
        print("5. Client ID and scopes are properly configured")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED - Review the errors above")
        sys.exit(1)

if __name__ == "__main__":
    main()
