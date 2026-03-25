#!/usr/bin/env python3
"""
Smart Composite API Rotation Fix Testing
Tests the rotation fix for the Smart Composite API endpoint.
"""

import requests
import json
import base64
import time
import sys
import os

# Test configuration
BASE_URL = "https://smart-composite.preview.emergentagent.com"
LOGIN_EMAIL = "test@soulprint.com"
LOGIN_PASSCODE = "test123"

def create_test_images():
    """Create test images using sharp-like approach with PIL"""
    try:
        from PIL import Image, ImageDraw
        
        # Create base image (vehicle-like with perspective)
        base = Image.new('RGB', (800, 600), color=(120, 140, 160))
        draw = ImageDraw.Draw(base)
        
        # Draw a simple vehicle-like shape with perspective
        # Front face (lighter)
        draw.polygon([(100, 200), (300, 180), (300, 400), (100, 420)], fill=(180, 180, 200))
        # Side face (darker, showing perspective)
        draw.polygon([(300, 180), (600, 200), (600, 420), (300, 400)], fill=(140, 140, 160))
        # Top face
        draw.polygon([(100, 200), (300, 180), (600, 200), (400, 220)], fill=(200, 200, 220))
        
        # Add some details to make it look more vehicle-like
        # Windows
        draw.rectangle([(120, 220), (280, 280)], fill=(100, 150, 200))  # Front window
        draw.rectangle([(320, 210), (580, 270)], fill=(100, 150, 200))  # Side window
        
        # Door line (this should have a slight slope for 3/4 view)
        draw.line([(100, 350), (600, 340)], fill=(80, 80, 100), width=3)
        
        # Convert to base64
        import io
        base_buffer = io.BytesIO()
        base.save(base_buffer, format='PNG')
        base_b64 = base64.b64encode(base_buffer.getvalue()).decode()
        
        # Create logo image (red rectangle)
        logo = Image.new('RGBA', (200, 100), color=(255, 0, 0, 255))
        draw_logo = ImageDraw.Draw(logo)
        draw_logo.text((50, 35), "LOGO", fill=(255, 255, 255, 255))
        
        logo_buffer = io.BytesIO()
        logo.save(logo_buffer, format='PNG')
        logo_b64 = base64.b64encode(logo_buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{base_b64}", f"data:image/png;base64,{logo_b64}"
        
    except ImportError:
        print("PIL not available, using simple base64 encoded test images")
        # Fallback: create minimal test images as base64
        # This is a 1x1 pixel PNG in base64
        simple_base = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        simple_logo = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        return f"data:image/png;base64,{simple_base}", f"data:image/png;base64,{simple_logo}"

def test_authentication():
    """Test authentication with provided credentials"""
    print("🔐 Testing Authentication...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": LOGIN_EMAIL,
                "passcode": LOGIN_PASSCODE
            },
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                print(f"   ✅ Authentication successful")
                print(f"   User ID: {data.get('userId', 'N/A')}")
                print(f"   Role: {data.get('role', 'N/A')}")
                return data["token"]
            else:
                print(f"   ❌ No token in response: {data}")
                return None
        else:
            print(f"   ❌ Authentication failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"   ❌ Authentication error: {str(e)}")
        return None

def test_composite_vehicle_rotation(token):
    """Test composite with vehicle instruction - should return non-zero rotation"""
    print("\n🚗 Testing Vehicle Composite (Rotation Fix)...")
    
    try:
        base_image, logo_image = create_test_images()
        
        response = requests.post(
            f"{BASE_URL}/api/composite/test",
            json={
                "baseImage": base_image,
                "overlayImage": logo_image,
                "instruction": "Place logo on the side door of this minivan in 3/4 view"
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=60  # Longer timeout for AI processing
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Request successful")
            print(f"   Success: {data.get('success', False)}")
            
            if data.get('success'):
                placement = data.get('placement', {})
                rotation = placement.get('rotation_degrees', 0)
                surface_angle = placement.get('surface_angle', 0)
                perspective_direction = placement.get('perspective_direction', 'none')
                
                print(f"   📊 Placement Analysis:")
                print(f"      Rotation Degrees: {rotation}")
                print(f"      Surface Angle: {surface_angle}")
                print(f"      Perspective Direction: {perspective_direction}")
                print(f"      Position: ({placement.get('x_percent', 0)}, {placement.get('y_percent', 0)})")
                print(f"      Size: {placement.get('width_percent', 0)}% x {placement.get('height_percent', 0)}%")
                
                # Verify rotation fix criteria
                rotation_ok = abs(rotation) > 0.5  # Should be non-zero for vehicles
                surface_angle_ok = surface_angle > 0  # Should be > 0 for 3/4 view
                perspective_ok = perspective_direction in ['left', 'right']  # Should not be 'none'
                
                print(f"   🔍 Rotation Fix Verification:")
                print(f"      Non-zero rotation: {'✅' if rotation_ok else '❌'} ({rotation}°)")
                print(f"      Surface angle > 0: {'✅' if surface_angle_ok else '❌'} ({surface_angle}°)")
                print(f"      Perspective direction: {'✅' if perspective_ok else '❌'} ({perspective_direction})")
                
                if data.get('url'):
                    print(f"   🖼️  Composite URL: {data['url'][:100]}...")
                
                return rotation_ok and surface_angle_ok and perspective_ok
            else:
                print(f"   ❌ Composite failed: {data}")
                return False
        else:
            print(f"   ❌ Request failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Vehicle composite test error: {str(e)}")
        return False

def test_composite_flat_surface(token):
    """Test composite with flat surface instruction - should return near-zero rotation"""
    print("\n📄 Testing Flat Surface Composite...")
    
    try:
        base_image, logo_image = create_test_images()
        
        response = requests.post(
            f"{BASE_URL}/api/composite/test",
            json={
                "baseImage": base_image,
                "overlayImage": logo_image,
                "instruction": "Place this logo on the center of this white paper"
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=60
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Request successful")
            print(f"   Success: {data.get('success', False)}")
            
            if data.get('success'):
                placement = data.get('placement', {})
                rotation = placement.get('rotation_degrees', 0)
                
                print(f"   📊 Placement Analysis:")
                print(f"      Rotation Degrees: {rotation}")
                print(f"      Surface Type: {placement.get('surface_type', 'unknown')}")
                
                # Verify flat surface criteria
                rotation_ok = abs(rotation) <= 2  # Should be near 0 (±2) for flat surfaces
                
                print(f"   🔍 Flat Surface Verification:")
                print(f"      Near-zero rotation (±2°): {'✅' if rotation_ok else '❌'} ({rotation}°)")
                
                return rotation_ok
            else:
                print(f"   ❌ Composite failed: {data}")
                return False
        else:
            print(f"   ❌ Request failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Flat surface composite test error: {str(e)}")
        return False

def test_input_validation(token):
    """Test input validation - missing overlayImage should return 400"""
    print("\n🔍 Testing Input Validation...")
    
    try:
        base_image, _ = create_test_images()
        
        response = requests.post(
            f"{BASE_URL}/api/composite/test",
            json={
                "baseImage": base_image,
                # Missing overlayImage
                "instruction": "Place logo on the surface"
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 400:
            print(f"   ✅ Correctly returned 400 for missing overlayImage")
            return True
        else:
            print(f"   ❌ Expected 400, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Input validation test error: {str(e)}")
        return False

def test_auth_validation():
    """Test auth validation - no token should return 401"""
    print("\n🔒 Testing Auth Validation...")
    
    try:
        base_image, logo_image = create_test_images()
        
        response = requests.post(
            f"{BASE_URL}/api/composite/test",
            json={
                "baseImage": base_image,
                "overlayImage": logo_image,
                "instruction": "Place logo on the surface"
            },
            headers={"Content-Type": "application/json"},
            # No Authorization header
            timeout=30
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 401:
            print(f"   ✅ Correctly returned 401 for missing auth token")
            return True
        else:
            print(f"   ❌ Expected 401, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Auth validation test error: {str(e)}")
        return False

def main():
    """Run all Smart Composite rotation fix tests"""
    print("🎯 Smart Composite API Rotation Fix Testing")
    print("=" * 50)
    
    # Test results
    results = {
        "auth": False,
        "vehicle_rotation": False,
        "flat_surface": False,
        "input_validation": False,
        "auth_validation": False
    }
    
    # Test 1: Authentication
    token = test_authentication()
    if token:
        results["auth"] = True
        
        # Test 2: Vehicle composite with rotation
        results["vehicle_rotation"] = test_composite_vehicle_rotation(token)
        
        # Test 3: Flat surface composite
        results["flat_surface"] = test_composite_flat_surface(token)
        
        # Test 4: Input validation
        results["input_validation"] = test_input_validation(token)
    
    # Test 5: Auth validation (no token needed)
    results["auth_validation"] = test_auth_validation()
    
    # Summary
    print("\n" + "=" * 50)
    print("📋 TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(results.values())
    total = len(results)
    
    for test_name, passed_test in results.items():
        status = "✅ PASS" if passed_test else "❌ FAIL"
        print(f"   {test_name.replace('_', ' ').title()}: {status}")
    
    print(f"\n🎯 Overall Result: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Smart Composite rotation fix is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Please check the implementation.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)