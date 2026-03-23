#!/usr/bin/env python3
"""
Simple test to verify attachment processing
"""

import requests
import json
import base64
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
        return data.get('token')
    return None

def create_conversation(token):
    response = requests.post(f"{BASE_URL}/api/conversations", 
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Attachment Test"}
    )
    
    if response.status_code == 200:
        return response.json().get('id')
    return None

def create_simple_image():
    """Create a very simple test image"""
    img = Image.new('RGB', (100, 100), color='red')
    draw = ImageDraw.Draw(img)
    draw.rectangle([10, 10, 90, 90], fill='blue')
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def test_attachment_processing(token, conversation_id, image_base64):
    """Test if attachments are being processed correctly"""
    print("🧪 Testing attachment processing...")
    
    # Test with minimal content to avoid intent detection issues
    payload = {
        "content": "test image",
        "conversationId": conversation_id,
        "model": "gpt-4o",
        "attachments": [{
            "type": "image",
            "data": f"data:image/png;base64,{image_base64}",
            "mimeType": "image/png"
        }]
    }
    
    print(f"📤 Payload size: {len(json.dumps(payload))} bytes")
    print(f"📤 Image data size: {len(image_base64)} bytes")
    print(f"📤 Attachment format: {payload['attachments'][0]['data'][:50]}...")
    
    response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload,
        stream=True
    )
    
    print(f"📡 Response status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Request failed: {response.text}")
        return
    
    response_content = ""
    
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode())
                print(f"📦 {data}")
                
                if data.get('type') == 'delta':
                    response_content += data.get('content', '')
                
                elif data.get('type') == 'done':
                    break
                    
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON decode error: {e}")
                print(f"Raw line: {line}")
    
    print(f"\n📋 Full response: {response_content}")
    
    # Check if image was processed
    if "didn't come through" in response_content:
        print("❌ Image attachment not processed correctly")
    elif "image" in response_content.lower():
        print("✅ Image attachment seems to be processed")
    else:
        print("⚠️ Unclear if image was processed")

def main():
    print("🔍 ATTACHMENT PROCESSING TEST")
    print("=" * 40)
    
    token = authenticate()
    if not token:
        print("❌ Authentication failed")
        return
    
    conversation_id = create_conversation(token)
    if not conversation_id:
        print("❌ Conversation creation failed")
        return
    
    image_base64 = create_simple_image()
    print(f"✅ Created test image ({len(image_base64)} bytes)")
    
    test_attachment_processing(token, conversation_id, image_base64)

if __name__ == "__main__":
    main()