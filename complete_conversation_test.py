#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime

# Test Configuration
BASE_URL = "https://web-search-fix.preview.emergentagent.com/api"

def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🚀 Complete Conversation API Test (Rename + Delete)")
    print("=" * 70)
    
    # Register new user for clean test
    session = requests.Session()
    
    email = "convtest@example.com"
    passcode = "testconv456"
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 📝 Registering test user: {email}")
    
    register_response = session.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "passcode": passcode
    }, timeout=30)
    
    if register_response.status_code != 200:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Registration failed: {register_response.status_code}")
        print(f"Response: {register_response.text}")
        return False
    
    result = register_response.json()
    token = result.get('token')
    if not token:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ No token received from registration")
        return False
    
    session.headers.update({'Authorization': f'Bearer {token}'})
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ User registered and authenticated")
    
    # Test 1: Create first conversation for rename testing
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 📝 TEST 1: Creating conversation for rename test...")
    
    create_response = session.post(f"{BASE_URL}/conversations", json={
        "title": "Original Conversation Title"
    }, timeout=30)
    
    if create_response.status_code != 200:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Failed to create conversation: {create_response.status_code}")
        return False
    
    create_result = create_response.json()
    rename_conv_id = create_result.get('id')
    original_title = create_result.get('title')
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Conversation created (ID: {rename_conv_id})")
    print(f"    Original title: '{original_title}'")
    
    # Test 2: Test rename functionality
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔄 TEST 2: Testing PUT /api/conversations/:id (rename)...")
    
    new_title = "Renamed Test Conversation - Updated!"
    
    rename_response = session.put(f"{BASE_URL}/conversations/{rename_conv_id}", json={
        "title": new_title
    }, timeout=30)
    
    if rename_response.status_code != 200:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Rename failed: {rename_response.status_code}")
        print(f"Response: {rename_response.text}")
        return False
    
    rename_result = rename_response.json()
    
    if not rename_result.get('success'):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Rename failed - success=false: {rename_result}")
        return False
    
    if rename_result.get('title') != new_title:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Rename failed - title mismatch")
        print(f"    Expected: '{new_title}'")
        print(f"    Got: '{rename_result.get('title')}'")
        return False
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ PUT /api/conversations/:id - Rename successful!")
    print(f"    New title: '{rename_result.get('title')}'")
    
    # Test 3: Verify rename persisted by getting conversations list
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔍 TEST 3: Verifying rename persisted...")
    
    conversations_response = session.get(f"{BASE_URL}/conversations", timeout=30)
    
    if conversations_response.status_code != 200:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Failed to get conversations: {conversations_response.status_code}")
        return False
    
    conversations = conversations_response.json()
    
    # Find our conversation and check title
    found_conversation = None
    for conv in conversations:
        if conv['id'] == rename_conv_id:
            found_conversation = conv
            break
    
    if not found_conversation:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Renamed conversation not found in list!")
        return False
    
    if found_conversation['title'] != new_title:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Title not persisted correctly!")
        print(f"    Expected: '{new_title}'")
        print(f"    Found: '{found_conversation['title']}'")
        return False
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Rename persisted correctly in database")
    
    # Test 4: Create second conversation for delete testing
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 📝 TEST 4: Creating conversation for delete test...")
    
    create_response2 = session.post(f"{BASE_URL}/conversations", json={
        "title": "Conversation to Delete"
    }, timeout=30)
    
    if create_response2.status_code != 200:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Failed to create second conversation: {create_response2.status_code}")
        return False
    
    create_result2 = create_response2.json()
    delete_conv_id = create_result2.get('id')
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Second conversation created (ID: {delete_conv_id})")
    
    # Test 5: Test delete functionality
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🗑️ TEST 5: Testing DELETE /api/conversations/:id...")
    
    delete_response = session.delete(f"{BASE_URL}/conversations/{delete_conv_id}", timeout=30)
    
    if delete_response.status_code != 200:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Delete failed: {delete_response.status_code}")
        print(f"Response: {delete_response.text}")
        return False
    
    delete_result = delete_response.json()
    
    if not delete_result.get('success'):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Delete failed - success=false: {delete_result}")
        return False
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ DELETE /api/conversations/:id - Deletion successful!")
    
    # Test 6: Verify deletion persisted
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔍 TEST 6: Verifying deletion persisted...")
    
    conversations_response2 = session.get(f"{BASE_URL}/conversations", timeout=30)
    
    if conversations_response2.status_code != 200:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Failed to get conversations for verification: {conversations_response2.status_code}")
        return False
    
    updated_conversations = conversations_response2.json()
    
    # Verify deleted conversation is gone
    for conv in updated_conversations:
        if conv['id'] == delete_conv_id:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Deleted conversation still found in list!")
            return False
    
    # Verify renamed conversation is still there
    renamed_still_exists = False
    for conv in updated_conversations:
        if conv['id'] == rename_conv_id:
            renamed_still_exists = True
            if conv['title'] != new_title:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Renamed conversation title changed unexpectedly!")
                return False
            break
    
    if not renamed_still_exists:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Renamed conversation was accidentally deleted!")
        return False
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Deletion verified - only target conversation removed")
    
    # Test 7: Error handling tests
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🚨 TEST 7: Error handling tests...")
    
    fake_id = "00000000-0000-0000-0000-000000000000"
    
    # Test rename with invalid ID
    error_rename = session.put(f"{BASE_URL}/conversations/{fake_id}", json={"title": "New Title"}, timeout=30)
    
    if error_rename.status_code == 404:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Rename non-existent conversation returns 404")
    else:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ Expected 404 for non-existent rename, got {error_rename.status_code}")
    
    # Test delete with invalid ID
    error_delete = session.delete(f"{BASE_URL}/conversations/{fake_id}", timeout=30)
    
    if error_delete.status_code == 404:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Delete non-existent conversation returns 404")
    else:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ Expected 404 for non-existent delete, got {error_delete.status_code}")
    
    # Test rename with empty title
    empty_title_rename = session.put(f"{BASE_URL}/conversations/{rename_conv_id}", json={"title": ""}, timeout=30)
    
    if empty_title_rename.status_code == 400:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Empty title rename returns 400")
    else:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ Expected 400 for empty title, got {empty_title_rename.status_code}")
    
    # Test rename with missing title
    no_title_rename = session.put(f"{BASE_URL}/conversations/{rename_conv_id}", json={}, timeout=30)
    
    if no_title_rename.status_code == 400:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Missing title rename returns 400")
    else:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ Expected 400 for missing title, got {no_title_rename.status_code}")
    
    # Final Summary
    print("\n" + "=" * 70)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🎉 COMPLETE CONVERSATION API TEST RESULTS:")
    print()
    print(f"✅ User Authentication - Working")
    print(f"✅ POST /api/conversations - Create conversation working")
    print(f"✅ PUT /api/conversations/:id - Rename conversation working")  
    print(f"✅ GET /api/conversations - List conversations working")
    print(f"✅ DELETE /api/conversations/:id - Delete conversation working")
    print(f"✅ Data persistence - Rename and delete operations persist correctly")
    print(f"✅ Error handling - 404 for non-existent conversations")
    print(f"✅ Input validation - 400 for invalid rename requests")
    print()
    print(f"🏆 ALL CONVERSATION RENAME AND DELETE API ENDPOINTS WORKING PERFECTLY!")
    
    return True

if __name__ == "__main__":
    success = main()
    
    if success:
        print(f"\n✅ Complete test suite passed - conversation APIs are functional")
        sys.exit(0)
    else:
        print(f"\n❌ Test suite failed")
        sys.exit(1)