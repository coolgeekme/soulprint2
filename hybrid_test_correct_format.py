#!/usr/bin/env python3
"""
HYBRID COMPOSITING test with correct attachment format
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
        json={"title": "Hybrid Compositing Test - Fixed"}
    )
    
    if response.status_code == 200:
        data = response.json()
        conversation_id = data.get('id')
        print(f"✅ Conversation created: {conversation_id}")
        return conversation_id
    else:
        print(f"❌ Conversation creation failed: {response.status_code} - {response.text}")
        return None

def create_car_image():
    """Create a realistic car image"""
    img = Image.new('RGB', (800, 600), color='lightblue')
    draw = ImageDraw.Draw(img)
    
    # Car body
    draw.rectangle([100, 200, 700, 400], fill='red', outline='black', width=3)
    
    # Windows
    draw.rectangle([150, 220, 350, 280], fill='lightblue', outline='black', width=2)
    draw.rectangle([400, 220, 650, 280], fill='lightblue', outline='black', width=2)
    
    # Front door (clearly defined)
    draw.rectangle([200, 280, 400, 380], fill=None, outline='black', width=3)
    draw.rectangle([380, 320, 390, 340], fill='silver')  # Door handle
    
    # Wheels
    draw.ellipse([150, 380, 200, 430], fill='black')
    draw.ellipse([550, 380, 600, 430], fill='black')
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def create_logo():
    """Create a simple logo"""
    img = Image.new('RGBA', (100, 100), color=(255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    # Circle logo
    draw.ellipse([10, 10, 90, 90], fill='blue', outline='darkblue', width=2)
    draw.text((50, 50), "LOGO", fill='white', anchor='mm')
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def upload_base_image(token, conversation_id, car_base64):
    """Upload base image with correct attachment format"""
    print("\n📤 Step 1: Uploading base image with correct format...")
    
    response = requests.post(f"{BASE_URL}/api/chat/stream",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json={
            "content": "Here is my vehicle",
            "conversationId": conversation_id,
            "model": "gpt-4o",
            "attachments": [{
                "type": "image",
                "base64": car_base64,  # Using 'base64' instead of 'data'
                "mimeType": "image/png"
            }]
        },
        stream=True
    )
    
    print(f"📡 Upload response status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Upload failed: {response.text}")
        return False
    
    response_content = ""
    
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode())
                
                if data.get('type') == 'delta':
                    response_content += data.get('content', '')
                
                elif data.get('type') == 'done':
                    break
                    
            except json.JSONDecodeError:
                continue
    
    print(f"📋 Upload response: {response_content[:100]}...")
    
    # Check if upload was successful
    if "didn't come through" in response_content:
        print("❌ Image upload failed")
        return False
    else:
        print("✅ Base image uploaded successfully")
        return True

def check_image_storage(token, conversation_id):
    """Check if the image was stored correctly"""
    print("\n🔍 Checking image storage...")
    
    response = requests.get(f"{BASE_URL}/api/messages?conversationId={conversation_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        messages = response.json()
        print(f"✅ Found {len(messages)} messages")
        
        user_uploads = [msg for msg in messages if msg.get('role') == 'user' and msg.get('content_type') == 'user_upload']
        user_with_image_url = [msg for msg in messages if msg.get('role') == 'user' and msg.get('image_url')]
        
        print(f"📊 User uploads with content_type='user_upload': {len(user_uploads)}")
        print(f"📊 User messages with image_url: {len(user_with_image_url)}")
        
        if user_uploads or user_with_image_url:
            print("✅ Image stored correctly for composite editing!")
            return True
        else:
            print("❌ Image not stored with proper metadata")
            return False
    else:
        print(f"❌ Failed to get messages: {response.status_code}")
        return False

def test_hybrid_compositing(token, conversation_id, logo_base64):
    """Test the HYBRID COMPOSITING flow"""
    print("\n🎨 Step 3: Testing HYBRID COMPOSITING...")
    print("Expected: Sharp composite → AI enhancement → realistic sticker effects")
    
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
                "base64": logo_base64,  # Using 'base64' instead of 'data'
                "mimeType": "image/png"
            }]
        },
        stream=True
    )
    
    print(f"📡 Composite response status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Composite request failed: {response.text}")
        return False, False
    
    # Track hybrid flow indicators
    flow_indicators = {
        'composite_edit_detected': False,
        'realistic_sticker_effects_message': False,
        'enhanced_with_realistic_effects': False,
        'final_image_generated': False,
        'sharp_composite_working': False,
        'ai_enhancement_working': False
    }
    
    response_content = ""
    
    print("📡 Monitoring hybrid compositing flow...")
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode())
                
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
                    
                    if 'sharp' in content.lower() and 'composite' in content.lower():
                        flow_indicators['sharp_composite_working'] = True
                        print("✅ Sharp composite mentioned")
                    
                    if 'enhancement' in content.lower() or 'enhanced' in content.lower():
                        flow_indicators['ai_enhancement_working'] = True
                        print("✅ AI enhancement mentioned")
                
                elif data.get('type') == 'image':
                    if data.get('contentType') == 'composite_edit':
                        flow_indicators['final_image_generated'] = True
                        print("✅ Final composite image generated!")
                
                elif data.get('type') == 'done':
                    break
                    
            except json.JSONDecodeError:
                continue
    
    print(f"\n📋 Full response content ({len(response_content)} chars):")
    print(response_content)
    
    print(f"\n📊 HYBRID COMPOSITING FLOW ANALYSIS:")
    for key, value in flow_indicators.items():
        print(f"   {key}: {'✅' if value else '❌'}")
    
    # Determine success
    basic_compositing = (
        flow_indicators['composite_edit_detected'] and
        flow_indicators['final_image_generated']
    )
    
    hybrid_features = (
        flow_indicators['realistic_sticker_effects_message'] or
        flow_indicators['enhanced_with_realistic_effects']
    )
    
    return basic_compositing, hybrid_features

def main():
    print("🚀 HYBRID COMPOSITING TEST - FIXED ATTACHMENT FORMAT")
    print("=" * 60)
    print("Testing the new two-step approach:")
    print("1. Sharp compositing (pixel-perfect)")
    print("2. AI enhancement (realistic effects)")
    print("=" * 60)
    
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
    car_base64 = create_car_image()
    logo_base64 = create_logo()
    print("✅ Test images created")
    
    # Step 1: Upload base image
    upload_success = upload_base_image(token, conversation_id, car_base64)
    
    if not upload_success:
        print("❌ Cannot proceed without successful base image upload")
        return
    
    # Wait for processing
    print("⏳ Waiting for image processing...")
    time.sleep(3)
    
    # Step 2: Check storage
    storage_success = check_image_storage(token, conversation_id)
    
    if not storage_success:
        print("❌ Cannot proceed without proper image storage")
        return
    
    # Step 3: Test hybrid compositing
    basic_compositing, hybrid_features = test_hybrid_compositing(token, conversation_id, logo_base64)
    
    # Final results
    print(f"\n🏁 FINAL RESULTS:")
    print(f"   Base Image Upload: {'✅' if upload_success else '❌'}")
    print(f"   Image Storage: {'✅' if storage_success else '❌'}")
    print(f"   Basic Compositing: {'✅' if basic_compositing else '❌'}")
    print(f"   Hybrid Features: {'✅' if hybrid_features else '❌'}")
    
    if upload_success and storage_success and basic_compositing:
        print("\n🎉 HYBRID COMPOSITING is working!")
        if hybrid_features:
            print("✅ HYBRID FEATURES detected - AI enhancement is working!")
        else:
            print("⚠️ Basic compositing works, but hybrid features not detected")
            print("   (Check backend logs for hybrid flow messages)")
    else:
        print("\n⚠️ HYBRID COMPOSITING needs investigation")
        if not upload_success:
            print("   - Base image upload failed")
        if not storage_success:
            print("   - Image storage failed")
        if not basic_compositing:
            print("   - Composite edit not working")

if __name__ == "__main__":
    main()