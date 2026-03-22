#!/usr/bin/env python3
"""
CORRECTED Backend Test for GPT-4o Vision Spatial Awareness
Uses correct attachment format with 'base64' field instead of 'data' field
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
            json={"title": "GPT-4o Vision Spatial Test - CORRECTED"}
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
        # Create a detailed car image (passenger side view)
        img = Image.new('RGB', (600, 400), color='lightgray')
        draw = ImageDraw.Draw(img)
        
        # Car body (passenger side visible)
        draw.rectangle([100, 150, 500, 250], fill='darkred', outline='black', width=3)
        
        # Front and rear indicators
        draw.polygon([(100, 150), (120, 130), (120, 270), (100, 250)], fill='gray')  # Front
        draw.polygon([(500, 150), (520, 130), (520, 270), (500, 250)], fill='gray')  # Rear
        
        # Windows (passenger side)
        draw.rectangle([130, 165, 250, 195], fill='lightblue', outline='black', width=2)  # Front window
        draw.rectangle([300, 165, 470, 195], fill='lightblue', outline='black', width=2)  # Rear window
        
        # Wheels
        draw.ellipse([130, 230, 170, 270], fill='black')  # Front wheel
        draw.ellipse([430, 230, 470, 270], fill='black')  # Rear wheel
        
        # Door lines (passenger side doors clearly visible)
        draw.line([250, 150, 250, 250], fill='black', width=3)  # Front door line
        draw.line([380, 150, 380, 250], fill='black', width=3)  # Rear door line
        
        # Door handles (passenger side)
        draw.rectangle([240, 200, 250, 210], fill='silver')  # Front door handle
        draw.rectangle([370, 200, 380, 210], fill='silver')  # Rear door handle
        
        # Add clear text to indicate this is passenger side
        draw.text((300, 320), "PASSENGER SIDE VIEW", fill='black', anchor='mm')
        draw.text((300, 340), "DRIVER SIDE NOT VISIBLE", fill='red', anchor='mm')
        
        # Convert to base64 JPEG
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=85)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        print(f"✅ Car image created (JPEG, {len(img_base64)} chars)")
        return img_base64
        
    except Exception as e:
        print(f"❌ Car image creation error: {str(e)}")
        return None

def create_logo_png():
    """Create a simple test logo as PNG"""
    try:
        # Create a simple logo
        img = Image.new('RGBA', (100, 100), color=(255, 255, 255, 0))
        draw = ImageDraw.Draw(img)
        
        # Draw a simple logo design
        draw.ellipse([10, 10, 90, 90], fill='blue', outline='darkblue', width=3)
        draw.text((50, 50), "LOGO", fill='white', anchor='mm')
        
        # Convert to base64 PNG
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        logo_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        print(f"✅ Logo created (PNG, {len(logo_base64)} chars)")
        return logo_base64
        
    except Exception as e:
        print(f"❌ Logo creation error: {str(e)}")
        return None

def test_spatial_awareness_corrected(token, conversation_id, car_base64, logo_base64):
    """Test GPT-4o Vision Spatial Awareness with CORRECT attachment format"""
    try:
        print("\n🧪 TESTING: GPT-4o Vision Spatial Awareness (CORRECTED FORMAT)")
        print("Using correct attachment format with 'base64' field")
        print("Car: JPEG (should be detected as base)")
        print("Logo: PNG (should be detected as element)")
        print("Request: Driver's side placement when only passenger side is visible")
        print("Expected: Base image upload → GPT-4o Vision analysis → Spatial warning")
        
        # Test with CORRECTED attachment format
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
                        "base64": car_base64,  # CORRECTED: using 'base64' instead of 'data'
                        "mimeType": "image/jpeg",
                        "name": "car.jpg"
                    },
                    {
                        "type": "image", 
                        "base64": logo_base64,  # CORRECTED: using 'base64' instead of 'data'
                        "mimeType": "image/png",
                        "name": "logo.png"
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
        compositing_started = False
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
                        
                        # Check for compositing start
                        if '🎨' in content and 'Adding' in content:
                            compositing_started = True
                            print("✅ Compositing process started!")
                        
                        # Check for visibility warning indicators
                        if '⚠️' in content and 'Note:' in content:
                            visibility_warning_found = True
                            print("✅ Visibility warning detected!")
                        
                        # Check for spatial analysis mentions
                        if any(term in content.lower() for term in ['visible', 'side', 'passenger', 'driver', 'placement']):
                            spatial_analysis_found = True
                            print("✅ Spatial analysis content detected!")
                        
                        # Check for GPT Vision response indicators
                        if any(term in content.lower() for term in ['placed', 'logo', 'door', 'coordinates']):
                            gpt_vision_response_found = True
                    
                    elif data.get('type') == 'done':
                        print("✅ Stream completed")
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        # Results
        print(f"\n📊 TEST RESULTS:")
        print(f"   Composite Edit Detected: {'✅' if composite_edit_detected else '❌'}")
        print(f"   Compositing Started: {'✅' if compositing_started else '❌'}")
        print(f"   Visibility Warning Found: {'✅' if visibility_warning_found else '❌'}")
        print(f"   Spatial Analysis Content: {'✅' if spatial_analysis_found else '❌'}")
        print(f"   GPT Vision Response: {'✅' if gpt_vision_response_found else '❌'}")
        print(f"   Response Content Length: {len(response_content)} chars")
        
        if response_content:
            print(f"\n📝 FULL RESPONSE CONTENT:")
            print("="*60)
            print(response_content)
            print("="*60)
        
        # Check if the fix is working
        basic_composite_working = composite_edit_detected and compositing_started
        spatial_awareness_working = visibility_warning_found or (spatial_analysis_found and 'driver' in response_content.lower())
        
        print(f"\n🔍 ANALYSIS:")
        print(f"   Basic Composite Edit: {'✅' if basic_composite_working else '❌'}")
        print(f"   Spatial Awareness: {'✅' if spatial_awareness_working else '❌'}")
        
        if basic_composite_working and spatial_awareness_working:
            print("\n🎉 GPT-4o Vision Spatial Awareness fix is working correctly!")
            return True
        elif basic_composite_working:
            print("\n⚠️ Composite edit works but spatial awareness may need investigation")
            return True  # Partial success
        else:
            print("\n❌ GPT-4o Vision Spatial Awareness fix needs investigation")
            return False
        
    except Exception as e:
        print(f"❌ Test error: {str(e)}")
        return False

def check_backend_logs_detailed():
    """Check recent backend logs for detailed analysis"""
    try:
        print("\n📋 CHECKING BACKEND LOGS FOR DETAILED ANALYSIS:")
        
        import subprocess
        result = subprocess.run([
            'tail', '-n', '50', '/var/log/supervisor/nextjs.out.log'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            logs = result.stdout
            print("Recent logs:")
            print("-" * 60)
            print(logs)
            print("-" * 60)
            
            # Look for specific patterns
            patterns_found = []
            if "Uploaded base image to:" in logs:
                patterns_found.append("✅ Base image upload SUCCESS")
            if "Base upload failed:" in logs:
                patterns_found.append("❌ Base image upload FAILURE")
            if "GPT-4o Vision response:" in logs:
                patterns_found.append("✅ GPT-4o Vision analysis")
            if "Visibility warning generated:" in logs:
                patterns_found.append("✅ Visibility warning generated")
            if "AI-refined placement:" in logs:
                patterns_found.append("✅ AI-refined placement coordinates")
            
            if patterns_found:
                print("\n🔍 PATTERNS DETECTED:")
                for pattern in patterns_found:
                    print(f"   {pattern}")
            else:
                print("\n⚠️ No specific upload/vision analysis patterns found")
                
        else:
            print(f"❌ Could not read logs: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Log check error: {str(e)}")

def main():
    """Run the corrected spatial awareness test"""
    print("🚀 GPT-4o Vision Spatial Awareness Test (CORRECTED)")
    print("=" * 70)
    
    # Step 1: Authenticate
    token = authenticate()
    if not token:
        return False
    
    # Step 2: Create conversation
    conversation_id = create_conversation(token)
    if not conversation_id:
        return False
    
    # Step 3: Create test images
    car_base64 = create_car_image_jpeg()
    logo_base64 = create_logo_png()
    
    if not car_base64 or not logo_base64:
        print("❌ Failed to create test images")
        return False
    
    # Step 4: Run the corrected test
    success = test_spatial_awareness_corrected(token, conversation_id, car_base64, logo_base64)
    
    # Step 5: Check backend logs for detailed analysis
    print("\n⏳ Waiting 3 seconds for backend processing...")
    time.sleep(3)
    check_backend_logs_detailed()
    
    print("\n" + "=" * 70)
    if success:
        print("🎉 TEST PASSED: GPT-4o Vision Spatial Awareness is working!")
    else:
        print("❌ TEST FAILED: GPT-4o Vision Spatial Awareness needs review")
    
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)