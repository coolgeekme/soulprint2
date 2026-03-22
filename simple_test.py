#!/usr/bin/env python3
"""
Simple test to verify user upload behavior step by step
"""

import requests
import json
import base64
import time
from io import BytesIO
from PIL import Image

# Configuration
BASE_URL = "https://chat-composite-edit.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

def create_test_image():
    """Create a simple test image"""
    img = Image.new('RGB', (100, 100), color='red')
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_data = buffer.getvalue()
    return base64.b64encode(img_data).decode('utf-8')

def main():
    # Login
    print("🔐 Logging in...")
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "passcode": TEST_PASSWORD
    })
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return
    
    token = login_response.json().get('token')
    print("✅ Login successful")
    
    # Create conversation
    print("💬 Creating conversation...")
    conv_response = requests.post(f"{BASE_URL}/api/conversations", 
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Simple Upload Test"}
    )
    
    if conv_response.status_code != 200:
        print(f"❌ Conversation creation failed: {conv_response.status_code}")
        return
    
    conv_id = conv_response.json().get('id')
    print(f"✅ Conversation created: {conv_id}")
    
    # Upload image
    print("📤 Uploading image...")
    test_image = create_test_image()
    
    payload = {
        "content": "Here is my test image",
        "model": "gpt-4o",
        "conversationId": conv_id,
        "attachments": [{
            "type": "image",
            "base64": test_image,
            "mimeType": "image/png"
        }]
    }
    
    # Make the request
    stream_response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload,
        stream=True
    )
    
    if stream_response.status_code != 200:
        print(f"❌ Stream request failed: {stream_response.status_code}")
        return
    
    print("✅ Stream request successful")
    
    # Process stream
    chunk_count = 0
    for line in stream_response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode('utf-8'))
                chunk_count += 1
                if data.get('type') == 'done':
                    break
            except json.JSONDecodeError:
                continue
    
    print(f"📊 Processed {chunk_count} stream chunks")
    
    # Wait for database write
    print("⏳ Waiting for database write...")
    time.sleep(3)
    
    # Check messages
    print("🔍 Checking messages...")
    messages_response = requests.get(f"{BASE_URL}/api/messages?conversationId={conv_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if messages_response.status_code != 200:
        print(f"❌ Messages request failed: {messages_response.status_code}")
        return
    
    messages = messages_response.json()
    print(f"📋 Found {len(messages)} messages")
    
    # Look for user message with image_url
    user_messages = [msg for msg in messages if msg.get('role') == 'user']
    
    if not user_messages:
        print("❌ No user messages found")
        return
    
    user_msg = user_messages[0]  # Should be the first/only user message
    
    print("\n📋 User Message Details:")
    print(f"  - ID: {user_msg.get('id')}")
    print(f"  - Role: {user_msg.get('role')}")
    print(f"  - Content: {user_msg.get('content')}")
    print(f"  - Content Type: {user_msg.get('content_type')}")
    print(f"  - Image URL: {user_msg.get('image_url')}")
    print(f"  - Created: {user_msg.get('created_at')}")
    
    # Check if it has the expected fields
    has_image_url = bool(user_msg.get('image_url'))
    has_content_type = user_msg.get('content_type') == 'user_upload'
    
    print(f"\n🎯 Results:")
    print(f"  - Has image_url: {'✅' if has_image_url else '❌'}")
    print(f"  - Content type is 'user_upload': {'✅' if has_content_type else '❌'}")
    
    if has_image_url and has_content_type:
        print("\n🎉 SUCCESS: User upload storage is working correctly!")
        
        # Now test if edit can find it
        print("\n🎨 Testing edit functionality...")
        edit_payload = {
            "content": "make it blue",
            "model": "gpt-4o",
            "conversationId": conv_id
        }
        
        edit_response = requests.post(f"{BASE_URL}/api/chat/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json=edit_payload,
            stream=True
        )
        
        if edit_response.status_code == 200:
            # Process edit stream
            for line in edit_response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode('utf-8'))
                        if data.get('type') == 'done':
                            break
                    except json.JSONDecodeError:
                        continue
            
            # Check edit result
            time.sleep(3)
            edit_messages_response = requests.get(f"{BASE_URL}/api/messages?conversationId={conv_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if edit_messages_response.status_code == 200:
                edit_messages = edit_messages_response.json()
                assistant_messages = [msg for msg in edit_messages if msg.get('role') == 'assistant']
                
                if assistant_messages:
                    latest_assistant = assistant_messages[-1]
                    content = latest_assistant.get('content', '').lower()
                    
                    if "don't see a previous image" in content:
                        print("❌ Edit failed - couldn't find user upload")
                    elif 'edit' in content or 'blue' in content:
                        print("✅ Edit succeeded - found user upload")
                    else:
                        print(f"⚠️ Edit result unclear: {content[:100]}...")
                else:
                    print("❌ No assistant response to edit")
            else:
                print("❌ Failed to get edit messages")
        else:
            print(f"❌ Edit request failed: {edit_response.status_code}")
    else:
        print("\n❌ FAILED: User upload storage is not working correctly")

if __name__ == "__main__":
    main()