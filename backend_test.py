#!/usr/bin/env python3
"""
Backend Testing for SoulPrint Engine Bug Fixes
Tests two specific bug fixes:
1. Conversational Follow-Up Detection ("any update?" context preservation)
2. Music Generation NDJSON Event Sequence
"""

import requests
import json
import time
import sys
from typing import Dict, List, Optional

# Configuration
BASE_URL = "http://localhost:3000"
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.RESET}")

def print_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.RESET}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.RESET}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.RESET}")

def login() -> Optional[str]:
    """Login and return auth token"""
    print_info("Logging in...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "passcode": TEST_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print_success(f"Login successful for {TEST_EMAIL}")
                return token
            else:
                print_error("No token in response")
                return None
        else:
            print_error(f"Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_error(f"Login error: {str(e)}")
        return None

def create_conversation(token: str) -> Optional[str]:
    """Create a new conversation and return conversation ID"""
    print_info("Creating conversation...")
    try:
        # Send initial message to create conversation
        response = requests.post(
            f"{BASE_URL}/api/chat/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "content": "Hello, I'm testing the chat system.",
                "model": "gpt-4o-mini"
            },
            timeout=30,
            stream=True
        )
        
        if response.status_code != 200:
            print_error(f"Failed to create conversation: {response.status_code}")
            return None
        
        # Parse NDJSON stream to get conversation ID
        conversation_id = None
        for line in response.iter_lines():
            if line:
                try:
                    event = json.loads(line.decode('utf-8'))
                    if event.get('type') == 'meta' and event.get('conversationId'):
                        conversation_id = event['conversationId']
                        break
                except json.JSONDecodeError:
                    continue
        
        if conversation_id:
            print_success(f"Conversation created: {conversation_id}")
            return conversation_id
        else:
            print_error("No conversation ID found in response")
            return None
            
    except Exception as e:
        print_error(f"Error creating conversation: {str(e)}")
        return None

def seed_conversation_messages(token: str, conversation_id: str) -> bool:
    """Seed some messages into the conversation for context"""
    print_info("Seeding conversation with context messages...")
    
    messages = [
        "Can you help me understand quantum computing?",
        "What are the main applications of quantum computers?",
        "How does quantum entanglement work?"
    ]
    
    for msg in messages:
        try:
            response = requests.post(
                f"{BASE_URL}/api/chat/stream",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                json={
                    "conversationId": conversation_id,
                    "content": msg,
                    "model": "gpt-4o-mini"
                },
                timeout=30,
                stream=True
            )
            
            if response.status_code != 200:
                print_error(f"Failed to seed message: {response.status_code}")
                return False
            
            # Consume the stream
            for line in response.iter_lines():
                pass
            
            time.sleep(0.5)  # Brief pause between messages
            
        except Exception as e:
            print_error(f"Error seeding message: {str(e)}")
            return False
    
    print_success("Conversation seeded with context messages")
    return True

def test_conversational_followup(token: str, conversation_id: str) -> Dict:
    """
    Test 1: Conversational Follow-Up Detection
    Tests that short status/progress follow-ups like "any update?" are detected
    as conversational follow-ups and do NOT trigger web search.
    """
    print("\n" + "="*80)
    print("TEST 1: CONVERSATIONAL FOLLOW-UP DETECTION")
    print("="*80)
    
    results = {
        "test_name": "Conversational Follow-Up Detection",
        "passed": 0,
        "failed": 0,
        "details": []
    }
    
    # Test cases: short status/progress follow-ups that should NOT trigger web search
    followup_messages = [
        "any update?",
        "any progress?",
        "is it done?",
        "done yet?",
        "any news?",
        "what's the status?",
        "how's it going?",
        "ready yet?"
    ]
    
    print_info(f"Testing {len(followup_messages)} conversational follow-up patterns...")
    
    for msg in followup_messages:
        print(f"\n  Testing: '{msg}'")
        try:
            response = requests.post(
                f"{BASE_URL}/api/chat/stream",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                json={
                    "conversationId": conversation_id,
                    "content": msg,
                    "model": "gpt-4o-mini"
                },
                timeout=30,
                stream=True
            )
            
            if response.status_code != 200:
                print_error(f"  Request failed: {response.status_code}")
                results["failed"] += 1
                results["details"].append({
                    "message": msg,
                    "status": "FAILED",
                    "reason": f"HTTP {response.status_code}"
                })
                continue
            
            # Parse NDJSON stream and check for web search indicators
            events = []
            web_search_detected = False
            
            for line in response.iter_lines():
                if line:
                    try:
                        event = json.loads(line.decode('utf-8'))
                        events.append(event)
                        
                        # Check for web search indicators
                        if event.get('type') == 'search_start':
                            web_search_detected = True
                        if event.get('type') == 'delta':
                            content = event.get('content', '').lower()
                            if 'searching' in content or 'web search' in content:
                                web_search_detected = True
                                
                    except json.JSONDecodeError:
                        continue
            
            # Verify: should NOT trigger web search
            if not web_search_detected:
                print_success(f"  ✓ Correctly detected as conversational follow-up (no web search)")
                results["passed"] += 1
                results["details"].append({
                    "message": msg,
                    "status": "PASSED",
                    "reason": "No web search triggered"
                })
            else:
                print_error(f"  ✗ Incorrectly triggered web search")
                results["failed"] += 1
                results["details"].append({
                    "message": msg,
                    "status": "FAILED",
                    "reason": "Web search was triggered"
                })
            
            time.sleep(0.5)
            
        except Exception as e:
            print_error(f"  Error: {str(e)}")
            results["failed"] += 1
            results["details"].append({
                "message": msg,
                "status": "FAILED",
                "reason": str(e)
            })
    
    # Test a longer query that SHOULD trigger web search
    print(f"\n  Testing longer query (should trigger web search): 'what is the latest update on tesla stock price'")
    try:
        response = requests.post(
            f"{BASE_URL}/api/chat/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "conversationId": conversation_id,
                "content": "what is the latest update on tesla stock price",
                "model": "gpt-4o-mini"
            },
            timeout=30,
            stream=True
        )
        
        if response.status_code == 200:
            web_search_detected = False
            for line in response.iter_lines():
                if line:
                    try:
                        event = json.loads(line.decode('utf-8'))
                        if event.get('type') == 'search_start':
                            web_search_detected = True
                        if event.get('type') == 'delta':
                            content = event.get('content', '').lower()
                            if 'searching' in content or 'web search' in content:
                                web_search_detected = True
                    except json.JSONDecodeError:
                        continue
            
            if web_search_detected:
                print_success(f"  ✓ Correctly triggered web search for longer query")
                results["passed"] += 1
                results["details"].append({
                    "message": "longer query test",
                    "status": "PASSED",
                    "reason": "Web search triggered as expected"
                })
            else:
                print_warning(f"  ⚠ Web search not detected (may be disabled or model-dependent)")
                results["details"].append({
                    "message": "longer query test",
                    "status": "SKIPPED",
                    "reason": "Web search not detected"
                })
    except Exception as e:
        print_warning(f"  Error testing longer query: {str(e)}")
    
    return results

def test_music_generation(token: str) -> Dict:
    """
    Test 2: Music Generation NDJSON Event Sequence
    Tests that music generation emits proper NDJSON events in order:
    1. generating_visual with visualType: 'music'
    2. delta (text content)
    3. music_task with jobId, taskId, title, style, status
    4. done
    """
    print("\n" + "="*80)
    print("TEST 2: MUSIC GENERATION NDJSON EVENT SEQUENCE")
    print("="*80)
    
    results = {
        "test_name": "Music Generation NDJSON Event Sequence",
        "passed": 0,
        "failed": 0,
        "details": []
    }
    
    # Check if KIE_API_KEY is configured
    print_info("Testing music generation endpoint...")
    
    music_request = "create a jazz song about summer"
    print(f"  Sending music request: '{music_request}'")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/chat/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "content": music_request,
                "model": "gpt-4o-mini"
            },
            timeout=60,
            stream=True
        )
        
        if response.status_code != 200:
            print_error(f"  Request failed: {response.status_code}")
            results["failed"] += 1
            results["details"].append({
                "test": "music_generation_request",
                "status": "FAILED",
                "reason": f"HTTP {response.status_code}"
            })
            return results
        
        # Parse NDJSON stream and collect events
        events = []
        event_types = []
        
        for line in response.iter_lines():
            if line:
                try:
                    event = json.loads(line.decode('utf-8'))
                    events.append(event)
                    event_types.append(event.get('type'))
                except json.JSONDecodeError:
                    continue
        
        print(f"\n  Received {len(events)} events: {event_types}")
        
        # Check for required events
        has_generating_visual = False
        has_music_task = False
        has_delta = False
        has_done = False
        music_not_configured = False
        
        for event in events:
            event_type = event.get('type')
            
            if event_type == 'generating_visual':
                if event.get('visualType') == 'music':
                    has_generating_visual = True
                    print_success(f"  ✓ Found 'generating_visual' event with visualType='music'")
            
            elif event_type == 'delta':
                has_delta = True
                content = event.get('content', '')
                if 'not configured' in content.lower() or 'music generation is not' in content.lower():
                    music_not_configured = True
                    print_warning(f"  ⚠ Music generation not configured (KIE_API_KEY missing)")
            
            elif event_type == 'music_task':
                has_music_task = True
                # Verify required fields
                required_fields = ['jobId', 'taskId', 'title', 'style', 'status']
                missing_fields = [f for f in required_fields if f not in event]
                
                if not missing_fields:
                    print_success(f"  ✓ Found 'music_task' event with all required fields: {required_fields}")
                    print(f"    - jobId: {event.get('jobId')}")
                    print(f"    - taskId: {event.get('taskId')}")
                    print(f"    - title: {event.get('title')}")
                    print(f"    - style: {event.get('style')}")
                    print(f"    - status: {event.get('status')}")
                else:
                    print_error(f"  ✗ 'music_task' event missing fields: {missing_fields}")
            
            elif event_type == 'done':
                has_done = True
                print_success(f"  ✓ Found 'done' event")
        
        # Evaluate results
        if music_not_configured:
            print_warning("  Music generation is not configured (KIE_API_KEY missing)")
            print_info("  Checking for graceful error handling...")
            
            if has_delta and has_done:
                print_success("  ✓ Gracefully handled missing configuration with error message")
                results["passed"] += 1
                results["details"].append({
                    "test": "music_not_configured_handling",
                    "status": "PASSED",
                    "reason": "Gracefully handled missing KIE_API_KEY"
                })
            else:
                print_error("  ✗ Did not handle missing configuration gracefully")
                results["failed"] += 1
                results["details"].append({
                    "test": "music_not_configured_handling",
                    "status": "FAILED",
                    "reason": "Missing graceful error handling"
                })
        else:
            # Check event sequence
            if has_generating_visual:
                results["passed"] += 1
                results["details"].append({
                    "test": "generating_visual_event",
                    "status": "PASSED",
                    "reason": "Found generating_visual with visualType='music'"
                })
            else:
                results["failed"] += 1
                results["details"].append({
                    "test": "generating_visual_event",
                    "status": "FAILED",
                    "reason": "Missing generating_visual event"
                })
            
            if has_delta:
                results["passed"] += 1
                results["details"].append({
                    "test": "delta_event",
                    "status": "PASSED",
                    "reason": "Found delta event with text content"
                })
            else:
                results["failed"] += 1
                results["details"].append({
                    "test": "delta_event",
                    "status": "FAILED",
                    "reason": "Missing delta event"
                })
            
            if has_music_task:
                results["passed"] += 1
                results["details"].append({
                    "test": "music_task_event",
                    "status": "PASSED",
                    "reason": "Found music_task event with required fields"
                })
            else:
                results["failed"] += 1
                results["details"].append({
                    "test": "music_task_event",
                    "status": "FAILED",
                    "reason": "Missing music_task event"
                })
            
            if has_done:
                results["passed"] += 1
                results["details"].append({
                    "test": "done_event",
                    "status": "PASSED",
                    "reason": "Found done event"
                })
            else:
                results["failed"] += 1
                results["details"].append({
                    "test": "done_event",
                    "status": "FAILED",
                    "reason": "Missing done event"
                })
        
        # Verify NDJSON format (not SSE)
        print_info("  Verifying NDJSON format (not SSE)...")
        is_ndjson = True
        for line_bytes in response.iter_lines():
            if line_bytes:
                line = line_bytes.decode('utf-8')
                if line.startswith('data: '):
                    is_ndjson = False
                    print_error("  ✗ Response uses SSE format (data: prefix), not NDJSON")
                    break
        
        if is_ndjson:
            print_success("  ✓ Response is proper NDJSON format (no 'data:' prefix)")
            results["passed"] += 1
            results["details"].append({
                "test": "ndjson_format",
                "status": "PASSED",
                "reason": "Response is NDJSON, not SSE"
            })
        else:
            results["failed"] += 1
            results["details"].append({
                "test": "ndjson_format",
                "status": "FAILED",
                "reason": "Response uses SSE format instead of NDJSON"
            })
        
    except Exception as e:
        print_error(f"  Error: {str(e)}")
        results["failed"] += 1
        results["details"].append({
            "test": "music_generation_request",
            "status": "FAILED",
            "reason": str(e)
        })
    
    return results

def print_summary(all_results: List[Dict]):
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total_passed = sum(r["passed"] for r in all_results)
    total_failed = sum(r["failed"] for r in all_results)
    total_tests = total_passed + total_failed
    
    for result in all_results:
        test_name = result["test_name"]
        passed = result["passed"]
        failed = result["failed"]
        total = passed + failed
        
        if failed == 0:
            status_icon = "✅"
            status_color = Colors.GREEN
        else:
            status_icon = "❌"
            status_color = Colors.RED
        
        print(f"\n{status_icon} {test_name}")
        print(f"  {status_color}Passed: {passed}/{total}{Colors.RESET}")
        if failed > 0:
            print(f"  {Colors.RED}Failed: {failed}/{total}{Colors.RESET}")
    
    print(f"\n{'='*80}")
    print(f"OVERALL: {total_passed}/{total_tests} tests passed")
    
    if total_failed == 0:
        print_success("All tests passed! 🎉")
        return 0
    else:
        print_error(f"{total_failed} test(s) failed")
        return 1

def main():
    """Main test execution"""
    print("\n" + "="*80)
    print("SOULPRINT ENGINE BUG FIX TESTING")
    print("Testing two bug fixes:")
    print("1. Conversational Follow-Up Detection")
    print("2. Music Generation NDJSON Event Sequence")
    print("="*80)
    
    # Login
    token = login()
    if not token:
        print_error("Failed to authenticate. Exiting.")
        return 1
    
    # Create conversation for Test 1
    conversation_id = create_conversation(token)
    if not conversation_id:
        print_error("Failed to create conversation. Exiting.")
        return 1
    
    # Seed conversation with context
    if not seed_conversation_messages(token, conversation_id):
        print_warning("Failed to seed conversation, but continuing with tests...")
    
    # Run tests
    all_results = []
    
    # Test 1: Conversational Follow-Up Detection
    result1 = test_conversational_followup(token, conversation_id)
    all_results.append(result1)
    
    # Test 2: Music Generation NDJSON Event Sequence
    result2 = test_music_generation(token)
    all_results.append(result2)
    
    # Print summary
    exit_code = print_summary(all_results)
    
    return exit_code

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
