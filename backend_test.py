#!/usr/bin/env python3
"""
Backend testing script for SoulPrint Engine Image Edit and Smart Composite endpoints
"""

import requests
import json
import base64
import io
from PIL import Image
import sys

# Base URL from environment
BASE_URL = "https://ai-image-craft-18.preview.emergentagent.com"

def create_test_image(color, size=(50, 50)):
    """Create a small test image in base64 format"""
    img = Image.new('RGB', size, color)
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_data = buffer.getvalue()
    return base64.b64encode(img_data).decode('utf-8')

def test_auth():
    """Test authentication and get token"""
    print("🔐 Testing authentication...")
    
    auth_data = {
        "email": "test@soulprint.com",
        "passcode": "test123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=auth_data, timeout=30)
        print(f"Auth response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print("✅ Authentication successful")
                return token
            else:
                print("❌ No token in response")
                print(f"Response: {data}")
                return None
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data}")
            except:
                print(f"Response text: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Authentication error: {e}")
        return None

def test_image_edit_text_only(token):
    """Test POST /api/image/edit with text-based editing"""
    print("\n🎨 Testing image edit (text-based)...")
    
    # Create a red test image
    red_image_b64 = create_test_image('red')
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "image": {
            "base64": red_image_b64,
            "mimeType": "image/png"
        },
        "prompt": "make this image more vibrant"
    }
    
    try:
        print("Sending image edit request...")
        response = requests.post(f"{BASE_URL}/api/image/edit", json=data, headers=headers, timeout=60)
        print(f"Image edit response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Image edit successful")
            print(f"Method: {result.get('method', 'unknown')}")
            print(f"URL present: {'url' in result}")
            print(f"Original prompt: {result.get('originalPrompt', 'none')}")
            
            # Check if method starts with "gemini-" as expected
            method = result.get('method', '')
            if method.startswith('gemini-'):
                print("✅ Using Gemini as primary engine (METHOD 0)")
            else:
                print(f"⚠️  Method '{method}' doesn't start with 'gemini-'")
            
            return True
        else:
            print(f"❌ Image edit failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data}")
            except:
                print(f"Response text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Image edit error: {e}")
        return False

def test_image_edit_with_overlay(token):
    """Test POST /api/image/edit with overlayImage (composite via edit endpoint)"""
    print("\n🔄 Testing image edit with overlay (composite pipeline)...")
    
    # Create test images
    red_image_b64 = create_test_image('red', (100, 100))
    blue_image_b64 = create_test_image('blue', (30, 30))
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "image": {
            "base64": red_image_b64,
            "mimeType": "image/png"
        },
        "prompt": "place this logo on the shirt",
        "overlayImage": {
            "base64": blue_image_b64,
            "mimeType": "image/png"
        }
    }
    
    try:
        print("Sending image edit with overlay request...")
        response = requests.post(f"{BASE_URL}/api/image/edit", json=data, headers=headers, timeout=60)
        print(f"Image edit with overlay response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Image edit with overlay successful")
            print(f"Method: {result.get('method', 'unknown')}")
            print(f"URL present: {'url' in result}")
            print(f"Original prompt: {result.get('originalPrompt', 'none')}")
            return True
        else:
            print(f"❌ Image edit with overlay failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data}")
            except:
                print(f"Response text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Image edit with overlay error: {e}")
        return False

def test_composite_direct(token):
    """Test POST /api/composite/test (direct composite testing)"""
    print("\n🎯 Testing direct composite endpoint...")
    
    # Create test images
    red_image_b64 = create_test_image('red', (100, 100))
    blue_image_b64 = create_test_image('blue', (30, 30))
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "baseImage": red_image_b64,
        "overlayImage": blue_image_b64,
        "instruction": "Place this logo on the t-shirt"
    }
    
    try:
        print("Sending composite test request...")
        response = requests.post(f"{BASE_URL}/api/composite/test", json=data, headers=headers, timeout=60)
        print(f"Composite test response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Composite test successful")
            print(f"Success: {result.get('success', False)}")
            print(f"URL present: {'url' in result}")
            
            # Check for placement data
            placements = result.get('placements', [])
            if placements:
                print(f"Placements found: {len(placements)}")
                for i, placement in enumerate(placements):
                    print(f"  Placement {i+1}: x={placement.get('x_percent')}%, y={placement.get('y_percent')}%, w={placement.get('width_percent')}%, h={placement.get('height_percent')}%")
            else:
                print("No placement data found")
            
            return True
        else:
            print(f"❌ Composite test failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data}")
            except:
                print(f"Response text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Composite test error: {e}")
        return False

def test_validation_errors(token):
    """Test validation errors for the endpoints"""
    print("\n🚫 Testing validation errors...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test missing image in image/edit
    try:
        response = requests.post(f"{BASE_URL}/api/image/edit", json={"prompt": "test"}, headers=headers, timeout=30)
        if response.status_code == 400:
            error_data = response.json()
            if "Image and prompt are required" in error_data.get('error', ''):
                print("✅ Image/edit validation working (missing image)")
            else:
                print(f"⚠️  Unexpected error message: {error_data}")
        else:
            print(f"⚠️  Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"❌ Validation test error: {e}")
    
    # Test missing baseImage in composite/test
    try:
        response = requests.post(f"{BASE_URL}/api/composite/test", json={"overlayImage": "test"}, headers=headers, timeout=30)
        if response.status_code == 400:
            error_data = response.json()
            if "baseImage and overlayImage are required" in error_data.get('error', ''):
                print("✅ Composite/test validation working (missing baseImage)")
            else:
                print(f"⚠️  Unexpected error message: {error_data}")
        else:
            print(f"⚠️  Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"❌ Validation test error: {e}")

def test_auth_required():
    """Test that endpoints require authentication"""
    print("\n🔒 Testing auth requirements...")
    
    # Test image/edit without token
    try:
        response = requests.post(f"{BASE_URL}/api/image/edit", json={"image": {"base64": "test"}, "prompt": "test"}, timeout=30)
        if response.status_code == 401:
            print("✅ Image/edit requires auth (401 without token)")
        else:
            print(f"⚠️  Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Auth test error: {e}")
    
    # Test composite/test without token
    try:
        response = requests.post(f"{BASE_URL}/api/composite/test", json={"baseImage": "test", "overlayImage": "test"}, timeout=30)
        if response.status_code == 401:
            print("✅ Composite/test requires auth (401 without token)")
        else:
            print(f"⚠️  Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Auth test error: {e}")

def main():
    """Main test function"""
    print("🚀 Starting SoulPrint Engine Backend Tests")
    print(f"Base URL: {BASE_URL}")
    
    # Test authentication first
    token = test_auth()
    if not token:
        print("\n❌ Cannot proceed without authentication")
        return False
    
    # Test auth requirements
    test_auth_required()
    
    # Test validation errors
    test_validation_errors(token)
    
    # Test the main endpoints
    results = []
    
    # Test text-based image editing
    results.append(test_image_edit_text_only(token))
    
    # Test image editing with overlay (composite pipeline)
    results.append(test_image_edit_with_overlay(token))
    
    # Test direct composite endpoint
    results.append(test_composite_direct(token))
    
    # Summary
    print("\n" + "="*50)
    print("📊 TEST SUMMARY")
    print("="*50)
    
    passed = sum(results)
    total = len(results)
    
    print(f"✅ Passed: {passed}/{total}")
    if passed < total:
        print(f"❌ Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 All critical endpoints are working!")
        return True
    else:
        print(f"\n⚠️  {total - passed} endpoint(s) have issues")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)