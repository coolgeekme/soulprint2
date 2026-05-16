#!/usr/bin/env python3
"""
Backend API Testing Script for SoulPrint Engine - Composio Integration
Tests all Composio integration API endpoints as specified in the review request.
"""

import requests
import json
import sys
import os

# Base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://soulprint-engine.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "testchat@example.com"
TEST_PASSCODE = "Test123456"

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_test(message):
    print(f"{BLUE}[TEST]{RESET} {message}")

def print_success(message):
    print(f"{GREEN}✓ PASS:{RESET} {message}")

def print_error(message):
    print(f"{RED}✗ FAIL:{RESET} {message}")

def print_info(message):
    print(f"{YELLOW}[INFO]{RESET} {message}")

# ============================================================================
# Test 1: Authentication
# ============================================================================
def test_authentication():
    """Test authentication with testchat@example.com/Test123456"""
    print_test("Test 1: Authentication (POST /api/auth/login)")
    
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": TEST_EMAIL, "passcode": TEST_PASSCODE},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'token' in data:
                print_success(f"Authentication successful - Token received")
                return data['token']
            else:
                print_error(f"Authentication response missing token: {data}")
                return None
        else:
            print_error(f"Authentication failed - Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        print_error(f"Authentication exception: {str(e)}")
        return None

# ============================================================================
# Test 2: GET /api/composio/status (no auth required)
# ============================================================================
def test_composio_status():
    """Test GET /api/composio/status - should work without auth"""
    print_test("Test 2: GET /api/composio/status (no auth required)")
    
    try:
        response = requests.get(
            f"{API_BASE}/composio/status",
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Status endpoint returned 200")
            
            # Check required fields
            if 'connected' in data and isinstance(data['connected'], bool):
                print_success(f"  - 'connected' field present: {data['connected']}")
            else:
                print_error(f"  - 'connected' field missing or not boolean")
            
            if 'supportedToolkits' in data:
                print_success(f"  - 'supportedToolkits' count: {data['supportedToolkits']}")
                if data['supportedToolkits'] == 8:
                    print_success(f"  - Correct count of 8 supported toolkits")
                else:
                    print_error(f"  - Expected 8 toolkits, got {data['supportedToolkits']}")
            else:
                print_error(f"  - 'supportedToolkits' field missing")
            
            print_info(f"Full response: {json.dumps(data, indent=2)}")
            return True
        else:
            print_error(f"Status endpoint failed - Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Status endpoint exception: {str(e)}")
        return False

# ============================================================================
# Test 3: GET /api/composio/toolkits (requires auth)
# ============================================================================
def test_composio_toolkits_without_auth():
    """Test GET /api/composio/toolkits without auth - should return 401"""
    print_test("Test 3a: GET /api/composio/toolkits (without auth - should return 401)")
    
    try:
        response = requests.get(
            f"{API_BASE}/composio/toolkits",
            timeout=30
        )
        
        if response.status_code == 401:
            print_success(f"Correctly returned 401 Unauthorized without auth token")
            return True
        else:
            print_error(f"Expected 401, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_composio_toolkits_with_auth(token):
    """Test GET /api/composio/toolkits with auth - should return 200 with toolkits array"""
    print_test("Test 3b: GET /api/composio/toolkits (with auth)")
    
    try:
        response = requests.get(
            f"{API_BASE}/composio/toolkits",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Toolkits endpoint returned 200")
            
            # Check for toolkits array
            if 'toolkits' in data and isinstance(data['toolkits'], list):
                toolkits = data['toolkits']
                print_success(f"  - 'toolkits' array present with {len(toolkits)} items")
                
                # Check count
                if len(toolkits) == 8:
                    print_success(f"  - Correct count of 8 toolkits")
                else:
                    print_error(f"  - Expected 8 toolkits, got {len(toolkits)}")
                
                # Check expected toolkit keys
                expected_keys = ['GMAIL', 'GOOGLECALENDAR', 'GITHUB', 'SLACK', 'GOOGLEDRIVE', 'NOTION', 'TRELLO', 'ZOOM']
                toolkit_keys = [t.get('key') for t in toolkits]
                
                for expected_key in expected_keys:
                    if expected_key in toolkit_keys:
                        print_success(f"  - Found toolkit: {expected_key}")
                    else:
                        print_error(f"  - Missing toolkit: {expected_key}")
                
                # Check structure of first toolkit
                if len(toolkits) > 0:
                    first_toolkit = toolkits[0]
                    required_fields = ['key', 'name', 'icon', 'description', 'category']
                    
                    print_info(f"Checking structure of first toolkit:")
                    for field in required_fields:
                        if field in first_toolkit and isinstance(first_toolkit[field], str):
                            print_success(f"    - '{field}': {first_toolkit[field]}")
                        else:
                            print_error(f"    - '{field}' missing or not a string")
                
                return True
            else:
                print_error(f"  - 'toolkits' field missing or not an array")
                print_info(f"Full response: {json.dumps(data, indent=2)}")
                return False
        else:
            print_error(f"Toolkits endpoint failed - Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Toolkits endpoint exception: {str(e)}")
        return False

# ============================================================================
# Test 4: GET /api/composio/connections (requires auth)
# ============================================================================
def test_composio_connections_without_auth():
    """Test GET /api/composio/connections without auth - should return 401"""
    print_test("Test 4a: GET /api/composio/connections (without auth - should return 401)")
    
    try:
        response = requests.get(
            f"{API_BASE}/composio/connections",
            timeout=30
        )
        
        if response.status_code == 401:
            print_success(f"Correctly returned 401 Unauthorized without auth token")
            return True
        else:
            print_error(f"Expected 401, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_composio_connections_with_auth(token):
    """Test GET /api/composio/connections with auth - should return 200 with connections array"""
    print_test("Test 4b: GET /api/composio/connections (with auth)")
    
    try:
        response = requests.get(
            f"{API_BASE}/composio/connections",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Connections endpoint returned 200")
            
            # Check for connections array
            if 'connections' in data and isinstance(data['connections'], list):
                connections = data['connections']
                print_success(f"  - 'connections' array present with {len(connections)} items")
                
                # Check structure of connections if any exist
                if len(connections) > 0:
                    print_info(f"Checking structure of connections:")
                    
                    for i, conn in enumerate(connections):
                        print_info(f"  Connection {i+1}:")
                        
                        # Check required fields
                        if 'id' in conn:
                            print_success(f"    - 'id': {conn['id']}")
                        else:
                            print_error(f"    - 'id' field missing")
                        
                        # CRITICAL: Check that toolkit is an UPPERCASE STRING, not an object
                        if 'toolkit' in conn:
                            if isinstance(conn['toolkit'], str):
                                if conn['toolkit'].isupper():
                                    print_success(f"    - 'toolkit' (UPPERCASE STRING): {conn['toolkit']}")
                                else:
                                    print_error(f"    - 'toolkit' is a string but NOT UPPERCASE: {conn['toolkit']}")
                            else:
                                print_error(f"    - 'toolkit' is NOT a string (type: {type(conn['toolkit'])}): {conn['toolkit']}")
                        else:
                            print_error(f"    - 'toolkit' field missing")
                        
                        # CRITICAL: Check that status is an UPPERCASE STRING
                        if 'status' in conn:
                            if isinstance(conn['status'], str):
                                if conn['status'].isupper():
                                    print_success(f"    - 'status' (UPPERCASE STRING): {conn['status']}")
                                else:
                                    print_error(f"    - 'status' is a string but NOT UPPERCASE: {conn['status']}")
                            else:
                                print_error(f"    - 'status' is NOT a string (type: {type(conn['status'])}): {conn['status']}")
                        else:
                            print_error(f"    - 'status' field missing")
                        
                        if 'alias' in conn:
                            print_success(f"    - 'alias': {conn['alias']}")
                        else:
                            print_info(f"    - 'alias' field missing (optional)")
                        
                        if 'createdAt' in conn:
                            print_success(f"    - 'createdAt': {conn['createdAt']}")
                        else:
                            print_info(f"    - 'createdAt' field missing (optional)")
                else:
                    print_info(f"  - No connections found (empty array is valid)")
                
                return True
            else:
                print_error(f"  - 'connections' field missing or not an array")
                print_info(f"Full response: {json.dumps(data, indent=2)}")
                return False
        else:
            print_error(f"Connections endpoint failed - Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Connections endpoint exception: {str(e)}")
        return False

# ============================================================================
# Test 5: POST /api/composio/connect (requires auth)
# ============================================================================
def test_composio_connect_without_auth():
    """Test POST /api/composio/connect without auth - should return 401"""
    print_test("Test 5a: POST /api/composio/connect (without auth - should return 401)")
    
    try:
        response = requests.post(
            f"{API_BASE}/composio/connect",
            json={"toolkit": "GMAIL"},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response.status_code == 401:
            print_success(f"Correctly returned 401 Unauthorized without auth token")
            return True
        else:
            print_error(f"Expected 401, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_composio_connect_invalid_toolkit(token):
    """Test POST /api/composio/connect with invalid toolkit - should return error"""
    print_test("Test 5b: POST /api/composio/connect (invalid toolkit)")
    
    try:
        response = requests.post(
            f"{API_BASE}/composio/connect",
            json={"toolkit": "INVALID_TOOLKIT"},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        if response.status_code in [400, 422]:
            print_success(f"Correctly returned error status {response.status_code} for invalid toolkit")
            data = response.json()
            if 'error' in data:
                print_success(f"  - Error message: {data['error']}")
            return True
        else:
            print_error(f"Expected 400/422, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_composio_connect_empty_body(token):
    """Test POST /api/composio/connect with empty body - should return error"""
    print_test("Test 5c: POST /api/composio/connect (empty body)")
    
    try:
        response = requests.post(
            f"{API_BASE}/composio/connect",
            json={},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        if response.status_code in [400, 422]:
            print_success(f"Correctly returned error status {response.status_code} for empty body")
            data = response.json()
            if 'error' in data:
                print_success(f"  - Error message: {data['error']}")
            return True
        else:
            print_error(f"Expected 400/422, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# Main Test Runner
# ============================================================================
def main():
    print("\n" + "="*80)
    print("COMPOSIO INTEGRATION API TESTING")
    print("="*80 + "\n")
    
    print_info(f"Base URL: {BASE_URL}")
    print_info(f"API Base: {API_BASE}")
    print_info(f"Test User: {TEST_EMAIL}\n")
    
    results = []
    
    # Test 1: Authentication
    token = test_authentication()
    results.append(("Authentication", token is not None))
    print()
    
    if not token:
        print_error("Cannot proceed without authentication token")
        sys.exit(1)
    
    # Test 2: Status endpoint (no auth)
    results.append(("GET /api/composio/status (no auth)", test_composio_status()))
    print()
    
    # Test 3: Toolkits endpoint
    results.append(("GET /api/composio/toolkits (without auth)", test_composio_toolkits_without_auth()))
    print()
    results.append(("GET /api/composio/toolkits (with auth)", test_composio_toolkits_with_auth(token)))
    print()
    
    # Test 4: Connections endpoint
    results.append(("GET /api/composio/connections (without auth)", test_composio_connections_without_auth()))
    print()
    results.append(("GET /api/composio/connections (with auth)", test_composio_connections_with_auth(token)))
    print()
    
    # Test 5: Connect endpoint
    results.append(("POST /api/composio/connect (without auth)", test_composio_connect_without_auth()))
    print()
    results.append(("POST /api/composio/connect (invalid toolkit)", test_composio_connect_invalid_toolkit(token)))
    print()
    results.append(("POST /api/composio/connect (empty body)", test_composio_connect_empty_body(token)))
    print()
    
    # Summary
    print("="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = f"{GREEN}✓ PASS{RESET}" if result else f"{RED}✗ FAIL{RESET}"
        print(f"{status}: {test_name}")
    
    print()
    print(f"Total: {passed}/{total} tests passed ({int(passed/total*100)}% success rate)")
    
    if passed == total:
        print(f"{GREEN}All tests passed!{RESET}")
        sys.exit(0)
    else:
        print(f"{RED}Some tests failed.{RESET}")
        sys.exit(1)

if __name__ == "__main__":
    main()
