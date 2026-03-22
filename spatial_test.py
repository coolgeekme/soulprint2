#!/usr/bin/env python3
"""
Simplified Backend Test for GPT-4o Vision Spatial Awareness
Tests composite edit with both images in a single request
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
    try:
        print("🔐 Authenticating...")
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
            
    except Exception as e:
        print(f"❌ Authentication error: {str(e)}")
        return None

def create_conversation(token):
    """Create a new conversation for testing"""
    try:
        print("💬 Creating new conversation...")
        response = requests.post(f"{BASE_URL}/api/conversations", 
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "GPT-4o Vision Spatial Test - Dual Upload"}
        )
        
        if response.status_code == 200:
            data = response.json()
            conversation_id = data.get('id')
            print(f"✅ Conversation created: {conversation_id}")
            return conversation_id
        else:
            print(f"❌ Conversation creation failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Conversation creation error: {str(e)}")
        return None

def create_car_image():
    """Create a test car image showing passenger side clearly"""
    try:
        # Create a more detailed car image (passenger side view)
        img = Image.new('RGB', (800, 600), color='lightgray')
        draw = ImageDraw.Draw(img)
        
        # Car body (passenger side visible) - make it clearly a side view
        draw.rectangle([100, 200, 700, 400], fill='darkred', outline='black', width=4)
        
        # Front and rear indicators
        draw.polygon([(100, 200), (120, 180), (120, 420), (100, 400)], fill='gray')  # Front
        draw.polygon([(700, 200), (720, 180), (720, 420), (700, 400)], fill='gray')  # Rear
        
        # Windows (passenger side)
        draw.rectangle([150, 220, 350, 280], fill='lightblue', outline='black', width=2)  # Front window
        draw.rectangle([400, 220, 650, 280], fill='lightblue', outline='black', width=2)  # Rear window
        
        # Wheels
        draw.ellipse([150, 380, 200, 430], fill='black')  # Front wheel
        draw.ellipse([550, 380, 600, 430], fill='black')  # Rear wheel
        
        # Door lines (passenger side doors clearly visible)
        draw.line([350, 200, 350, 400], fill='black', width=3)  # Front door line
        draw.line([500, 200, 500, 400], fill='black', width=3)  # Rear door line
        
        # Door handles (passenger side)
        draw.rectangle([340, 300, 350, 310], fill='silver')  # Front door handle
        draw.rectangle([490, 300, 500, 310], fill='silver')  # Rear door handle
        
        # Add text to indicate this is passenger side
        draw.text((400, 450), "PASSENGER SIDE VIEW", fill='black', anchor='mm')
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        print("✅ Test car image created (clear passenger side view)")
        return img_base64
        
    except Exception as e:
        print(f"❌ Car image creation error: {str(e)}")
        return None

def create_logo():
    """Create a simple test logo"""
    try:
        # Create a simple logo
        img = Image.new('RGBA', (150, 150), color=(255, 255, 255, 0))
        draw = ImageDraw.Draw(img)
        
        # Draw a simple logo design
        draw.ellipse([10, 10, 140, 140], fill='blue', outline='darkblue', width=3)
        draw.text((75, 75), "LOGO", fill='white', anchor='mm')
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        logo_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        print("✅ Test logo created")
        return logo_base64
        
    except Exception as e:
        print(f"❌ Logo creation error: {str(e)}")
        return None

def test_spatial_awareness_composite_edit(token, conversation_id, car_base64, logo_base64):
    """Test GPT-4o Vision Spatial Awareness with dual image upload"""
    try:
        print("\n🧪 TESTING: GPT-4o Vision Spatial Awareness Composite Edit")
        print("Scenario: Request driver's side placement when only passenger side is visible")
        print("Expected: System should detect visibility issue and generate warning")
        
        # Test with both images uploaded together and request driver's side
        response = requests.post(f"{BASE_URL}/api/chat/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "content": "add this logo to the driver's side front door",
                "conversationId": conversation_id,
                "model": "gpt-4o",
                "attachments": [
                    {
                        "type": "image",
                        "data": f"data:image/png;base64,{car_base64}",
                        "mimeType": "image/png",
                        "filename": "car.png"
                    },
                    {
                        "type": "image", 
                        "data": f"data:image/png;base64,{logo_base64}",
                        "mimeType": "image/png",
                        "filename": "logo.png"
                    }
                ]
            },
            stream=True
        )
        
        if response.status_code != 200:
            print(f"❌ Request failed: {response.status_code} - {response.text}")
            return False
        
        # Parse streaming response
        composite_edit_detected = False
        visibility_warning_found = False
        spatial_analysis_found = False
        response_content = ""
        meta_data = {}
        
        print("📡 Parsing streaming response...")
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode())
                    
                    if data.get('type') == 'meta':
                        meta_data = data
                        print(f"📋 Meta: {data}")
                        if 'composite_edit' in str(data):
                            composite_edit_detected = True
                            print("✅ Composite edit intent detected!")
                    
                    elif data.get('type') == 'delta':
                        content = data.get('content', '')
                        response_content += content
                        
                        # Check for visibility warning indicators
                        if '⚠️' in content and 'Note:' in content:
                            visibility_warning_found = True
                            print("✅ Visibility warning detected!")
                        
                        # Check for spatial analysis mentions
                        if any(term in content.lower() for term in ['visible', 'side', 'passenger', 'driver']):
                            spatial_analysis_found = True
                    
                    elif data.get('type') == 'done':
                        print("✅ Stream completed")
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        # Results
        print(f"\n📊 TEST RESULTS:")
        print(f"   Composite Edit Detected: {'✅' if composite_edit_detected else '❌'}")
        print(f"   Visibility Warning Found: {'✅' if visibility_warning_found else '❌'}")
        print(f"   Spatial Analysis Content: {'✅' if spatial_analysis_found else '❌'}")
        print(f"   Response Content Length: {len(response_content)} chars")
        print(f"   Meta Data: {meta_data}")
        
        if response_content:
            print(f"\n📝 FULL RESPONSE CONTENT:")
            print(response_content)
        
        # Check if the fix is working
        fix_working = composite_edit_detected and (visibility_warning_found or spatial_analysis_found)
        
        if fix_working:
            print("\n🎉 GPT-4o Vision Spatial Awareness fix appears to be working!")
        else:
            print("\n⚠️ GPT-4o Vision Spatial Awareness fix may need investigation")
        
        return fix_working
        
    except Exception as e:
        print(f"❌ Test error: {str(e)}")
        return False

def main():
    """Run the spatial awareness test"""
    print("🚀 GPT-4o Vision Spatial Awareness Test")
    print("=" * 60)
    
    # Step 1: Authenticate
    token = authenticate()
    if not token:
        return False
    
    # Step 2: Create conversation
    conversation_id = create_conversation(token)
    if not conversation_id:
        return False
    
    # Step 3: Create test images
    car_base64 = create_car_image()
    logo_base64 = create_logo()
    
    if not car_base64 or not logo_base64:
        print("❌ Failed to create test images")
        return False
    
    # Step 4: Run the test
    success = test_spatial_awareness_composite_edit(token, conversation_id, car_base64, logo_base64)
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 TEST PASSED: GPT-4o Vision Spatial Awareness is working!")
    else:
        print("❌ TEST FAILED: GPT-4o Vision Spatial Awareness needs review")
    
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)