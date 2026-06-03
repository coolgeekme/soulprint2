#!/usr/bin/env python3
"""
Backend Test for Imprints Marketplace Phase 1
Tests all 7 endpoints as specified in the review request
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com/api"
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

# ANSI color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_test(message):
    print(f"{BLUE}[TEST]{RESET} {message}")

def print_success(message):
    print(f"{GREEN}✓{RESET} {message}")

def print_error(message):
    print(f"{RED}✗{RESET} {message}")

def print_info(message):
    print(f"{YELLOW}ℹ{RESET} {message}")

def login():
    """Login and get auth token"""
    print_test("Logging in to get auth token...")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": TEST_EMAIL, "passcode": TEST_PASSWORD},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print_success(f"Login successful. Token received.")
                return token
            else:
                print_error(f"Login response missing token: {data}")
                return None
        else:
            print_error(f"Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_error(f"Login exception: {str(e)}")
        return None

def test_get_imprints_public():
    """Test 1: GET /api/imprints (Public, no auth needed)"""
    print_test("\n=== TEST 1: GET /api/imprints (Public) ===")
    
    try:
        response = requests.get(f"{BASE_URL}/imprints", timeout=60)
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check response structure
            if 'imprints' not in data:
                print_error("Response missing 'imprints' field")
                return False
            
            if 'categories' not in data:
                print_error("Response missing 'categories' field")
                return False
            
            imprints = data['imprints']
            categories = data['categories']
            
            print_success(f"Response has correct structure")
            print_info(f"Total imprints: {len(imprints)}")
            print_info(f"Categories: {categories}")
            
            # Check if auto-seeding happened (should have 50 imprints)
            if len(imprints) >= 50:
                print_success(f"Auto-seeding successful - found {len(imprints)} imprints")
            else:
                print_info(f"Found {len(imprints)} imprints (expected 50 from seed)")
            
            # Verify imprint structure
            if len(imprints) > 0:
                first_imprint = imprints[0]
                required_fields = ['id', 'name', 'slug', 'icon', 'color', 'category', 'tags', 
                                 'short_description', 'description', 'rating_avg', 'rating_count', 
                                 'install_count', 'created_at']
                
                missing_fields = [f for f in required_fields if f not in first_imprint]
                if missing_fields:
                    print_error(f"Imprint missing fields: {missing_fields}")
                    return False
                
                print_success(f"Imprint structure valid")
                print_info(f"Sample imprint: {first_imprint['name']} ({first_imprint['slug']})")
            
            return True
        else:
            print_error(f"Failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_get_imprints_with_filters(imprints_data):
    """Test 1b: GET /api/imprints with query params"""
    print_test("\n=== TEST 1b: GET /api/imprints with filters ===")
    
    all_passed = True
    
    # Test category filter
    try:
        print_test("Testing ?category=creative filter...")
        response = requests.get(f"{BASE_URL}/imprints?category=creative", timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            creative_imprints = data['imprints']
            
            # Verify all are creative category
            all_creative = all(imp['category'] == 'creative' for imp in creative_imprints)
            if all_creative:
                print_success(f"Category filter working - found {len(creative_imprints)} creative imprints")
            else:
                print_error("Category filter returned non-creative imprints")
                all_passed = False
        else:
            print_error(f"Category filter failed: {response.status_code}")
            all_passed = False
    except Exception as e:
        print_error(f"Category filter exception: {str(e)}")
        all_passed = False
    
    # Test search filter
    try:
        print_test("Testing ?search=code filter...")
        response = requests.get(f"{BASE_URL}/imprints?search=code", timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            search_results = data['imprints']
            print_success(f"Search filter working - found {len(search_results)} results for 'code'")
        else:
            print_error(f"Search filter failed: {response.status_code}")
            all_passed = False
    except Exception as e:
        print_error(f"Search filter exception: {str(e)}")
        all_passed = False
    
    # Test sort filter
    try:
        print_test("Testing ?sort=newest filter...")
        response = requests.get(f"{BASE_URL}/imprints?sort=newest", timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            sorted_imprints = data['imprints']
            print_success(f"Sort filter working - returned {len(sorted_imprints)} imprints")
        else:
            print_error(f"Sort filter failed: {response.status_code}")
            all_passed = False
    except Exception as e:
        print_error(f"Sort filter exception: {str(e)}")
        all_passed = False
    
    return all_passed

def test_get_imprint_by_slug(slug):
    """Test 2: GET /api/imprints/:slug (Public)"""
    print_test(f"\n=== TEST 2: GET /api/imprints/{slug} (Public) ===")
    
    try:
        response = requests.get(f"{BASE_URL}/imprints/{slug}", timeout=30)
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'imprint' not in data:
                print_error("Response missing 'imprint' field")
                return False
            
            imprint = data['imprint']
            
            # Check for system_prompt in instructions
            if 'instructions' not in imprint:
                print_error("Imprint missing 'instructions' field")
                return False
            
            if 'system_prompt' not in imprint['instructions']:
                print_error("Imprint instructions missing 'system_prompt' field")
                return False
            
            print_success(f"Imprint detail retrieved successfully")
            print_info(f"Name: {imprint['name']}")
            print_info(f"Category: {imprint['category']}")
            print_info(f"System prompt length: {len(imprint['instructions']['system_prompt'])} chars")
            
            return True
        else:
            print_error(f"Failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_get_my_imprints(token):
    """Test 3: GET /api/imprints/my (Auth required)"""
    print_test("\n=== TEST 3: GET /api/imprints/my (Auth required) ===")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/imprints/my", headers=headers, timeout=30)
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check response structure
            if 'default_imprint' not in data:
                print_error("Response missing 'default_imprint' field")
                return False, None
            
            if 'project_imprints' not in data:
                print_error("Response missing 'project_imprints' field")
                return False, None
            
            print_success(f"My imprints retrieved successfully")
            print_info(f"Default imprint: {data['default_imprint']}")
            print_info(f"Project imprints: {len(data['project_imprints'])}")
            
            return True, data
        else:
            print_error(f"Failed with status {response.status_code}: {response.text}")
            return False, None
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False, None

def test_install_imprint(token, imprint_id):
    """Test 4: POST /api/imprints/install (Auth required)"""
    print_test(f"\n=== TEST 4: POST /api/imprints/install (Auth required) ===")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "imprint_id": imprint_id,
            "usage_type": "default"
        }
        
        response = requests.post(
            f"{BASE_URL}/imprints/install",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'success' not in data or not data['success']:
                print_error(f"Install failed: {data}")
                return False
            
            print_success(f"Imprint installed successfully")
            print_info(f"Response: {data}")
            
            return True
        else:
            print_error(f"Failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_uninstall_imprint(token):
    """Test 5: POST /api/imprints/uninstall (Auth required)"""
    print_test("\n=== TEST 5: POST /api/imprints/uninstall (Auth required) ===")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "usage_type": "default"
        }
        
        response = requests.post(
            f"{BASE_URL}/imprints/uninstall",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'success' not in data or not data['success']:
                print_error(f"Uninstall failed: {data}")
                return False
            
            print_success(f"Imprint uninstalled successfully")
            print_info(f"Response: {data}")
            
            return True
        else:
            print_error(f"Failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_rate_imprint(token, imprint_id):
    """Test 6: POST /api/imprints/rate (Auth required)"""
    print_test(f"\n=== TEST 6: POST /api/imprints/rate (Auth required) ===")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "imprint_id": imprint_id,
            "rating": 5
        }
        
        response = requests.post(
            f"{BASE_URL}/imprints/rate",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'success' not in data or not data['success']:
                print_error(f"Rating failed: {data}")
                return False
            
            print_success(f"Imprint rated successfully")
            print_info(f"New average rating: {data.get('new_avg_rating', 'N/A')}")
            
            return True
        else:
            print_error(f"Failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_generate_imprint(token):
    """Test 7: POST /api/imprints/generate (Auth required, calls OpenAI GPT-4o)"""
    print_test("\n=== TEST 7: POST /api/imprints/generate (Auth required, calls OpenAI) ===")
    print_info("This test calls OpenAI GPT-4o and may take 5-10 seconds...")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "description": "A witty British butler who helps with productivity and time management",
            "name": "Jeeves",
            "category": "personality"
        }
        
        response = requests.post(
            f"{BASE_URL}/imprints/generate",
            headers=headers,
            json=payload,
            timeout=60  # Longer timeout for OpenAI call
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'success' not in data or not data['success']:
                print_error(f"Generation failed: {data}")
                return False
            
            if 'imprint' not in data:
                print_error("Response missing 'imprint' field")
                return False
            
            imprint = data['imprint']
            
            # Verify generated imprint has required fields
            required_fields = ['name', 'slug', 'category', 'description', 'instructions']
            missing_fields = [f for f in required_fields if f not in imprint]
            
            if missing_fields:
                print_error(f"Generated imprint missing fields: {missing_fields}")
                return False
            
            # Check for system_prompt
            if 'system_prompt' not in imprint['instructions']:
                print_error("Generated imprint missing system_prompt")
                return False
            
            print_success(f"Imprint generated successfully via OpenAI GPT-4o")
            print_info(f"Generated name: {imprint['name']}")
            print_info(f"Generated slug: {imprint['slug']}")
            print_info(f"System prompt length: {len(imprint['instructions']['system_prompt'])} chars")
            print_info(f"Message: {data.get('message', 'N/A')}")
            
            return True
        else:
            print_error(f"Failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def main():
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Imprints Marketplace Phase 1 - Backend API Testing{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    results = []
    
    # Step 1: Login
    token = login()
    if not token:
        print_error("\nFailed to login. Cannot proceed with authenticated tests.")
        sys.exit(1)
    
    # Step 2: Test GET /api/imprints (Public)
    result = test_get_imprints_public()
    results.append(("GET /api/imprints (Public)", result))
    
    # Get imprints data for subsequent tests
    try:
        response = requests.get(f"{BASE_URL}/imprints", timeout=30)
        imprints_data = response.json()
        imprints = imprints_data.get('imprints', [])
        
        if len(imprints) > 0:
            test_slug = imprints[0]['slug']
            test_imprint_id = imprints[0]['id']
        else:
            print_error("No imprints found for testing")
            sys.exit(1)
    except Exception as e:
        print_error(f"Failed to get imprints data: {str(e)}")
        sys.exit(1)
    
    # Step 3: Test query params
    result = test_get_imprints_with_filters(imprints_data)
    results.append(("GET /api/imprints with filters", result))
    
    # Step 4: Test GET /api/imprints/:slug (Public)
    result = test_get_imprint_by_slug(test_slug)
    results.append((f"GET /api/imprints/{test_slug} (Public)", result))
    
    # Step 5: Test GET /api/imprints/my (Auth)
    result, my_imprints_data = test_get_my_imprints(token)
    results.append(("GET /api/imprints/my (Auth)", result))
    
    # Step 6: Test POST /api/imprints/install (Auth)
    result = test_install_imprint(token, test_imprint_id)
    results.append(("POST /api/imprints/install (Auth)", result))
    
    # Step 7: Verify installation by checking /api/imprints/my again
    if result:
        print_test("\n=== Verifying installation ===")
        result_verify, my_imprints_after = test_get_my_imprints(token)
        if result_verify and my_imprints_after:
            if my_imprints_after['default_imprint'] is not None:
                print_success("Installation verified - default_imprint is now set")
            else:
                print_error("Installation not reflected in /api/imprints/my")
    
    # Step 8: Test POST /api/imprints/rate (Auth)
    result = test_rate_imprint(token, test_imprint_id)
    results.append(("POST /api/imprints/rate (Auth)", result))
    
    # Step 9: Test POST /api/imprints/generate (Auth, OpenAI)
    result = test_generate_imprint(token)
    results.append(("POST /api/imprints/generate (Auth, OpenAI)", result))
    
    # Step 10: Test POST /api/imprints/uninstall (Auth)
    result = test_uninstall_imprint(token)
    results.append(("POST /api/imprints/uninstall (Auth)", result))
    
    # Step 11: Verify uninstallation
    if result:
        print_test("\n=== Verifying uninstallation ===")
        result_verify, my_imprints_after = test_get_my_imprints(token)
        if result_verify and my_imprints_after:
            if my_imprints_after['default_imprint'] is None:
                print_success("Uninstallation verified - default_imprint is now null")
            else:
                print_error("Uninstallation not reflected in /api/imprints/my")
    
    # Print summary
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"{status} - {test_name}")
    
    print(f"\n{BLUE}Total: {passed}/{total} tests passed{RESET}")
    
    if passed == total:
        print(f"\n{GREEN}✓ All tests passed!{RESET}\n")
        sys.exit(0)
    else:
        print(f"\n{RED}✗ Some tests failed{RESET}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
