#!/usr/bin/env python3
"""
Test to verify user image upload and storage is working correctly
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
    """Authenticate and get JWT token"""
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
    """Create a new conversation"""
    response = requests.post(f"{BASE_URL}/api/conversations", 
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "User Upload Test"}
    )
    
    if response.status_code == 200:
        data = response.json()
        conversation_id = data.get('id')
        print(f"✅ Conversation created: {conversation_id}")
        return conversation_id
    else:
        print(f"❌ Conversation creation failed: {response.status_code} - {response.text}")
        return None

def create_test_car():
    """Create a test car image"""
    img = Image.new('RGB', (800, 600), color='lightblue')
    draw = ImageDraw.Draw(img)
    
    # Simple car shape
    draw.rectangle([100, 200, 700, 400], fill='red', outline='black', width=3)
    draw.rectangle([150, 220, 350, 280], fill='lightblue', outline='black', width=2)
    draw.rectangle([400, 220, 650, 280], fill='lightblue', outline='black', width=2)
    draw.ellipse([150, 380, 200, 430], fill='black')
    draw.ellipse([550, 380, 600, 430], fill='black')
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def create_test_logo():
    """Create a test logo"""
    img = Image.new('RGBA', (100, 100), color=(255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([10, 10, 90, 90], fill='blue', outline='darkblue', width=2)
    draw.text((50, 50), "LOGO", fill='white', anchor='mm')
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def test_user_image_upload(token, conversation_id, car_base64):
    """Test user image upload and verify storage"""
    print("\n🧪 Testing user image upload...")
    
    response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json={
            "content": "Here's my car image for logo placement",
            "conversationId": conversation_id,
            "model": "gpt-4o",
            "attachments": [{
                "type": "image",
                "data": f"data:image/png;base64,{car_base64}",
                "mimeType": "image/png"
            }]
        },
        stream=True
    )
    
    print(f"📡 Upload response status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Upload failed: {response.text}")
        return False
    
    print("📡 Processing upload response...")
    upload_successful = False
    
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode())
                print(f"📦 Upload response: {data}")
                
                if data.get('type') == 'done':
                    upload_successful = True
                    break
                    
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON decode error: {e}")
                continue
    
    return upload_successful

def get_conversation_messages(token, conversation_id):
    """Get messages from conversation to verify storage"""
    print("\n🔍 Checking conversation messages...")
    
    response = requests.get(f"{BASE_URL}/api/messages?conversationId={conversation_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        messages = response.json()
        print(f"✅ Found {len(messages)} messages in conversation")
        
        for i, msg in enumerate(messages):
            print(f"📋 Message {i+1}:")
            print(f"   Role: {msg.get('role')}")
            print(f"   Content Type: {msg.get('content_type', 'none')}")
            print(f"   Has Image URL: {'✅' if msg.get('image_url') else '❌'}")
            print(f"   Content Length: {len(msg.get('content', ''))}")
            if msg.get('image_url'):
                print(f"   Image URL: {msg.get('image_url')[:80]}...")
        
        # Check for user upload
        user_uploads = [msg for msg in messages if msg.get('role') == 'user' and msg.get('content_type') == 'user_upload']
        print(f"\n📊 User uploads found: {len(user_uploads)}")
        
        return len(user_uploads) > 0
    else:
        print(f"❌ Failed to get messages: {response.status_code} - {response.text}")
        return False

def test_composite_after_upload(token, conversation_id, logo_base64):
    """Test composite edit after confirmed upload"""
    print("\n🎨 Testing composite edit after upload...")
    
    response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json={
            "content": "add this logo to the front door",
            "conversationId": conversation_id,
            "model": "gpt-4o",
            "attachments": [{
                "type": "image",
                "data": f"data:image/png;base64,{logo_base64}",
                "mimeType": "image/png"
            }]
        },
        stream=True
    )
    
    print(f"📡 Composite response status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Composite request failed: {response.text}")
        return False
    
    print("📡 Processing composite response...")
    composite_successful = False
    response_content = ""
    
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode())
                print(f"📦 Composite response: {data}")
                
                if data.get('type') == 'delta':
                    response_content += data.get('content', '')
                
                elif data.get('type') == 'image':
                    if data.get('contentType') == 'composite_edit':
                        composite_successful = True
                        print("✅ Composite image generated!")
                
                elif data.get('type') == 'done':
                    break
                    
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON decode error: {e}")
                continue
    
    print(f"\n📋 Composite response content: {response_content}")
    return composite_successful

def main():
    print("🔍 USER IMAGE UPLOAD & STORAGE TEST")
    print("=" * 50)
    
    # Authenticate
    token = authenticate()
    if not token:
        return
    
    # Create conversation
    conversation_id = create_conversation(token)
    if not conversation_id:
        return
    
    # Create test images
    print("🎨 Creating test images...")
    car_base64 = create_test_car()
    logo_base64 = create_test_logo()
    print("✅ Test images created")
    
    # Test 1: Upload user image
    upload_success = test_user_image_upload(token, conversation_id, car_base64)
    print(f"📊 Upload success: {'✅' if upload_success else '❌'}")
    
    # Wait for processing
    time.sleep(3)
    
    # Test 2: Verify storage
    storage_success = get_conversation_messages(token, conversation_id)
    print(f"📊 Storage success: {'✅' if storage_success else '❌'}")
    
    # Test 3: Try composite edit
    if storage_success:
        composite_success = test_composite_after_upload(token, conversation_id, logo_base64)
        print(f"📊 Composite success: {'✅' if composite_success else '❌'}")
    else:
        print("⚠️ Skipping composite test due to storage failure")
        composite_success = False
    
    # Final results
    print(f"\n🏁 FINAL RESULTS:")
    print(f"   User Image Upload: {'✅' if upload_success else '❌'}")
    print(f"   Image Storage: {'✅' if storage_success else '❌'}")
    print(f"   Composite Edit: {'✅' if composite_success else '❌'}")
    
    if upload_success and storage_success and composite_success:
        print("\n🎉 ALL TESTS PASSED! User upload flow is working.")
    else:
        print("\n⚠️ Some tests failed. Check the implementation.")

if __name__ == "__main__":
    main()