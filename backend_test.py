#!/usr/bin/env python3
"""
Backend API Testing Script for SoulPrint Engine
Tests conversation follow-up memory fix to ensure short follow-up questions don't trigger web search
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"

# Test credentials
REGULAR_USER = {
    "email": "testchat@example.com",
    "passcode": "Test123456"
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_test(message: str):
    print(f"{Colors.BLUE}[TEST]{Colors.RESET} {message}")

def print_success(message: str):
    print(f"{Colors.GREEN}✅ {message}{Colors.RESET}")

def print_error(message: str):
    print(f"{Colors.RED}❌ {message}{Colors.RESET}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.RESET}")

def login(email: str, passcode: str) -> Optional[str]:
    """Login and return auth token"""
    try:
        print_test(f"Logging in as {email}...")
        response = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": email, "passcode": passcode},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print_success(f"Login successful for {email}")
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

def test_conversation_followup_no_crash(token: str) -> bool:
    """
    Test 1: Conversation Follow-Up — No Crash
    Send first message, then send follow-up "What is the average pricing?" - should return 200 (NOT 500)
    """
    print_test("\n" + "="*80)
    print_test("TEST 1: Conversation Follow-Up — No Crash")
    print_test("="*80)
    
    conversation_id = f"test-followup-mem-{int(time.time())}"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Step 1: Send first message
        print_test("Step 1: Sending first message about DealRoom.net and competitors...")
        first_message = {
            "content": "Tell me about DealRoom.net and their competitors",
            "conversation_id": conversation_id
        }
        
        response1 = requests.post(
            f"{API_BASE}/chat/stream",
            json=first_message,
            headers=headers,
            timeout=60
        )
        
        if response1.status_code != 200:
            print_error(f"First message failed: {response1.status_code}")
            print_error(f"Response: {response1.text[:500]}")
            return False
        
        print_success(f"First message returned 200 OK")
        
        # Wait a bit for the conversation to be established
        time.sleep(2)
        
        # Step 2: Send follow-up question (this is the critical test)
        print_test("Step 2: Sending follow-up question 'What is the average pricing?'...")
        followup_message = {
            "content": "What is the average pricing?",
            "conversation_id": conversation_id
        }
        
        response2 = requests.post(
            f"{API_BASE}/chat/stream",
            json=followup_message,
            headers=headers,
            timeout=60
        )
        
        if response2.status_code == 500:
            print_error(f"❌ CRITICAL: Follow-up message crashed with 500 error!")
            print_error(f"Response: {response2.text[:500]}")
            return False
        elif response2.status_code == 200:
            print_success(f"✅ Follow-up message returned 200 OK (no crash)")
            print_success(f"Content-Type: {response2.headers.get('content-type', 'N/A')}")
            return True
        else:
            print_warning(f"Follow-up message returned unexpected status: {response2.status_code}")
            print_warning(f"Response: {response2.text[:500]}")
            return False
            
    except Exception as e:
        print_error(f"Exception during test: {str(e)}")
        return False

def test_short_followup_detection(token: str) -> bool:
    """
    Test 2: Short Follow-Up Detection
    Send "How do they compare?" - should return 200
    """
    print_test("\n" + "="*80)
    print_test("TEST 2: Short Follow-Up Detection")
    print_test("="*80)
    
    conversation_id = f"test-followup-mem-{int(time.time())}"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Step 1: Send first message to establish context
        print_test("Step 1: Establishing conversation context...")
        first_message = {
            "content": "Tell me about DealRoom.net and their competitors",
            "conversation_id": conversation_id
        }
        
        response1 = requests.post(
            f"{API_BASE}/chat/stream",
            json=first_message,
            headers=headers,
            timeout=60
        )
        
        if response1.status_code != 200:
            print_error(f"First message failed: {response1.status_code}")
            return False
        
        print_success(f"Context established")
        time.sleep(2)
        
        # Step 2: Send short follow-up
        print_test("Step 2: Sending short follow-up 'How do they compare?'...")
        followup_message = {
            "content": "How do they compare?",
            "conversation_id": conversation_id
        }
        
        response2 = requests.post(
            f"{API_BASE}/chat/stream",
            json=followup_message,
            headers=headers,
            timeout=60
        )
        
        if response2.status_code == 200:
            print_success(f"✅ Short follow-up returned 200 OK")
            return True
        else:
            print_error(f"Short follow-up failed: {response2.status_code}")
            print_error(f"Response: {response2.text[:500]}")
            return False
            
    except Exception as e:
        print_error(f"Exception during test: {str(e)}")
        return False

def test_new_topic_still_works(token: str) -> bool:
    """
    Test 3: New Topic Still Works
    NEW conversation with explicit query - should return 200 (web search should still work for new topics)
    """
    print_test("\n" + "="*80)
    print_test("TEST 3: New Topic Still Works")
    print_test("="*80)
    
    conversation_id = f"test-new-topic-{int(time.time())}"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        print_test("Sending new topic query 'What is the current weather forecast for San Francisco?'...")
        message = {
            "content": "What is the current weather forecast for San Francisco?",
            "conversation_id": conversation_id
        }
        
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json=message,
            headers=headers,
            timeout=60
        )
        
        if response.status_code == 200:
            print_success(f"✅ New topic query returned 200 OK")
            print_success(f"Web search still works for explicit new queries")
            return True
        else:
            print_error(f"New topic query failed: {response.status_code}")
            print_error(f"Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print_error(f"Exception during test: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("CONVERSATION FOLLOW-UP MEMORY FIX TESTING")
    print("Testing that short follow-up questions don't trigger web search in active conversations")
    print("="*80 + "\n")
    
    # Login as regular user
    token = login(REGULAR_USER["email"], REGULAR_USER["passcode"])
    if not token:
        print_error("Failed to login. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run tests
    results = []
    
    # Test 1: Conversation Follow-Up — No Crash
    test1_result = test_conversation_followup_no_crash(token)
    results.append(("Conversation Follow-Up — No Crash", test1_result))
    
    # Test 2: Short Follow-Up Detection
    test2_result = test_short_followup_detection(token)
    results.append(("Short Follow-Up Detection", test2_result))
    
    # Test 3: New Topic Still Works
    test3_result = test_new_topic_still_works(token)
    results.append(("New Topic Still Works", test3_result))
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({int(passed/total*100)}% success rate)")
    
    if passed == total:
        print_success("\n🎉 All tests passed! Conversation follow-up memory fix is working correctly.")
        sys.exit(0)
    else:
        print_error(f"\n⚠️  {total - passed} test(s) failed. Please review the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
