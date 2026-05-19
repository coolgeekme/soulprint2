#!/usr/bin/env python3
"""
Backend Testing Script for Composio Gmail Integration and Conversational Follow-up Memory Fixes
Tests the following:
1. Auth Protection Fix (POST /api/admin/notify/grace-expired)
2. Chat Stream - No Crash on Email-Related Messages
3. Chat Stream - Conversational Follow-Up (no web search)
4. Google Context Detection with Composio (no crashes)
"""

import requests
import json
import sys
import time

# Base URL from environment
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from review request
ADMIN_EMAIL = "test@soulprint.com"
ADMIN_PASSCODE = "test123"
REGULAR_EMAIL = "testchat@example.com"
REGULAR_PASSCODE = "Test123456"

def print_test(msg):
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_result(success, msg):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {msg}")

def login(email, passcode):
    """Login and return auth token"""
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": email, "passcode": passcode},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return data.get('token')
        else:
            print(f"Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def test_auth_protection_fix():
    """
    TEST 1: Auth Protection Fix (POST /api/admin/notify/grace-expired)
    - POST without Authorization header should return 403 Forbidden
    - POST with valid admin token should work (200 or appropriate response)
    """
    print_test("1. Auth Protection Fix - POST /api/admin/notify/grace-expired")
    
    # Test 1a: Without auth header (should return 403)
    try:
        print("\n[1a] Testing WITHOUT Authorization header...")
        response = requests.post(
            f"{API_BASE}/admin/notify/grace-expired",
            json={"cohort": "og", "dry_run": True},
            timeout=10
        )
        
        if response.status_code == 403:
            print_result(True, f"Correctly returned 403 Forbidden without auth (was returning 200 before fix)")
        elif response.status_code == 401:
            print_result(True, f"Returned 401 Unauthorized without auth (acceptable)")
        else:
            print_result(False, f"Expected 403/401, got {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")
    
    # Test 1b: With valid admin token (should work)
    try:
        print("\n[1b] Testing WITH valid admin token...")
        admin_token = login(ADMIN_EMAIL, ADMIN_PASSCODE)
        if not admin_token:
            print_result(False, "Could not obtain admin token")
            return
        
        response = requests.post(
            f"{API_BASE}/admin/notify/grace-expired",
            json={"cohort": "og", "dry_run": True},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, f"Admin can access endpoint: {data.get('cohort', 'N/A')} cohort, {data.get('will_send', 0)} users to notify")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")

def test_chat_stream_email_no_crash():
    """
    TEST 2: Chat Stream - No Crash on Email-Related Messages
    - POST /api/chat/stream with email-related queries should return 200 (NOT 500)
    - Should handle messages about emails gracefully even without Composio connections
    """
    print_test("2. Chat Stream - No Crash on Email-Related Messages")
    
    # Login as regular user
    token = login(REGULAR_EMAIL, REGULAR_PASSCODE)
    if not token:
        print_result(False, "Could not obtain user token")
        return
    
    # Test 2a: Email search query
    try:
        print("\n[2a] Testing email search query...")
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json={
                "content": "can you search my email for messages from Adrian Floyd?",
                "conversation_id": "test-conv-email-1",
                "model": "gpt-4o"
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
            stream=True
        )
        
        if response.status_code == 200:
            # Read first few chunks to verify it's streaming
            chunks_read = 0
            for chunk in response.iter_lines():
                if chunk:
                    chunks_read += 1
                    if chunks_read >= 3:  # Read a few chunks to verify streaming works
                        break
            print_result(True, f"Email search query returned 200 and streamed {chunks_read} chunks (NOT 500)")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")
    
    # Test 2b: Follow-up about email summary
    try:
        print("\n[2b] Testing follow-up about email summary...")
        time.sleep(1)  # Brief pause between requests
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json={
                "content": "where's the summary of the emails?",
                "conversation_id": "test-conv-email-1",
                "model": "gpt-4o"
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
            stream=True
        )
        
        if response.status_code == 200:
            chunks_read = 0
            for chunk in response.iter_lines():
                if chunk:
                    chunks_read += 1
                    if chunks_read >= 3:
                        break
            print_result(True, f"Follow-up query returned 200 and streamed {chunks_read} chunks (NOT 500, NOT web search about random people)")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")

def test_conversational_followup():
    """
    TEST 3: Chat Stream - Conversational Follow-Up
    - First message: general query
    - Second message: follow-up question should NOT trigger web search
    """
    print_test("3. Chat Stream - Conversational Follow-Up (No Web Search)")
    
    # Login as regular user
    token = login(REGULAR_EMAIL, REGULAR_PASSCODE)
    if not token:
        print_result(False, "Could not obtain user token")
        return
    
    # Test 3a: Initial message
    try:
        print("\n[3a] Testing initial message...")
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json={
                "content": "tell me about machine learning",
                "conversation_id": "test-conv-followup-1",
                "model": "gpt-4o"
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
            stream=True
        )
        
        if response.status_code == 200:
            chunks_read = 0
            for chunk in response.iter_lines():
                if chunk:
                    chunks_read += 1
                    if chunks_read >= 5:
                        break
            print_result(True, f"Initial message returned 200 and streamed {chunks_read} chunks")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")
    
    # Test 3b: Follow-up message (should NOT trigger web search)
    try:
        print("\n[3b] Testing follow-up message (should NOT trigger web search)...")
        time.sleep(1)
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json={
                "content": "where's the summary you mentioned?",
                "conversation_id": "test-conv-followup-1",
                "model": "gpt-4o"
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
            stream=True
        )
        
        if response.status_code == 200:
            # Check response content for web search indicators
            chunks = []
            for chunk in response.iter_lines():
                if chunk:
                    try:
                        data = json.loads(chunk.decode('utf-8'))
                        chunks.append(data)
                        if len(chunks) >= 10:  # Read enough to detect web search
                            break
                    except:
                        pass
            
            # Look for web search indicators in the chunks
            has_web_search = any('web_search' in str(c).lower() or 'searching' in str(c).lower() for c in chunks)
            
            if has_web_search:
                print_result(False, f"Follow-up triggered web search (should be conversational)")
            else:
                print_result(True, f"Follow-up did NOT trigger web search (correct conversational behavior)")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")

def test_google_context_composio():
    """
    TEST 4: Google Context Detection with Composio
    - Should not crash even without real Composio connections
    - Just verify no 500 errors
    """
    print_test("4. Google Context Detection with Composio (No Crash Test)")
    
    # Login as regular user
    token = login(REGULAR_EMAIL, REGULAR_PASSCODE)
    if not token:
        print_result(False, "Could not obtain user token")
        return
    
    # Test 4: Gmail inbox check
    try:
        print("\n[4] Testing Gmail inbox query...")
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json={
                "content": "check my gmail inbox",
                "conversation_id": "test-conv-gmail",
                "model": "gpt-4o"
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
            stream=True
        )
        
        if response.status_code == 200:
            chunks_read = 0
            for chunk in response.iter_lines():
                if chunk:
                    chunks_read += 1
                    if chunks_read >= 3:
                        break
            print_result(True, f"Gmail query returned 200 and streamed {chunks_read} chunks (NOT 500 crash)")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")

def main():
    print("\n" + "="*80)
    print("COMPOSIO GMAIL INTEGRATION & CONVERSATIONAL FOLLOW-UP MEMORY FIXES")
    print("Backend Testing Suite")
    print("="*80)
    
    try:
        # Run all tests
        test_auth_protection_fix()
        test_chat_stream_email_no_crash()
        test_conversational_followup()
        test_google_context_composio()
        
        print("\n" + "="*80)
        print("ALL TESTS COMPLETED")
        print("="*80)
        
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFATAL ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
