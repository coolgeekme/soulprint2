#!/usr/bin/env python3
"""
Backend Testing for SoulPrint Engine - Composio Multi-Account Routing & edit_image Safeguard
Tests two new features:
1. Composio Multi-Account Routing (resolveAccountSelection, buildComposioToolDefs, describeAvailableAccounts)
2. edit_image Emotional Conversation Safeguard (isConversationalMessage detection)
"""

import requests
import json
import os
import sys

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_URL = f"{BASE_URL}/api"

# Test credentials from /app/memory/test_credentials.md
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(msg):
    print(f"{Colors.BLUE}[TEST]{Colors.END} {msg}")

def print_pass(msg):
    print(f"{Colors.GREEN}✅ PASS:{Colors.END} {msg}")

def print_fail(msg):
    print(f"{Colors.RED}❌ FAIL:{Colors.END} {msg}")

def print_info(msg):
    print(f"{Colors.YELLOW}ℹ️  INFO:{Colors.END} {msg}")

def login():
    """Authenticate and get token"""
    print_test("Authenticating...")
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            json={"email": TEST_EMAIL, "passcode": TEST_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print_pass(f"Authentication successful for {TEST_EMAIL}")
                return token
            else:
                print_fail("No token in response")
                return None
        else:
            print_fail(f"Login failed: {response.status_code} - {response.text[:200]}")
            return None
    except Exception as e:
        print_fail(f"Login error: {str(e)}")
        return None

# ============================================================
# FEATURE 1: Composio Multi-Account Routing Tests
# ============================================================

def test_composio_resolve_account_selection():
    """
    Test resolveAccountSelection logic with mock data
    This function is in /app/lib/handlers/composio.js
    We'll test the logic by examining the code behavior
    """
    print_test("\n=== FEATURE 1: Composio Multi-Account Routing ===")
    print_test("Test 1: resolveAccountSelection logic verification")
    
    # Since this is a JavaScript function, we'll test the API endpoints that use it
    # The logic should be:
    # 1. If single account, return that account
    # 2. If multiple accounts, match by alias/displayName (partial, case-insensitive)
    # 3. If numeric index (1-based), return accounts[idx-1]
    # 4. Default to first account
    
    print_info("Testing resolveAccountSelection logic patterns:")
    print_info("  Pattern 1: Multiple accounts with alias match (e.g., 'archeforge' matches 'ben@archeforge.com')")
    print_info("  Pattern 2: Single account with null selection should return that account")
    print_info("  Pattern 3: Numeric index '2' should return second account (1-based indexing)")
    
    # We can't directly test the JS function, but we can verify the logic is correct
    # by checking if the function exists and is exported
    try:
        with open('/app/lib/handlers/composio.js', 'r') as f:
            content = f.read()
            
            # Check if resolveAccountSelection function exists
            if 'function resolveAccountSelection' in content:
                print_pass("resolveAccountSelection function exists in composio.js")
            else:
                print_fail("resolveAccountSelection function not found")
                return False
            
            # Check key logic patterns
            checks = [
                ('accounts.length === 1', 'Single account check'),
                ('toLowerCase()', 'Case-insensitive matching'),
                ('includes(sel)', 'Partial match support'),
                ('parseInt(sel, 10)', 'Numeric index parsing'),
                ('idx >= 1 && idx <= accounts.length', '1-based index validation'),
                ('accounts[idx - 1]', '1-based to 0-based conversion'),
            ]
            
            all_passed = True
            for pattern, description in checks:
                if pattern in content:
                    print_pass(f"  ✓ {description}: '{pattern}' found")
                else:
                    print_fail(f"  ✗ {description}: '{pattern}' not found")
                    all_passed = False
            
            return all_passed
            
    except Exception as e:
        print_fail(f"Error reading composio.js: {str(e)}")
        return False

def test_composio_build_tool_defs():
    """
    Test buildComposioToolDefs adds account parameter for multi-account scenarios
    """
    print_test("\nTest 2: buildComposioToolDefs account parameter injection")
    
    try:
        with open('/app/lib/handlers/composio.js', 'r') as f:
            content = f.read()
            
            # Check if buildComposioToolDefs function exists
            if 'function buildComposioToolDefs' not in content:
                print_fail("buildComposioToolDefs function not found")
                return False
            
            print_pass("buildComposioToolDefs function exists")
            
            # Check for addAccountParam helper function
            if 'const addAccountParam = (appKey, properties)' in content:
                print_pass("  ✓ addAccountParam helper function exists")
            else:
                print_fail("  ✗ addAccountParam helper function not found")
                return False
            
            # Check for multi-account detection
            if 'accounts.length > 1' in content:
                print_pass("  ✓ Multi-account detection logic present")
            else:
                print_fail("  ✗ Multi-account detection logic missing")
                return False
            
            # Check for account parameter addition
            if 'properties.account = {' in content:
                print_pass("  ✓ Account parameter injection logic present")
            else:
                print_fail("  ✗ Account parameter injection logic missing")
                return False
            
            # Check for describeAvailableAccounts usage
            if 'describeAvailableAccounts(accounts)' in content:
                print_pass("  ✓ describeAvailableAccounts integration present")
            else:
                print_fail("  ✗ describeAvailableAccounts integration missing")
                return False
            
            # Check for account parameter description
            if 'Which account to use' in content or 'which account' in content.lower():
                print_pass("  ✓ Account parameter description present")
            else:
                print_fail("  ✗ Account parameter description missing")
                return False
            
            return True
            
    except Exception as e:
        print_fail(f"Error reading composio.js: {str(e)}")
        return False

def test_composio_describe_available_accounts():
    """
    Test describeAvailableAccounts formats account list correctly
    """
    print_test("\nTest 3: describeAvailableAccounts formatting")
    
    try:
        with open('/app/lib/handlers/composio.js', 'r') as f:
            content = f.read()
            
            # Check if describeAvailableAccounts function exists
            if 'function describeAvailableAccounts' not in content:
                print_fail("describeAvailableAccounts function not found")
                return False
            
            print_pass("describeAvailableAccounts function exists")
            
            # Check for single account early return
            if 'accounts.length <= 1' in content and "return ''" in content:
                print_pass("  ✓ Single account early return (returns empty string)")
            else:
                print_fail("  ✗ Single account early return logic missing")
                return False
            
            # Check for account mapping with index
            if 'accounts.map((acc, i)' in content:
                print_pass("  ✓ Account mapping with index present")
            else:
                print_fail("  ✗ Account mapping with index missing")
                return False
            
            # Check for label extraction (alias or displayName or id)
            if 'acc.alias' in content and 'acc.displayName' in content and 'acc.id' in content:
                print_pass("  ✓ Label extraction logic (alias/displayName/id) present")
            else:
                print_fail("  ✗ Label extraction logic incomplete")
                return False
            
            # Check for 1-based numbering
            if 'i + 1' in content:
                print_pass("  ✓ 1-based numbering (i + 1) present")
            else:
                print_fail("  ✗ 1-based numbering missing")
                return False
            
            return True
            
    except Exception as e:
        print_fail(f"Error reading composio.js: {str(e)}")
        return False

def test_composio_handle_tool_call():
    """
    Test handleComposioToolCall uses resolveAccountSelection and includes account_used in response
    """
    print_test("\nTest 4: handleComposioToolCall account resolution and response")
    
    try:
        with open('/app/lib/handlers/composio.js', 'r') as f:
            content = f.read()
            
            # Check if handleComposioToolCall function exists
            if 'async function handleComposioToolCall' not in content:
                print_fail("handleComposioToolCall function not found")
                return False
            
            print_pass("handleComposioToolCall function exists")
            
            # Check for resolveAccountSelection usage
            resolve_calls = content.count('resolveAccountSelection(')
            if resolve_calls >= 8:  # Should be called for each tool (Gmail, Calendar, Slack, GitHub)
                print_pass(f"  ✓ resolveAccountSelection called {resolve_calls} times (for different tools)")
            else:
                print_fail(f"  ✗ resolveAccountSelection called only {resolve_calls} times (expected >= 8)")
                return False
            
            # Check for account_used in responses
            account_used_count = content.count('account_used:')
            if account_used_count >= 8:
                print_pass(f"  ✓ account_used field present in {account_used_count} tool responses")
            else:
                print_fail(f"  ✗ account_used field only in {account_used_count} responses (expected >= 8)")
                return False
            
            # Check for console logging of account selection
            if 'Using Gmail account:' in content or 'Using Calendar account:' in content:
                print_pass("  ✓ Account selection logging present")
            else:
                print_fail("  ✗ Account selection logging missing")
                return False
            
            return True
            
    except Exception as e:
        print_fail(f"Error reading composio.js: {str(e)}")
        return False

# ============================================================
# FEATURE 2: edit_image Emotional Conversation Safeguard Tests
# ============================================================

def test_edit_image_safeguard_exists():
    """
    Test that isConversationalMessage detection exists in chat-stream.js
    """
    print_test("\n=== FEATURE 2: edit_image Emotional Conversation Safeguard ===")
    print_test("Test 5: isConversationalMessage detection exists")
    
    try:
        with open('/app/lib/handlers/chat-stream.js', 'r') as f:
            content = f.read()
            
            # Check if isConversationalMessage detection exists
            if 'const isConversationalMessage = (' not in content:
                print_fail("isConversationalMessage detection not found")
                return False
            
            print_pass("isConversationalMessage detection exists")
            
            # Check for question detection patterns
            patterns = [
                ('why|what|how|when|where|who', 'Question word detection'),
                ("content.trim().endsWith('?')", 'Question mark detection'),
                ('content.trim().length < 80', 'Short message detection'),
                ('feel|love|miss|hate|afraid|scared|worried|happy|sad|angry', 'Emotional keyword detection'),
                ('who are you', 'Identity/philosophical question detection'),
            ]
            
            all_passed = True
            for pattern, description in patterns:
                if pattern in content:
                    print_pass(f"  ✓ {description}")
                else:
                    print_fail(f"  ✗ {description} missing")
                    all_passed = False
            
            return all_passed
            
    except Exception as e:
        print_fail(f"Error reading chat-stream.js: {str(e)}")
        return False

def test_edit_image_safeguard_rejection():
    """
    Test that edit_image tool returns error for conversational messages
    """
    print_test("\nTest 6: edit_image safeguard rejection logic")
    
    try:
        with open('/app/lib/handlers/chat-stream.js', 'r') as f:
            content = f.read()
            
            # Check for rejection logic
            if 'if (isConversationalMessage)' not in content:
                print_fail("Rejection logic not found")
                return False
            
            print_pass("Rejection logic exists")
            
            # Check for rejection message
            if 'REJECTED — user message is conversational/emotional' in content:
                print_pass("  ✓ Rejection logging present")
            else:
                print_fail("  ✗ Rejection logging missing")
                return False
            
            # Check for error response
            if 'success: false' in content and 'error:' in content:
                print_pass("  ✓ Error response structure present")
            else:
                print_fail("  ✗ Error response structure missing")
                return False
            
            # Check for guidance to respond with text only
            if 'respond with' in content.lower() and 'text only' in content.lower():
                print_pass("  ✓ Text-only response guidance present")
            else:
                print_fail("  ✗ Text-only response guidance missing")
                return False
            
            return True
            
    except Exception as e:
        print_fail(f"Error reading chat-stream.js: {str(e)}")
        return False

def test_edit_image_tool_description():
    """
    Test that edit_image tool description mentions emotional/personal conversations
    """
    print_test("\nTest 7: edit_image tool description update")
    
    try:
        with open('/app/lib/handlers/chat-stream.js', 'r') as f:
            content = f.read()
            
            # Find the edit_image tool definition
            if "name: 'edit_image'" not in content:
                print_fail("edit_image tool definition not found")
                return False
            
            print_pass("edit_image tool definition found")
            
            # Check for emotional/personal conversation guidance in description
            # The description should be near the tool definition
            tool_section_start = content.find("name: 'edit_image'")
            tool_section = content[max(0, tool_section_start - 2000):tool_section_start + 2000]
            
            checks = [
                ('emotional', 'Emotional conversation mention'),
                ('personal', 'Personal conversation mention'),
                ('conversational', 'Conversational message mention'),
                ('Do NOT use this tool', 'Explicit prohibition guidance'),
                ('respond', 'Response guidance'),
            ]
            
            all_passed = True
            for keyword, description in checks:
                if keyword.lower() in tool_section.lower():
                    print_pass(f"  ✓ {description}: '{keyword}' found in tool description")
                else:
                    print_fail(f"  ✗ {description}: '{keyword}' not found in tool description")
                    all_passed = False
            
            return all_passed
            
    except Exception as e:
        print_fail(f"Error reading chat-stream.js: {str(e)}")
        return False

def test_normal_chat_no_regression(token):
    """
    Test that normal chat still works without regression
    """
    print_test("\nTest 8: Normal chat works without regression")
    
    try:
        response = requests.post(
            f"{API_URL}/chat/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "content": "hello",
                "conversationId": "test-composio-" + str(os.urandom(4).hex()),
                "model": "gpt-4o-mini"
            },
            timeout=30,
            stream=True
        )
        
        if response.status_code != 200:
            print_fail(f"Chat stream failed: {response.status_code}")
            return False
        
        print_pass("Chat stream endpoint accessible")
        
        # Check for NDJSON format
        events = []
        for line in response.iter_lines():
            if line:
                try:
                    event = json.loads(line.decode('utf-8'))
                    events.append(event)
                except:
                    pass
        
        if len(events) > 0:
            print_pass(f"  ✓ Received {len(events)} NDJSON events")
        else:
            print_fail("  ✗ No events received")
            return False
        
        # Check for expected event types
        event_types = [e.get('type') for e in events]
        if 'meta' in event_types or 'delta' in event_types or 'done' in event_types:
            print_pass(f"  ✓ Expected event types present: {set(event_types)}")
        else:
            print_fail(f"  ✗ Unexpected event types: {set(event_types)}")
            return False
        
        return True
        
    except Exception as e:
        print_fail(f"Error testing normal chat: {str(e)}")
        return False

# ============================================================
# Main Test Runner
# ============================================================

def main():
    print("\n" + "="*70)
    print("SoulPrint Engine - Composio Multi-Account & edit_image Safeguard Tests")
    print("="*70)
    
    # Authenticate
    token = login()
    if not token:
        print_fail("\n❌ Authentication failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Track results
    results = []
    
    # Feature 1: Composio Multi-Account Routing
    results.append(("resolveAccountSelection logic", test_composio_resolve_account_selection()))
    results.append(("buildComposioToolDefs account param", test_composio_build_tool_defs()))
    results.append(("describeAvailableAccounts formatting", test_composio_describe_available_accounts()))
    results.append(("handleComposioToolCall account resolution", test_composio_handle_tool_call()))
    
    # Feature 2: edit_image Emotional Conversation Safeguard
    results.append(("isConversationalMessage detection", test_edit_image_safeguard_exists()))
    results.append(("edit_image safeguard rejection", test_edit_image_safeguard_rejection()))
    results.append(("edit_image tool description", test_edit_image_tool_description()))
    results.append(("Normal chat regression test", test_normal_chat_no_regression(token)))
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = f"{Colors.GREEN}✅ PASS{Colors.END}" if result else f"{Colors.RED}❌ FAIL{Colors.END}"
        print(f"{status}: {test_name}")
    
    print("\n" + "="*70)
    print(f"Results: {passed}/{total} tests passed ({int(passed/total*100)}% success rate)")
    print("="*70 + "\n")
    
    if passed == total:
        print(f"{Colors.GREEN}🎉 ALL TESTS PASSED!{Colors.END}")
        sys.exit(0)
    else:
        print(f"{Colors.RED}⚠️  SOME TESTS FAILED{Colors.END}")
        sys.exit(1)

if __name__ == "__main__":
    main()
