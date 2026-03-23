#!/usr/bin/env python3
"""
Simplified Intent Detection Test
Tests the critical scenario from the review request
"""

import requests
import json
import base64
import time

# Configuration
BASE_URL = "https://chat-composite-edit.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

def authenticate():
    """Get auth token"""
    response = requests.post(f"{API_BASE}/auth/login", json={
        "email": TEST_EMAIL,
        "passcode": TEST_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        return data.get('token')
    else:
        print(f"❌ Authentication failed: {response.status_code}")
        return None

def create_simple_logo():
    """Create a simple base64 logo for testing"""
    # Simple 50x50 red square as PNG
    import io
    from PIL import Image, ImageDraw
    
    img = Image.new('RGBA', (50, 50), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle([10, 10, 40, 40], fill=(255, 0, 0, 255))
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_data = buffer.getvalue()
    
    return base64.b64encode(img_data).decode('utf-8')

def test_critical_scenario():
    """Test the critical scenario from review request"""
    print("🚀 Testing Critical Scenario: Intent Detection Order Fix")
    print("="*70)
    
    # Authenticate
    token = authenticate()
    if not token:
        return False
    
    # Create test logo
    try:
        logo_base64 = create_simple_logo()
    except Exception as e:
        print(f"❌ Failed to create logo: {e}")
        return False
    
    # Test the critical case
    content = "can you add this logo to the back of a tshirt that someone is wearing that is sitting around campfire?"
    
    print(f"📝 Testing: {content}")
    print(f"📎 With logo attachment")
    print(f"🎯 Expected: mockup intent (NOT composite_edit)")
    
    # Prepare request
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "content": content,
        "model": "gpt-4o",
        "conversationId": f"test-critical-{int(time.time())}",
        "attachments": [{
            "type": "image",
            "data": f"data:image/png;base64,{logo_base64}",
            "mimeType": "image/png"
        }]
    }
    
    # Make request
    try:
        print("\n🔄 Making request to chat stream...")
        response = requests.post(f"{API_BASE}/chat/stream", 
                               json=payload, 
                               headers=headers,
                               stream=True,
                               timeout=30)
        
        if response.status_code != 200:
            print(f"❌ Request failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print("✅ Request successful, parsing stream...")
        
        # Parse stream for intent and backend logs
        detected_intent = None
        backend_logs = []
        content_chunks = []
        
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    
                    # Check for meta with intent
                    if data.get('type') == 'meta':
                        meta = data.get('meta', {})
                        if 'mediaIntent' in meta:
                            detected_intent = meta['mediaIntent']
                            print(f"🔍 Detected intent: {detected_intent}")
                    
                    # Check for backend logs in content
                    if data.get('type') == 'delta':
                        content = data.get('content', '')
                        content_chunks.append(content)
                        
                        # Look for specific backend log patterns
                        if '[Mockup]' in content:
                            backend_logs.append(f"MOCKUP: {content.strip()}")
                            print(f"📋 Backend log: {content.strip()}")
                        elif '[Composite Edit]' in content:
                            backend_logs.append(f"COMPOSITE: {content.strip()}")
                            print(f"📋 Backend log: {content.strip()}")
                    
                    # Stop after we have enough data
                    if detected_intent and len(content_chunks) > 10:
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        # Analyze results
        print(f"\n📊 RESULTS:")
        print(f"🔍 Detected Intent: {detected_intent}")
        print(f"📋 Backend Logs Found: {len(backend_logs)}")
        
        for log in backend_logs:
            print(f"   - {log}")
        
        # Check if we got the expected result
        if detected_intent == 'mockup':
            print(f"\n✅ SUCCESS: Intent correctly detected as 'mockup'")
            
            # Check for expected backend logs
            mockup_logs = [log for log in backend_logs if 'MOCKUP' in log]
            if mockup_logs:
                print(f"✅ Backend logs confirm mockup processing")
                
                # Look for scene detection
                scene_logs = [log for log in mockup_logs if 'Scene request: true' in log]
                if scene_logs:
                    print(f"✅ Scene detection working: {scene_logs[0]}")
                
                return True
            else:
                print(f"⚠️  Intent correct but no mockup backend logs found")
                return True
        else:
            print(f"\n❌ FAILED: Expected 'mockup' but got '{detected_intent}'")
            
            # Check if it was incorrectly detected as composite_edit
            if detected_intent == 'composite_edit':
                print(f"❌ CRITICAL ISSUE: T-shirt request incorrectly detected as composite_edit!")
                print(f"❌ This means the intent detection order fix is NOT working")
            
            return False
            
    except Exception as e:
        print(f"❌ Test error: {e}")
        return False

def main():
    """Run the test"""
    success = test_critical_scenario()
    
    if success:
        print(f"\n🎉 CRITICAL TEST PASSED!")
        print(f"✅ Intent detection order fix is working correctly")
        print(f"✅ Mockup patterns are checked BEFORE composite_edit patterns")
    else:
        print(f"\n⚠️  CRITICAL TEST FAILED!")
        print(f"❌ Intent detection order fix needs attention")
    
    return success

if __name__ == "__main__":
    main()