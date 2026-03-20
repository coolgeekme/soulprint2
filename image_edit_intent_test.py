#!/usr/bin/env python3
"""
Image Edit Intent Detection Test
Testing the conversational image editing flow where user generates an image first, 
then asks to edit it (e.g., "add more colors"). The system should detect this as 
'image_edit' intent and edit the previously generated image.
"""

import requests
import json
import time
import sys
import os

# Configuration
BASE_URL = "https://image-edit-preview.preview.emergentagent.com"
LOGIN_EMAIL = "test@soulprint.com"
LOGIN_PASSWORD = "test123"

def authenticate():
    """Authenticate and get JWT token"""
    print("🔐 Authenticating...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": LOGIN_EMAIL,
                "passcode": LOGIN_PASSWORD
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            if token:
                print(f"✅ Authentication successful! Role: {data.get('role', 'N/A')}")
                return token
            else:
                print(f"❌ Authentication failed: No token in response")
                return None
        else:
            print(f"❌ Authentication failed: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Authentication error: {str(e)}")
        return None

def generate_initial_image(token, conversation_id):
    """Step 1: Generate initial image (basketball shorts)"""
    print("\n🏀 Step 1: Generating initial image...")
    
    try:
        payload = {
            "content": "design me some basketball shorts",
            "model": "gpt-4o",
            "conversationId": conversation_id
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        print(f"📡 Sending request: '{payload['content']}'")
        
        response = requests.post(
            f"{BASE_URL}/api/chat/stream",
            json=payload,
            headers=headers,
            stream=True
        )
        
        print(f"Response Status: HTTP {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Request failed: {response.text}")
            return False, None
            
        # Process NDJSON stream
        image_url = None
        conversation_id_from_response = None
        
        print("📦 Processing NDJSON stream...")
        for line_num, line in enumerate(response.iter_lines(decode_unicode=True), 1):
            if line.strip():
                try:
                    event = json.loads(line)
                    
                    if event.get('type') == 'meta':
                        conversation_id_from_response = event.get('conversationId')
                        print(f"Event {line_num}: type='meta', conversationId={conversation_id_from_response}")
                    elif event.get('type') == 'image':
                        image_url = event.get('url', '')
                        print(f"Event {line_num}: type='image', url='{image_url[:100]}{'...' if len(image_url) > 100 else ''}'")
                    elif event.get('type') == 'delta':
                        content = event.get('content', '')
                        if content:
                            print(f"Event {line_num}: type='delta', content='{content[:50]}{'...' if len(content) > 50 else ''}'")
                    elif event.get('type') == 'done':
                        print(f"Event {line_num}: type='done' - Stream complete!")
                        
                except json.JSONDecodeError as e:
                    print(f"⚠️ Failed to parse line {line_num}: {e}")
        
        if image_url:
            print(f"✅ Image generated successfully!")
            print(f"🖼️ Image URL: {image_url}")
            return True, conversation_id_from_response or conversation_id
        else:
            print("❌ No image URL received in response")
            return False, None
            
    except Exception as e:
        print(f"❌ Image generation failed: {str(e)}")
        return False, None

def test_image_edit_intent(token, conversation_id):
    """Step 2: Test image edit intent detection"""
    print("\n🎨 Step 2: Testing image edit intent detection...")
    print("Testing message: 'add more arizona sunset colors'")
    
    try:
        payload = {
            "content": "add more arizona sunset colors",
            "model": "gpt-4o",
            "conversationId": conversation_id
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        print(f"📡 Sending edit request to same conversation...")
        print(f"Content: '{payload['content']}'")
        print(f"ConversationId: {conversation_id}")
        
        response = requests.post(
            f"{BASE_URL}/api/chat/stream",
            json=payload,
            headers=headers,
            stream=True
        )
        
        print(f"Response Status: HTTP {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Request failed: {response.text}")
            return False
            
        # Process NDJSON stream and look for image edit indicators
        image_edit_detected = False
        edited_image_url = None
        all_content = []
        
        print("📦 Processing NDJSON stream...")
        for line_num, line in enumerate(response.iter_lines(decode_unicode=True), 1):
            if line.strip():
                try:
                    event = json.loads(line)
                    
                    if event.get('type') == 'meta':
                        # The intent is stored as 'mediaIntent' in the meta chunk
                        media_intent = event.get('mediaIntent')
                        
                        print(f"Event {line_num}: type='meta'")
                        if media_intent:
                            print(f"  📱 Media Intent: {media_intent}")
                            if media_intent == 'image_edit':
                                image_edit_detected = True
                                print(f"  🎯 IMAGE_EDIT INTENT DETECTED!")
                            else:
                                print(f"  ⚠️ Expected image_edit but got: {media_intent}")
                        else:
                            print(f"  ⚠️ No mediaIntent found in meta chunk")
                            
                    elif event.get('type') == 'image':
                        edited_image_url = event.get('url', '')
                        print(f"Event {line_num}: type='image' (EDITED IMAGE)")
                        print(f"  🖼️ URL: {edited_image_url[:100]}{'...' if len(edited_image_url) > 100 else ''}")
                        
                    elif event.get('type') == 'delta':
                        content = event.get('content', '')
                        if content:
                            all_content.append(content)
                            if line_num <= 10 or 'edit' in content.lower() or 'arizona' in content.lower():
                                print(f"Event {line_num}: type='delta', content='{content[:80]}{'...' if len(content) > 80 else ''}'")
                                
                    elif event.get('type') == 'done':
                        print(f"Event {line_num}: type='done' - Stream complete!")
                        
                except json.JSONDecodeError as e:
                    print(f"⚠️ Failed to parse line {line_num}: {e}")
        
        # Analyze results
        print(f"\n📊 Analysis Results:")
        print(f"🎯 Image Edit Intent Detected: {'✅ YES' if image_edit_detected else '❌ NO'}")
        print(f"🖼️ Edited Image Received: {'✅ YES' if edited_image_url else '❌ NO'}")
        
        full_response = ''.join(all_content)
        if 'arizona' in full_response.lower() or 'sunset' in full_response.lower():
            print(f"🌅 Arizona Sunset Context: ✅ Detected in response")
        
        # Check for expected backend log patterns
        if image_edit_detected:
            print(f"\n📝 Expected Backend Logs (check server logs for these patterns):")
            print(f"  - '[Quick Intent] Detected image_edit'")
            print(f"  - '[Image Edit] Looking for previous image'") 
            print(f"  - '[Image Edit] Found previous image to edit'")
        
        return image_edit_detected and edited_image_url is not None
            
    except Exception as e:
        print(f"❌ Image edit test failed: {str(e)}")
        return False

def check_backend_logs():
    """Check backend logs for expected patterns (if accessible)"""
    print("\n📋 Checking Backend Logs...")
    
    try:
        # Try to check supervisor logs
        import subprocess
        result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/nextjs.log'], 
                              capture_output=True, text=True, timeout=5)
        
        if result.returncode == 0:
            log_content = result.stdout
            patterns_found = {
                'quick_intent': '[Quick Intent] Detected image_edit' in log_content,
                'looking_for_image': '[Image Edit] Looking for previous image' in log_content,
                'found_image': '[Image Edit] Found previous image to edit' in log_content
            }
            
            print("🔍 Log Pattern Analysis:")
            for pattern, found in patterns_found.items():
                status = "✅ FOUND" if found else "❌ NOT FOUND"
                print(f"  {pattern}: {status}")
                
            if any(patterns_found.values()):
                print("✅ Some expected log patterns found!")
                return True
            else:
                print("⚠️ No expected log patterns found in recent logs")
                return False
        else:
            print("⚠️ Could not access backend logs (permission or path issue)")
            return False
            
    except Exception as e:
        print(f"⚠️ Backend log check failed: {str(e)}")
        return False

def main():
    """Main test function"""
    print("=" * 80)
    print("🧪 IMAGE EDIT INTENT DETECTION TEST")
    print("=" * 80)
    print("Testing conversational image editing flow:")
    print("1. Generate image: 'design me some basketball shorts'")  
    print("2. Edit request: 'add more arizona sunset colors'")
    print("3. Verify intent detection as 'image_edit' (NOT 'text')")
    print(f"Base URL: {BASE_URL}")
    print()
    
    # Step 1: Authenticate
    token = authenticate()
    if not token:
        print("\n❌ TESTING FAILED: Authentication required")
        sys.exit(1)
    
    # Generate unique conversation ID for this test
    conversation_id = f"image-edit-test-{int(time.time())}"
    print(f"📝 Using conversation ID: {conversation_id}")
    
    # Step 2: Generate initial image
    image_generated, final_conversation_id = generate_initial_image(token, conversation_id)
    if not image_generated:
        print("\n❌ TESTING FAILED: Could not generate initial image")
        sys.exit(1)
        
    # Wait a moment for image to be fully processed
    print("\n⏱️ Waiting 3 seconds for image processing...")
    time.sleep(3)
    
    # Step 3: Test image edit intent detection
    edit_success = test_image_edit_intent(token, final_conversation_id)
    
    # Step 4: Check backend logs
    logs_found = check_backend_logs()
    
    # Final result
    print("\n" + "=" * 80)
    if edit_success:
        print("🎉 IMAGE EDIT INTENT DETECTION TEST: PASSED")
        print("✅ System correctly detected 'image_edit' intent")
        print("✅ Found previous image and edited it")
        print("✅ Conversational image editing flow working!")
        if logs_found:
            print("✅ Expected backend log patterns found")
    else:
        print("❌ IMAGE EDIT INTENT DETECTION TEST: FAILED") 
        print("❌ System did not correctly detect 'image_edit' intent")
        print("❌ Check intent classification and image editing logic")
        if not logs_found:
            print("⚠️ Expected backend log patterns not found")
    
    print("=" * 80)
    return edit_success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)