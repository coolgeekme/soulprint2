#!/usr/bin/env python3
"""
Test HYBRID COMPOSITING with proper image upload flow
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
        json={"title": "Hybrid Compositing Test"}
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
    
    # Simple car shape with clear door area
    draw.rectangle([100, 200, 700, 400], fill='red', outline='black', width=3)
    draw.rectangle([150, 220, 350, 280], fill='lightblue', outline='black', width=2)
    draw.rectangle([400, 220, 650, 280], fill='lightblue', outline='black', width=2)
    draw.ellipse([150, 380, 200, 430], fill='black')
    draw.ellipse([550, 380, 600, 430], fill='black')
    
    # Door outline (front door)
    draw.rectangle([200, 220, 400, 380], fill=None, outline='black', width=2)
    
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

def upload_base_image(token, conversation_id, car_base64):
    """Upload base image with neutral language"""
    print("\n📤 Uploading base image with neutral language...")
    
    response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json={
            "content": "Here's my vehicle image",  # Neutral language
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
    response_content = ""
    
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode())
                print(f"📦 Upload: {data}")
                
                if data.get('type') == 'delta':
                    response_content += data.get('content', '')
                
                elif data.get('type') == 'done':
                    upload_successful = True
                    break
                    
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON decode error: {e}")
                continue
    
    print(f"📋 Upload response: {response_content}")
    return upload_successful

def test_hybrid_compositing(token, conversation_id, logo_base64):
    """Test the hybrid compositing flow"""
    print("\n🎨 Testing HYBRID COMPOSITING...")
    print("Expected flow:")
    print("1. Sharp composite (pixel-perfect placement)")
    print("2. AI enhancement (realistic sticker effects)")
    
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
    
    # Track hybrid flow indicators
    flow_indicators = {
        'composite_edit_detected': False,
        'realistic_sticker_effects_message': False,
        'enhanced_with_realistic_effects': False,
        'final_image_generated': False,
        'sharp_composite_mentioned': False,
        'ai_enhancement_mentioned': False
    }
    
    response_content = ""
    
    print("📡 Monitoring hybrid compositing flow...")
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode())
                print(f"📦 Composite: {data}")
                
                if data.get('type') == 'meta':
                    if data.get('mediaIntent') == 'composite_edit':
                        flow_indicators['composite_edit_detected'] = True
                        print("✅ Composite edit intent detected!")
                
                elif data.get('type') == 'delta':
                    content = data.get('content', '')
                    response_content += content
                    
                    # Check for hybrid flow messages
                    if '🎨 *Adding realistic sticker effects' in content:
                        flow_indicators['realistic_sticker_effects_message'] = True
                        print("✅ Found: Adding realistic sticker effects message")
                    
                    if '🎨 *Enhanced with realistic sticker effects*' in content:
                        flow_indicators['enhanced_with_realistic_effects'] = True
                        print("✅ Found: Enhanced with realistic sticker effects confirmation")
                    
                    if 'sharp' in content.lower():
                        flow_indicators['sharp_composite_mentioned'] = True
                    
                    if 'enhancement' in content.lower() or 'enhanced' in content.lower():
                        flow_indicators['ai_enhancement_mentioned'] = True
                
                elif data.get('type') == 'image':
                    if data.get('contentType') == 'composite_edit':
                        flow_indicators['final_image_generated'] = True
                        print("✅ Final composite image generated!")
                
                elif data.get('type') == 'done':
                    break
                    
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON decode error: {e}")
                continue
    
    print(f"\n📋 Full response content: {response_content}")
    
    print(f"\n📊 HYBRID COMPOSITING FLOW ANALYSIS:")
    for key, value in flow_indicators.items():
        print(f"   {key}: {'✅' if value else '❌'}")
    
    # Determine if hybrid flow is working
    hybrid_working = (
        flow_indicators['composite_edit_detected'] and
        flow_indicators['final_image_generated']
    )
    
    ai_enhancement_working = (
        flow_indicators['realistic_sticker_effects_message'] or
        flow_indicators['enhanced_with_realistic_effects']
    )
    
    print(f"\n🎯 RESULTS:")
    print(f"   Hybrid Compositing Flow: {'✅' if hybrid_working else '❌'}")
    print(f"   AI Enhancement Features: {'✅' if ai_enhancement_working else '❌'}")
    
    return hybrid_working, ai_enhancement_working

def main():
    print("🚀 HYBRID COMPOSITING TEST")
    print("=" * 50)
    print("Testing the new two-step approach:")
    print("1. Sharp compositing (pixel-perfect)")
    print("2. AI enhancement (realistic effects)")
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
    
    # Step 1: Upload base image
    upload_success = upload_base_image(token, conversation_id, car_base64)
    print(f"📊 Base image upload: {'✅' if upload_success else '❌'}")
    
    if not upload_success:
        print("❌ Cannot proceed without successful base image upload")
        return
    
    # Wait for processing
    time.sleep(3)
    
    # Step 2: Test hybrid compositing
    hybrid_working, ai_enhancement_working = test_hybrid_compositing(token, conversation_id, logo_base64)
    
    # Final results
    print(f"\n🏁 FINAL RESULTS:")
    print(f"   Base Image Upload: {'✅' if upload_success else '❌'}")
    print(f"   Hybrid Compositing: {'✅' if hybrid_working else '❌'}")
    print(f"   AI Enhancement: {'✅' if ai_enhancement_working else '❌'}")
    
    if upload_success and hybrid_working:
        print("\n🎉 HYBRID COMPOSITING is working!")
        if ai_enhancement_working:
            print("✅ AI enhancement features detected")
        else:
            print("⚠️ AI enhancement features not detected (may be working in backend)")
    else:
        print("\n⚠️ HYBRID COMPOSITING needs investigation")

if __name__ == "__main__":
    main()