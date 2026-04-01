#!/usr/bin/env python3
"""
Smart Composite API Backend Testing
Tests authentication and Smart Composite API endpoints as per review request
"""

import requests
import json
import base64
import time
import sys
from io import BytesIO
from PIL import Image

# Configuration
BASE_URL = "https://image-routing-patch.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

# Test credentials
auth_token = None

def create_small_red_square_base64():
    """Create a small 50x50 red square PNG as base64"""
    try:
        # Create a 50x50 red image
        img = Image.new('RGB', (50, 50), color='red')
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        base64_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{base64_data}"
    except Exception as e:
        print(f"Error creating red square: {e}")
        return None

def test_authentication():
    """Test 1: Authentication - POST /api/auth/login"""
    global auth_token
    
    print("\n=== Test 1: Authentication ===")
    
    try:
        url = f"{BASE_URL}/api/auth/login"
        payload = {
            "email": TEST_EMAIL,
            "passcode": TEST_PASSWORD
        }
        
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if 'token' in data:
                auth_token = data['token']
                print("✅ PASS: Authentication successful, token received")
                return True
            else:
                print("❌ FAIL: No token in response")
                return False
        else:
            print(f"❌ FAIL: Authentication failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Authentication error: {e}")
        return False

def test_composite_url_input():
    """Test 2: Composite Test Endpoint - URL Input"""
    print("\n=== Test 2: Composite Test Endpoint - URL Input ===")
    
    if not auth_token:
        print("❌ FAIL: No auth token available")
        return False
    
    try:
        url = f"{BASE_URL}/api/composite/test"
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "baseImage": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800",
            "overlayImage": "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=200",
            "instruction": "Place this logo on the center of the t-shirt"
        }
        
        print(f"POST {url}")
        print(f"Headers: Authorization: Bearer {auth_token[:20]}...")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print("Note: This test may take 15-30 seconds due to GPT-4o Vision analysis...")
        
        # Use 120 second timeout as specified
        response = requests.post(url, json=payload, headers=headers, timeout=120)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify required fields
            required_fields = ['success', 'url', 'placement']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"❌ FAIL: Missing required fields: {missing_fields}")
                return False
            
            if not data.get('success'):
                print("❌ FAIL: success field is not true")
                return False
                
            if not data.get('url'):
                print("❌ FAIL: url field is empty")
                return False
                
            placement = data.get('placement', {})
            placement_fields = ['x_percent', 'y_percent', 'width_percent', 'height_percent', 'surface_type']
            missing_placement = [field for field in placement_fields if field not in placement]
            
            if missing_placement:
                print(f"❌ FAIL: Missing placement fields: {missing_placement}")
                return False
                
            print("✅ PASS: Composite test endpoint working correctly")
            print(f"  - URL: {data['url']}")
            print(f"  - Surface Type: {placement.get('surface_type')}")
            print(f"  - Placement: {placement.get('x_percent')}%, {placement.get('y_percent')}%")
            return True
        else:
            print(f"❌ FAIL: Composite test failed with status {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ FAIL: Request timed out (>120 seconds)")
        return False
    except Exception as e:
        print(f"❌ FAIL: Composite test error: {e}")
        return False

def test_composite_missing_input():
    """Test 3: Composite Test Endpoint - Missing Input"""
    print("\n=== Test 3: Composite Test Endpoint - Missing Input ===")
    
    if not auth_token:
        print("❌ FAIL: No auth token available")
        return False
    
    try:
        url = f"{BASE_URL}/api/composite/test"
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "baseImage": "https://example.com/img.png"
            # Missing overlayImage intentionally
        }
        
        print(f"POST {url}")
        print(f"Headers: Authorization: Bearer {auth_token[:20]}...")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            print("✅ PASS: Correctly returns 400 error for missing overlayImage")
            return True
        else:
            print(f"❌ FAIL: Expected 400 error, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Missing input test error: {e}")
        return False

def test_composite_unauthorized():
    """Test 4: Composite Test Endpoint - Unauthorized"""
    print("\n=== Test 4: Composite Test Endpoint - Unauthorized ===")
    
    try:
        url = f"{BASE_URL}/api/composite/test"
        payload = {
            "baseImage": "https://example.com/img.png",
            "overlayImage": "https://example.com/logo.png",
            "instruction": "Place logo on image"
        }
        
        print(f"POST {url}")
        print("Headers: No Authorization header")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 401:
            print("✅ PASS: Correctly returns 401 unauthorized")
            return True
        else:
            print(f"❌ FAIL: Expected 401 error, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Unauthorized test error: {e}")
        return False

def test_mockup_generate():
    """Test 5: Mockup Generate Endpoint"""
    print("\n=== Test 5: Mockup Generate Endpoint ===")
    
    if not auth_token:
        print("❌ FAIL: No auth token available")
        return False
    
    try:
        # Create small red square base64
        red_square_base64 = create_small_red_square_base64()
        if not red_square_base64:
            print("❌ FAIL: Could not create red square base64")
            return False
        
        url = f"{BASE_URL}/api/mockup/generate"
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "design": {
                "base64": red_square_base64.split(',')[1]  # Remove data:image/png;base64, prefix
            },
            "product": "white t-shirt"
        }
        
        print(f"POST {url}")
        print(f"Headers: Authorization: Bearer {auth_token[:20]}...")
        print(f"Payload: design.base64 length: {len(payload['design']['base64'])} chars, product: {payload['product']}")
        print("Note: This test will take 30-60 seconds as it generates a base image with DALL-E and then composites...")
        
        # Use 180 second timeout as specified
        response = requests.post(url, json=payload, headers=headers, timeout=180)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'url' in data and data['url']:
                print("✅ PASS: Mockup generate endpoint working correctly")
                print(f"  - URL: {data['url']}")
                print(f"  - Product: {data.get('product', 'N/A')}")
                print(f"  - Method: {data.get('method', 'N/A')}")
                return True
            else:
                print("❌ FAIL: No url property in response")
                return False
        else:
            print(f"❌ FAIL: Mockup generate failed with status {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ FAIL: Request timed out (>180 seconds)")
        return False
    except Exception as e:
        print(f"❌ FAIL: Mockup generate error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Smart Composite API Backend Testing")
    print("=" * 50)
    
    test_results = []
    
    # Run all tests
    test_results.append(("Authentication", test_authentication()))
    test_results.append(("Composite URL Input", test_composite_url_input()))
    test_results.append(("Composite Missing Input", test_composite_missing_input()))
    test_results.append(("Composite Unauthorized", test_composite_unauthorized()))
    test_results.append(("Mockup Generate", test_mockup_generate()))
    
    # Summary
    print("\n" + "=" * 50)
    print("🏁 TEST SUMMARY")
    print("=" * 50)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())