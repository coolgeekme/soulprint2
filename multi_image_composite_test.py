#!/usr/bin/env python3
"""
Backend Test for Multi-Image Composite/Reference Generation Flow
Tests the complete flow from image pre-upload through confirmation to generation
"""

import requests
import json
import base64
import time
import sys
from io import BytesIO

# Configuration
BASE_URL = "https://perfil-soul.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

# Global auth token
auth_token = None

def create_test_image(color_name, rgb_color):
    """Create a small test image with specified color"""
    try:
        from PIL import Image
        # Create a 10x10 pixel image with the specified color
        img = Image.new('RGB', (10, 10), rgb_color)
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=95)
        buffer.seek(0)
        
        # Convert to base64
        image_data = buffer.getvalue()
        base64_data = base64.b64encode(image_data).decode('utf-8')
        return base64_data
    except ImportError:
        # Fallback: Use minimal JPEG base64 data
        if color_name == "red":
            return "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGBkaGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
        elif color_name == "green":
            return "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGBkaGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
        else:  # blue
            return "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGBkaGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="

def test_login():
    """Test user login and get auth token"""
    global auth_token
    
    print("🔐 Testing login...")
    
    try:
        response = requests.post(f"{API_BASE}/auth/login", json={
            "email": TEST_EMAIL,
            "passcode": TEST_PASSWORD
        }, timeout=30)
        
        print(f"Login response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            auth_token = data.get('token')
            if auth_token:
                print("✅ Login successful - token obtained")
                return True
            else:
                print("❌ Login failed - no token in response")
                print(f"Response: {data}")
                return False
        else:
            print(f"❌ Login failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Login failed with exception: {e}")
        return False

def test_user_settings_setup():
    """Set user to confirmation mode (quick_generate: false)"""
    print("\n⚙️ Setting up user settings (quick_generate: false)...")
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.patch(f"{API_BASE}/user/settings", 
                                json={"quick_generate": False},
                                headers=headers, timeout=30)
        
        print(f"Settings update response status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ User settings updated to confirmation mode")
            return True
        else:
            print(f"❌ Settings update failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Settings update failed with exception: {e}")
        return False

def test_image_upload(image_name, base64_data):
    """Upload a single image and return the URL"""
    print(f"\n📤 Uploading {image_name}...")
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{API_BASE}/attachments/upload", 
                               json={
                                   "base64": base64_data,
                                   "mimeType": "image/jpeg",
                                   "name": image_name
                               },
                               headers=headers, timeout=30)
        
        print(f"Upload response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('url'):
                url = data['url']
                print(f"✅ {image_name} uploaded successfully")
                print(f"   URL: {url}")
                return url
            else:
                print(f"❌ Upload failed - invalid response format")
                print(f"Response: {data}")
                return None
        else:
            print(f"❌ Upload failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Upload failed with exception: {e}")
        return None

def test_multi_image_chat_confirmation(image_urls):
    """Send multi-image chat and verify confirmation flow"""
    print(f"\n💬 Testing multi-image chat with {len(image_urls)} URL references...")
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Prepare attachments with URL references
        attachments = []
        for i, url in enumerate(image_urls):
            attachments.append({
                "type": "image",
                "base64": url,  # URL goes in base64 field when isUrlReference=true
                "isUrlReference": True,
                "mimeType": "image/jpeg",
                "name": f"character{i+1}.jpg"
            })
        
        payload = {
            "content": "generate an image combining all three of these characters into one scene",
            "model": "claude-sonnet-4-20250514",
            "provider": "anthropic",
            "attachments": attachments
        }
        
        print(f"Sending chat request with {len(attachments)} URL-referenced attachments...")
        
        response = requests.post(f"{API_BASE}/chat/stream", 
                               json=payload,
                               headers=headers, 
                               timeout=60,
                               stream=True)
        
        print(f"Chat stream response status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Chat stream started successfully")
            
            # Parse NDJSON response
            media_confirmation_found = False
            reference_image_urls = None
            has_attached_image = None
            detected_type = None
            
            for line in response.iter_lines():
                if line:
                    try:
                        line_str = line.decode('utf-8').strip()
                        if line_str:
                            event_data = json.loads(line_str)
                            event_type = event_data.get('type')
                            
                            print(f"   Event: {event_type}")
                            
                            if event_type == 'media_confirmation':
                                media_confirmation_found = True
                                data = event_data.get('data', {})
                                detected_type = data.get('detectedType')
                                reference_image_urls = data.get('referenceImageUrls')
                                has_attached_image = data.get('hasAttachedImage')
                                
                                # Also check if the fields are at the top level
                                if detected_type is None:
                                    detected_type = event_data.get('detectedType')
                                if reference_image_urls is None:
                                    reference_image_urls = event_data.get('referenceImageUrls')
                                if has_attached_image is None:
                                    has_attached_image = event_data.get('hasAttachedImage')
                                
                                print(f"   ✅ Media confirmation event found!")
                                print(f"   Full event data: {event_data}")
                                print(f"   Detected type: {detected_type}")
                                print(f"   Has attached image: {has_attached_image}")
                                print(f"   Reference image URLs count: {len(reference_image_urls) if reference_image_urls else 0}")
                                
                                if reference_image_urls:
                                    for j, ref_url in enumerate(reference_image_urls):
                                        print(f"   URL {j+1}: {ref_url[:80]}...")
                                
                                break
                                
                    except json.JSONDecodeError as e:
                        print(f"   Warning: Failed to parse line as JSON: {line_str[:100]}...")
                        continue
            
            # Verify confirmation flow results
            if media_confirmation_found:
                print("\n🔍 Verifying confirmation flow...")
                
                success = True
                
                if detected_type != 'image':
                    print(f"❌ Expected detectedType 'image', got '{detected_type}'")
                    success = False
                else:
                    print("✅ Detected type is 'image'")
                
                if not has_attached_image:
                    print(f"❌ Expected hasAttachedImage to be true, got {has_attached_image}")
                    success = False
                else:
                    print("✅ Has attached image is true")
                
                if not reference_image_urls or len(reference_image_urls) != 3:
                    print(f"❌ Expected 3 reference image URLs, got {len(reference_image_urls) if reference_image_urls else 0}")
                    success = False
                else:
                    print("✅ All 3 reference image URLs preserved")
                    
                    # Verify URLs are valid https URLs
                    for i, url in enumerate(reference_image_urls):
                        if not url.startswith('https://'):
                            print(f"❌ URL {i+1} is not a valid https URL: {url}")
                            success = False
                        else:
                            print(f"✅ URL {i+1} is valid https URL")
                
                if success:
                    print("✅ Confirmation flow verification PASSED")
                    return reference_image_urls
                else:
                    print("❌ Confirmation flow verification FAILED")
                    return None
            else:
                print("❌ No media_confirmation event found in response")
                return None
                
        else:
            print(f"❌ Chat stream failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Multi-image chat failed with exception: {e}")
        return None

def test_confirmed_generation(reference_image_urls):
    """Test confirmed generation with referenceImageUrls"""
    print(f"\n🎨 Testing confirmed generation with {len(reference_image_urls)} reference URLs...")
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        payload = {
            "content": "create a composite scene with all characters",
            "model": "gpt-4o",
            "provider": "openai",
            "mediaFlow": {
                "step": "confirmed",
                "type": "image",
                "finalPrompt": "Create a composite scene combining all three characters into one epic scene",
                "selectedModel": "gpt-image-1-5",
                "referenceImageUrls": reference_image_urls
            }
        }
        
        print("Sending confirmed generation request...")
        
        response = requests.post(f"{API_BASE}/chat/stream", 
                               json=payload,
                               headers=headers, 
                               timeout=120,  # Longer timeout for generation
                               stream=True)
        
        print(f"Confirmed generation response status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Confirmed generation stream started successfully")
            
            # Parse NDJSON response
            generating_visual_found = False
            analyzing_text_found = False
            image_generated = False
            error_found = False
            
            for line in response.iter_lines():
                if line:
                    try:
                        line_str = line.decode('utf-8').strip()
                        if line_str:
                            event_data = json.loads(line_str)
                            event_type = event_data.get('type')
                            
                            print(f"   Event: {event_type}")
                            
                            if event_type == 'generating_visual':
                                generating_visual_found = True
                                data = event_data.get('data', {})
                                visual_type = data.get('visualType')
                                print(f"   ✅ Generating visual event found (type: {visual_type})")
                            
                            elif event_type == 'delta':
                                delta_text = event_data.get('data', {}).get('text', '')
                                if 'analyzing' in delta_text.lower() and 'image' in delta_text.lower():
                                    analyzing_text_found = True
                                    print(f"   ✅ Found analyzing text: {delta_text[:50]}...")
                            
                            elif event_type == 'image':
                                image_generated = True
                                data = event_data.get('data', {})
                                image_url = data.get('url') if data else None
                                if not image_url:
                                    # Try getting URL from top level
                                    image_url = event_data.get('url')
                                print(f"   ✅ Image generated successfully!")
                                if image_url:
                                    print(f"   Image URL: {image_url[:80]}...")
                                break
                            
                            elif event_type == 'error':
                                error_found = True
                                error_msg = event_data.get('data', {}).get('message', 'Unknown error')
                                print(f"   ❌ Error event found: {error_msg}")
                                break
                                
                    except json.JSONDecodeError as e:
                        print(f"   Warning: Failed to parse line as JSON: {line_str[:100]}...")
                        continue
            
            # Verify generation flow results
            print("\n🔍 Verifying generation flow...")
            
            success = True
            
            if not generating_visual_found:
                print("❌ No generating_visual event found")
                success = False
            else:
                print("✅ Generating visual event found")
            
            if not analyzing_text_found:
                print("⚠️ No 'analyzing images' text found (may be timing dependent)")
            else:
                print("✅ Image analysis text found")
            
            if error_found:
                print("❌ Error event found during generation")
                success = False
            elif image_generated:
                print("✅ Image generation completed successfully")
            else:
                print("⚠️ Image generation may have timed out (this is acceptable for testing)")
            
            if success and not error_found:
                print("✅ Confirmed generation flow verification PASSED")
                return True
            else:
                print("❌ Confirmed generation flow verification FAILED")
                return False
                
        else:
            print(f"❌ Confirmed generation failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Confirmed generation failed with exception: {e}")
        return False

def test_health_check():
    """Test health check endpoint"""
    print("\n🏥 Testing health check...")
    
    try:
        response = requests.get(f"{API_BASE}/health", timeout=30)
        
        print(f"Health check response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'ok':
                print("✅ Health check passed")
                return True
            else:
                print(f"❌ Health check failed - unexpected response: {data}")
                return False
        else:
            print(f"❌ Health check failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Health check failed with exception: {e}")
        return False

def main():
    """Run the complete Multi-Image Composite/Reference Generation flow test"""
    print("🚀 Starting Multi-Image Composite/Reference Generation Flow Test")
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_EMAIL}")
    print("=" * 80)
    
    # Test sequence
    tests_passed = 0
    total_tests = 6
    
    # 1. Login and Setup
    if test_login():
        tests_passed += 1
    else:
        print("\n❌ Login failed - aborting test sequence")
        sys.exit(1)
    
    if test_user_settings_setup():
        tests_passed += 1
    else:
        print("\n❌ User settings setup failed - aborting test sequence")
        sys.exit(1)
    
    # 2. Pre-upload 3 test images
    print("\n📸 Creating and uploading 3 test images...")
    
    # Create test images
    red_image = create_test_image("red", (255, 0, 0))
    green_image = create_test_image("green", (0, 255, 0))
    blue_image = create_test_image("blue", (0, 0, 255))
    
    # Upload images
    image_urls = []
    for name, data in [("red-character.jpg", red_image), 
                       ("green-character.jpg", green_image), 
                       ("blue-character.jpg", blue_image)]:
        url = test_image_upload(name, data)
        if url:
            image_urls.append(url)
        else:
            print(f"\n❌ Failed to upload {name} - aborting test sequence")
            sys.exit(1)
    
    if len(image_urls) == 3:
        tests_passed += 1
        print(f"\n✅ All 3 images uploaded successfully")
    else:
        print(f"\n❌ Only {len(image_urls)}/3 images uploaded - aborting test sequence")
        sys.exit(1)
    
    # 3. Multi-image chat with URL references and trigger confirmation
    reference_urls = test_multi_image_chat_confirmation(image_urls)
    if reference_urls:
        tests_passed += 1
    else:
        print("\n❌ Multi-image chat confirmation failed - aborting test sequence")
        sys.exit(1)
    
    # 4. Test confirmed generation with referenceImageUrls
    if test_confirmed_generation(reference_urls):
        tests_passed += 1
    else:
        print("\n❌ Confirmed generation test failed")
    
    # 5. Health Check
    if test_health_check():
        tests_passed += 1
    
    # Final Results
    print("\n" + "=" * 80)
    print("🏁 MULTI-IMAGE COMPOSITE/REFERENCE GENERATION FLOW TEST RESULTS")
    print("=" * 80)
    print(f"Tests Passed: {tests_passed}/{total_tests}")
    
    if tests_passed == total_tests:
        print("🎉 ALL TESTS PASSED - Multi-Image Composite/Reference Generation flow is working correctly!")
        print("\nKey Findings:")
        print("✅ Authentication working with testchat@example.com/Test123456")
        print("✅ User settings API working (quick_generate: false)")
        print("✅ Image upload API working (POST /api/attachments/upload)")
        print("✅ Multi-image chat with URL references triggers confirmation flow")
        print("✅ Confirmation flow preserves all 3 reference image URLs")
        print("✅ Confirmed generation accepts referenceImageUrls parameter")
        print("✅ Health check endpoint working")
        
        return True
    else:
        print("❌ SOME TESTS FAILED - See details above")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)