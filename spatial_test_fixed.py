#!/usr/bin/env python3
"""
Fixed Backend Test for GPT-4o Vision Spatial Awareness
Uses JPEG for car image to avoid PNG=logo classification issue
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
            json={"title": "GPT-4o Vision Spatial Test - Fixed"}
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

def create_car_image_jpeg():
    """Create a test car image as JPEG (passenger side view)"""
    try:
        # Create a larger, more detailed car image (passenger side view)
        img = Image.new('RGB', (1000, 700), color='lightgray')
        draw = ImageDraw.Draw(img)
        
        # Car body (passenger side visible) - make it clearly a side view
        draw.rectangle([150, 250, 850, 450], fill='darkred', outline='black', width=5)
        
        # Front and rear indicators to show orientation
        draw.polygon([(150, 250), (180, 230), (180, 470), (150, 450)], fill='gray')  # Front
        draw.polygon([(850, 250), (880, 230), (880, 470), (850, 450)], fill='gray')  # Rear
        
        # Windows (passenger side)
        draw.rectangle([200, 270, 400, 330], fill='lightblue', outline='black', width=3)  # Front window
        draw.rectangle([500, 270, 800, 330], fill='lightblue', outline='black', width=3)  # Rear window
        
        # Wheels
        draw.ellipse([200, 430, 270, 500], fill='black')  # Front wheel
        draw.ellipse([730, 430, 800, 500], fill='black')  # Rear wheel
        
        # Door lines (passenger side doors clearly visible)
        draw.line([400, 250, 400, 450], fill='black', width=4)  # Front door line
        draw.line([650, 250, 650, 450], fill='black', width=4)  # Rear door line
        
        # Door handles (passenger side)
        draw.rectangle([385, 350, 400, 365], fill='silver')  # Front door handle
        draw.rectangle([635, 350, 650, 365], fill='silver')  # Rear door handle
        
        # Side mirrors
        draw.ellipse([190, 300, 210, 320], fill='black')  # Front mirror
        
        # Add clear text to indicate this is passenger side
        draw.text((500, 550), "PASSENGER SIDE VIEW - DRIVER SIDE NOT VISIBLE", fill='black', anchor='mm')
        
        # Convert to base64 JPEG
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=85)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        print("✅ Test car image created (JPEG, clear passenger side view)")
        return img_base64
        
    except Exception as e:
        print(f"❌ Car image creation error: {str(e)}")
        return None

def create_logo_png():
    """Create a simple test logo as PNG"""
    try:
        # Create a simple logo
        img = Image.new('RGBA', (120, 120), color=(255, 255, 255, 0))
        draw = ImageDraw.Draw(img)
        
        # Draw a simple logo design
        draw.ellipse([10, 10, 110, 110], fill='blue', outline='darkblue', width=3)
        draw.text((60, 60), "LOGO", fill='white', anchor='mm')
        
        # Convert to base64 PNG
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        logo_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        print("✅ Test logo created (PNG)")
        return logo_base64
        
    except Exception as e:
        print(f"❌ Logo creation error: {str(e)}")
        return None

def test_spatial_awareness_fixed(token, conversation_id, car_base64, logo_base64):
    """Test GPT-4o Vision Spatial Awareness with proper image formats"""
    try:
        print("\n🧪 TESTING: GPT-4o Vision Spatial Awareness (Fixed)")
        print("Car: JPEG (should be detected as base)")
        print("Logo: PNG (should be detected as element)")
        print("Request: Driver's side placement when only passenger side is visible")
        print("Expected: Spatial analysis + visibility warning")
        
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
                        "data": f"data:image/jpeg;base64,{car_base64}",
                        "mimeType": "image/jpeg",
                        "filename": "car.jpg"
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
        gpt_vision_response_found = False
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
                        if any(term in content.lower() for term in ['visible', 'side', 'passenger', 'driver', 'placement']):
                            spatial_analysis_found = True
                            print("✅ Spatial analysis content detected!")
                        
                        # Check for GPT Vision response indicators
                        if any(term in content.lower() for term in ['placed', 'logo', 'door']):
                            gpt_vision_response_found = True
                    
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
        print(f"   GPT Vision Response: {'✅' if gpt_vision_response_found else '❌'}")
        print(f"   Response Content Length: {len(response_content)} chars")
        
        if response_content:
            print(f"\n📝 FULL RESPONSE CONTENT:")
            print(response_content)
            print("\n" + "="*50)
        
        # Check if the fix is working
        fix_working = composite_edit_detected and gpt_vision_response_found
        spatial_awareness_working = visibility_warning_found or (spatial_analysis_found and 'driver' in response_content.lower())
        
        print(f"\n🔍 ANALYSIS:")
        print(f"   Basic Composite Edit: {'✅' if fix_working else '❌'}")
        print(f"   Spatial Awareness: {'✅' if spatial_awareness_working else '❌'}")
        
        if fix_working and spatial_awareness_working:
            print("\n🎉 GPT-4o Vision Spatial Awareness fix is working correctly!")
        elif fix_working:
            print("\n⚠️ Composite edit works but spatial awareness may need investigation")
        else:
            print("\n❌ GPT-4o Vision Spatial Awareness fix needs investigation")
        
        return fix_working and spatial_awareness_working
        
    except Exception as e:
        print(f"❌ Test error: {str(e)}")
        return False

def main():
    """Run the fixed spatial awareness test"""
    print("🚀 GPT-4o Vision Spatial Awareness Test (Fixed)")
    print("=" * 70)
    
    # Step 1: Authenticate
    token = authenticate()
    if not token:
        return False
    
    # Step 2: Create conversation
    conversation_id = create_conversation(token)
    if not conversation_id:
        return False
    
    # Step 3: Create test images with proper formats
    car_base64 = create_car_image_jpeg()  # JPEG for base
    logo_base64 = create_logo_png()       # PNG for logo
    
    if not car_base64 or not logo_base64:
        print("❌ Failed to create test images")
        return False
    
    # Step 4: Run the test
    success = test_spatial_awareness_fixed(token, conversation_id, car_base64, logo_base64)
    
    print("\n" + "=" * 70)
    if success:
        print("🎉 TEST PASSED: GPT-4o Vision Spatial Awareness is working!")
    else:
        print("❌ TEST FAILED: GPT-4o Vision Spatial Awareness needs review")
    
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)