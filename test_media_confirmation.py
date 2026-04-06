#!/usr/bin/env python3
"""
Test Media Generation Confirmation Flow
"""

import requests
import json
import time

# Test configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

def get_auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "passcode": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    else:
        print(f"Auth failed: {response.status_code} - {response.text}")
        return None

def test_user_settings():
    """Test User Settings API"""
    print("🔧 Testing User Settings API...")
    
    token = get_auth_token()
    if not token:
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test GET
    print("  📖 Testing GET /api/user/settings...")
    response = requests.get(f"{BASE_URL}/api/user/settings", headers=headers)
    print(f"  Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"  Response: {data}")
        print(f"  ✅ GET working, quick_generate: {data.get('quick_generate', False)}")
    else:
        print(f"  ❌ GET failed: {response.text}")
        return False
    
    # Test PATCH - enable
    print("  ✏️ Testing PATCH /api/user/settings (enable)...")
    response = requests.patch(f"{BASE_URL}/api/user/settings", 
                             json={"quick_generate": True}, headers=headers)
    print(f"  Status: {response.status_code}")
    if response.status_code == 200:
        print(f"  ✅ PATCH enable working")
    else:
        print(f"  ❌ PATCH enable failed: {response.text}")
        return False
    
    # Verify
    print("  🔍 Verifying setting was updated...")
    response = requests.get(f"{BASE_URL}/api/user/settings", headers=headers)
    if response.status_code == 200:
        data = response.json()
        if data.get("quick_generate"):
            print(f"  ✅ Verification passed: {data}")
        else:
            print(f"  ❌ Verification failed: {data}")
            return False
    
    # Reset to false
    print("  🔄 Resetting to false...")
    response = requests.patch(f"{BASE_URL}/api/user/settings", 
                             json={"quick_generate": False}, headers=headers)
    if response.status_code == 200:
        print(f"  ✅ Reset successful")
    else:
        print(f"  ❌ Reset failed: {response.text}")
    
    return True

def parse_ndjson_stream(response_text):
    """Parse NDJSON stream response"""
    lines = []
    for line in response_text.strip().split('\n'):
        line = line.strip()
        if line:
            try:
                # Handle SSE format (data: {...}) or plain NDJSON
                if line.startswith('data: '):
                    json_str = line[6:]  # Remove 'data: ' prefix
                else:
                    json_str = line
                
                if json_str and json_str != '[DONE]':
                    parsed = json.loads(json_str)
                    lines.append(parsed)
            except json.JSONDecodeError:
                continue
    return lines

def test_media_confirmation_flow():
    """Test Media Confirmation Flow"""
    print("\n🎨 Testing Media Confirmation Flow...")
    
    token = get_auth_token()
    if not token:
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Ensure quick_generate is disabled
    print("  🔧 Ensuring quick_generate is disabled...")
    requests.patch(f"{BASE_URL}/api/user/settings", 
                  json={"quick_generate": False}, headers=headers)
    
    # Test image generation request
    print("  🖼️ Testing image generation request...")
    test_data = {
        "message": "generate an image of a sunset over the ocean",
        "model": "gpt-4o"
    }
    
    response = requests.post(f"{BASE_URL}/api/chat/stream", 
                           json=test_data, headers=headers, timeout=60)
    
    print(f"  Status: {response.status_code}")
    if response.status_code == 200:
        response_text = response.text
        print(f"  Response length: {len(response_text)} chars")
        
        # Parse NDJSON
        parsed_lines = parse_ndjson_stream(response_text)
        print(f"  Parsed {len(parsed_lines)} NDJSON lines")
        
        # Look for media_confirmation
        media_confirmation_found = False
        for i, line in enumerate(parsed_lines):
            print(f"    Line {i}: type={line.get('type')}")
            if line.get("type") == "media_confirmation":
                media_confirmation_found = True
                print(f"    ✅ Found media_confirmation: {line}")
                
                # Check required fields
                required_fields = ["detectedType", "originalPrompt", "refinedPrompt", "availableModels", "recommendedModel"]
                for field in required_fields:
                    if field in line:
                        print(f"      ✅ {field}: {line[field]}")
                    else:
                        print(f"      ❌ Missing {field}")
        
        if media_confirmation_found:
            print("  ✅ Media confirmation flow working")
            return True
        else:
            print("  ❌ No media_confirmation found in response")
            return False
    else:
        print(f"  ❌ Request failed: {response.text}")
        return False

def test_quick_generate_flow():
    """Test Quick Generate Flow"""
    print("\n⚡ Testing Quick Generate Flow...")
    
    token = get_auth_token()
    if not token:
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Enable quick_generate
    print("  🔧 Enabling quick_generate...")
    response = requests.patch(f"{BASE_URL}/api/user/settings", 
                             json={"quick_generate": True}, headers=headers)
    if response.status_code != 200:
        print(f"  ❌ Failed to enable quick_generate: {response.text}")
        return False
    
    # Test image generation request
    print("  🚀 Testing image generation with quick_generate enabled...")
    test_data = {
        "message": "generate an image of a mountain landscape",
        "model": "gpt-4o"
    }
    
    response = requests.post(f"{BASE_URL}/api/chat/stream", 
                           json=test_data, headers=headers, timeout=60)
    
    print(f"  Status: {response.status_code}")
    if response.status_code == 200:
        response_text = response.text
        parsed_lines = parse_ndjson_stream(response_text)
        
        # Should skip confirmation and go to generation
        media_confirmation_found = False
        generating_visual_found = False
        
        for line in parsed_lines:
            if line.get("type") == "media_confirmation":
                media_confirmation_found = True
            elif line.get("type") == "generating_visual":
                generating_visual_found = True
                print(f"    ✅ Found generating_visual: {line}")
        
        if media_confirmation_found:
            print("  ❌ media_confirmation found - should have been skipped")
            return False
        elif generating_visual_found:
            print("  ✅ Quick generate flow working - skipped confirmation")
            return True
        else:
            print("  ❌ No generation flow detected")
            return False
    else:
        print(f"  ❌ Request failed: {response.text}")
        return False
    
    # Reset quick_generate
    print("  🔄 Resetting quick_generate to false...")
    requests.patch(f"{BASE_URL}/api/user/settings", 
                  json={"quick_generate": False}, headers=headers)

def main():
    print("🚀 Testing Media Generation Confirmation Flow")
    print("=" * 60)
    
    results = []
    
    # Test 1: User Settings API
    results.append(("User Settings API", test_user_settings()))
    
    # Test 2: Media Confirmation Flow
    results.append(("Media Confirmation Flow", test_media_confirmation_flow()))
    
    # Test 3: Quick Generate Flow
    results.append(("Quick Generate Flow", test_quick_generate_flow()))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n📈 Success Rate: {passed}/{total} ({(passed/total)*100:.1f}%)")

if __name__ == "__main__":
    main()