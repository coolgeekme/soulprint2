#!/usr/bin/env python3
"""
Targeted Scene-Based Detection Test
"""

import requests
import json
import base64
from io import BytesIO
from PIL import Image, ImageDraw

# Configuration
BASE_URL = "https://chat-composite-edit.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

def authenticate():
    """Authenticate with test credentials"""
    print("🔐 Authenticating...")
    
    login_data = {
        "email": TEST_EMAIL,
        "passcode": TEST_PASSWORD
    }
    
    response = requests.post(f"{API_BASE}/auth/login", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('token')
        user_id = data.get('userId')
        print(f"✅ Authentication successful - User ID: {user_id}")
        return token
    else:
        print(f"❌ Authentication failed: {response.status_code} - {response.text}")
        return None

def create_test_logo(text="LOGO", size=(200, 200)):
    """Create a simple test logo image"""
    img = Image.new('RGB', size, color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple logo with text
    draw.rectangle([10, 10, size[0]-10, size[1]-10], outline='black', width=3)
    
    # Calculate text position (center)
    bbox = draw.textbbox((0, 0), text)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size[0] - text_width) // 2
    y = (size[1] - text_height) // 2
    
    draw.text((x, y), text, fill='black')
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

def test_mockup_request(token, content, test_name):
    """Test a specific mockup request"""
    print(f"\n🧪 Testing: {test_name}")
    print(f"Content: {content}")
    
    # Create test logo
    logo_base64 = create_test_logo("TEST")
    
    test_data = {
        "content": content,
        "model": "gpt-4o",
        "conversationId": None,
        "attachments": [
            {
                "type": "image",
                "base64": logo_base64,
                "mimeType": "image/png",
                "fileName": "test_logo.png"
            }
        ]
    }
    
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.post(
        f"{API_BASE}/chat/stream",
        json=test_data,
        headers=headers,
        stream=True,
        timeout=60
    )
    
    if response.status_code != 200:
        print(f"❌ Request failed: {response.status_code} - {response.text}")
        return False
    
    # Parse response
    media_intent = None
    mockup_generated = False
    scene_detected = False
    lifestyle_message = False
    
    print("📡 Processing stream response...")
    
    try:
        for line in response.iter_lines(decode_unicode=True):
            if line:
                try:
                    data = json.loads(line)
                    
                    if data.get('type') == 'meta':
                        media_intent = data.get('mediaIntent')
                        print(f"📋 Media Intent: {media_intent}")
                    
                    elif data.get('type') == 'delta':
                        content_text = data.get('content', '')
                        if content_text.strip():
                            if 'lifestyle scene mockup' in content_text.lower():
                                lifestyle_message = True
                                print("✅ Found lifestyle scene mockup message")
                            if 'campfire' in content_text.lower() or 'beach' in content_text.lower() or 'park' in content_text.lower():
                                scene_detected = True
                                print("✅ Scene context detected")
                    
                    elif data.get('type') == 'image':
                        mockup_generated = True
                        content_type = data.get('contentType')
                        print(f"🖼️ Image generated: {content_type}")
                    
                    elif data.get('type') == 'done':
                        print("✅ Stream completed")
                        break
                        
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        print(f"Stream processing error: {e}")
        return False
    
    # Check backend logs for scene detection
    print("🔍 Checking backend logs...")
    try:
        import subprocess
        result = subprocess.run(['tail', '-n', '10', '/var/log/supervisor/nextjs.out.log'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            log_content = result.stdout
            for line in log_content.split('\n'):
                if 'Scene request:' in line:
                    print(f"📋 Backend log: {line.strip()}")
                    if 'Scene request: true' in line:
                        scene_detected = True
    except Exception as e:
        print(f"❌ Error checking logs: {e}")
    
    # Results
    print(f"📊 Results:")
    print(f"  Media Intent: {media_intent}")
    print(f"  Mockup Generated: {mockup_generated}")
    print(f"  Scene Detected: {scene_detected}")
    print(f"  Lifestyle Message: {lifestyle_message}")
    
    return {
        'media_intent': media_intent,
        'mockup_generated': mockup_generated,
        'scene_detected': scene_detected,
        'lifestyle_message': lifestyle_message
    }

def main():
    """Main test execution"""
    print("🚀 Scene-Based Detection Testing")
    print("=" * 60)
    
    # Authenticate
    token = authenticate()
    if not token:
        print("❌ Authentication failed - cannot proceed")
        return False
    
    # Test cases designed to trigger different behaviors
    test_cases = [
        {
            "content": "create a t-shirt mockup with this logo",
            "name": "Traditional Product Mockup",
            "expected_intent": "mockup",
            "expected_scene": False
        },
        {
            "content": "put this logo on a t-shirt mockup",
            "name": "Traditional Product Mockup (Alternative)",
            "expected_intent": "mockup", 
            "expected_scene": False
        },
        {
            "content": "create a mockup of someone wearing a t-shirt with this logo sitting around a campfire",
            "name": "Scene-based Mockup (Campfire)",
            "expected_intent": "mockup",
            "expected_scene": True
        },
        {
            "content": "make a lifestyle photo of people wearing shirts with this design at a beach",
            "name": "Scene-based Mockup (Beach)",
            "expected_intent": "mockup",
            "expected_scene": True
        }
    ]
    
    results = []
    
    for test_case in test_cases:
        result = test_mockup_request(token, test_case["content"], test_case["name"])
        
        # Evaluate result
        success = True
        if result['media_intent'] != test_case['expected_intent']:
            print(f"❌ Expected intent {test_case['expected_intent']}, got {result['media_intent']}")
            success = False
        
        if result['scene_detected'] != test_case['expected_scene']:
            print(f"❌ Expected scene detection {test_case['expected_scene']}, got {result['scene_detected']}")
            success = False
        
        if success:
            print("✅ Test PASSED")
        else:
            print("❌ Test FAILED")
        
        results.append((test_case['name'], success))
        print("-" * 60)
    
    # Summary
    print("\n📊 FINAL RESULTS")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name:<40} {status}")
        if success:
            passed += 1
    
    print("-" * 60)
    print(f"Total: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
        return True
    else:
        print("⚠️ SOME TESTS FAILED")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)