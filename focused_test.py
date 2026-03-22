#!/usr/bin/env python3
"""
Focused test for User-Uploaded Image Editing/Compositing feature
"""

import requests
import json
import base64
import sys
from io import BytesIO
from PIL import Image

# Configuration
BASE_URL = "https://chat-composite-edit.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

def create_test_image(color="red", size=(200, 200)):
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
        json={"title": "User Upload Test"}
    )
    
    if response.status_code == 200:
        conv_data = response.json()
        conv_id = conv_data.get('id')
        print(f"✅ Conversation created: {conv_id}")
        return conv_id
    else:
        print(f"❌ Failed to create conversation: {response.status_code} - {response.text}")
        return None

def test_user_upload_storage(token, conv_id):
    """Test that user uploads are stored with correct metadata"""
    print("\n🧪 Testing user upload storage...")
    
    # Create test image
    test_image_b64 = create_test_image(color="blue", size=(300, 200))
    
    # Upload via chat stream
    payload = {
        "content": "Here's my car image",
        "model": "gpt-4o",
        "conversationId": conv_id,
        "attachments": [{
            "type": "image",
            "base64": test_image_b64,
            "mimeType": "image/png"
        }]
    }
    
    print("📤 Uploading image...")
    response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload,
        stream=True,
        timeout=30
    )
    
    if response.status_code == 200:
        # Consume stream
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    if data.get('type') == 'done':
                        break
                except json.JSONDecodeError:
                    continue
        
        # Check message storage
        print("🔍 Checking message storage...")
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
                
                print(f"📋 User message metadata:")
                print(f"   - content_type: {latest_user_msg.get('content_type')}")
                print(f"   - image_url: {'✅ Present' if has_image_url else '❌ Missing'}")
                print(f"   - role: {latest_user_msg.get('role')}")
                
                if has_image_url and has_correct_content_type:
                    print("✅ User upload storage: PASSED")
                    return True
                else:
                    print("❌ User upload storage: FAILED")
                    return False
            else:
                print("❌ No user messages found")
                return False
        else:
            print(f"❌ Failed to get messages: {messages_response.status_code}")
            return False
    else:
        print(f"❌ Upload failed: {response.status_code}")
        return False

def test_image_edit_finds_user_upload(token, conv_id):
    """Test that image edit can find and use user-uploaded images"""
    print("\n🧪 Testing image edit on user upload...")
    
    # Send edit request
    payload = {
        "content": "make it more realistic",
        "model": "gpt-4o",
        "conversationId": conv_id
    }
    
    print("🎨 Sending edit request...")
    response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload,
        stream=True,
        timeout=30
    )
    
    if response.status_code == 200:
        # Consume stream
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    if data.get('type') == 'done':
                        break
                except json.JSONDecodeError:
                    continue
        
        # Check if edit was processed
        print("🔍 Checking edit result...")
        messages_response = requests.get(f"{BASE_URL}/api/messages?conversationId={conv_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if messages_response.status_code == 200:
            messages = messages_response.json()
            assistant_messages = [msg for msg in messages if msg.get('role') == 'assistant']
            
            if assistant_messages:
                latest_assistant_msg = assistant_messages[-1]
                content = latest_assistant_msg.get('content', '').lower()
                
                # Check if it processed the edit (not saying "no previous image")
                if "don't see a previous image" in content or "no previous image" in content:
                    print("❌ Image edit: FAILED - System couldn't find user upload")
                    return False
                elif 'edit' in content or 'realistic' in content or 'image' in content:
                    print("✅ Image edit: PASSED - System found and processed user upload")
                    return True
                else:
                    print(f"⚠️ Image edit: UNCLEAR - Response: {content[:100]}...")
                    return False
            else:
                print("❌ No assistant response found")
                return False
        else:
            print(f"❌ Failed to get messages: {messages_response.status_code}")
            return False
    else:
        print(f"❌ Edit request failed: {response.status_code}")
        return False

def main():
    """Run focused tests"""
    print("🚀 User-Uploaded Image Editing/Compositing Tests")
    print("=" * 60)
    
    # Login
    token = login()
    if not token:
        print("❌ Cannot proceed without authentication")
        return False
    
    # Create conversation
    conv_id = create_conversation(token)
    if not conv_id:
        print("❌ Cannot proceed without conversation")
        return False
    
    # Test 1: User upload storage
    test1_passed = test_user_upload_storage(token, conv_id)
    
    # Test 2: Image edit finds user upload (only if test 1 passed)
    test2_passed = False
    if test1_passed:
        test2_passed = test_image_edit_finds_user_upload(token, conv_id)
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    print(f"User Upload Storage: {'✅ PASSED' if test1_passed else '❌ FAILED'}")
    print(f"Image Edit on User Upload: {'✅ PASSED' if test2_passed else '❌ FAILED'}")
    
    if test1_passed and test2_passed:
        print("\n🎉 ALL TESTS PASSED! User-uploaded image editing is working correctly.")
        return True
    else:
        print("\n⚠️ Some tests failed.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)