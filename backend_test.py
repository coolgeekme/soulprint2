#!/usr/bin/env python3
"""
Backend Test Suite for SoulPrint Engine - New Chat Inherits Project Feature
Testing the project association functionality in chat/stream endpoint
"""

import requests
import json
import sys
import time

# Configuration
BASE_URL = "https://image-video-gen-11.preview.emergentagent.com/api"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

# Global variables for test state
auth_token = None
test_project_id = None
test_conversation_id = None
baseline_conversation_id = None

def make_request(method, endpoint, data=None, headers=None, timeout=30):
    """Make HTTP request with proper error handling"""
    url = f"{BASE_URL}{endpoint}"
    req_headers = {"Content-Type": "application/json"}
    
    if headers:
        req_headers.update(headers)
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=req_headers, timeout=timeout)
        elif method.upper() == "POST":
            response = requests.post(url, headers=req_headers, json=data, timeout=timeout)
        elif method.upper() == "PUT":
            response = requests.put(url, headers=req_headers, json=data, timeout=timeout)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=req_headers, timeout=timeout)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        return response
    except requests.exceptions.Timeout:
        print(f"❌ Request timeout for {method} {endpoint}")
        return None
    except Exception as e:
        print(f"❌ Request error for {method} {endpoint}: {e}")
        return None

def authenticate():
    """Authenticate with test credentials"""
    global auth_token
    
    print("🔐 Authenticating with test credentials...")
    
    response = make_request("POST", "/auth/login", {
        "email": TEST_EMAIL,
        "passcode": TEST_PASSWORD
    })
    
    if not response or response.status_code != 200:
        print(f"❌ Authentication failed: {response.status_code if response else 'No response'}")
        return False
    
    data = response.json()
    auth_token = data.get("token")
    
    if not auth_token:
        print("❌ No token received from authentication")
        return False
    
    print(f"✅ Authentication successful - Role: {data.get('role', 'unknown')}")
    return True

def test_create_project():
    """Test Step 1: Create a test project"""
    global test_project_id
    
    print("\n📁 Step 1: Creating test project...")
    
    project_data = {
        "name": "Test Project for New Chat",
        "description": "Testing project association with new conversations",
        "color": "#FF6B00"
    }
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = make_request("POST", "/projects", project_data, headers)
    
    if not response:
        print("❌ Failed to create project - no response")
        return False
    
    if response.status_code != 200:
        print(f"❌ Failed to create project: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    test_project_id = data.get("id")
    
    if not test_project_id:
        print("❌ No project ID returned")
        return False
    
    print(f"✅ Project created successfully: {test_project_id}")
    print(f"   Name: {data.get('name')}")
    print(f"   Description: {data.get('description')}")
    return True

def test_chat_stream_with_project():
    """Test Step 2: Create new conversation WITH projectId"""
    global test_conversation_id
    
    print(f"\n💬 Step 2: Creating conversation with projectId: {test_project_id}")
    
    chat_data = {
        "content": "Hello, this is a test message for project association",
        "model": "gpt-4o",
        "provider": "openai",
        "projectId": test_project_id
    }
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = make_request("POST", "/chat/stream", chat_data, headers)
    
    if not response:
        print("❌ Failed to create conversation - no response")
        return False
    
    if response.status_code != 200:
        print(f"❌ Failed to create conversation: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    # Parse NDJSON stream response to extract conversationId
    lines = response.text.strip().split('\n')
    conversation_id = None
    
    for line in lines:
        if line.strip():
            try:
                chunk = json.loads(line)
                if chunk.get("type") == "meta" and chunk.get("conversationId"):
                    conversation_id = chunk["conversationId"]
                    break
            except json.JSONDecodeError:
                continue
    
    if not conversation_id:
        print("❌ No conversationId found in stream response")
        print(f"First few lines of response: {lines[:3]}")
        return False
    
    test_conversation_id = conversation_id
    print(f"✅ Conversation created with projectId: {conversation_id}")
    return True

def test_verify_project_association():
    """Test Step 3: Verify conversation has project_id"""
    print(f"\n🔍 Step 3: Verifying conversation has project_id...")
    
    # Test using project-specific endpoint
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = make_request("GET", f"/conversations?project_id={test_project_id}", headers=headers)
    
    if not response or response.status_code != 200:
        print(f"❌ Failed to get project conversations: {response.status_code if response else 'No response'}")
        return False
    
    # The response is a list of conversations, not an object with "conversations" key
    conversations = response.json()
    
    # Check if our test conversation appears in the project's conversations
    found_conversation = None
    for conv in conversations:
        if conv.get("id") == test_conversation_id:
            found_conversation = conv
            break
    
    if not found_conversation:
        print(f"❌ Conversation {test_conversation_id} not found in project {test_project_id}")
        print(f"Found {len(conversations)} conversations in project")
        return False
    
    project_id_in_conv = found_conversation.get("project_id")
    if project_id_in_conv != test_project_id:
        print(f"❌ Conversation has wrong project_id: {project_id_in_conv} (expected: {test_project_id})")
        return False
    
    print(f"✅ Conversation correctly associated with project")
    print(f"   Conversation ID: {test_conversation_id}")
    print(f"   Project ID: {project_id_in_conv}")
    print(f"   Title: {found_conversation.get('title', 'No title')}")
    return True

def test_chat_stream_without_project():
    """Test Step 4: Create conversation WITHOUT projectId (baseline)"""
    global baseline_conversation_id
    
    print(f"\n💭 Step 4: Creating conversation WITHOUT projectId (baseline)...")
    
    chat_data = {
        "content": "Hello, this is a test without project association",
        "model": "gpt-4o",
        "provider": "openai"
        # No projectId provided
    }
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = make_request("POST", "/chat/stream", chat_data, headers)
    
    if not response:
        print("❌ Failed to create baseline conversation - no response")
        return False
    
    if response.status_code != 200:
        print(f"❌ Failed to create baseline conversation: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    # Parse NDJSON stream response to extract conversationId
    lines = response.text.strip().split('\n')
    conversation_id = None
    
    for line in lines:
        if line.strip():
            try:
                chunk = json.loads(line)
                if chunk.get("type") == "meta" and chunk.get("conversationId"):
                    conversation_id = chunk["conversationId"]
                    break
            except json.JSONDecodeError:
                continue
    
    if not conversation_id:
        print("❌ No conversationId found in baseline response")
        return False
    
    baseline_conversation_id = conversation_id
    print(f"✅ Baseline conversation created: {conversation_id}")
    
    # Verify this conversation does NOT have a project_id
    print("🔍 Verifying baseline conversation has no project association...")
    
    response = make_request("GET", "/conversations?project_id=general", headers=headers)
    
    if not response or response.status_code != 200:
        print(f"❌ Failed to get general conversations: {response.status_code if response else 'No response'}")
        return False
    
    # The response is a list of conversations
    general_conversations = response.json()
    
    # Check if baseline conversation appears in general/uncategorized
    found_in_general = False
    for conv in general_conversations:
        if conv.get("id") == baseline_conversation_id:
            found_in_general = True
            project_id = conv.get("project_id")
            if project_id and project_id != "general":
                print(f"❌ Baseline conversation unexpectedly has project_id: {project_id}")
                return False
            break
    
    if not found_in_general:
        print("❌ Baseline conversation not found in general conversations")
        return False
    
    print("✅ Baseline conversation correctly has no project association")
    return True

def test_invalid_project_id():
    """Test Step 5: Test with invalid projectId"""
    print(f"\n🚫 Step 5: Testing with invalid projectId...")
    
    chat_data = {
        "content": "Test with invalid project ID",
        "model": "gpt-4o",
        "provider": "openai",
        "projectId": "invalid-project-id-12345"
    }
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = make_request("POST", "/chat/stream", chat_data, headers)
    
    if not response:
        print("❌ Failed to test invalid project - no response")
        return False
    
    if response.status_code != 200:
        print(f"❌ Unexpected response for invalid project: {response.status_code}")
        return False
    
    # Parse response to get conversationId  
    lines = response.text.strip().split('\n')
    conversation_id = None
    
    for line in lines:
        if line.strip():
            try:
                chunk = json.loads(line)
                if chunk.get("type") == "meta" and chunk.get("conversationId"):
                    conversation_id = chunk["conversationId"]
                    break
            except json.JSONDecodeError:
                continue
    
    if not conversation_id:
        print("❌ No conversationId found for invalid project test")
        return False
    
    # Verify this conversation does NOT have the invalid project_id
    response = make_request("GET", "/conversations?project_id=general", headers=headers)
    
    if not response or response.status_code != 200:
        print(f"❌ Failed to verify invalid project handling: {response.status_code if response else 'No response'}")
        return False
    
    # The response is a list of conversations
    general_conversations = response.json()
    
    found_in_general = False
    for conv in general_conversations:
        if conv.get("id") == conversation_id:
            found_in_general = True
            project_id = conv.get("project_id")
            if project_id == "invalid-project-id-12345":
                print(f"❌ Conversation incorrectly assigned to invalid project")
                return False
            break
    
    if not found_in_general:
        print("❌ Conversation with invalid project not found in general conversations")
        return False
    
    print("✅ Invalid projectId correctly ignored - conversation created without project association")
    return True

def cleanup_test_data():
    """Test Step 6: Cleanup - Delete the test project"""
    if not test_project_id:
        print("\n🧹 No test project to cleanup")
        return True
    
    print(f"\n🧹 Step 6: Cleaning up test project: {test_project_id}")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = make_request("DELETE", f"/projects/{test_project_id}", headers=headers)
    
    if not response:
        print("❌ Failed to delete test project - no response")
        return False
    
    if response.status_code != 200:
        print(f"❌ Failed to delete test project: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    print("✅ Test project deleted successfully")
    return True

def main():
    """Run the complete New Chat inherits Project feature test suite"""
    print("🚀 Starting New Chat inherits Project Feature Test Suite")
    print("=" * 70)
    
    # Step 0: Authentication
    if not authenticate():
        print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
        sys.exit(1)
    
    test_results = []
    
    # Step 1: Create test project
    result = test_create_project()
    test_results.append(("Create Test Project", result))
    if not result:
        print("\n❌ CRITICAL: Cannot proceed without test project")
        sys.exit(1)
    
    # Step 2: Create conversation with project
    result = test_chat_stream_with_project()
    test_results.append(("Create Conversation WITH ProjectId", result))
    
    # Step 3: Verify project association
    result = test_verify_project_association()
    test_results.append(("Verify Project Association", result))
    
    # Step 4: Create conversation without project (baseline)
    result = test_chat_stream_without_project()
    test_results.append(("Create Conversation WITHOUT ProjectId", result))
    
    # Step 5: Test invalid project ID
    result = test_invalid_project_id()
    test_results.append(("Test Invalid ProjectId", result))
    
    # Step 6: Cleanup
    result = cleanup_test_data()
    test_results.append(("Cleanup Test Data", result))
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    for test_name, result in test_results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:<40} {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal Tests: {len(test_results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED - New Chat inherits Project feature is working correctly!")
        print("\n✅ FEATURE SUMMARY:")
        print("   • ✅ Conversations created with valid projectId are correctly associated")
        print("   • ✅ Conversations created without projectId remain uncategorized")  
        print("   • ✅ Invalid projectIds are ignored gracefully")
        print("   • ✅ Project-specific conversation filtering works correctly")
        print("   • ✅ General/uncategorized conversation filtering works correctly")
        sys.exit(0)
    else:
        print(f"\n❌ {failed} TEST(S) FAILED - New Chat inherits Project feature has issues")
        sys.exit(1)

if __name__ == "__main__":
    main()