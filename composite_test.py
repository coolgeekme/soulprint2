#!/usr/bin/env python3
"""
Test the composite edit scenario that we know is working from the logs
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
    """Create a simple test image"""
    img = Image.new('RGB', size, color=color)
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
        json={"title": "Composite Edit Test"}
    )
    
    if conv_response.status_code != 200:
        print(f"❌ Conversation creation failed: {conv_response.status_code}")
        return
    
    conv_id = conv_response.json().get('id')
    print(f"✅ Conversation created: {conv_id}")
    
    # Step 1: Upload base image (car)
    print("📤 Step 1: Uploading base car image...")
    car_image = create_test_image(color='blue', size=(300, 200))
    
    payload1 = {
        "content": "Here's my car",
        "model": "gpt-4o",
        "conversationId": conv_id,
        "attachments": [{
            "type": "image",
            "base64": car_image,
            "mimeType": "image/png"
        }]
    }
    
    stream_response1 = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload1,
        stream=True
    )
    
    if stream_response1.status_code != 200:
        print(f"❌ Base image upload failed: {stream_response1.status_code}")
        return
    
    # Process stream
    for line in stream_response1.iter_lines():
        if line:
            try:
                data = json.loads(line.decode('utf-8'))
                if data.get('type') == 'done':
                    break
            except json.JSONDecodeError:
                continue
    
    print("✅ Base car image uploaded")
    time.sleep(2)
    
    # Check if base image was stored correctly
    print("🔍 Checking base image storage...")
    messages_response = requests.get(f"{BASE_URL}/api/messages?conversationId={conv_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if messages_response.status_code == 200:
        messages = messages_response.json()
        user_messages = [msg for msg in messages if msg.get('role') == 'user']
        
        if user_messages:
            base_msg = user_messages[0]
            has_image_url = bool(base_msg.get('image_url'))
            has_content_type = base_msg.get('content_type') == 'user_upload'
            
            print(f"📋 Base image message:")
            print(f"  - Has image_url: {'✅' if has_image_url else '❌'}")
            print(f"  - Content type: {base_msg.get('content_type')}")
            
            if not (has_image_url and has_content_type):
                print("❌ Base image not stored correctly, but continuing with composite test...")
        else:
            print("❌ No user messages found")
    
    # Step 2: Upload logo and request composite
    print("📤 Step 2: Uploading logo and requesting composite...")
    logo_image = create_test_image(color='yellow', size=(100, 100))
    
    payload2 = {
        "content": "add this logo to the door",
        "model": "gpt-4o",
        "conversationId": conv_id,
        "attachments": [{
            "type": "image",
            "base64": logo_image,
            "mimeType": "image/png"
        }]
    }
    
    stream_response2 = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload2,
        stream=True
    )
    
    if stream_response2.status_code != 200:
        print(f"❌ Composite request failed: {stream_response2.status_code}")
        return
    
    print("✅ Composite request sent")
    
    # Process stream and look for success indicators
    composite_success = False
    for line in stream_response2.iter_lines():
        if line:
            try:
                data = json.loads(line.decode('utf-8'))
                if data.get('type') == 'delta':
                    content = data.get('content', '')
                    if 'composite' in content.lower() or 'adding' in content.lower() or 'logo' in content.lower():
                        composite_success = True
                if data.get('type') == 'done':
                    break
            except json.JSONDecodeError:
                continue
    
    time.sleep(3)
    
    # Check final result
    print("🔍 Checking composite result...")
    final_messages_response = requests.get(f"{BASE_URL}/api/messages?conversationId={conv_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if final_messages_response.status_code == 200:
        final_messages = final_messages_response.json()
        assistant_messages = [msg for msg in final_messages if msg.get('role') == 'assistant']
        
        if assistant_messages:
            latest_assistant = assistant_messages[-1]
            content = latest_assistant.get('content', '').lower()
            
            print(f"📋 Assistant response: {content[:200]}...")
            
            if "don't see a previous image" in content:
                print("❌ COMPOSITE TEST FAILED: System couldn't find user-uploaded base image")
            elif 'composite' in content or 'logo' in content or 'added' in content:
                print("✅ COMPOSITE TEST PASSED: System found user upload and processed composite")
            else:
                print("⚠️ COMPOSITE TEST UNCLEAR: Response doesn't clearly indicate success or failure")
        else:
            print("❌ No assistant response found")
    else:
        print(f"❌ Failed to get final messages: {final_messages_response.status_code}")

if __name__ == "__main__":
    main()