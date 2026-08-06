#!/usr/bin/env python3
"""
Backend API Testing Script for Google OAuth Flow
Tests the OAuth endpoints and redirect URI configuration
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
    """Test Case 1: Google OAuth Start Endpoint Accessible"""
    print_test("Google OAuth Start Endpoint (POST /api/auth/google)")
    
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
        
        if 'authUrl' not in data:
            return print_result(False, "Response missing 'authUrl' field")
        
        auth_url = data['authUrl']
        print(f"Auth URL received: {auth_url[:100]}...")
        
        return print_result(True, "OAuth start endpoint returns 200 with authUrl")
        
    except Exception as e:
        return print_result(False, f"Error: {str(e)}")

def test_oauth_redirect_uri(token):
    """Test Case 2: OAuth Redirect URI Check"""
    print_test("OAuth Redirect URI Validation")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{API_BASE}/auth/google",
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200:
            return print_result(False, f"Failed to get authUrl: {response.status_code}")
        
        data = response.json()
        auth_url = data.get('authUrl')
        
        if not auth_url:
            return print_result(False, "No authUrl in response")
        
        # Parse the auth URL
        parsed = urlparse(auth_url)
        params = parse_qs(parsed.query)
        
        print(f"Parsed OAuth URL:")
        print(f"  - Base: {parsed.scheme}://{parsed.netloc}{parsed.path}")
        print(f"  - Query params: {list(params.keys())}")
        
        # Check redirect_uri parameter
        if 'redirect_uri' not in params:
            return print_result(False, "Missing 'redirect_uri' parameter in OAuth URL")
        
        redirect_uri = params['redirect_uri'][0]
        print(f"  - redirect_uri: {redirect_uri}")
        
        # Verify redirect_uri is NOT undefined/null
        if not redirect_uri or redirect_uri in ['undefined', 'null', '']:
            return print_result(False, f"redirect_uri is invalid: '{redirect_uri}'")
        
        # Verify redirect_uri format
        if not redirect_uri.startswith('https://'):
            return print_result(False, f"redirect_uri should use https: {redirect_uri}")
        
        # Verify redirect_uri ends with /api/auth/google/callback
        if not redirect_uri.endswith('/api/auth/google/callback'):
            return print_result(False, f"redirect_uri should end with /api/auth/google/callback: {redirect_uri}")
        
        # Verify domain matches request host (dynamic, not hardcoded)
        redirect_domain = urlparse(redirect_uri).netloc
        expected_domain = urlparse(BASE_URL).netloc
        
        print(f"  - Redirect domain: {redirect_domain}")
        print(f"  - Expected domain: {expected_domain}")
        
        if redirect_domain != expected_domain:
            return print_result(False, f"redirect_uri domain mismatch: {redirect_domain} vs {expected_domain}")
        
        return print_result(True, f"redirect_uri is properly formed: {redirect_uri}")
        
    except Exception as e:
        return print_result(False, f"Error: {str(e)}")

def test_callback_endpoint_accessible():
    """Test Case 3: Callback Endpoint Accessible (without code - should return error but not 404)"""
    print_test("OAuth Callback Endpoint Accessibility (GET /api/auth/google/callback)")
    
    try:
        # Call callback without code parameter - should return 400/401, NOT 404
        response = requests.get(
            f"{API_BASE}/auth/google/callback",
            timeout=10,
            allow_redirects=False  # Don't follow redirects
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        # Check if it's a redirect (302/301)
        if response.status_code in [301, 302, 303, 307, 308]:
            location = response.headers.get('Location', '')
            print(f"Redirect Location: {location}")
            
            # This is acceptable - callback is redirecting (likely to error page)
            if 'error' in location:
                return print_result(True, f"Callback endpoint registered (redirects with error): {response.status_code}")
            else:
                return print_result(True, f"Callback endpoint registered (redirects): {response.status_code}")
        
        # Should NOT be 404 (endpoint not found)
        if response.status_code == 404:
            return print_result(False, "Callback endpoint returns 404 - endpoint not registered!")
        
        # 400 or 401 is acceptable (missing OAuth code)
        if response.status_code in [400, 401]:
            return print_result(True, f"Callback endpoint registered (returns {response.status_code} for missing code)")
        
        # Any other non-404 status means endpoint exists
        return print_result(True, f"Callback endpoint registered (returns {response.status_code})")
        
    except Exception as e:
        return print_result(False, f"Error: {str(e)}")

def test_oauth_url_structure(token):
    """Test Case 4: OAuth URL Structure"""
    print_test("OAuth URL Structure Validation")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{API_BASE}/auth/google",
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200:
            return print_result(False, f"Failed to get authUrl: {response.status_code}")
        
        data = response.json()
        auth_url = data.get('authUrl')
        
        if not auth_url:
            return print_result(False, "No authUrl in response")
        
        # Parse the auth URL
        parsed = urlparse(auth_url)
        params = parse_qs(parsed.query)
        
        print(f"OAuth URL Structure:")
        print(f"  - Base URL: {parsed.scheme}://{parsed.netloc}{parsed.path}")
        
        # Verify base URL
        expected_base = "https://accounts.google.com/o/oauth2/v2/auth"
        actual_base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        
        if actual_base != expected_base:
            return print_result(False, f"OAuth base URL incorrect: {actual_base} (expected {expected_base})")
        
        print(f"  ✓ Base URL correct: {expected_base}")
        
        # Check required parameters
        required_params = ['client_id', 'redirect_uri', 'response_type', 'scope', 'state']
        missing_params = []
        
        for param in required_params:
            if param not in params:
                missing_params.append(param)
            else:
                value = params[param][0]
                if param == 'response_type':
                    if value != 'code':
                        return print_result(False, f"response_type should be 'code', got '{value}'")
                    print(f"  ✓ {param}: {value}")
                elif param == 'scope':
                    print(f"  ✓ {param}: {value[:50]}...")
                elif param == 'client_id':
                    print(f"  ✓ {param}: {value[:30]}...")
                elif param == 'redirect_uri':
                    print(f"  ✓ {param}: {value}")
                elif param == 'state':
                    print(f"  ✓ {param}: {value[:30]}...")
        
        if missing_params:
            return print_result(False, f"Missing required parameters: {', '.join(missing_params)}")
        
        return print_result(True, "OAuth URL has all required parameters with correct structure")
        
    except Exception as e:
        return print_result(False, f"Error: {str(e)}")

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("GOOGLE OAUTH FLOW TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Test User: {TEST_EMAIL}")
    
    # Login first
    token = login()
    if not token:
        print("\n❌ CRITICAL: Authentication failed. Cannot proceed with OAuth tests.")
        sys.exit(1)
    
    # Run OAuth tests
    results = []
    
    # Test 1: OAuth Start Endpoint
    results.append(test_google_oauth_start(token))
    
    # Test 2: Redirect URI Check
    results.append(test_oauth_redirect_uri(token))
    
    # Test 3: Callback Endpoint Accessible
    results.append(test_callback_endpoint_accessible())
    
    # Test 4: OAuth URL Structure
    results.append(test_oauth_url_structure(token))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    total = len(results)
    passed = sum(results)
    failed = total - passed
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {(passed/total*100):.1f}%")
    
    if failed > 0:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)
    else:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)

if __name__ == "__main__":
    main()
