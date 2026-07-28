#!/usr/bin/env python3
"""
Backend Test Suite for GitHub Integration Loop Bug Fix
Tests that casual GitHub mentions don't trigger connection prompts
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com/api"
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

def print_test_header(test_name):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    return success

def login():
    """Login and get auth token"""
    print_test_header("Authentication Setup")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": TEST_EMAIL, "passcode": TEST_PASSWORD},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print_result(True, f"Logged in successfully as {TEST_EMAIL}")
                return token
            else:
                print_result(False, "No token in response")
                return None
        else:
            print_result(False, f"Login failed with status {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print_result(False, f"Login error: {str(e)}")
        return None

def send_chat_message(token, message, conversation_id=None):
    """Send a chat message and return the response"""
    try:
        payload = {
            "content": message,
            "model": "gpt-4o-mini"  # Use free model to avoid enforcement blocking
        }
        if conversation_id:
            payload["conversationId"] = conversation_id
        
        response = requests.post(
            f"{BASE_URL}/chat/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=60,
            stream=True
        )
        
        if response.status_code != 200:
            return {
                "success": False,
                "error": f"HTTP {response.status_code}: {response.text[:200]}"
            }
        
        # Parse NDJSON stream
        full_content = ""
        conversation_id = None
        message_id = None
        is_github_system_response = False
        line_count = 0
        
        for line in response.iter_lines():
            if not line:
                continue
            
            line_count += 1
            try:
                line_str = line.decode('utf-8').strip()
                if not line_str:
                    continue
                
                # Parse NDJSON (not SSE format)
                event = json.loads(line_str)
                
                # Debug first few events
                if line_count <= 3:
                    print(f"[DEBUG] Event {line_count}: {event.get('type')} - {str(event)[:100]}")
                
                if event.get('type') == 'meta':
                    conversation_id = event.get('conversationId')
                    message_id = event.get('messageId')
                elif event.get('type') == 'delta':
                    content = event.get('content', '')
                    full_content += content
                    # Check if this is a GitHub system response
                    if 'GitHub' in content and ('Connect' in content or 'connect' in content):
                        is_github_system_response = True
                elif event.get('type') == 'done':
                    break
                elif event.get('type') == 'error':
                    return {
                        "success": False,
                        "error": event.get('error', 'Unknown error')
                    }
            except json.JSONDecodeError:
                continue
        
        return {
            "success": True,
            "content": full_content,
            "conversation_id": conversation_id,
            "message_id": message_id,
            "is_github_system_response": is_github_system_response
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def test_casual_github_mention_1(token):
    """Test 1: Casual GitHub mention should NOT trigger connection prompt"""
    print_test_header("Test 1: Casual GitHub Mention - 'explain why GitHub is important'")
    
    message = "explain why GitHub is important for developers"
    result = send_chat_message(token, message)
    
    if not result["success"]:
        return print_result(False, f"Chat request failed: {result.get('error')}")
    
    content = result["content"]
    is_github_response = result["is_github_system_response"]
    
    # Check that it's NOT a GitHub connection prompt
    if is_github_response or "connect" in content.lower() and "github" in content.lower() and "account" in content.lower():
        return print_result(False, f"CRITICAL BUG: Casual mention triggered GitHub connection prompt. Response: {content[:200]}")
    
    # Check that it's a normal AI response explaining GitHub
    if len(content) > 50 and ("github" in content.lower() or "version control" in content.lower() or "repository" in content.lower()):
        return print_result(True, f"Normal AI response received (length: {len(content)} chars). No GitHub connection prompt triggered.")
    
    return print_result(False, f"Unexpected response: {content[:200]}")

def test_casual_github_mention_2(token):
    """Test 2: Another casual GitHub mention should NOT trigger connection prompt"""
    print_test_header("Test 2: Casual GitHub Mention - 'write a slack message about GitHub'")
    
    message = "write a slack message telling Nick why he needs to be on GitHub"
    result = send_chat_message(token, message)
    
    if not result["success"]:
        return print_result(False, f"Chat request failed: {result.get('error')}")
    
    content = result["content"]
    is_github_response = result["is_github_system_response"]
    
    # Check that it's NOT a GitHub connection prompt
    if is_github_response or ("connect" in content.lower() and "github" in content.lower() and "account" in content.lower()):
        return print_result(False, f"CRITICAL BUG: Casual mention triggered GitHub connection prompt. Response: {content[:200]}")
    
    # Check that it's a normal AI response writing a Slack message
    if len(content) > 50:
        return print_result(True, f"Normal AI response received (length: {len(content)} chars). No GitHub connection prompt triggered.")
    
    return print_result(False, f"Unexpected response: {content[:200]}")

def test_slash_command_without_connection(token):
    """Test 3: Slash command should trigger connection prompt"""
    print_test_header("Test 3: Slash Command Without Connection - '/github repos'")
    
    message = "/github repos"
    result = send_chat_message(token, message)
    
    if not result["success"]:
        return print_result(False, f"Chat request failed: {result.get('error')}")
    
    content = result["content"]
    
    # Check that it IS a GitHub connection prompt
    if "connect" in content.lower() and "github" in content.lower():
        return print_result(True, f"Correctly triggered GitHub connection prompt: {content[:150]}")
    
    return print_result(False, f"Expected connection prompt but got: {content[:200]}")

def test_explicit_connection_request(token):
    """Test 4: Explicit connection request should trigger connection prompt"""
    print_test_header("Test 4: Explicit Connection Request - 'I want to connect my github account'")
    
    message = "I want to connect my github account"
    result = send_chat_message(token, message)
    
    if not result["success"]:
        return print_result(False, f"Chat request failed: {result.get('error')}")
    
    content = result["content"]
    
    # Check that it IS a GitHub connection prompt
    if "connect" in content.lower() and "github" in content.lower():
        return print_result(True, f"Correctly triggered GitHub connection prompt: {content[:150]}")
    
    return print_result(False, f"Expected connection prompt but got: {content[:200]}")

def test_normal_conversation(token):
    """Test 5: Normal conversation should work without GitHub interference"""
    print_test_header("Test 5: Normal Conversation - 'what's the weather like today?'")
    
    message = "what's the weather like today?"
    result = send_chat_message(token, message)
    
    if not result["success"]:
        return print_result(False, f"Chat request failed: {result.get('error')}")
    
    content = result["content"]
    is_github_response = result["is_github_system_response"]
    
    # Check that there's NO GitHub interference
    if is_github_response or ("github" in content.lower() and "connect" in content.lower()):
        return print_result(False, f"GitHub logic interfered with normal conversation: {content[:200]}")
    
    # Check that it's a normal AI response
    if len(content) > 20:
        return print_result(True, f"Normal AI response received (length: {len(content)} chars). No GitHub interference.")
    
    return print_result(False, f"Unexpected response: {content[:200]}")

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("GITHUB INTEGRATION LOOP BUG FIX - BACKEND TEST SUITE")
    print("="*80)
    print(f"Testing against: {BASE_URL}")
    print(f"Test user: {TEST_EMAIL}")
    
    # Login
    token = login()
    if not token:
        print("\n❌ FATAL: Could not authenticate. Aborting tests.")
        sys.exit(1)
    
    # Run all tests
    results = []
    
    # CRITICAL TESTS - These were broken before the fix
    results.append(("Test 1: Casual GitHub Mention 1", test_casual_github_mention_1(token)))
    results.append(("Test 2: Casual GitHub Mention 2", test_casual_github_mention_2(token)))
    
    # VERIFICATION TESTS - These should still work correctly
    results.append(("Test 3: Slash Command", test_slash_command_without_connection(token)))
    results.append(("Test 4: Explicit Connection Request", test_explicit_connection_request(token)))
    results.append(("Test 5: Normal Conversation", test_normal_conversation(token)))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({int(passed/total*100)}% success rate)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! GitHub integration bug fix is working correctly.")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review the output above for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()
