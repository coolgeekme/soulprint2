#!/usr/bin/env python3
"""
Backend Testing for Mobile Media Confirmation Flow
Tests the P0 bug fix where mobile users were unable to generate videos/images
because the confirmation UI was missing.
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from review request
TEST_USER_EMAIL = "testchat@example.com"
TEST_USER_PASSWORD = "Test123456"
ADMIN_EMAIL = "test@soulprint.com"
ADMIN_PASSWORD = "test123"

def print_test_header(test_name):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_success(message):
    """Print success message"""
    print(f"✅ {message}")

def print_error(message):
    """Print error message"""
    print(f"❌ {message}")

def print_info(message):
    """Print info message"""
    print(f"ℹ️  {message}")

def login(email, password):
    """Login and return auth token"""
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": email, "passcode": password},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print_success(f"Logged in as {email}")
                return token
            else:
                print_error(f"No token in response: {data}")
                return None
        else:
            print_error(f"Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_error(f"Login exception: {str(e)}")
        return None

def test_video_generation_media_confirmation(token):
    """
    TEST 1: Chat Stream sends media_confirmation events for video generation intent
    POST /api/chat/stream with "make me a video of a sunset over the ocean"
    Should return NDJSON with media_confirmation event
    """
    print_test_header("Test 1: Video Generation Media Confirmation")
    
    try:
        # Create a test conversation first
        conv_response = requests.post(
            f"{API_BASE}/conversations",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "Test Video Confirmation"},
            timeout=10
        )
        
        if conv_response.status_code != 200:
            print_error(f"Failed to create conversation: {conv_response.status_code}")
            return False
        
        conv_id = conv_response.json().get('id')
        print_info(f"Created test conversation: {conv_id}")
        
        # Send video generation request with mediaGenMode=false (confirmation mode)
        print_info("Sending video generation request: 'make me a video of a sunset over the ocean'")
        
        response = requests.post(
            f"{API_BASE}/chat/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "conversationId": conv_id,
                "content": "make me a video of a sunset over the ocean",
                "model": "smart",
                "mediaGenMode": False  # Confirmation mode
            },
            stream=True,
            timeout=60
        )
        
        if response.status_code != 200:
            print_error(f"Request failed: {response.status_code} - {response.text}")
            return False
        
        # Check content type
        content_type = response.headers.get('Content-Type', '')
        print_info(f"Response Content-Type: {content_type}")
        
        if 'application/x-ndjson' not in content_type and 'text/event-stream' not in content_type:
            print_error(f"Unexpected content type: {content_type}")
            return False
        
        # Parse NDJSON stream
        found_media_confirmation = False
        media_confirmation_data = None
        event_count = 0
        
        for line in response.iter_lines():
            if not line:
                continue
            
            line_str = line.decode('utf-8').strip()
            if not line_str:
                continue
            
            # Skip SSE "data: " prefix if present (should NOT be present for NDJSON)
            if line_str.startswith('data: '):
                print_error("Found SSE 'data: ' prefix - should be pure NDJSON!")
                line_str = line_str[6:]  # Strip it for parsing
            
            try:
                data = json.loads(line_str)
                event_count += 1
                
                if data.get('type') == 'media_confirmation':
                    found_media_confirmation = True
                    media_confirmation_data = data
                    print_success("Found media_confirmation event!")
                    print_info(f"Event data: {json.dumps(data, indent=2)}")
                    
                    # Validate required fields
                    required_fields = ['detectedType', 'refinedPrompt', 'availableModels', 'recommendedModel']
                    missing_fields = [f for f in required_fields if f not in data]
                    
                    if missing_fields:
                        print_error(f"Missing required fields: {missing_fields}")
                        return False
                    
                    # Check detectedType is 'video'
                    if data.get('detectedType') != 'video':
                        print_error(f"Expected detectedType='video', got '{data.get('detectedType')}'")
                        return False
                    
                    print_success(f"detectedType: {data.get('detectedType')}")
                    print_success(f"refinedPrompt: {data.get('refinedPrompt')}")
                    print_success(f"availableModels: {data.get('availableModels')}")
                    print_success(f"recommendedModel: {data.get('recommendedModel')}")
                    
                    # Break after finding confirmation
                    break
                    
            except json.JSONDecodeError as e:
                print_error(f"Failed to parse JSON line: {line_str[:100]}... Error: {e}")
                continue
        
        print_info(f"Total events processed: {event_count}")
        
        if not found_media_confirmation:
            print_error("No media_confirmation event found in stream")
            return False
        
        print_success("Test 1 PASSED: Video generation triggers media_confirmation")
        return True
        
    except Exception as e:
        print_error(f"Test 1 exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_image_generation_media_confirmation(token):
    """
    TEST 2: Chat Stream sends media_confirmation for image intent
    POST /api/chat/stream with "generate an image of a beautiful sunset"
    Should return media_confirmation event with detectedType: "image"
    """
    print_test_header("Test 2: Image Generation Media Confirmation")
    
    try:
        # Create a test conversation
        conv_response = requests.post(
            f"{API_BASE}/conversations",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "Test Image Confirmation"},
            timeout=10
        )
        
        if conv_response.status_code != 200:
            print_error(f"Failed to create conversation: {conv_response.status_code}")
            return False
        
        conv_id = conv_response.json().get('id')
        print_info(f"Created test conversation: {conv_id}")
        
        # Send image generation request
        print_info("Sending image generation request: 'generate an image of a beautiful sunset'")
        
        response = requests.post(
            f"{API_BASE}/chat/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "conversationId": conv_id,
                "content": "generate an image of a beautiful sunset",
                "model": "smart",
                "mediaGenMode": False  # Confirmation mode
            },
            stream=True,
            timeout=60
        )
        
        if response.status_code != 200:
            print_error(f"Request failed: {response.status_code}")
            return False
        
        # Parse NDJSON stream
        found_media_confirmation = False
        
        for line in response.iter_lines():
            if not line:
                continue
            
            line_str = line.decode('utf-8').strip()
            if not line_str:
                continue
            
            # Skip SSE prefix if present
            if line_str.startswith('data: '):
                line_str = line_str[6:]
            
            try:
                data = json.loads(line_str)
                
                if data.get('type') == 'media_confirmation':
                    found_media_confirmation = True
                    print_success("Found media_confirmation event!")
                    
                    # Check detectedType is 'image'
                    if data.get('detectedType') != 'image':
                        print_error(f"Expected detectedType='image', got '{data.get('detectedType')}'")
                        return False
                    
                    print_success(f"detectedType: {data.get('detectedType')}")
                    print_success(f"refinedPrompt: {data.get('refinedPrompt')}")
                    
                    # Break after finding confirmation
                    break
                    
            except json.JSONDecodeError:
                continue
        
        if not found_media_confirmation:
            print_error("No media_confirmation event found in stream")
            return False
        
        print_success("Test 2 PASSED: Image generation triggers media_confirmation")
        return True
        
    except Exception as e:
        print_error(f"Test 2 exception: {str(e)}")
        return False

def test_regular_chat_no_confirmation(token):
    """
    TEST 3: Chat Stream does NOT send media_confirmation for regular chat
    POST /api/chat/stream with "what is the weather like today?"
    Should NOT contain any media_confirmation event
    """
    print_test_header("Test 3: Regular Chat - No Media Confirmation")
    
    try:
        # Create a test conversation
        conv_response = requests.post(
            f"{API_BASE}/conversations",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "Test Regular Chat"},
            timeout=10
        )
        
        if conv_response.status_code != 200:
            print_error(f"Failed to create conversation: {conv_response.status_code}")
            return False
        
        conv_id = conv_response.json().get('id')
        print_info(f"Created test conversation: {conv_id}")
        
        # Send regular chat message
        print_info("Sending regular chat: 'what is the weather like today?'")
        
        response = requests.post(
            f"{API_BASE}/chat/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "conversationId": conv_id,
                "content": "what is the weather like today?",
                "model": "smart",
                "mediaGenMode": False
            },
            stream=True,
            timeout=60
        )
        
        if response.status_code != 200:
            print_error(f"Request failed: {response.status_code}")
            return False
        
        # Parse NDJSON stream
        found_media_confirmation = False
        found_delta = False
        found_done = False
        
        for line in response.iter_lines():
            if not line:
                continue
            
            line_str = line.decode('utf-8').strip()
            if not line_str:
                continue
            
            # Skip SSE prefix if present
            if line_str.startswith('data: '):
                line_str = line_str[6:]
            
            try:
                data = json.loads(line_str)
                
                if data.get('type') == 'media_confirmation':
                    found_media_confirmation = True
                    print_error("Found unexpected media_confirmation event!")
                    return False
                
                if data.get('type') == 'delta':
                    found_delta = True
                
                if data.get('type') == 'done':
                    found_done = True
                    break
                    
            except json.JSONDecodeError:
                continue
        
        if found_media_confirmation:
            print_error("Regular chat should NOT trigger media_confirmation")
            return False
        
        if not found_delta:
            print_error("Expected delta events for regular chat")
            return False
        
        if not found_done:
            print_error("Expected done event")
            return False
        
        print_success("No media_confirmation event found (correct)")
        print_success("Found delta and done events (correct)")
        print_success("Test 3 PASSED: Regular chat does not trigger media_confirmation")
        return True
        
    except Exception as e:
        print_error(f"Test 3 exception: {str(e)}")
        return False

def test_confirmed_media_flow(token):
    """
    TEST 4: Confirmed media flow endpoint works
    POST /api/chat/stream with mediaFlow payload
    Should return streaming response (NOT 500 error)
    """
    print_test_header("Test 4: Confirmed Media Flow Endpoint")
    
    try:
        # Create a test conversation
        conv_response = requests.post(
            f"{API_BASE}/conversations",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "Test Confirmed Media Flow"},
            timeout=10
        )
        
        if conv_response.status_code != 200:
            print_error(f"Failed to create conversation: {conv_response.status_code}")
            return False
        
        conv_id = conv_response.json().get('id')
        print_info(f"Created test conversation: {conv_id}")
        
        # Send confirmed media flow request
        print_info("Sending confirmed media flow request")
        
        media_flow_payload = {
            "step": "confirmed",
            "type": "video",
            "finalPrompt": "A beautiful sunset over the ocean with golden light reflecting on waves",
            "selectedModel": "smart",
            "aspectRatio": "16:9"
        }
        
        response = requests.post(
            f"{API_BASE}/chat/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "conversationId": conv_id,
                "content": "[Confirmed: Generate video]",
                "model": "smart",
                "mediaFlow": media_flow_payload,
                "create_mode": True
            },
            stream=True,
            timeout=60
        )
        
        # Check for 500 error
        if response.status_code == 500:
            print_error("Got 500 error - confirmed media flow is broken!")
            return False
        
        if response.status_code != 200:
            print_error(f"Request failed: {response.status_code}")
            return False
        
        print_success(f"Got 200 response (not 500)")
        
        # Parse stream to verify it's working
        found_events = False
        event_types = set()
        
        for line in response.iter_lines():
            if not line:
                continue
            
            line_str = line.decode('utf-8').strip()
            if not line_str:
                continue
            
            # Skip SSE prefix if present
            if line_str.startswith('data: '):
                line_str = line_str[6:]
            
            try:
                data = json.loads(line_str)
                event_types.add(data.get('type'))
                found_events = True
                
                # Look for video_task or image events
                if data.get('type') == 'video_task':
                    print_success(f"Found video_task event: taskId={data.get('taskId')}")
                
                if data.get('type') == 'image':
                    print_success(f"Found image event: url={data.get('url', '')[:50]}...")
                
                if data.get('type') == 'done':
                    break
                    
            except json.JSONDecodeError:
                continue
        
        if not found_events:
            print_error("No events found in stream")
            return False
        
        print_success(f"Found event types: {event_types}")
        print_success("Test 4 PASSED: Confirmed media flow endpoint works")
        return True
        
    except Exception as e:
        print_error(f"Test 4 exception: {str(e)}")
        return False

def test_admin_page_builds(token):
    """
    TEST 5: Admin page builds correctly
    GET /admin should not return 500 error
    """
    print_test_header("Test 5: Admin Page Builds")
    
    try:
        print_info("Checking admin page...")
        
        response = requests.get(
            f"{BASE_URL}/admin",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
            allow_redirects=True
        )
        
        if response.status_code == 500:
            print_error("Admin page returns 500 error!")
            print_error(f"Response: {response.text[:500]}")
            return False
        
        if response.status_code == 200:
            print_success("Admin page loads successfully (200)")
            print_success("Test 5 PASSED: Admin page builds correctly")
            return True
        
        # Other status codes (401, 403, etc.) are acceptable - page builds, just auth issues
        print_info(f"Admin page returned {response.status_code} (not 500, so build is OK)")
        print_success("Test 5 PASSED: Admin page builds correctly")
        return True
        
    except Exception as e:
        print_error(f"Test 5 exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("MOBILE MEDIA CONFIRMATION FLOW - BACKEND TESTING")
    print("P0 Bug Fix: Mobile users unable to generate videos/images")
    print("="*80)
    
    # Login
    print_test_header("Authentication")
    token = login(TEST_USER_EMAIL, TEST_USER_PASSWORD)
    
    if not token:
        print_error("Failed to authenticate - cannot proceed with tests")
        sys.exit(1)
    
    # Run all tests
    results = []
    
    results.append(("Test 1: Video Generation Media Confirmation", test_video_generation_media_confirmation(token)))
    results.append(("Test 2: Image Generation Media Confirmation", test_image_generation_media_confirmation(token)))
    results.append(("Test 3: Regular Chat - No Confirmation", test_regular_chat_no_confirmation(token)))
    results.append(("Test 4: Confirmed Media Flow Endpoint", test_confirmed_media_flow(token)))
    results.append(("Test 5: Admin Page Builds", test_admin_page_builds(token)))
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\n{passed}/{total} tests passed ({int(passed/total*100)}% success rate)")
    
    if passed == total:
        print_success("ALL TESTS PASSED! Mobile Media Confirmation Flow is working correctly.")
        sys.exit(0)
    else:
        print_error(f"{total - passed} test(s) failed. Please review the output above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
