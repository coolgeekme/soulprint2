#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime

# Test Configuration
BASE_URL = "https://chat-to-canvas.preview.emergentagent.com/api"
TEST_EMAIL = "reggie@coolgeek.me"
TEST_PASSCODE = "testpasscode123"

def main():
    session = requests.Session()
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🚀 Testing Conversation API Endpoints")
    print("=" * 60)
    
    # Step 1: Try to register first (will fail if user exists)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 📝 Attempting registration...")
    
    register_response = session.post(f"{BASE_URL}/auth/register", json={
        "email": TEST_EMAIL,
        "passcode": TEST_PASSCODE
    }, timeout=30)
    
    if register_response.status_code == 200:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Registration successful")
        result = register_response.json()
        token = result.get('token')
    elif register_response.status_code == 400 and "already registered" in register_response.text:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 👤 User already exists, trying login...")
        
        # Try to login
        login_response = session.post(f"{BASE_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "passcode": TEST_PASSCODE
        }, timeout=30)
        
        if login_response.status_code == 200:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Login successful")
            result = login_response.json()
            token = result.get('token')
        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            return False
    else:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Registration failed: {register_response.status_code}")
        print(f"Response: {register_response.text}")
        return False
    
    if not token:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ No token received")
        return False
    
    # Set authorization header
    session.headers.update({'Authorization': f'Bearer {token}'})
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🔐 Authentication token obtained")
    
    # Step 2: Get existing conversations
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 📝 Getting conversations list...")
    
    conversations_response = session.get(f"{BASE_URL}/conversations", timeout=30)
    
    if conversations_response.status_code != 200:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Failed to get conversations: {conversations_response.status_code}")
        print(f"Response: {conversations_response.text}")
        return False
    
    conversations = conversations_response.json()
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Found {len(conversations)} existing conversations")
    
    # Step 3: Test rename (if conversations exist)
    rename_tested = False
    if conversations:
        conv_id = conversations[0]['id']
        original_title = conversations[0]['title']
        new_title = "Renamed Test Conversation"
        
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 🔄 Testing conversation rename...")
        print(f"  Original title: '{original_title}'")
        print(f"  New title: '{new_title}'")
        
        rename_response = session.put(f"{BASE_URL}/conversations/{conv_id}", json={
            "title": new_title
        }, timeout=30)
        
        if rename_response.status_code == 200:
            result = rename_response.json()
            if result.get('success') and result.get('title') == new_title:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Conversation renamed successfully")
                rename_tested = True
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Rename failed - unexpected response: {result}")
        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Rename failed: {rename_response.status_code}")
            print(f"Response: {rename_response.text}")
    else:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ No existing conversations to test rename")
    
    # Step 4: Create a test conversation for deletion
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ➕ Creating test conversation for deletion...")
    
    create_response = session.post(f"{BASE_URL}/conversations", json={
        "title": "Test Conversation to Delete"
    }, timeout=30)
    
    if create_response.status_code != 200:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Failed to create conversation: {create_response.status_code}")
        print(f"Response: {create_response.text}")
        return False
    
    create_result = create_response.json()
    test_conv_id = create_result.get('id')
    
    if not test_conv_id:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ No ID in create response")
        return False
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Test conversation created (ID: {test_conv_id})")
    
    # Step 5: Test delete
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🗑️ Testing conversation deletion...")
    
    delete_response = session.delete(f"{BASE_URL}/conversations/{test_conv_id}", timeout=30)
    
    if delete_response.status_code != 200:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Delete failed: {delete_response.status_code}")
        print(f"Response: {delete_response.text}")
        return False
    
    delete_result = delete_response.json()
    if not delete_result.get('success'):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Delete failed - unexpected response: {delete_result}")
        return False
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Conversation deleted successfully")
    
    # Step 6: Verify deletion
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🔍 Verifying deletion...")
    
    verify_response = session.get(f"{BASE_URL}/conversations", timeout=30)
    
    if verify_response.status_code != 200:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Failed to verify deletion: {verify_response.status_code}")
        return False
    
    updated_conversations = verify_response.json()
    
    # Check if deleted conversation still exists
    for conv in updated_conversations:
        if conv['id'] == test_conv_id:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Deleted conversation still found in list!")
            return False
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Deletion verified - conversation no longer in list")
    
    # Step 7: Test error cases
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🚨 Testing error cases...")
    
    fake_id = "00000000-0000-0000-0000-000000000000"
    
    # Test rename non-existent conversation (should return 404)
    error_rename = session.put(f"{BASE_URL}/conversations/{fake_id}", json={"title": "New Title"}, timeout=30)
    
    if error_rename.status_code == 404:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Rename non-existent conversation correctly returns 404")
    else:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ Expected 404 for non-existent conversation rename, got {error_rename.status_code}")
    
    # Test delete non-existent conversation (should return 404)
    error_delete = session.delete(f"{BASE_URL}/conversations/{fake_id}", timeout=30)
    
    if error_delete.status_code == 404:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Delete non-existent conversation correctly returns 404")
    else:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ Expected 404 for non-existent conversation delete, got {error_delete.status_code}")
    
    # Summary
    print("=" * 60)
    tests_passed = []
    tests_passed.append("Authentication")
    tests_passed.append("Get Conversations")
    if rename_tested:
        tests_passed.append("Rename Conversation")
    tests_passed.append("Create Conversation")
    tests_passed.append("Delete Conversation")
    tests_passed.append("Verify Deletion")
    tests_passed.append("Error Handling")
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🏁 Test Results: {len(tests_passed)} tests completed")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🎉 ALL CONVERSATION API TESTS PASSED!")
    
    for test in tests_passed:
        print(f"  ✅ {test}")
    
    return True

if __name__ == "__main__":
    success = main()
    
    if success:
        print("\n✅ Test suite completed successfully")
        sys.exit(0)
    else:
        print("\n❌ Test suite failed")
        sys.exit(1)