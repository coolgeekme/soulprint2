#!/usr/bin/env python3
"""
Backend testing script for SoulPrint Engine Video Generation endpoints
"""

import requests
import json
import base64
import io
from PIL import Image
import sys
import time

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

def test_video_generation(token):
    """Test POST /api/media/generate for video generation"""
    print("\n🎬 Testing video generation...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "type": "video",
        "model": "kling-3",
        "prompt": "a cat walking on a beach",
        "duration": "5"
    }
    
    try:
        print("Sending video generation request...")
        response = requests.post(f"{BASE_URL}/api/media/generate", json=data, headers=headers, timeout=60)
        print(f"Video generation response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Video generation successful")
            print(f"Success: {result.get('success', False)}")
            print(f"Task ID: {result.get('taskId', 'none')}")
            print(f"Media ID: {result.get('mediaId', 'none')}")
            print(f"Type: {result.get('type', 'none')}")
            print(f"Status: {result.get('status', 'none')}")
            
            # Return taskId for status polling tests
            return result.get('taskId')
        else:
            print(f"❌ Video generation failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data}")
            except:
                print(f"Response text: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Video generation error: {e}")
        return None

def test_video_status_mobile(token, task_id):
    """Test GET /api/media/status/:taskId (mobile path)"""
    print(f"\n📱 Testing video status polling (mobile path) for task: {task_id}")
    
    if not task_id:
        print("❌ No task ID provided")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        response = requests.get(f"{BASE_URL}/api/media/status/{task_id}", headers=headers, timeout=30)
        print(f"Video status (mobile) response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Video status (mobile) successful")
            print(f"Status: {result.get('status', 'none')}")
            print(f"Progress: {result.get('progress', 'none')}")
            if result.get('url'):
                print(f"URL present: True")
            else:
                print(f"URL present: False (expected for generating status)")
            return True
        elif response.status_code == 404:
            print("❌ Video status (mobile) failed: Task not found")
            return False
        else:
            print(f"❌ Video status (mobile) failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data}")
            except:
                print(f"Response text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Video status (mobile) error: {e}")
        return False

def test_video_status_desktop(token, task_id):
    """Test GET /api/media/video/status/:taskId (desktop path)"""
    print(f"\n🖥️  Testing video status polling (desktop path) for task: {task_id}")
    
    if not task_id:
        print("❌ No task ID provided")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        response = requests.get(f"{BASE_URL}/api/media/video/status/{task_id}", headers=headers, timeout=30)
        print(f"Video status (desktop) response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Video status (desktop) successful")
            print(f"Status: {result.get('status', 'none')}")
            print(f"Progress: {result.get('progress', 'none')}")
            if result.get('url'):
                print(f"URL present: True")
            else:
                print(f"URL present: False (expected for generating status)")
            return True
        elif response.status_code == 404:
            print("❌ Video status (desktop) failed: Task not found")
            return False
        else:
            print(f"❌ Video status (desktop) failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data}")
            except:
                print(f"Response text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Video status (desktop) error: {e}")
        return False

def test_save_to_gallery(token):
    """Test POST /api/media/save-to-gallery"""
    print("\n💾 Testing save to gallery...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "url": "https://example.com/video.mp4",
        "prompt": "test video",
        "model": "kling-3",
        "modelLabel": "Kling 3.0",
        "type": "video"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/media/save-to-gallery", json=data, headers=headers, timeout=30)
        print(f"Save to gallery response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Save to gallery successful")
            print(f"Success: {result.get('success', False)}")
            print(f"Media ID: {result.get('mediaId', 'none')}")
            return True
        else:
            print(f"❌ Save to gallery failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data}")
            except:
                print(f"Response text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Save to gallery error: {e}")
        return False

def test_media_gallery(token):
    """Test GET /api/media/gallery"""
    print("\n🖼️  Testing media gallery...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        response = requests.get(f"{BASE_URL}/api/media/gallery", headers=headers, timeout=30)
        print(f"Media gallery response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Media gallery successful")
            print(f"Items count: {len(result) if isinstance(result, list) else 'not a list'}")
            
            # Check if we have any video items
            video_items = [item for item in result if isinstance(item, dict) and item.get('type') == 'video']
            print(f"Video items: {len(video_items)}")
            
            if video_items:
                print("Sample video item fields:")
                sample = video_items[0]
                for key in ['id', 'type', 'model', 'model_label', 'prompt', 'url', 'status']:
                    if key in sample:
                        print(f"  {key}: {sample[key]}")
            
            return True
        else:
            print(f"❌ Media gallery failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data}")
            except:
                print(f"Response text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Media gallery error: {e}")
        return False

def test_video_validation_errors(token):
    """Test validation errors for video endpoints"""
    print("\n🚫 Testing video validation errors...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test missing type in media/generate
    try:
        response = requests.post(f"{BASE_URL}/api/media/generate", json={"prompt": "test"}, headers=headers, timeout=30)
        if response.status_code == 400:
            error_data = response.json()
            if "type must be" in error_data.get('error', ''):
                print("✅ Media/generate validation working (missing type)")
            else:
                print(f"⚠️  Unexpected error message: {error_data}")
        else:
            print(f"⚠️  Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"❌ Validation test error: {e}")
    
    # Test missing prompt in media/generate
    try:
        response = requests.post(f"{BASE_URL}/api/media/generate", json={"type": "video", "model": "kling-3"}, headers=headers, timeout=30)
        if response.status_code == 400:
            error_data = response.json()
            if "prompt required" in error_data.get('error', ''):
                print("✅ Media/generate validation working (missing prompt)")
            else:
                print(f"⚠️  Unexpected error message: {error_data}")
        else:
            print(f"⚠️  Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"❌ Validation test error: {e}")
    
    # Test missing url in save-to-gallery
    try:
        response = requests.post(f"{BASE_URL}/api/media/save-to-gallery", json={"prompt": "test"}, headers=headers, timeout=30)
        if response.status_code == 400:
            error_data = response.json()
            if "url required" in error_data.get('error', ''):
                print("✅ Save-to-gallery validation working (missing url)")
            else:
                print(f"⚠️  Unexpected error message: {error_data}")
        else:
            print(f"⚠️  Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"❌ Validation test error: {e}")

def test_video_auth_required():
    """Test that video endpoints require authentication"""
    print("\n🔒 Testing video auth requirements...")
    
    # Test media/generate without token
    try:
        response = requests.post(f"{BASE_URL}/api/media/generate", json={"type": "video", "model": "kling-3", "prompt": "test"}, timeout=30)
        if response.status_code == 401:
            print("✅ Media/generate requires auth (401 without token)")
        else:
            print(f"⚠️  Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Auth test error: {e}")
    
    # Test media/gallery without token
    try:
        response = requests.get(f"{BASE_URL}/api/media/gallery", timeout=30)
        if response.status_code == 401:
            print("✅ Media/gallery requires auth (401 without token)")
        else:
            print(f"⚠️  Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Auth test error: {e}")
    
    # Test save-to-gallery without token
    try:
        response = requests.post(f"{BASE_URL}/api/media/save-to-gallery", json={"url": "test"}, timeout=30)
        if response.status_code == 401:
            print("✅ Save-to-gallery requires auth (401 without token)")
        else:
            print(f"⚠️  Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Auth test error: {e}")

def test_invalid_task_id_status(token):
    """Test status endpoints with invalid task ID"""
    print("\n🔍 Testing invalid task ID handling...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    invalid_task_id = "invalid-task-id-12345"
    
    # Test mobile status endpoint
    try:
        response = requests.get(f"{BASE_URL}/api/media/status/{invalid_task_id}", headers=headers, timeout=30)
        if response.status_code == 404:
            print("✅ Mobile status endpoint handles invalid task ID (404)")
        else:
            print(f"⚠️  Expected 404, got {response.status_code}")
    except Exception as e:
        print(f"❌ Invalid task ID test error: {e}")
    
    # Test desktop status endpoint
    try:
        response = requests.get(f"{BASE_URL}/api/media/video/status/{invalid_task_id}", headers=headers, timeout=30)
        if response.status_code == 404:
            print("✅ Desktop status endpoint handles invalid task ID (404)")
        else:
            print(f"⚠️  Expected 404, got {response.status_code}")
    except Exception as e:
        print(f"❌ Invalid task ID test error: {e}")

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
    print("🚀 Starting SoulPrint Engine Video Generation Backend Tests")
    print(f"Base URL: {BASE_URL}")
    
    # Test authentication first
    token = test_auth()
    if not token:
        print("\n❌ Cannot proceed without authentication")
        return False
    
    # Test auth requirements for video endpoints
    test_video_auth_required()
    
    # Test validation errors for video endpoints
    test_video_validation_errors(token)
    
    # Test invalid task ID handling
    test_invalid_task_id_status(token)
    
    # Test the main video endpoints
    results = []
    task_id = None
    
    # Test video generation
    print("\n" + "="*60)
    print("🎬 TESTING VIDEO GENERATION ENDPOINTS")
    print("="*60)
    
    task_id = test_video_generation(token)
    results.append(task_id is not None)
    
    # Test video status polling (both mobile and desktop paths)
    if task_id:
        results.append(test_video_status_mobile(token, task_id))
        results.append(test_video_status_desktop(token, task_id))
    else:
        print("\n❌ Skipping status tests - no task ID from video generation")
        results.extend([False, False])
    
    # Test save to gallery
    results.append(test_save_to_gallery(token))
    
    # Test media gallery
    results.append(test_media_gallery(token))
    
    # Summary
    print("\n" + "="*60)
    print("📊 VIDEO GENERATION TEST SUMMARY")
    print("="*60)
    
    test_names = [
        "Video Generation (POST /api/media/generate)",
        "Video Status Mobile (GET /api/media/status/:taskId)",
        "Video Status Desktop (GET /api/media/video/status/:taskId)",
        "Save to Gallery (POST /api/media/save-to-gallery)",
        "Media Gallery (GET /api/media/gallery)"
    ]
    
    passed = sum(results)
    total = len(results)
    
    print(f"✅ Passed: {passed}/{total}")
    if passed < total:
        print(f"❌ Failed: {total - passed}/{total}")
    
    print("\nDetailed Results:")
    for i, (test_name, result) in enumerate(zip(test_names, results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {i+1}. {test_name}: {status}")
    
    if passed == total:
        print("\n🎉 All video generation endpoints are working!")
        return True
    else:
        print(f"\n⚠️  {total - passed} endpoint(s) have issues")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)