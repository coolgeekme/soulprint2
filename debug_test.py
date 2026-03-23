#!/usr/bin/env python3
"""
Debug test to see actual response structure
"""

import requests
import json
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
        token = data.get('token')
        print(f"✅ Authentication successful!")
        return token
    else:
        print(f"❌ Authentication failed: {response.status_code}")
        return None

def debug_response(message, token, has_attachment=False):
    """Debug the actual response structure"""
    print(f"\n🔍 Debugging response for: '{message}'")
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "content": message,
        "model": "gpt-4o",
        "conversationId": f"test-{int(time.time())}"
    }
    
    # Add simple attachment if needed
    if has_attachment:
        # Simple 1x1 PNG in base64
        png_data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg=="
        payload["attachments"] = [{
            "type": "image",
            "data": f"data:image/png;base64,{png_data}",
            "name": "test-logo.png"
        }]
        print("📎 Attachment added")
    
    try:
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json=payload,
            headers=headers,
            stream=True,
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"❌ Request failed: {response.status_code}")
            return
        
        print("📋 Raw response chunks:")
        chunk_count = 0
        
        for line in response.iter_lines(decode_unicode=True):
            if line.strip():
                chunk_count += 1
                print(f"Chunk {chunk_count}: {line}")
                
                try:
                    data = json.loads(line)
                    print(f"  Type: {data.get('type')}")
                    
                    if data.get('type') == 'meta':
                        print(f"  Meta: {data.get('meta', {})}")
                    
                    if data.get('type') == 'delta':
                        content = data.get('content', '')
                        if '[Mockup]' in content or '[Composite Edit]' in content:
                            print(f"  Backend Log Found: {content}")
                    
                    if data.get('type') == 'done':
                        print("  Stream complete")
                        break
                        
                except json.JSONDecodeError as e:
                    print(f"  JSON decode error: {e}")
                
                if chunk_count > 20:  # Limit output
                    print("  ... (truncated)")
                    break
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def main():
    """Debug a few key test cases"""
    print("🔍 Debugging NEW SMART Intent Detection Response Structure")
    print("="*70)
    
    # Authenticate
    token = authenticate()
    if not token:
        return
    
    # Test critical case
    debug_response(
        "add this logo to the back of a tshirt that someone is wearing at a campfire",
        token,
        has_attachment=True
    )

if __name__ == "__main__":
    main()