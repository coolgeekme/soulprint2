#!/usr/bin/env python3
"""
Backend Testing for Imprint-Project Auto-Association Fix

Test Focus:
1. New Conversation in Project - verify project_id is set correctly
2. Old Conversation Auto-Association (CRITICAL FIX) - verify old conversations get project_id updated
3. Conversation in Wrong Project - verify project_id doesn't change
4. No Project Context - verify project_id remains null
"""

import requests
import json
import os
import sys
import time
from pymongo import MongoClient
from datetime import datetime
import uuid

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
            user_id = data.get('userId')
            print_pass(f"Authentication successful (user_id: {user_id})")
            return token, user_id
        else:
            print_fail(f"Authentication failed: {response.status_code}")
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

def create_project(token, name):
    """Create a test project"""
    print_test(f"Creating project: {name}")
    try:
        response = requests.post(
            f"{API_URL}/projects",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": name, "description": f"Test project for {name}"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            project_id = data.get('id')
            print_pass(f"Project created: {project_id}")
            return project_id
        else:
            print_fail(f"Project creation failed: {response.status_code}")
            return None
    except Exception as e:
        print_fail(f"Project creation error: {str(e)}")
        return None

def create_conversation_in_db(db, user_id, project_id=None):
    """Create a conversation directly in the database"""
    conv_id = str(uuid.uuid4())
    conv_data = {
        "id": conv_id,
        "user_id": user_id,
        "title": "Test Conversation",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    if project_id:
        conv_data["project_id"] = project_id
    
    db.conversations.insert_one(conv_data)
    print_info(f"Created conversation: {conv_id} (project_id: {project_id})")
    return conv_id

def send_message(token, conv_id, message, project_id=None):
    """Send a chat message"""
    print_test(f"Sending message (conv: {conv_id[:8]}..., project: {project_id[:8] if project_id else 'None'}...)")
    try:
        payload = {
            "content": message,
            "model": "gpt-4o-mini",
            "conversationId": conv_id
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
            # Consume stream
            for line in response.iter_lines():
                pass
            print_pass("Message sent successfully")
            return True
        else:
            print_fail(f"Message send failed: {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Message send error: {str(e)}")
        return False

def get_conversation(db, conv_id):
    """Get conversation from database"""
    try:
        return db.conversations.find_one({"id": conv_id})
    except Exception as e:
        print_fail(f"Error fetching conversation: {str(e)}")
        return None

def cleanup(db, project_ids, conv_ids):
    """Clean up test data"""
    print_test("Cleaning up...")
    try:
        if conv_ids:
            db.conversations.delete_many({"id": {"$in": conv_ids}})
            db.messages.delete_many({"conversation_id": {"$in": conv_ids}})
        if project_ids:
            db.projects.delete_many({"id": {"$in": project_ids}})
        print_pass("Cleanup complete")
    except Exception as e:
        print_fail(f"Cleanup error: {str(e)}")

def test_1_new_conversation(token, user_id, db):
    """Test 1: New Conversation in Project"""
    print("\n" + "="*80)
    print(f"{Colors.BLUE}TEST 1: New Conversation in Project{Colors.END}")
    print("="*80)
    
    project_id = None
    conv_id = None
    
    try:
        # Create project
        project_id = create_project(token, "Test Project 1")
        if not project_id:
            return False
        
        # Send message in project context (creates new conversation)
        print_test("Sending message in project context")
        response = requests.post(
            f"{API_URL}/chat/stream",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "content": "Test message in project",
                "model": "gpt-4o-mini",
                "projectId": project_id
            },
            timeout=30,
            stream=True
        )
        
        if response.status_code != 200:
            print_fail(f"Message failed: {response.status_code}")
            return False
        
        # Extract conversation ID
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    if data.get('type') == 'meta':
                        conv_id = data.get('conversationId')
                        print_info(f"Conversation ID: {conv_id}")
                        break
                except:
                    pass
        
        # Consume rest of stream
        for line in response.iter_lines():
            pass
        
        if not conv_id:
            print_fail("Could not extract conversation ID")
            return False
        
        time.sleep(1)
        
        # Verify project_id in database
        print_test("Verifying project_id in database")
        conv = get_conversation(db, conv_id)
        if not conv:
            print_fail("Conversation not found")
            return False
        
        if conv.get('project_id') == project_id:
            print_pass(f"✅ Conversation has correct project_id")
            return True
        else:
            print_fail(f"❌ Wrong project_id: {conv.get('project_id')}")
            return False
    
    finally:
        cleanup(db, [project_id] if project_id else [], [conv_id] if conv_id else [])

def test_2_old_conversation_auto_association(token, user_id, db):
    """Test 2: Old Conversation Auto-Association (CRITICAL)"""
    print("\n" + "="*80)
    print(f"{Colors.BLUE}TEST 2: Old Conversation Auto-Association (CRITICAL){Colors.END}")
    print("="*80)
    
    project_id = None
    conv_id = None
    
    try:
        # Create project
        project_id = create_project(token, "Test Project 2")
        if not project_id:
            return False
        
        # Create old conversation with NO project_id
        print_test("Creating old conversation with NO project_id")
        conv_id = create_conversation_in_db(db, user_id, project_id=None)
        
        # Verify no project_id
        conv = get_conversation(db, conv_id)
        if conv.get('project_id'):
            print_fail(f"Conversation already has project_id")
            return False
        print_pass("Old conversation has no project_id")
        
        # Send message in project context
        if not send_message(token, conv_id, "Test message", project_id):
            return False
        
        time.sleep(1)
        
        # Verify conversation now has project_id
        print_test("Verifying auto-association")
        conv = get_conversation(db, conv_id)
        if not conv:
            print_fail("Conversation not found")
            return False
        
        if conv.get('project_id') == project_id:
            print_pass(f"✅ OLD CONVERSATION AUTO-ASSOCIATED")
            return True
        else:
            print_fail(f"❌ NOT auto-associated. project_id: {conv.get('project_id')}")
            return False
    
    finally:
        cleanup(db, [project_id] if project_id else [], [conv_id] if conv_id else [])

def test_3_wrong_project(token, user_id, db):
    """Test 3: Conversation in Wrong Project"""
    print("\n" + "="*80)
    print(f"{Colors.BLUE}TEST 3: Conversation in Wrong Project{Colors.END}")
    print("="*80)
    
    project_a = None
    project_b = None
    conv_id = None
    
    try:
        # Create two projects
        project_a = create_project(token, "Project A")
        project_b = create_project(token, "Project B")
        if not project_a or not project_b:
            return False
        
        # Create conversation with project_a
        print_test(f"Creating conversation with project_a")
        conv_id = create_conversation_in_db(db, user_id, project_id=project_a)
        
        # Verify project_a
        conv = get_conversation(db, conv_id)
        if conv.get('project_id') != project_a:
            print_fail("Wrong initial project_id")
            return False
        print_pass(f"Conversation has project_a")
        
        # Try to chat in project_b context
        print_test("Attempting to chat in project_b context")
        if not send_message(token, conv_id, "Test", project_b):
            return False
        
        time.sleep(1)
        
        # Verify project_id UNCHANGED
        print_test("Verifying project_id did NOT change")
        conv = get_conversation(db, conv_id)
        if not conv:
            print_fail("Conversation not found")
            return False
        
        if conv.get('project_id') == project_a:
            print_pass(f"✅ project_id UNCHANGED (correct)")
            return True
        else:
            print_fail(f"❌ project_id CHANGED to: {conv.get('project_id')}")
            return False
    
    finally:
        cleanup(db, [project_a, project_b] if project_a and project_b else [], 
                [conv_id] if conv_id else [])

def test_4_no_project_context(token, user_id, db):
    """Test 4: No Project Context"""
    print("\n" + "="*80)
    print(f"{Colors.BLUE}TEST 4: No Project Context{Colors.END}")
    print("="*80)
    
    conv_id = None
    
    try:
        # Create conversation with NO project_id
        print_test("Creating conversation with NO project_id")
        conv_id = create_conversation_in_db(db, user_id, project_id=None)
        
        # Verify no project_id
        conv = get_conversation(db, conv_id)
        if conv.get('project_id'):
            print_fail("Conversation already has project_id")
            return False
        print_pass("Conversation has no project_id")
        
        # Chat without project context
        print_test("Chatting without project context")
        if not send_message(token, conv_id, "Test", project_id=None):
            return False
        
        time.sleep(1)
        
        # Verify project_id still NULL
        print_test("Verifying project_id remains NULL")
        conv = get_conversation(db, conv_id)
        if not conv:
            print_fail("Conversation not found")
            return False
        
        if not conv.get('project_id'):
            print_pass(f"✅ project_id remains NULL (correct)")
            return True
        else:
            print_fail(f"❌ Unexpected project_id: {conv.get('project_id')}")
            return False
    
    finally:
        cleanup(db, [], [conv_id] if conv_id else [])

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
        print_fail("Authentication failed")
        sys.exit(1)
    
    # Connect to MongoDB
    db = get_db()
    if db is None:
        print_fail("MongoDB connection failed")
        sys.exit(1)
    
    # Run tests
    results = []
    
    try:
        result = test_1_new_conversation(token, user_id, db)
        results.append(("Test 1: New Conversation in Project", result))
    except Exception as e:
        print_fail(f"Test 1 exception: {str(e)}")
        results.append(("Test 1: New Conversation in Project", False))
    
    try:
        result = test_2_old_conversation_auto_association(token, user_id, db)
        results.append(("Test 2: Old Conversation Auto-Association (CRITICAL)", result))
    except Exception as e:
        print_fail(f"Test 2 exception: {str(e)}")
        results.append(("Test 2: Old Conversation Auto-Association (CRITICAL)", False))
    
    try:
        result = test_3_wrong_project(token, user_id, db)
        results.append(("Test 3: Conversation in Wrong Project", result))
    except Exception as e:
        print_fail(f"Test 3 exception: {str(e)}")
        results.append(("Test 3: Conversation in Wrong Project", False))
    
    try:
        result = test_4_no_project_context(token, user_id, db)
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
    print(f"Total: {len(results)} | Passed: {passed} | Failed: {failed}")
    print("="*80 + "\n")
    
    if failed > 0:
        sys.exit(1)
    else:
        print_pass("ALL TESTS PASSED!")
        sys.exit(0)

if __name__ == "__main__":
    main()
