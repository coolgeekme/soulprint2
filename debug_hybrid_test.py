#!/usr/bin/env python3
"""
Debug test for HYBRID COMPOSITING - Simple test to see what's happening
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
        json={"title": "Debug Hybrid Test"}
    )
    
    if response.status_code == 200:
        data = response.json()
        conversation_id = data.get('id')
        print(f"✅ Conversation created: {conversation_id}")
        return conversation_id
    else:
        print(f"❌ Conversation creation failed: {response.status_code} - {response.text}")
        return None

def create_simple_car():
    """Create a simple car image"""
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

def create_simple_logo():
    """Create a simple logo"""
    img = Image.new('RGBA', (100, 100), color=(255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([10, 10, 90, 90], fill='blue', outline='darkblue', width=2)
    draw.text((50, 50), "LOGO", fill='white', anchor='mm')
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def test_composite_edit(token, conversation_id, car_base64, logo_base64):
    """Test composite edit and capture full response"""
    print("\n🧪 Testing composite edit...")
    
    # First upload car
    print("📤 Uploading car image...")
    car_response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json={
            "content": "Here's my car",
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
    
    # Consume car response
    for line in car_response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode())
                if data.get('type') == 'done':
                    break
            except:
                continue
    
    print("✅ Car uploaded")
    time.sleep(2)
    
    # Now test composite edit
    print("🎨 Testing: 'add this logo to the front door'")
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
    
    print(f"📡 Response status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Request failed: {response.text}")
        return
    
    print("📡 Parsing response stream...")
    full_response = ""
    
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode())
                print(f"📦 {data}")
                
                if data.get('type') == 'delta':
                    content = data.get('content', '')
                    full_response += content
                
                elif data.get('type') == 'done':
                    break
                    
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON decode error: {e}")
                print(f"Raw line: {line}")
                continue
    
    print(f"\n📋 FULL RESPONSE CONTENT:")
    print(f"Length: {len(full_response)} characters")
    print(f"Content: {full_response}")
    
    # Check for specific indicators
    indicators = {
        'composite_edit': 'composite' in full_response.lower(),
        'logo_added': 'logo' in full_response.lower(),
        'realistic_effects': 'realistic' in full_response.lower(),
        'sticker_effects': 'sticker' in full_response.lower(),
        'enhanced': 'enhanced' in full_response.lower()
    }
    
    print(f"\n🔍 RESPONSE ANALYSIS:")
    for key, found in indicators.items():
        print(f"   {key}: {'✅' if found else '❌'}")

def main():
    print("🔍 HYBRID COMPOSITING DEBUG TEST")
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
    car_base64 = create_simple_car()
    logo_base64 = create_simple_logo()
    print("✅ Test images created")
    
    # Test composite edit
    test_composite_edit(token, conversation_id, car_base64, logo_base64)

if __name__ == "__main__":
    main()