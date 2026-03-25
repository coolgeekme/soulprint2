#!/usr/bin/env python3
"""
Smart Composite API Testing Suite
Tests the new screen-print simulation pipeline after major refactoring
"""

import requests
import json
import base64
import time
import sys
from io import BytesIO

# Test configuration
BASE_URL = "https://smart-composite.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSCODE = "test123"

def create_test_images():
    """Create test images using PIL (fallback if sharp not available)"""
    try:
        from PIL import Image, ImageDraw
        
        # Create base image (800x600 blue background)
        base = Image.new('RGBA', (800, 600), (120, 140, 160, 255))
        base_buffer = BytesIO()
        base.save(base_buffer, format='PNG')
        base_b64 = base64.b64encode(base_buffer.getvalue()).decode()
        
        # Create logo image (200x100 red rectangle)
        logo = Image.new('RGBA', (200, 100), (255, 0, 0, 255))
        logo_buffer = BytesIO()
        logo.save(logo_buffer, format='PNG')
        logo_b64 = base64.b64encode(logo_buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{base_b64}", f"data:image/png;base64,{logo_b64}"
        
    except ImportError:
        print("PIL not available, using minimal base64 images")
        # Minimal 1x1 PNG images as fallback
        base_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg=="
        logo_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        return f"data:image/png;base64,{base_b64}", f"data:image/png;base64,{logo_b64}"

def test_authentication():
    """Test authentication endpoint"""
    print("🔐 Testing Authentication...")
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "passcode": TEST_PASSCODE
        }, timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            role = data.get('role')
            print(f"✅ Authentication successful! Role: {role}")
            return token
        else:
            print(f"❌ Authentication failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Authentication error: {str(e)}")
        return None

def test_composite_api(token, test_name, instruction, expected_surface_type=None, expected_brightness_range=None):
    """Test Smart Composite API with specific instruction"""
    print(f"\n🎨 Testing {test_name}...")
    print(f"Instruction: '{instruction}'")
    
    try:
        base_image, overlay_image = create_test_images()
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "baseImage": base_image,
            "overlayImage": overlay_image,
            "instruction": instruction
        }
        
        print("Sending request to /api/composite/test...")
        response = requests.post(f"{BASE_URL}/api/composite/test", 
                               json=payload, 
                               headers=headers, 
                               timeout=60)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ {test_name} successful!")
            
            # Validate response structure
            if 'success' in data and data['success']:
                print("✅ Success field present and true")
            else:
                print("⚠️ Success field missing or false")
            
            if 'url' in data:
                print(f"✅ URL returned: {data['url'][:50]}...")
            else:
                print("❌ URL missing from response")
            
            if 'placement' in data and isinstance(data['placement'], list):
                placements = data['placement']
                print(f"✅ Placements array returned with {len(placements)} item(s)")
                
                for i, placement in enumerate(placements):
                    print(f"  Placement {i+1}:")
                    print(f"    - target_description: {placement.get('target_description', 'N/A')}")
                    print(f"    - surface_type: {placement.get('surface_type', 'N/A')}")
                    print(f"    - position: {placement.get('x_percent', 'N/A')}%, {placement.get('y_percent', 'N/A')}%")
                    print(f"    - size: {placement.get('width_percent', 'N/A')}% x {placement.get('height_percent', 'N/A')}%")
                    print(f"    - rotation_degrees: {placement.get('rotation_degrees', 'N/A')}")
                    print(f"    - brightness_adjust: {placement.get('brightness_adjust', 'N/A')}")
                    
                    # Validate expected surface type
                    if expected_surface_type and placement.get('surface_type') == expected_surface_type:
                        print(f"    ✅ Surface type matches expected: {expected_surface_type}")
                    elif expected_surface_type:
                        print(f"    ⚠️ Surface type '{placement.get('surface_type')}' doesn't match expected '{expected_surface_type}'")
                    
                    # Validate brightness adjustment range
                    brightness = placement.get('brightness_adjust')
                    if expected_brightness_range and brightness is not None:
                        min_bright, max_bright = expected_brightness_range
                        if min_bright <= brightness <= max_bright:
                            print(f"    ✅ Brightness adjustment {brightness} in expected range [{min_bright}, {max_bright}]")
                        else:
                            print(f"    ⚠️ Brightness adjustment {brightness} outside expected range [{min_bright}, {max_bright}]")
            else:
                print("❌ Placements array missing or invalid")
            
            if 'scene_description' in data:
                print(f"✅ Scene description: {data['scene_description']}")
            else:
                print("⚠️ Scene description missing")
            
            if 'remove_background' in data:
                print(f"✅ Remove background: {data['remove_background']}")
            else:
                print("⚠️ Remove background field missing")
            
            return True
            
        else:
            print(f"❌ {test_name} failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ {test_name} error: {str(e)}")
        return False

def test_input_validation(token):
    """Test input validation (missing overlayImage)"""
    print("\n🔍 Testing Input Validation...")
    
    try:
        base_image, _ = create_test_images()
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "baseImage": base_image,
            # Missing overlayImage intentionally
            "instruction": "Place logo on surface"
        }
        
        response = requests.post(f"{BASE_URL}/api/composite/test", 
                               json=payload, 
                               headers=headers, 
                               timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 400:
            print("✅ Input validation working - correctly returned 400 for missing overlayImage")
            return True
        else:
            print(f"❌ Expected 400 status code, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Input validation test error: {str(e)}")
        return False

def test_auth_validation():
    """Test authentication validation (no token)"""
    print("\n🔒 Testing Auth Validation...")
    
    try:
        base_image, overlay_image = create_test_images()
        
        payload = {
            "baseImage": base_image,
            "overlayImage": overlay_image,
            "instruction": "Place logo on surface"
        }
        
        # No Authorization header
        response = requests.post(f"{BASE_URL}/api/composite/test", 
                               json=payload, 
                               timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Auth validation working - correctly returned 401 for missing token")
            return True
        else:
            print(f"❌ Expected 401 status code, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Auth validation test error: {str(e)}")
        return False

def main():
    """Run all Smart Composite API tests"""
    print("🚀 Smart Composite API Testing Suite")
    print("=" * 50)
    
    # Test 1: Authentication
    token = test_authentication()
    if not token:
        print("❌ Cannot proceed without authentication token")
        sys.exit(1)
    
    test_results = []
    
    # Test 2: Fabric composite (dark surface)
    result = test_composite_api(
        token, 
        "Fabric Composite (Dark Surface)",
        "Replace the logos on both tshirts with this design",
        expected_surface_type="fabric",
        expected_brightness_range=(0.5, 0.9)  # Should be < 1.0 for dark surfaces
    )
    test_results.append(("Fabric Composite", result))
    
    # Test 3: Vehicle composite
    result = test_composite_api(
        token,
        "Vehicle Composite", 
        "Place this logo on the side door of the van",
        expected_surface_type="vehicle"
    )
    test_results.append(("Vehicle Composite", result))
    
    # Test 4: Flat surface
    result = test_composite_api(
        token,
        "Flat Surface Composite",
        "Put this logo in the center of the white paper",
        expected_brightness_range=(0.9, 1.2)  # Should be ~1.0 for bright surfaces
    )
    test_results.append(("Flat Surface", result))
    
    # Test 5: Input validation
    result = test_input_validation(token)
    test_results.append(("Input Validation", result))
    
    # Test 6: Auth validation
    result = test_auth_validation()
    test_results.append(("Auth Validation", result))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Smart Composite API is working correctly.")
        sys.exit(0)
    else:
        print("⚠️ Some tests failed. Please check the implementation.")
        sys.exit(1)

if __name__ == "__main__":
    main()