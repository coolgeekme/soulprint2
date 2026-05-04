#!/usr/bin/env python3
"""
Backend API Testing for SoulPrint Engine - Music Generation Fix
Tests the fix for long lyrics prompts in music generation
"""

import requests
import json
import sys
import time

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from review request
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log_success(msg):
    print(f"{GREEN}✅ {msg}{RESET}")

def log_error(msg):
    print(f"{RED}❌ {msg}{RESET}")

def log_info(msg):
    print(f"{BLUE}ℹ️  {msg}{RESET}")

def log_warning(msg):
    print(f"{YELLOW}⚠️  {msg}{RESET}")

def authenticate():
    """Authenticate and get JWT token"""
    try:
        log_info("Authenticating...")
        response = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": TEST_EMAIL, "passcode": TEST_PASSWORD},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                log_success(f"Authentication successful for {TEST_EMAIL}")
                return token
            else:
                log_error("No token in response")
                return None
        else:
            log_error(f"Authentication failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        log_error(f"Authentication error: {str(e)}")
        return None

def parse_ndjson_stream(text):
    """Parse NDJSON stream (newline-delimited JSON)"""
    events = []
    for line in text.strip().split('\n'):
        line = line.strip()
        if line:
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                # Skip invalid JSON lines
                pass
    return events

def test_long_lyrics_music_generation(token):
    """
    Test 1: Long lyrics music generation request (951 chars, 30+ linebreaks)
    This is the exact failing prompt from the review request
    """
    print("\n" + "="*80)
    log_info("TEST 1: Long Lyrics Music Generation (951 chars, 30+ linebreaks)")
    print("="*80)
    
    # The exact prompt from the review request
    prompt = """Generate a song with these lyrics:

In a world of echoes, I find my own,
A path of light where my soul is shown.
Each word a whisper, each thought a spark,
Guiding me through the unknown dark.

SoulPrint, my reflection in the night,
A tapestry of dreams, woven in light.
In your embrace, I feel the call,
To be the truest version of it all.

Memories that linger, stories untold,
A journey of the heart, both brave and bold.
With every step, I find my way,
A dance of shadows that lead to day.

SoulPrint, my reflection in the night,
A tapestry of dreams, woven in light.
In your embrace, I feel the call,
To be the truest version of it all.

Guided by the stars, we shine so bright,
An endless horizon, in the depth of night.
Together we rise, together we fall,
In this mirrored world, we stand tall.

SoulPrint, you're the compass of my soul,
In your gentle light, I find my goal.
A journey unending, forever free,
SoulPrint, you're the heart of me."""
    
    log_info(f"Prompt length: {len(prompt)} chars")
    log_info(f"Line breaks: {prompt.count(chr(10))}")
    
    try:
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json={
                "content": prompt,
                "model": "gpt-4o",
                "conversationId": None
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=60
        )
        
        if response.status_code != 200:
            log_error(f"Request failed: {response.status_code}")
            log_error(f"Response: {response.text[:500]}")
            return False
        
        # Parse NDJSON response
        events = parse_ndjson_stream(response.text)
        log_info(f"Received {len(events)} NDJSON events")
        
        # Check for music generation events
        has_generating_visual = False
        has_music_task = False
        visual_type = None
        
        for event in events:
            event_type = event.get('type')
            
            if event_type == 'generating_visual':
                has_generating_visual = True
                visual_type = event.get('visualType')
                log_info(f"Found generating_visual event with visualType: {visual_type}")
            
            if event_type == 'music_task':
                has_music_task = True
                log_info(f"Found music_task event: {json.dumps(event, indent=2)}")
        
        # Verify music intent was detected
        if has_generating_visual and visual_type == 'music':
            log_success("✓ generating_visual event with visualType='music' found")
        else:
            log_error("✗ generating_visual event with visualType='music' NOT found")
            return False
        
        if has_music_task:
            log_success("✓ music_task event found")
        else:
            log_warning("⚠ music_task event not found (may be async)")
        
        log_success("TEST 1 PASSED: Long lyrics music generation detected correctly")
        return True
        
    except Exception as e:
        log_error(f"Test 1 failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_short_music_request(token):
    """
    Test 2: Short music request still works (regression check)
    """
    print("\n" + "="*80)
    log_info("TEST 2: Short Music Request (Regression Check)")
    print("="*80)
    
    prompt = "create a jazz song about summer"
    log_info(f"Prompt: '{prompt}'")
    
    try:
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json={
                "content": prompt,
                "model": "gpt-4o",
                "conversationId": None
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=60
        )
        
        if response.status_code != 200:
            log_error(f"Request failed: {response.status_code}")
            return False
        
        # Parse NDJSON response
        events = parse_ndjson_stream(response.text)
        log_info(f"Received {len(events)} NDJSON events")
        
        # Check for music generation events
        has_generating_visual = False
        visual_type = None
        
        for event in events:
            event_type = event.get('type')
            
            if event_type == 'generating_visual':
                has_generating_visual = True
                visual_type = event.get('visualType')
                log_info(f"Found generating_visual event with visualType: {visual_type}")
        
        # Verify music intent was detected
        if has_generating_visual and visual_type == 'music':
            log_success("✓ Short music request still detects music intent")
            log_success("TEST 2 PASSED: Short music request regression check passed")
            return True
        else:
            log_error("✗ Short music request did NOT detect music intent")
            log_error("TEST 2 FAILED: Regression detected")
            return False
        
    except Exception as e:
        log_error(f"Test 2 failed with exception: {str(e)}")
        return False

def test_long_non_music_text(token):
    """
    Test 3: Long non-music text should NOT trigger music
    """
    print("\n" + "="*80)
    log_info("TEST 3: Long Non-Music Text (Should NOT Trigger Music)")
    print("="*80)
    
    # Long business strategy text (>800 chars, no music keywords)
    prompt = """I need help developing a comprehensive business strategy for our new SaaS product. 
We're targeting mid-market companies in the healthcare sector. Our product is a patient engagement 
platform that helps hospitals and clinics improve communication with patients through automated 
reminders, appointment scheduling, and secure messaging. We need to consider our go-to-market 
strategy, pricing model, customer acquisition channels, and competitive positioning. The market 
is quite crowded with established players like Epic and Cerner, but we believe our focus on 
user experience and mobile-first design gives us a competitive advantage. We're also considering 
a freemium model to drive adoption, but we're concerned about conversion rates. What are the 
key factors we should consider when developing our pricing strategy? Should we focus on per-user 
pricing or per-organization pricing? How do we balance growth with profitability in the early 
stages? We also need to think about our sales strategy - should we build an inside sales team 
or focus on self-service with product-led growth? What metrics should we track to measure success?"""
    
    log_info(f"Prompt length: {len(prompt)} chars")
    log_info(f"Line breaks: {prompt.count(chr(10))}")
    
    try:
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json={
                "content": prompt,
                "model": "gpt-4o",
                "conversationId": None
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=60
        )
        
        if response.status_code != 200:
            log_error(f"Request failed: {response.status_code}")
            return False
        
        # Parse NDJSON response
        events = parse_ndjson_stream(response.text)
        log_info(f"Received {len(events)} NDJSON events")
        
        # Check that NO music generation events are present
        has_music_events = False
        
        for event in events:
            event_type = event.get('type')
            
            if event_type == 'generating_visual':
                visual_type = event.get('visualType')
                if visual_type == 'music':
                    has_music_events = True
                    log_error(f"Found unexpected music generation event")
            
            if event_type == 'music_task':
                has_music_events = True
                log_error(f"Found unexpected music_task event")
        
        # Verify NO music events
        if not has_music_events:
            log_success("✓ Long non-music text did NOT trigger music generation")
            log_success("TEST 3 PASSED: Long non-music text correctly ignored")
            return True
        else:
            log_error("✗ Long non-music text incorrectly triggered music generation")
            log_error("TEST 3 FAILED: False positive detected")
            return False
        
    except Exception as e:
        log_error(f"Test 3 failed with exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print(f"{BLUE}MUSIC GENERATION FIX TESTING - Long Lyrics Prompts{RESET}")
    print("="*80)
    
    # Authenticate
    token = authenticate()
    if not token:
        log_error("Authentication failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run tests
    results = []
    
    # Test 1: Long lyrics music generation
    results.append(("Long Lyrics Music Generation", test_long_lyrics_music_generation(token)))
    time.sleep(2)  # Brief pause between tests
    
    # Test 2: Short music request (regression check)
    results.append(("Short Music Request", test_short_music_request(token)))
    time.sleep(2)
    
    # Test 3: Long non-music text
    results.append(("Long Non-Music Text", test_long_non_music_text(token)))
    
    # Summary
    print("\n" + "="*80)
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = f"{GREEN}PASSED{RESET}" if result else f"{RED}FAILED{RESET}"
        print(f"{test_name}: {status}")
    
    print("\n" + "="*80)
    if passed == total:
        log_success(f"ALL TESTS PASSED ({passed}/{total})")
        print("="*80)
        sys.exit(0)
    else:
        log_error(f"SOME TESTS FAILED ({passed}/{total} passed)")
        print("="*80)
        sys.exit(1)

if __name__ == "__main__":
    main()
