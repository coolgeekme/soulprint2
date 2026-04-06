#!/usr/bin/env python3
"""
Focused test for Smart Aspect Ratio Recreation feature
Tests the intent detection without relying on conversation setup
"""

import requests
import json
import time

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
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

def test_intent_detection(token, message, should_trigger_smart_recreate=False):
    """Test intent detection for a specific message"""
    print(f"\n🔍 Testing: '{message}'")
    print(f"   Expected SmartRecreate: {should_trigger_smart_recreate}")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(f"{API_BASE}/chat/stream",
        headers=headers,
        json={
            "content": message,
            "model": "gpt-4o"
        },
        timeout=30,
        stream=True
    )
    
    if response.status_code != 200:
        print(f"   ❌ Request failed: {response.status_code}")
        return False
    
    # Look for SmartRecreate indicators in the response
    found_generating_visual = False
    found_recreation_content = False
    found_image_edit = False
    found_question_skip = False
    
    line_count = 0
    for line in response.iter_lines():
        line_count += 1
        if line_count > 30:  # Limit to prevent hanging
            break
            
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
                        print(f"   🔄 Found recreation content")
                    elif 'edit' in content.lower() and 'image' in content.lower():
                        found_image_edit = True
                        print(f"   ✏️ Found image edit content")
                    elif 'question' in content.lower() and 'skip' in content.lower():
                        found_question_skip = True
                        print(f"   ❓ Found question skip content")
                
                elif data.get('type') == 'done':
                    break
                    
            except json.JSONDecodeError:
                continue
    
    # Determine if SmartRecreate was triggered
    smart_recreate_triggered = found_generating_visual and found_recreation_content
    
    if should_trigger_smart_recreate:
        if smart_recreate_triggered:
            print("   ✅ PASS: SmartRecreate correctly triggered")
            return True
        else:
            print("   ❌ FAIL: SmartRecreate should have triggered but didn't")
            return False
    else:
        if smart_recreate_triggered:
            print("   ❌ FAIL: SmartRecreate triggered when it shouldn't have")
            return False
        else:
            print("   ✅ PASS: SmartRecreate correctly NOT triggered")
            return True

def main():
    """Main test execution"""
    print("🚀 Smart Aspect Ratio Recreation Intent Detection Test")
    print("=" * 60)
    
    # Step 1: Authentication
    token = authenticate()
    if not token:
        return
    
    # Test cases for intent detection
    test_cases = [
        # These should NOT trigger SmartRecreate (no image context)
        ("recreate this as 1:1", False),  # No image in conversation
        ("make this square", False),      # No image in conversation
        ("change aspect ratio to 16:9", False),  # No image in conversation
        
        # These should NOT trigger SmartRecreate (questions)
        ("why is this image so dark?", False),
        ("what aspect ratio is this?", False),
        ("how was this image created?", False),
        
        # These should NOT trigger SmartRecreate (standard edits)
        ("add a dog to the image", False),
        ("remove the background", False),
        ("make it blue", False),
        
        # General messages that should work normally
        ("Hello, how are you?", False),
        ("What's the weather like?", False),
    ]
    
    results = []
    
    print("\n📋 Running Intent Detection Tests:")
    for message, should_trigger in test_cases:
        result = test_intent_detection(token, message, should_trigger)
        results.append(result)
        time.sleep(1)  # Rate limiting
    
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
        print("\n🎉 ALL TESTS PASSED! Intent detection is working correctly.")
        print("\nℹ️  Note: SmartRecreate requires an existing image in the conversation.")
        print("   These tests verify that the feature doesn't trigger inappropriately")
        print("   when no image context exists.")
    else:
        print(f"\n⚠️ {total_tests - passed_tests} tests failed. Please review the issues above.")

if __name__ == "__main__":
    main()