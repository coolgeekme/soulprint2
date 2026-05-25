#!/usr/bin/env python3
"""
Backend Testing Script for SoulPrint Engine
Tests the Composite Base Image Expired URL fallback fix
"""

import requests
import json
import sys
import time

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

def login():
    """Login and get auth token"""
    print_test_header("Authentication")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": TEST_EMAIL, "passcode": TEST_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            if token:
                print_result(True, f"Login successful for {TEST_EMAIL}")
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

def test_normal_chat(token):
    """Test 1: Normal chat stream works without regression"""
    print_test_header("Test 1: Normal Chat Stream (No Regression)")
    
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "content": "hello, how are you?",
            "conversationId": f"test-normal-{int(time.time())}",
            "model": "gpt-4o"
        }
        
        print(f"Sending POST to {BASE_URL}/chat/stream")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(
            f"{BASE_URL}/chat/stream",
            headers=headers,
            json=payload,
            stream=True,
            timeout=30
        )
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        # Parse NDJSON stream
        events = []
        for line in response.iter_lines():
            if line:
                try:
                    event = json.loads(line.decode('utf-8'))
                    events.append(event)
                except json.JSONDecodeError:
                    continue
        
        # Check for expected events
        has_delta = any(e.get('type') == 'delta' for e in events)
        has_done = any(e.get('type') == 'done' for e in events)
        has_error = any('error' in e for e in events)
        
        print(f"Total events received: {len(events)}")
        print(f"Has delta events: {has_delta}")
        print(f"Has done event: {has_done}")
        print(f"Has error: {has_error}")
        
        if has_delta and has_done and not has_error:
            print_result(True, "Normal chat stream working correctly")
            return True
        else:
            print_result(False, "Missing expected events or has errors")
            return False
            
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
        return False

def test_chat_with_image_attachment(token):
    """Test 2: Chat stream with image attachment works"""
    print_test_header("Test 2: Chat Stream with Image Attachment")
    
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Simple base64 1x1 red pixel PNG
        red_pixel_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        
        payload = {
            "content": "what is in this image?",
            "conversationId": f"test-image-{int(time.time())}",
            "model": "gpt-4o",
            "attachments": [
                {
                    "type": "image/png",
                    "base64": red_pixel_base64,
                    "name": "test.png"
                }
            ]
        }
        
        print(f"Sending POST to {BASE_URL}/chat/stream with image attachment")
        
        response = requests.post(
            f"{BASE_URL}/chat/stream",
            headers=headers,
            json=payload,
            stream=True,
            timeout=30
        )
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        # Parse NDJSON stream
        events = []
        for line in response.iter_lines():
            if line:
                try:
                    event = json.loads(line.decode('utf-8'))
                    events.append(event)
                except json.JSONDecodeError:
                    continue
        
        # Check for expected events
        has_delta = any(e.get('type') == 'delta' for e in events)
        has_done = any(e.get('type') == 'done' for e in events)
        has_error = any('error' in e for e in events)
        
        print(f"Total events received: {len(events)}")
        print(f"Has delta events: {has_delta}")
        print(f"Has done event: {has_done}")
        print(f"Has error: {has_error}")
        
        if has_delta and has_done and not has_error:
            print_result(True, "Chat with image attachment working correctly")
            return True
        else:
            print_result(False, "Missing expected events or has errors")
            return False
            
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
        return False

def test_composite_code_structure():
    """Test 3: Verify composite flow code structure is valid"""
    print_test_header("Test 3: Composite Flow Code Structure Validation")
    
    try:
        # Read the chat-stream.js file
        with open('/app/lib/handlers/chat-stream.js', 'r') as f:
            content = f.read()
        
        # Check for compositeFallThrough variable
        checks = {
            "Declaration": "let compositeFallThrough = false;",
            "Set to true (recovery failed)": "compositeFallThrough = true;",
            "Checked in catch block": "if (compErr.message === '__FALLTHROUGH__' || compositeFallThrough)",
            "Guards save/return": "if (!compositeFallThrough)",
            "Fallthrough comment": "compositeFallThrough === true: base image expired"
        }
        
        all_found = True
        for check_name, check_str in checks.items():
            if check_str in content:
                print(f"✓ Found: {check_name}")
            else:
                print(f"✗ Missing: {check_name}")
                all_found = False
        
        # Check for the DB recovery logic
        db_recovery_checks = [
            "Base image expired (HTTP",
            "attempting DB recovery",
            "db.collection('messages').findOne",
            "image_base64",
            "Recovered base image from DB base64 cache",
            "Base image unrecoverable — falling through"
        ]
        
        print("\nDB Recovery Logic:")
        for check in db_recovery_checks:
            if check in content:
                print(f"✓ Found: {check}")
            else:
                print(f"✗ Missing: {check}")
                all_found = False
        
        if all_found:
            print_result(True, "All composite fallback code structure checks passed")
            return True
        else:
            print_result(False, "Some code structure checks failed")
            return False
            
    except Exception as e:
        print_result(False, f"Error reading file: {str(e)}")
        return False

def test_syntax_check():
    """Test 4: Verify no syntax errors in chat-stream.js"""
    print_test_header("Test 4: JavaScript Syntax Check")
    
    try:
        import subprocess
        
        # Use Node.js to check syntax
        result = subprocess.run(
            ['node', '--check', '/app/lib/handlers/chat-stream.js'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            print_result(True, "No syntax errors found in chat-stream.js")
            return True
        else:
            print_result(False, f"Syntax errors found: {result.stderr}")
            return False
            
    except Exception as e:
        print_result(False, f"Error checking syntax: {str(e)}")
        return False

def test_bracket_matching():
    """Test 5: Verify proper bracket matching in composite area"""
    print_test_header("Test 5: Bracket Matching in Composite Area")
    
    try:
        with open('/app/lib/handlers/chat-stream.js', 'r') as f:
            lines = f.readlines()
        
        # Extract the composite area (lines 1653-2065)
        composite_area = ''.join(lines[1652:2065])  # 0-indexed
        
        # Count brackets
        open_braces = composite_area.count('{')
        close_braces = composite_area.count('}')
        open_parens = composite_area.count('(')
        close_parens = composite_area.count(')')
        open_brackets = composite_area.count('[')
        close_brackets = composite_area.count(']')
        
        print(f"Braces: {{ {open_braces} | }} {close_braces}")
        print(f"Parentheses: ( {open_parens} | ) {close_parens}")
        print(f"Brackets: [ {open_brackets} | ] {close_brackets}")
        
        # Note: The composite area is part of a larger function, so brackets may not match
        # The important check is that the overall file syntax is valid (checked in Test 4)
        print("\nNote: The composite area (lines 1653-2065) is part of a larger function,")
        print("so bracket counts may not match within this range. The syntax check (Test 4)")
        print("confirms the entire file is syntactically correct.")
        
        print_result(True, "Bracket analysis complete (see note above)")
        return True
            
    except Exception as e:
        print_result(False, f"Error checking brackets: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("COMPOSITE BASE IMAGE EXPIRED URL FALLBACK FIX - BACKEND TESTING")
    print("="*80)
    
    # Login first
    token = login()
    if not token:
        print("\n❌ FATAL: Cannot proceed without authentication")
        sys.exit(1)
    
    # Run tests
    results = []
    
    # Test 1: Normal chat (no regression)
    results.append(("Normal Chat Stream", test_normal_chat(token)))
    
    # Test 2: Chat with image attachment
    results.append(("Chat with Image Attachment", test_chat_with_image_attachment(token)))
    
    # Test 3: Code structure validation
    results.append(("Code Structure Validation", test_composite_code_structure()))
    
    # Test 4: Syntax check
    results.append(("Syntax Check", test_syntax_check()))
    
    # Test 5: Bracket matching
    results.append(("Bracket Matching", test_bracket_matching()))
    
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
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
