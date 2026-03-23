#!/usr/bin/env python3
"""
Fixed Backend Test for NEW SMART Intent Detection
Testing specific test cases from review request
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

def test_single_intent(message, expected_intent, test_name, token, has_attachment=False):
    """Test a single intent detection case"""
    print(f"\n🧪 Testing: {test_name}")
    print(f"📝 Message: '{message}'")
    print(f"🎯 Expected: {expected_intent}")
    
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
        # Make request with timeout
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json=payload,
            headers=headers,
            stream=True,
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"❌ Request failed: {response.status_code}")
            return False
        
        # Parse stream for intent detection
        detected_intent = None
        intent_reason = None
        backend_logs = []
        
        for line in response.iter_lines(decode_unicode=True):
            if line.strip():
                try:
                    data = json.loads(line)
                    
                    # Look for mediaIntent in the JSON object directly (not in meta)
                    if data.get('type') == 'meta' and 'mediaIntent' in data:
                        detected_intent = data.get('mediaIntent')
                        intent_reason = data.get('mediaIntentReason', '')
                        print(f"🎯 Detected: {detected_intent}")
                        print(f"📋 Reason: {intent_reason}")
                    
                    # Look for backend logs in delta content
                    if data.get('type') == 'delta':
                        content = data.get('content', '')
                        if '[Mockup]' in content or '[Composite Edit]' in content:
                            backend_logs.append(content.strip())
                            print(f"📋 Log: {content.strip()}")
                    
                    # Stop after done
                    if data.get('type') == 'done':
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        # Check result
        if detected_intent == expected_intent:
            print(f"✅ PASS: Correctly detected '{detected_intent}'")
            if intent_reason:
                print(f"   Reason: {intent_reason}")
            return True
        else:
            print(f"❌ FAIL: Expected '{expected_intent}' but got '{detected_intent}'")
            if intent_reason:
                print(f"   Reason: {intent_reason}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def main():
    """Run comprehensive test cases from review request"""
    print("🚀 Testing NEW SMART Intent Detection")
    print("="*60)
    
    # Authenticate
    token = authenticate()
    if not token:
        return
    
    # Comprehensive test cases from review request
    test_cases = [
        # MOCKUP tests (should detect as mockup)
        {
            "message": "add this logo to the back of a tshirt that someone is wearing at a campfire",
            "expected": "mockup",
            "name": "🔥 Critical Test: T-shirt at campfire (MOCKUP)",
            "attachment": True
        },
        {
            "message": "put this logo on a surfboard that someone is holding at the beach", 
            "expected": "mockup",
            "name": "🏄 Beach lifestyle mockup",
            "attachment": True
        },
        {
            "message": "add this design to a jacket that people are wearing at a concert",
            "expected": "mockup",
            "name": "🎵 Concert scene mockup",
            "attachment": True
        },
        {
            "message": "create a mockup of this logo on a skateboard",
            "expected": "mockup",
            "name": "🛹 Direct mockup request",
            "attachment": True
        },
        {
            "message": "put this on a coffee mug",
            "expected": "mockup", 
            "name": "☕ Product mockup (indefinite 'a')",
            "attachment": True
        },
        {
            "message": "add this logo to a laptop someone is using in an office",
            "expected": "mockup",
            "name": "💻 Office lifestyle mockup",
            "attachment": True
        },
        
        # COMPOSITE_EDIT tests (should detect as composite_edit)
        {
            "message": "add this logo to the car",
            "expected": "composite_edit",
            "name": "🚗 Definite 'the' + existing item",
            "attachment": True
        },
        {
            "message": "put this on the image",
            "expected": "composite_edit",
            "name": "🖼️ Reference to existing image", 
            "attachment": True
        },
        {
            "message": "add it there",
            "expected": "composite_edit",
            "name": "📍 Spatial reference",
            "attachment": True
        },
        {
            "message": "put this logo on that picture",
            "expected": "composite_edit",
            "name": "🖼️ Reference to specific picture",
            "attachment": True
        }
    ]
    
    # Run tests
    results = {}
    mockup_results = {}
    composite_results = {}
    
    for test in test_cases:
        success = test_single_intent(
            test["message"],
            test["expected"], 
            test["name"],
            token,
            test["attachment"]
        )
        results[test["name"]] = success
        
        # Categorize results
        if test["expected"] == "mockup":
            mockup_results[test["name"]] = success
        else:
            composite_results[test["name"]] = success
            
        time.sleep(2)  # Pause between tests
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST RESULTS SUMMARY")
    print("="*60)
    
    # Mockup results
    print(f"\n🎨 MOCKUP TESTS:")
    mockup_passed = sum(1 for result in mockup_results.values() if result)
    mockup_total = len(mockup_results)
    for test_name, result in mockup_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {test_name}")
    print(f"  📈 Mockup Results: {mockup_passed}/{mockup_total} passed")
    
    # Composite edit results
    print(f"\n🔧 COMPOSITE_EDIT TESTS:")
    composite_passed = sum(1 for result in composite_results.values() if result)
    composite_total = len(composite_results)
    for test_name, result in composite_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {test_name}")
    print(f"  📈 Composite Results: {composite_passed}/{composite_total} passed")
    
    # Overall results
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    print(f"\n🎯 OVERALL RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! NEW SMART Intent Detection is working correctly!")
        print("✨ Context-aware detection successfully distinguishes mockup vs composite_edit")
    elif mockup_passed == mockup_total:
        print("🎨 MOCKUP detection working perfectly!")
        print("⚠️  COMPOSITE_EDIT detection needs review")
    elif composite_passed == composite_total:
        print("🔧 COMPOSITE_EDIT detection working perfectly!")
        print("⚠️  MOCKUP detection needs review")
    else:
        print("⚠️  Both mockup and composite_edit detection need review")
    
    return results

if __name__ == "__main__":
    main()