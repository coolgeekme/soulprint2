#!/usr/bin/env python3
"""
Debug Test for GPT-4o Vision Spatial Awareness
Tests with detailed logging to understand the flow
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
            json={"title": "Debug Spatial Test"}
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

def create_small_car_jpeg():
    """Create a small test car image as JPEG"""
    try:
        # Create a smaller car image to ensure it uploads successfully
        img = Image.new('RGB', (400, 300), color='lightgray')
        draw = ImageDraw.Draw(img)
        
        # Simple car (passenger side)
        draw.rectangle([50, 100, 350, 200], fill='red', outline='black', width=2)
        draw.rectangle([80, 110, 150, 140], fill='lightblue', outline='black')  # Front window
        draw.rectangle([200, 110, 320, 140], fill='lightblue', outline='black')  # Rear window
        draw.ellipse([80, 180, 120, 220], fill='black')  # Front wheel
        draw.ellipse([280, 180, 320, 220], fill='black')  # Rear wheel
        draw.line([150, 100, 150, 200], fill='black', width=2)  # Door line
        draw.text((200, 250), "PASSENGER SIDE", fill='black', anchor='mm')
        
        # Convert to base64 JPEG
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=80)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        print(f"✅ Small car image created (JPEG, {len(img_base64)} chars)")
        return img_base64
        
    except Exception as e:
        print(f"❌ Car image creation error: {str(e)}")
        return None

def create_small_logo_png():
    """Create a small test logo as PNG"""
    try:
        # Create a small logo
        img = Image.new('RGBA', (80, 80), color=(255, 255, 255, 0))
        draw = ImageDraw.Draw(img)
        
        draw.ellipse([5, 5, 75, 75], fill='blue', outline='darkblue', width=2)
        draw.text((40, 40), "L", fill='white', anchor='mm')
        
        # Convert to base64 PNG
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        logo_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        print(f"✅ Small logo created (PNG, {len(logo_base64)} chars)")
        return logo_base64
        
    except Exception as e:
        print(f"❌ Logo creation error: {str(e)}")
        return None

def test_debug_composite_edit(token, conversation_id, car_base64, logo_base64):
    """Debug test to understand the composite edit flow"""
    try:
        print("\n🔍 DEBUG TEST: Composite Edit Flow Analysis")
        print("Monitoring backend logs for upload attempts and failures...")
        
        # Test with both images
        response = requests.post(f"{BASE_URL}/api/chat/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "content": "place this logo on the driver's side door",
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
        
        # Parse response
        response_content = ""
        composite_detected = False
        
        print("📡 Parsing response...")
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode())
                    
                    if data.get('type') == 'meta':
                        print(f"📋 Meta: {data}")
                        if 'composite_edit' in str(data):
                            composite_detected = True
                    
                    elif data.get('type') == 'delta':
                        content = data.get('content', '')
                        response_content += content
                    
                    elif data.get('type') == 'done':
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        print(f"\n📊 DEBUG RESULTS:")
        print(f"   Composite Edit Detected: {'✅' if composite_detected else '❌'}")
        print(f"   Response: {response_content}")
        
        # Wait a moment then check logs
        print("\n⏳ Waiting 3 seconds for backend processing...")
        time.sleep(3)
        
        return composite_detected
        
    except Exception as e:
        print(f"❌ Debug test error: {str(e)}")
        return False

def check_backend_logs():
    """Check recent backend logs for upload attempts"""
    try:
        print("\n📋 CHECKING BACKEND LOGS:")
        print("Looking for upload attempts, errors, and spatial analysis...")
        
        import subprocess
        result = subprocess.run([
            'tail', '-n', '30', '/var/log/supervisor/nextjs.out.log'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            logs = result.stdout
            print("Recent logs:")
            print("-" * 50)
            print(logs)
            print("-" * 50)
            
            # Look for specific patterns
            if "Uploaded base image to:" in logs:
                print("✅ Base image upload SUCCESS detected!")
            elif "Base upload failed:" in logs:
                print("❌ Base image upload FAILURE detected!")
            elif "GPT-4o Vision response:" in logs:
                print("✅ GPT-4o Vision analysis detected!")
            else:
                print("⚠️ No upload or vision analysis logs found")
        else:
            print(f"❌ Could not read logs: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Log check error: {str(e)}")

def main():
    """Run the debug test"""
    print("🔍 GPT-4o Vision Spatial Awareness Debug Test")
    print("=" * 60)
    
    # Step 1: Authenticate
    token = authenticate()
    if not token:
        return False
    
    # Step 2: Create conversation
    conversation_id = create_conversation(token)
    if not conversation_id:
        return False
    
    # Step 3: Create small test images
    car_base64 = create_small_car_jpeg()
    logo_base64 = create_small_logo_png()
    
    if not car_base64 or not logo_base64:
        print("❌ Failed to create test images")
        return False
    
    # Step 4: Run debug test
    success = test_debug_composite_edit(token, conversation_id, car_base64, logo_base64)
    
    # Step 5: Check backend logs
    check_backend_logs()
    
    print("\n" + "=" * 60)
    print("🔍 DEBUG TEST COMPLETED")
    print("Check the logs above to understand the composite edit flow")
    
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)