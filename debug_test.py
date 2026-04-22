#!/usr/bin/env python3
"""
Simplified test to debug the Smart Aspect Ratio Recreation feature
"""

import requests
import json
import time

# Configuration
BASE_URL = "https://perfil-soul.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

def authenticate():
    """Login and get auth token"""
    print("🔐 Authenticating...")
    
    response = requests.post(f"{API_BASE}/auth/login", json={
        "email": TEST_EMAIL,
        "passcode": TEST_PASSWORD
    }, timeout=30)
    
    if response.status_code == 200:
        token = response.json().get('token')
        print("✅ Authentication successful")
        return token
    else:
        print(f"❌ Authentication failed: {response.status_code} - {response.text}")
        return None

def test_simple_chat(token):
    """Test a simple chat message"""
    print("\n💬 Testing simple chat...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(f"{API_BASE}/chat/stream",
        headers=headers,
        json={
            "content": "Hello, this is a test message",
            "model": "gpt-4o"
        },
        timeout=30,
        stream=True
    )
    
    if response.status_code == 200:
        print("✅ Simple chat working")
        
        # Parse first few lines to get conversation ID
        conversation_id = None
        line_count = 0
        for line in response.iter_lines():
            line_count += 1
            if line_count > 20:  # Limit to prevent hanging
                break
                
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    print(f"   Debug: {data.get('type', 'unknown')} event")
                    
                    if data.get('type') == 'conversation_id':
                        conversation_id = data.get('conversationId')
                        print(f"✅ Conversation ID: {conversation_id}")
                        break
                    elif data.get('type') == 'done':
                        break
                except json.JSONDecodeError:
                    continue
        
        return conversation_id
    else:
        print(f"❌ Simple chat failed: {response.status_code} - {response.text}")
        return None

def test_image_generation(token, conversation_id):
    """Test image generation"""
    print("\n🖼️ Testing image generation...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "content": "Generate an image of a beautiful sunset over mountains",
        "model": "gpt-4o"
    }
    
    if conversation_id:
        payload["conversationId"] = conversation_id
    
    response = requests.post(f"{API_BASE}/chat/stream",
        headers=headers,
        json=payload,
        timeout=60,
        stream=True
    )
    
    if response.status_code == 200:
        print("✅ Image generation request successful")
        
        # Parse response to find image URL
        image_url = None
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    
                    if data.get('type') == 'image':
                        image_url = data.get('url')
                        print(f"✅ Image generated: {image_url[:80]}...")
                        break
                    elif data.get('type') == 'done':
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        return image_url
    else:
        print(f"❌ Image generation failed: {response.status_code} - {response.text}")
        return None

def test_smart_recreate(token, conversation_id):
    """Test Smart Aspect Ratio Recreation"""
    print("\n🔄 Testing Smart Aspect Ratio Recreation...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(f"{API_BASE}/chat/stream",
        headers=headers,
        json={
            "content": "recreate this as 1:1",
            "model": "gpt-4o",
            "conversationId": conversation_id
        },
        timeout=60,
        stream=True
    )
    
    if response.status_code == 200:
        print("✅ Smart recreate request successful")
        
        # Look for SmartRecreate indicators
        found_generating_visual = False
        found_recreation_content = False
        
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    
                    if (data.get('type') == 'generating_visual' and 
                        data.get('visualType') == 'image'):
                        found_generating_visual = True
                        print("   📊 Found generating_visual event")
                    
                    elif data.get('type') == 'delta':
                        content = data.get('content', '')
                        if 'Recreating' in content or 'recreation' in content.lower():
                            found_recreation_content = True
                            print(f"   🔄 Found recreation content: {content[:100]}...")
                    
                    elif data.get('type') == 'done':
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        if found_generating_visual and found_recreation_content:
            print("✅ Smart Aspect Ratio Recreation is working!")
            return True
        else:
            print("❌ Smart Aspect Ratio Recreation not detected")
            return False
    else:
        print(f"❌ Smart recreate failed: {response.status_code} - {response.text}")
        return False

def main():
    """Main test execution"""
    print("🚀 Smart Aspect Ratio Recreation Debug Test")
    print("=" * 50)
    
    # Step 1: Authentication
    token = authenticate()
    if not token:
        return
    
    # Step 2: Simple chat test
    conversation_id = test_simple_chat(token)
    if not conversation_id:
        return
    
    # Step 3: Image generation test
    image_url = test_image_generation(token, conversation_id)
    if not image_url:
        print("⚠️ Image generation failed, but continuing with Smart Recreate test...")
    
    # Step 4: Smart recreate test
    success = test_smart_recreate(token, conversation_id)
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 Smart Aspect Ratio Recreation is working correctly!")
    else:
        print("⚠️ Smart Aspect Ratio Recreation needs investigation")

if __name__ == "__main__":
    main()