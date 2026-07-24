#!/usr/bin/env python3
"""
Backend Testing for Imprint-Project Auto-Association Fix

Test Focus:
1. New Conversation in Project - verify project_id is set correctly
2. Old Conversation Auto-Association (CRITICAL FIX) - verify old conversations get project_id updated
3. Conversation in Wrong Project - verify project_id doesn't change
4. No Project Context - verify project_id remains null

Files tested:
- /app/lib/handlers/chat-stream.js (lines 872-897)
- /app/lib/handlers/imprints.js (getActiveImprint function)
"""

import requests
import json
import os
import sys
import time
from pymongo import MongoClient
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://soulprint-engine.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL')
DB_NAME = os.getenv('DB_NAME', 'soulprint')

# Test credentials
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
            user_id = data.get('userId')  # Fixed: use 'userId' not 'user.id'
            print_pass(f"Authentication successful (user_id: {user_id})")
            return token, user_id
        else:
            print_fail(f"Authentication failed: {response.status_code} - {response.text}")
            return None, None
    except Exception as e:
        print_fail(f"Authentication error: {str(e)}")
        return None, None

def get_db():
    """Get MongoDB database connection"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        return db
    except Exception as e:
        print_fail(f"MongoDB connection error: {str(e)}")
        return None

def create_test_project(token, user_id, project_name):
    """Create a test project"""
    print_test(f"Creating test project: {project_name}")
    try:
        response = requests.post(
            f"{API_URL}/projects",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": project_name, "description": f"Test project for {project_name}"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            project_id = data.get('id')
            print_pass(f"Project created: {project_id}")
            return project_id
        else:
            print_fail(f"Project creation failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_fail(f"Project creation error: {str(e)}")
        return None

def create_test_imprint(token, user_id, project_id, imprint_name):
    """Create a test Imprint and associate it with a project"""
    print_test(f"Creating test Imprint: {imprint_name}")
    try:
        # Create Imprint
        response = requests.post(
            f"{API_URL}/imprints",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": imprint_name,
                "icon": "🎭",
                "color": "#FF5733",
                "instructions": {
                    "system_prompt": f"You are {imprint_name}, a helpful AI assistant for this project."
                }
            },
            timeout=10
        )
        if response.status_code != 200:
            print_fail(f"Imprint creation failed: {response.status_code} - {response.text}")
            return None
        
        data = response.json()
        imprint_id = data.get('id')
        print_pass(f"Imprint created: {imprint_id}")
        
        # Associate Imprint with project
        print_test(f"Associating Imprint {imprint_id} with project {project_id}")
        response = requests.post(
            f"{API_URL}/imprints/activate",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "imprint_id": imprint_id,
                "usage_type": "project",
                "project_id": project_id
            },
            timeout=10
        )
        if response.status_code == 200:
            print_pass(f"Imprint associated with project")
            return imprint_id
        else:
            print_fail(f"Imprint association failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_fail(f"Imprint creation error: {str(e)}")
        return None

def create_conversation_in_db(db, user_id, project_id=None):
    """Create a conversation directly in the database (simulating old conversation)"""
    import uuid
    conv_id = str(uuid.uuid4())
    conv_data = {
        "id": conv_id,
        "user_id": user_id,
        "title": "Old Test Conversation",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    if project_id:
        conv_data["project_id"] = project_id
    
    db.conversations.insert_one(conv_data)
    print_info(f"Created conversation in DB: {conv_id} (project_id: {project_id})")
    return conv_id

def send_chat_message(token, conversation_id, message, project_id=None):
    """Send a chat message"""
    print_test(f"Sending message to conversation {conversation_id} (project: {project_id})")
    try:
        payload = {
            "content": message,  # Fixed: use 'content' not 'message'
            "model": "gpt-4o-mini",
            "conversationId": conversation_id
        }
        if project_id:
            payload["projectId"] = project_id
        
        response = requests.post(
            f"{API_URL}/chat/stream",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=30,
            stream=True
        )
        
        if response.status_code == 200:
            print_pass(f"Message sent successfully")
            # Read the stream to completion
            for line in response.iter_lines():
                if line:
                    pass  # Just consume the stream
            return True
        else:
            print_fail(f"Message send failed: {response.status_code} - {response.text[:200]}")
            return False
    except Exception as e:
        print_fail(f"Message send error: {str(e)}")
        return False

def get_conversation_from_db(db, conv_id):
    """Get conversation from database"""
    try:
        conv = db.conversations.find_one({"id": conv_id})
        return conv
    except Exception as e:
        print_fail(f"Error fetching conversation: {str(e)}")
        return None

def cleanup_test_data(db, user_id, project_ids, imprint_ids, conv_ids):
    """Clean up test data"""
    print_test("Cleaning up test data...")
    try:
        # Delete conversations
        if conv_ids:
            db.conversations.delete_many({"id": {"$in": conv_ids}})
            db.messages.delete_many({"conversation_id": {"$in": conv_ids}})
        
        # Delete imprints
        if imprint_ids:
            db.imprints.delete_many({"id": {"$in": imprint_ids}})
            db.user_imprints.delete_many({"imprint_id": {"$in": imprint_ids}})
        
        # Delete projects
        if project_ids:
            db.projects.delete_many({"id": {"$in": project_ids}})
        
        print_pass("Test data cleaned up")
    except Exception as e:
        print_fail(f"Cleanup error: {str(e)}")

def test_scenario_1_new_conversation_in_project(token, user_id, db):
    """Test 1: New Conversation in Project"""
    print("\n" + "="*80)
    print(f"{Colors.BLUE}TEST SCENARIO 1: New Conversation in Project{Colors.END}")
    print("="*80)
    
    project_id = None
    conv_id = None
    
    try:
        # Create test project
        project_id = create_test_project(token, user_id, "Test Project 1")
        if not project_id:
            return False
        
        # Send a message in the project context (new conversation)
        print_test("Sending message in project context (new conversation)")
        response = requests.post(
            f"{API_URL}/chat/stream",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "content": "Hello, this is a test message in a project",
                "model": "gpt-4o-mini",
                "projectId": project_id
            },
            timeout=30,
            stream=True
        )
        
        if response.status_code != 200:
            print_fail(f"Message send failed: {response.status_code}")
            return False
        
        # Extract conversation ID from stream
        for line in response.iter_lines():
            if line:
                try:
                    line_str = line.decode('utf-8')
                    data = json.loads(line_str)
                    if data.get('type') == 'meta':
                        conv_id = data.get('conversationId')
                        print_info(f"Conversation ID: {conv_id}")
                        break
                except:
                    pass
        
        if not conv_id:
            print_fail("Could not extract conversation ID from stream")
            return False
        
        # Consume rest of stream
        for line in response.iter_lines():
            pass
        
        # Wait a moment for DB write
        time.sleep(1)
        
        # Verify conversation has correct project_id in database
        print_test("Verifying conversation has correct project_id in database")
        conv = get_conversation_from_db(db, conv_id)
        if not conv:
            print_fail("Conversation not found in database")
            return False
        
        if conv.get('project_id') == project_id:
            print_pass(f"✅ Conversation has correct project_id: {project_id}")
            return True
        else:
            print_fail(f"❌ Conversation has wrong project_id: {conv.get('project_id')} (expected: {project_id})")
            return False
    
    finally:
        # Cleanup
        cleanup_test_data(db, user_id, [project_id] if project_id else [], 
                         [],  # No imprints
                         [conv_id] if conv_id else [])

def test_scenario_2_old_conversation_auto_association(token, user_id, db):
    """Test 2: Old Conversation Auto-Association (CRITICAL FIX)"""
    print("\n" + "="*80)
    print(f"{Colors.BLUE}TEST SCENARIO 2: Old Conversation Auto-Association (CRITICAL FIX){Colors.END}")
    print("="*80)
    
    project_id = None
    conv_id = None
    
    try:
        # Create test project
        project_id = create_test_project(token, user_id, "Test Project 2")
        if not project_id:
            return False
        
        # Create old conversation with NO project_id (simulating old conversation)
        print_test("Creating old conversation with NO project_id")
        conv_id = create_conversation_in_db(db, user_id, project_id=None)
        
        # Verify conversation has no project_id
        conv = get_conversation_from_db(db, conv_id)
        if conv.get('project_id'):
            print_fail(f"Conversation already has project_id: {conv.get('project_id')}")
            return False
        print_pass("Old conversation has no project_id (as expected)")
        
        # Send a message in the project context
        success = send_chat_message(token, conv_id, "Hello from project context", project_id)
        if not success:
            return False
        
        # Wait a moment for DB update
        time.sleep(1)
        
        # Verify conversation now has project_id
        print_test("Verifying conversation was auto-associated with project")
        conv = get_conversation_from_db(db, conv_id)
        if not conv:
            print_fail("Conversation not found in database")
            return False
        
        if conv.get('project_id') == project_id:
            print_pass(f"✅ OLD CONVERSATION AUTO-ASSOCIATED with project: {project_id}")
            return True
        else:
            print_fail(f"❌ Conversation was NOT auto-associated. project_id: {conv.get('project_id')} (expected: {project_id})")
            return False
    
    finally:
        # Cleanup
        cleanup_test_data(db, user_id, [project_id] if project_id else [], 
                         [],  # No imprints
                         [conv_id] if conv_id else [])

def test_scenario_3_conversation_in_wrong_project(token, user_id, db):
    """Test 3: Conversation in Wrong Project"""
    print("\n" + "="*80)
    print(f"{Colors.BLUE}TEST SCENARIO 3: Conversation in Wrong Project{Colors.END}")
    print("="*80)
    
    project_a_id = None
    project_b_id = None
    imprint_a_id = None
    imprint_b_id = None
    conv_id = None
    
    try:
        # Create two test projects
        project_a_id = create_test_project(token, user_id, "Test Project A")
        if not project_a_id:
            return False
        
        project_b_id = create_test_project(token, user_id, "Test Project B")
        if not project_b_id:
            return False
        
        # Create Imprints for both projects
        imprint_a_id = create_test_imprint(token, user_id, project_a_id, "Test Imprint A")
        imprint_b_id = create_test_imprint(token, user_id, project_b_id, "Test Imprint B")
        
        # Create conversation with project_a_id
        print_test(f"Creating conversation with project_id: {project_a_id}")
        conv_id = create_conversation_in_db(db, user_id, project_id=project_a_id)
        
        # Verify conversation has project_a_id
        conv = get_conversation_from_db(db, conv_id)
        if conv.get('project_id') != project_a_id:
            print_fail(f"Conversation has wrong initial project_id: {conv.get('project_id')}")
            return False
        print_pass(f"Conversation has project_id: {project_a_id}")
        
        # Try to chat in project_b context
        print_test(f"Attempting to chat in different project context: {project_b_id}")
        success = send_chat_message(token, conv_id, "Hello from project B", project_b_id)
        if not success:
            return False
        
        # Wait a moment for DB update
        time.sleep(1)
        
        # Verify conversation STILL has project_a_id (should NOT change)
        print_test("Verifying conversation project_id did NOT change")
        conv = get_conversation_from_db(db, conv_id)
        if not conv:
            print_fail("Conversation not found in database")
            return False
        
        if conv.get('project_id') == project_a_id:
            print_pass(f"✅ Conversation project_id UNCHANGED: {project_a_id} (correct behavior)")
            return True
        else:
            print_fail(f"❌ Conversation project_id CHANGED to: {conv.get('project_id')} (should remain: {project_a_id})")
            return False
    
    finally:
        # Cleanup
        cleanup_test_data(db, user_id, 
                         [project_a_id, project_b_id] if project_a_id and project_b_id else [], 
                         [imprint_a_id, imprint_b_id] if imprint_a_id and imprint_b_id else [], 
                         [conv_id] if conv_id else [])

def test_scenario_4_no_project_context(token, user_id, db):
    """Test 4: No Project Context"""
    print("\n" + "="*80)
    print(f"{Colors.BLUE}TEST SCENARIO 4: No Project Context{Colors.END}")
    print("="*80)
    
    conv_id = None
    
    try:
        # Create conversation with NO project_id
        print_test("Creating conversation with NO project_id")
        conv_id = create_conversation_in_db(db, user_id, project_id=None)
        
        # Verify conversation has no project_id
        conv = get_conversation_from_db(db, conv_id)
        if conv.get('project_id'):
            print_fail(f"Conversation already has project_id: {conv.get('project_id')}")
            return False
        print_pass("Conversation has no project_id (as expected)")
        
        # Chat in "All Chats" view (no selectedProject)
        print_test("Chatting in 'All Chats' view (no project context)")
        success = send_chat_message(token, conv_id, "Hello without project context", project_id=None)
        if not success:
            return False
        
        # Wait a moment for DB update
        time.sleep(1)
        
        # Verify conversation STILL has no project_id
        print_test("Verifying conversation still has no project_id")
        conv = get_conversation_from_db(db, conv_id)
        if not conv:
            print_fail("Conversation not found in database")
            return False
        
        if not conv.get('project_id'):
            print_pass(f"✅ Conversation project_id remains NULL (correct behavior)")
            return True
        else:
            print_fail(f"❌ Conversation unexpectedly has project_id: {conv.get('project_id')}")
            return False
    
    finally:
        # Cleanup
        cleanup_test_data(db, user_id, [], [], [conv_id] if conv_id else [])

def main():
    print("\n" + "="*80)
    print(f"{Colors.BLUE}IMPRINT-PROJECT AUTO-ASSOCIATION FIX - BACKEND TESTING{Colors.END}")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_EMAIL}")
    print("="*80 + "\n")
    
    # Authenticate
    token, user_id = login()
    if not token or not user_id:
        print_fail("Authentication failed. Exiting.")
        sys.exit(1)
    
    # Connect to MongoDB
    db = get_db()
    if db is None:
        print_fail("MongoDB connection failed. Exiting.")
        sys.exit(1)
    
    # Run test scenarios
    results = []
    
    # Test 1: New Conversation in Project
    try:
        result = test_scenario_1_new_conversation_in_project(token, user_id, db)
        results.append(("Test 1: New Conversation in Project", result))
    except Exception as e:
        print_fail(f"Test 1 exception: {str(e)}")
        results.append(("Test 1: New Conversation in Project", False))
    
    # Test 2: Old Conversation Auto-Association (CRITICAL)
    try:
        result = test_scenario_2_old_conversation_auto_association(token, user_id, db)
        results.append(("Test 2: Old Conversation Auto-Association (CRITICAL)", result))
    except Exception as e:
        print_fail(f"Test 2 exception: {str(e)}")
        results.append(("Test 2: Old Conversation Auto-Association (CRITICAL)", False))
    
    # Test 3: Conversation in Wrong Project
    try:
        result = test_scenario_3_conversation_in_wrong_project(token, user_id, db)
        results.append(("Test 3: Conversation in Wrong Project", result))
    except Exception as e:
        print_fail(f"Test 3 exception: {str(e)}")
        results.append(("Test 3: Conversation in Wrong Project", False))
    
    # Test 4: No Project Context
    try:
        result = test_scenario_4_no_project_context(token, user_id, db)
        results.append(("Test 4: No Project Context", result))
    except Exception as e:
        print_fail(f"Test 4 exception: {str(e)}")
        results.append(("Test 4: No Project Context", False))
    
    # Print summary
    print("\n" + "="*80)
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
    print("="*80)
    
    passed = 0
    failed = 0
    for test_name, result in results:
        if result:
            print_pass(f"{test_name}")
            passed += 1
        else:
            print_fail(f"{test_name}")
            failed += 1
    
    print("="*80)
    print(f"Total: {len(results)} tests | Passed: {passed} | Failed: {failed}")
    print("="*80 + "\n")
    
    if failed > 0:
        sys.exit(1)
    else:
        print_pass("ALL TESTS PASSED!")
        sys.exit(0)

if __name__ == "__main__":
    main()
