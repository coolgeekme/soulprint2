#!/usr/bin/env python3
"""
Debug test to check what's being stored in the database
"""

import requests
import json
import base64
import time
from io import BytesIO
from PIL import Image, ImageDraw

# Configuration
BASE_URL = "https://chat-composite-edit.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

def authenticate():
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "passcode": TEST_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('token')
        print(f"✅ Authentication successful! Role: {data.get('role', 'unknown')}")
        return token
    else:
        print(f"❌ Authentication failed: {response.status_code} - {response.text}")
        return None

def create_conversation(token):
    response = requests.post(f"{BASE_URL}/api/conversations", 
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Debug Storage Test"}
    )
    
    if response.status_code == 200:
        data = response.json()
        conversation_id = data.get('id')
        print(f"✅ Conversation created: {conversation_id}")
        return conversation_id
    else:
        print(f"❌ Conversation creation failed: {response.status_code} - {response.text}")
        return None

def create_simple_image():
    img = Image.new('RGB', (200, 200), color='red')
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 50, 150, 150], fill='blue')
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def upload_image_and_check_storage(token, conversation_id, image_base64):
    """Upload image and check what gets stored"""
    print("\n📤 Uploading image...")
    
    response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json={
            "content": "Here is my image",
            "conversationId": conversation_id,
            "model": "gpt-4o",
            "attachments": [{
                "type": "image",
                "data": f"data:image/png;base64,{image_base64}",
                "mimeType": "image/png"
            }]
        },
        stream=True
    )
    
    print(f"📡 Upload response status: {response.status_code}")
    
    # Consume the response
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode())
                if data.get('type') == 'done':
                    break
            except:
                continue
    
    print("✅ Upload completed")
    
    # Wait for processing
    time.sleep(2)
    
    # Check what was stored
    print("\n🔍 Checking stored messages...")
    messages_response = requests.get(f"{BASE_URL}/api/messages?conversationId={conversation_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if messages_response.status_code == 200:
        messages = messages_response.json()
        print(f"✅ Found {len(messages)} messages")
        
        for i, msg in enumerate(messages):
            print(f"\n📋 Message {i+1}:")
            print(f"   ID: {msg.get('id')}")
            print(f"   Role: {msg.get('role')}")
            print(f"   Content: {msg.get('content', '')[:100]}...")
            print(f"   Content Type: {msg.get('content_type', 'none')}")
            print(f"   Image URL: {msg.get('image_url', 'none')}")
            print(f"   Model Used: {msg.get('model_used', 'none')}")
            print(f"   Created At: {msg.get('created_at', 'none')}")
        
        # Check for user uploads specifically
        user_uploads = [msg for msg in messages if msg.get('role') == 'user' and msg.get('content_type') == 'user_upload']
        print(f"\n📊 User uploads with content_type='user_upload': {len(user_uploads)}")
        
        user_with_image_url = [msg for msg in messages if msg.get('role') == 'user' and msg.get('image_url')]
        print(f"📊 User messages with image_url: {len(user_with_image_url)}")
        
        return len(user_uploads) > 0 or len(user_with_image_url) > 0
    else:
        print(f"❌ Failed to get messages: {messages_response.status_code}")
        return False

def main():
    print("🔍 DATABASE STORAGE DEBUG TEST")
    print("=" * 40)
    
    token = authenticate()
    if not token:
        return
    
    conversation_id = create_conversation(token)
    if not conversation_id:
        return
    
    image_base64 = create_simple_image()
    print(f"✅ Created test image ({len(image_base64)} bytes)")
    
    storage_success = upload_image_and_check_storage(token, conversation_id, image_base64)
    
    print(f"\n🏁 STORAGE TEST RESULT:")
    print(f"   Image stored correctly: {'✅' if storage_success else '❌'}")
    
    if not storage_success:
        print("\n⚠️ Image not stored with proper metadata for composite editing")
        print("   Expected: content_type='user_upload' and image_url field")

if __name__ == "__main__":
    main()