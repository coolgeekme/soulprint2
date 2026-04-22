#!/usr/bin/env python3
"""
Complete test for Smart Aspect Ratio Recreation feature
Tests the full workflow: image generation -> aspect ratio recreation
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

def create_conversation_with_image(token):
    """Create a conversation and generate an image"""
    print("\n🖼️ Creating conversation with image...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(f"{API_BASE}/chat/stream",
        headers=headers,
        json={
            "content": "Generate a simple image of a red circle",
            "model": "gpt-4o"
        },
        timeout=120,  # Longer timeout for image generation
        stream=True
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to create conversation: {response.status_code}")
        return None, None
    
    conversation_id = None
    image_url = None
    
    print("   Waiting for image generation...")
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode('utf-8'))
                
                # Look for conversation ID in meta event
                if data.get('type') == 'meta':
                    meta_data = data.get('data', {})
                    if 'conversationId' in meta_data:
                        conversation_id = meta_data['conversationId']
                        print(f"   ✅ Conversation ID: {conversation_id}")
                
                # Look for image URL
                elif data.get('type') == 'image':
                    image_url = data.get('url')
                    print(f"   ✅ Image generated: {image_url[:80]}...")
                
                elif data.get('type') == 'done':
                    break
                    
            except json.JSONDecodeError:
                continue
    
    if conversation_id and image_url:
        print("✅ Conversation with image setup complete")
        return conversation_id, image_url
    else:
        print("❌ Failed to setup conversation with image")
        return None, None

def test_smart_recreate_with_context(token, conversation_id, message):
    """Test Smart Aspect Ratio Recreation with image context"""
    print(f"\n🔄 Testing SmartRecreate: '{message}'")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(f"{API_BASE}/chat/stream",
        headers=headers,
        json={
            "content": message,
            "model": "gpt-4o",
            "conversationId": conversation_id
        },
        timeout=120,  # Longer timeout for recreation
        stream=True
    )
    
    if response.status_code != 200:
        print(f"   ❌ Request failed: {response.status_code}")
        return False
    
    # Look for SmartRecreate indicators
    found_generating_visual = False
    found_recreation_content = False
    found_recreated_image = False
    
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode('utf-8'))
                
                # Check for generating_visual with visualType: 'image'
                if (data.get('type') == 'generating_visual' and 
                    data.get('visualType') == 'image'):
                    found_generating_visual = True
                    print("   📊 Found generating_visual event")
                
                # Check for recreation-specific content in delta
                elif data.get('type') == 'delta':
                    content = data.get('content', '')
                    if 'Recreating' in content or 'recreation' in content.lower():
                        found_recreation_content = True
                        print(f"   🔄 Found recreation content: {content[:100]}...")
                
                # Check for new image with contentType: 'recreate'
                elif data.get('type') == 'image':
                    content_type = data.get('contentType')
                    if content_type == 'recreate':
                        found_recreated_image = True
                        image_url = data.get('url')
                        print(f"   🎨 Found recreated image: {image_url[:80]}...")
                
                elif data.get('type') == 'done':
                    break
                    
            except json.JSONDecodeError:
                continue
    
    # Determine if SmartRecreate was successful
    smart_recreate_success = (found_generating_visual and 
                             found_recreation_content and 
                             found_recreated_image)
    
    if smart_recreate_success:
        print("   ✅ SmartRecreate successfully triggered and completed!")
        return True
    else:
        print("   ❌ SmartRecreate did not complete successfully")
        print(f"      - generating_visual: {found_generating_visual}")
        print(f"      - recreation_content: {found_recreation_content}")
        print(f"      - recreated_image: {found_recreated_image}")
        return False

def main():
    """Main test execution"""
    print("🚀 Complete Smart Aspect Ratio Recreation Test")
    print("=" * 60)
    
    # Step 1: Authentication
    token = authenticate()
    if not token:
        return
    
    # Step 2: Create conversation with image
    conversation_id, image_url = create_conversation_with_image(token)
    if not conversation_id or not image_url:
        print("❌ Cannot proceed without image context")
        return
    
    # Step 3: Test SmartRecreate with various aspect ratio requests
    test_messages = [
        "recreate this as 1:1",
        "make this square",
        "convert this to portrait",
        "change the aspect ratio to 16:9",
        "I want this in 9:16 format"
    ]
    
    results = []
    
    print("\n📋 Testing SmartRecreate with Image Context:")
    for message in test_messages:
        result = test_smart_recreate_with_context(token, conversation_id, message)
        results.append(result)
        time.sleep(3)  # Rate limiting between tests
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    total_tests = len(results)
    passed_tests = sum(results)
    
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    if passed_tests == total_tests:
        print("\n🎉 ALL TESTS PASSED! Smart Aspect Ratio Recreation is working correctly!")
        print("✅ Intent detection working")
        print("✅ Image analysis working")
        print("✅ Recreation generation working")
        print("✅ NDJSON response format correct")
    elif passed_tests > 0:
        print(f"\n⚠️ {total_tests - passed_tests} tests failed, but {passed_tests} passed.")
        print("   The Smart Aspect Ratio Recreation feature is partially working.")
    else:
        print("\n❌ All tests failed. Smart Aspect Ratio Recreation needs investigation.")

if __name__ == "__main__":
    main()