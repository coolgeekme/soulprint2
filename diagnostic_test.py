#!/usr/bin/env python3
"""
Diagnostic test to understand the user upload behavior
"""

import requests
import json
import base64
import time
from io import BytesIO
from PIL import Image

# Configuration
BASE_URL = "https://chat-to-canvas.preview.emergentagent.com"
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
        json={"title": "Diagnostic Test"}
    )
    
    if response.status_code == 200:
        conv_data = response.json()
        conv_id = conv_data.get('id')
        print(f"✅ Conversation created: {conv_id}")
        return conv_id
    else:
        print(f"❌ Failed to create conversation: {response.status_code} - {response.text}")
        return None

def diagnostic_test(token, conv_id):
    """Diagnostic test to see what happens with user uploads"""
    print("\n🔍 Running diagnostic test...")
    
    # Create test image
    test_image_b64 = create_test_image(color="green", size=(250, 150))
    
    # Upload via chat stream
    payload = {
        "content": "I'm uploading this image for later editing",
        "model": "gpt-4o",
        "conversationId": conv_id,
        "attachments": [{
            "type": "image",
            "base64": test_image_b64,
            "mimeType": "image/png"
        }]
    }
    
    print("📤 Uploading image with attachment...")
    response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload,
        stream=True
    )
    
    if response.status_code == 200:
        print("✅ Stream request successful")
        
        # Process stream and look for logs
        stream_content = []
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    stream_content.append(data)
                    if data.get('type') == 'done':
                        break
                except json.JSONDecodeError:
                    continue
        
        print(f"📊 Received {len(stream_content)} stream chunks")
        
        # Wait a moment for database write
        time.sleep(2)
        
        # Check messages
        print("🔍 Checking all messages in conversation...")
        messages_response = requests.get(f"{BASE_URL}/api/messages?conversationId={conv_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if messages_response.status_code == 200:
            messages = messages_response.json()
            print(f"📋 Found {len(messages)} messages")
            
            for i, msg in enumerate(messages):
                print(f"\nMessage {i+1}:")
                print(f"  - ID: {msg.get('id')}")
                print(f"  - Role: {msg.get('role')}")
                print(f"  - Content: {msg.get('content', '')[:100]}...")
                print(f"  - Content Type: {msg.get('content_type')}")
                print(f"  - Image URL: {'Present' if msg.get('image_url') else 'None'}")
                print(f"  - Created: {msg.get('created_at')}")
                
                # If this is a user message with image_url, we found it!
                if msg.get('role') == 'user' and msg.get('image_url'):
                    print(f"  🎯 FOUND USER UPLOAD! URL: {msg.get('image_url')[:60]}...")
                    return True
        else:
            print(f"❌ Failed to get messages: {messages_response.status_code}")
            return False
    else:
        print(f"❌ Stream request failed: {response.status_code}")
        return False

def test_edit_after_upload(token, conv_id):
    """Test editing after the upload"""
    print("\n🎨 Testing edit after upload...")
    
    # Send edit request
    payload = {
        "content": "make it red",
        "model": "gpt-4o",
        "conversationId": conv_id
    }
    
    print("📤 Sending edit request...")
    response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload,
        stream=True
    )
    
    if response.status_code == 200:
        print("✅ Edit request successful")
        
        # Process stream
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    if data.get('type') == 'done':
                        break
                except json.JSONDecodeError:
                    continue
        
        # Check result
        time.sleep(2)
        messages_response = requests.get(f"{BASE_URL}/api/messages?conversationId={conv_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if messages_response.status_code == 200:
            messages = messages_response.json()
            assistant_messages = [msg for msg in messages if msg.get('role') == 'assistant']
            
            if assistant_messages:
                latest_msg = assistant_messages[-1]
                content = latest_msg.get('content', '').lower()
                
                print(f"🔍 Assistant response: {content[:200]}...")
                
                if "don't see a previous image" in content:
                    print("❌ Edit failed - couldn't find user upload")
                    return False
                elif 'edit' in content or 'red' in content:
                    print("✅ Edit succeeded - found user upload")
                    return True
                else:
                    print("⚠️ Edit result unclear")
                    return False
        else:
            print(f"❌ Failed to get messages: {messages_response.status_code}")
            return False
    else:
        print(f"❌ Edit request failed: {response.status_code}")
        return False

def main():
    """Run diagnostic tests"""
    print("🔍 User Upload Diagnostic Test")
    print("=" * 50)
    
    # Login
    token = login()
    if not token:
        return False
    
    # Create conversation
    conv_id = create_conversation(token)
    if not conv_id:
        return False
    
    # Run diagnostic
    upload_success = diagnostic_test(token, conv_id)
    
    # Test edit if upload worked
    edit_success = False
    if upload_success:
        edit_success = test_edit_after_upload(token, conv_id)
    
    # Summary
    print("\n" + "="*50)
    print("📊 DIAGNOSTIC SUMMARY")
    print("="*50)
    print(f"User Upload Storage: {'✅ WORKING' if upload_success else '❌ NOT WORKING'}")
    print(f"Edit Finds User Upload: {'✅ WORKING' if edit_success else '❌ NOT WORKING'}")
    
    return upload_success and edit_success

if __name__ == "__main__":
    main()