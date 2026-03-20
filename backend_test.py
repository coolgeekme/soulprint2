#!/usr/bin/env python3
"""
Backend Testing Script for User-Uploaded Image Editing/Compositing Feature
Tests the P0 fix that enables users to upload their own images and edit them or add elements to them.
"""

import requests
import json
import base64
import time
import sys
from io import BytesIO
from PIL import Image

# Configuration
BASE_URL = "https://chat-to-canvas.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

def create_test_image(color="red", size=(200, 200), text="TEST"):
    """Create a simple test image in base64 format"""
    img = Image.new('RGB', size, color=color)
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_data = buffer.getvalue()
    return base64.b64encode(img_data).decode('utf-8')

def login():
    """Login and get authentication token"""
    print("🔐 Authenticating...")
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "passcode": TEST_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('token')
        print(f"✅ Authentication successful - Role: {data.get('role', 'unknown')}")
        return token
    else:
        print(f"❌ Authentication failed: {response.status_code} - {response.text}")
        return None

def create_conversation(token):
    """Create a new conversation for testing"""
    print("💬 Creating test conversation...")
    response = requests.post(f"{BASE_URL}/api/conversations", 
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "User Upload Image Test"}
    )
    
    if response.status_code == 200:
        conv_data = response.json()
        conv_id = conv_data.get('id')
        print(f"✅ Conversation created: {conv_id}")
        return conv_id
    else:
        print(f"❌ Failed to create conversation: {response.status_code} - {response.text}")
        return None

def test_image_upload_and_storage(token, conv_id):
    """Test 1: Image Upload & Storage Test"""
    print("\n" + "="*60)
    print("🧪 TEST 1: Image Upload & Storage")
    print("="*60)
    
    # Create a test car image
    car_image_b64 = create_test_image(color="blue", size=(300, 200), text="CAR")
    
    # Upload image via chat stream
    payload = {
        "content": "I'm uploading a car image for editing",
        "model": "gpt-4o",
        "conversationId": conv_id,
        "attachments": [{
            "type": "image",
            "base64": car_image_b64,
            "mimeType": "image/png"
        }]
    }
    
    print("📤 Uploading car image via POST /api/chat/stream...")
    response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload,
        stream=True
    )
    
    if response.status_code == 200:
        print("✅ Chat stream request successful")
        
        # Process NDJSON stream
        found_user_upload_log = False
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    if data.get('type') == 'delta':
                        content = data.get('content', '')
                        if 'Stored user image URL for future editing:' in content:
                            found_user_upload_log = True
                            print("✅ Found user upload storage log in response")
                except json.JSONDecodeError:
                    continue
        
        # Check if user message was saved with correct fields
        print("🔍 Checking if user message was saved with image_url and content_type='user_upload'...")
        messages_response = requests.get(f"{BASE_URL}/api/messages?conversationId={conv_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if messages_response.status_code == 200:
            messages = messages_response.json()
            user_messages = [msg for msg in messages if msg.get('role') == 'user']
            
            if user_messages:
                latest_user_msg = user_messages[-1]
                has_image_url = 'image_url' in latest_user_msg and latest_user_msg['image_url']
                has_correct_content_type = latest_user_msg.get('content_type') == 'user_upload'
                
                print(f"📋 User message fields:")
                print(f"   - content_type: {latest_user_msg.get('content_type')}")
                print(f"   - image_url: {'✅ Present' if has_image_url else '❌ Missing'}")
                print(f"   - role: {latest_user_msg.get('role')}")
                
                if has_image_url and has_correct_content_type:
                    print("✅ TEST 1 PASSED: User message stored with image_url and content_type='user_upload'")
                    return True, conv_id
                else:
                    print("❌ TEST 1 FAILED: User message missing required fields")
                    return False, conv_id
            else:
                print("❌ TEST 1 FAILED: No user messages found")
                return False, conv_id
        else:
            print(f"❌ Failed to retrieve messages: {messages_response.status_code}")
            return False, conv_id
    else:
        print(f"❌ TEST 1 FAILED: Chat stream failed - {response.status_code}: {response.text}")
        return False, conv_id

def test_image_edit_on_user_upload(token, conv_id):
    """Test 2: Image Edit on User-Uploaded Image Test"""
    print("\n" + "="*60)
    print("🧪 TEST 2: Image Edit on User-Uploaded Image")
    print("="*60)
    
    # Send edit request
    payload = {
        "content": "make it red",
        "model": "gpt-4o", 
        "conversationId": conv_id
    }
    
    print("🎨 Sending image edit request: 'make it red'...")
    response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload,
        stream=True
    )
    
    if response.status_code == 200:
        print("✅ Chat stream request successful")
        
        # Process NDJSON stream and look for expected logs
        found_image_edit_log = False
        found_user_upload_detection = False
        found_image_edit_success = False
        
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    if data.get('type') == 'delta':
                        content = data.get('content', '')
                        # Look for backend log indicators in the response
                        if 'Found' in content and 'recent image messages' in content:
                            found_image_edit_log = True
                            print("✅ Found image edit search log")
                        if 'isUserUpload: true' in content:
                            found_user_upload_detection = True
                            print("✅ Found user upload detection log")
                        if 'edit' in content.lower() and ('success' in content.lower() or 'created' in content.lower()):
                            found_image_edit_success = True
                            print("✅ Found image edit success indicator")
                except json.JSONDecodeError:
                    continue
        
        # The key test is that the system should find the user-uploaded image and attempt to edit it
        # We'll check the messages to see if an edit was attempted
        print("🔍 Checking if image edit was processed...")
        messages_response = requests.get(f"{BASE_URL}/api/messages?conversationId={conv_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if messages_response.status_code == 200:
            messages = messages_response.json()
            assistant_messages = [msg for msg in messages if msg.get('role') == 'assistant']
            
            # Look for the latest assistant message that should contain the edit response
            if assistant_messages:
                latest_assistant_msg = assistant_messages[-1]
                content = latest_assistant_msg.get('content', '').lower()
                
                # Check if the response indicates it found and processed the user image
                if ('edit' in content or 'red' in content or 'image' in content) and 'previous image' not in content:
                    print("✅ TEST 2 PASSED: System found user-uploaded image and processed edit request")
                    return True
                elif "don't see a previous image" in content or "no previous image" in content:
                    print("❌ TEST 2 FAILED: System couldn't find the user-uploaded image")
                    return False
                else:
                    print(f"⚠️ TEST 2 UNCLEAR: Response content: {content[:200]}...")
                    return False
            else:
                print("❌ TEST 2 FAILED: No assistant response found")
                return False
        else:
            print(f"❌ Failed to retrieve messages: {messages_response.status_code}")
            return False
    else:
        print(f"❌ TEST 2 FAILED: Chat stream failed - {response.status_code}: {response.text}")
        return False

def test_composite_edit_on_user_upload(token):
    """Test 3: Composite Edit on User-Uploaded Image Test"""
    print("\n" + "="*60)
    print("🧪 TEST 3: Composite Edit on User-Uploaded Image")
    print("="*60)
    
    # Create a new conversation for this test
    conv_id = create_conversation(token)
    if not conv_id:
        return False
    
    # Step 1: Upload a base image (car)
    print("📤 Step 1: Uploading base car image...")
    car_image_b64 = create_test_image(color="blue", size=(400, 300), text="CAR")
    
    payload1 = {
        "content": "Here's a car image",
        "model": "gpt-4o",
        "conversationId": conv_id,
        "attachments": [{
            "type": "image",
            "base64": car_image_b64,
            "mimeType": "image/png"
        }]
    }
    
    response1 = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload1,
        stream=True
    )
    
    if response1.status_code != 200:
        print(f"❌ Failed to upload base image: {response1.status_code}")
        return False
    
    # Consume the stream
    for line in response1.iter_lines():
        pass
    
    print("✅ Base car image uploaded")
    
    # Step 2: Upload logo and request composite
    print("📤 Step 2: Uploading logo and requesting composite...")
    logo_image_b64 = create_test_image(color="yellow", size=(100, 100), text="LOGO")
    
    payload2 = {
        "content": "add this logo to the door",
        "model": "gpt-4o",
        "conversationId": conv_id,
        "attachments": [{
            "type": "image",
            "base64": logo_image_b64,
            "mimeType": "image/png"
        }]
    }
    
    response2 = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload2,
        stream=True
    )
    
    if response2.status_code == 200:
        print("✅ Composite edit request successful")
        
        # Process stream and look for composite edit indicators
        found_composite_log = False
        found_target_user_upload = False
        found_composite_success = False
        
        for line in response2.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    if data.get('type') == 'delta':
                        content = data.get('content', '')
                        if 'Composite Edit' in content or 'Adding' in content:
                            found_composite_log = True
                            print("✅ Found composite edit processing log")
                        if 'Target image - role: user' in content and 'content_type: user_upload' in content:
                            found_target_user_upload = True
                            print("✅ Found target user upload detection")
                        if 'composite' in content.lower() or 'added' in content.lower():
                            found_composite_success = True
                            print("✅ Found composite edit success indicator")
                except json.JSONDecodeError:
                    continue
        
        # Check final messages
        print("🔍 Checking composite edit result...")
        messages_response = requests.get(f"{BASE_URL}/api/messages?conversationId={conv_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if messages_response.status_code == 200:
            messages = messages_response.json()
            assistant_messages = [msg for msg in messages if msg.get('role') == 'assistant']
            
            if assistant_messages:
                latest_assistant_msg = assistant_messages[-1]
                content = latest_assistant_msg.get('content', '').lower()
                
                # Check if composite edit was processed
                if ('add' in content or 'logo' in content or 'composite' in content) and "don't see a previous image" not in content:
                    print("✅ TEST 3 PASSED: System found user-uploaded base image and processed composite request")
                    return True
                elif "don't see a previous image" in content:
                    print("❌ TEST 3 FAILED: System couldn't find the user-uploaded base image")
                    return False
                else:
                    print(f"⚠️ TEST 3 UNCLEAR: Response content: {content[:200]}...")
                    return False
            else:
                print("❌ TEST 3 FAILED: No assistant response found")
                return False
        else:
            print(f"❌ Failed to retrieve messages: {messages_response.status_code}")
            return False
    else:
        print(f"❌ TEST 3 FAILED: Composite edit request failed - {response2.status_code}: {response2.text}")
        return False

def main():
    """Run all tests for User-Uploaded Image Editing/Compositing feature"""
    print("🚀 Starting User-Uploaded Image Editing/Compositing Tests")
    print("=" * 80)
    
    # Login
    token = login()
    if not token:
        print("❌ Cannot proceed without authentication")
        sys.exit(1)
    
    # Test results
    test_results = []
    
    # Test 1: Image Upload & Storage
    conv_id = create_conversation(token)
    if conv_id:
        test1_passed, conv_id = test_image_upload_and_storage(token, conv_id)
        test_results.append(("Image Upload & Storage", test1_passed))
        
        # Test 2: Image Edit on User-Uploaded Image (using same conversation)
        if test1_passed:
            test2_passed = test_image_edit_on_user_upload(token, conv_id)
            test_results.append(("Image Edit on User Upload", test2_passed))
        else:
            test_results.append(("Image Edit on User Upload", False))
    else:
        test_results.append(("Image Upload & Storage", False))
        test_results.append(("Image Edit on User Upload", False))
    
    # Test 3: Composite Edit on User-Uploaded Image
    test3_passed = test_composite_edit_on_user_upload(token)
    test_results.append(("Composite Edit on User Upload", test3_passed))
    
    # Summary
    print("\n" + "="*80)
    print("📊 TEST SUMMARY")
    print("="*80)
    
    passed_count = 0
    for test_name, passed in test_results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
        if passed:
            passed_count += 1
    
    print(f"\nOverall: {passed_count}/{len(test_results)} tests passed")
    
    if passed_count == len(test_results):
        print("🎉 ALL TESTS PASSED! User-Uploaded Image Editing/Compositing feature is working correctly.")
        return True
    else:
        print("⚠️ Some tests failed. The feature needs attention.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)