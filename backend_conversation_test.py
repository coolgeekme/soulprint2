#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime

# Test Configuration
BASE_URL = "https://offline-voice-engine.preview.emergentagent.com/api"
TEST_EMAIL = "reggie@coolgeek.me"
TEST_PASSWORD = "password123"  # any password works for superadmin accounts

class ConversationAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.test_conversation_id = None
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def login(self):
        """Step 1: Login to get authentication token (or register if needed)"""
        self.log("🔐 Testing login...")
        
        url = f"{BASE_URL}/auth/login"
        data = {
            "email": TEST_EMAIL,
            "passcode": TEST_PASSWORD
        }
        
        try:
            response = self.session.post(url, json=data, timeout=30)
            self.log(f"Login response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                self.token = result.get('token')
                if self.token:
                    # Set Authorization header for subsequent requests
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.token}'
                    })
                    self.log("✅ Login successful - token obtained")
                    return True
                else:
                    self.log("❌ Login failed - no token in response")
                    return False
            elif response.status_code == 404:
                # User not found, try to register
                self.log("👤 User not found, attempting registration...")
                return self.register()
            else:
                self.log(f"❌ Login failed with status {response.status_code}")
                if hasattr(response, 'text'):
                    self.log(f"Response: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Login error: {str(e)}")
            return False
    
    def register(self):
        """Register a new user"""
        self.log("📝 Registering new user...")
        
        url = f"{BASE_URL}/auth/register"
        data = {
            "email": TEST_EMAIL,
            "passcode": TEST_PASSWORD
        }
        
        try:
            response = self.session.post(url, json=data, timeout=30)
            self.log(f"Registration response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                self.token = result.get('token')
                if self.token:
                    # Set Authorization header for subsequent requests
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.token}'
                    })
                    self.log("✅ Registration successful - token obtained")
                    return True
                else:
                    self.log("❌ Registration failed - no token in response")
                    return False
            else:
                self.log(f"❌ Registration failed with status {response.status_code}")
                if hasattr(response, 'text'):
                    self.log(f"Response: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Registration error: {str(e)}")
            return False
    
    def get_conversations(self):
        """Step 2: Get list of existing conversations"""
        self.log("📝 Getting conversations list...")
        
        url = f"{BASE_URL}/conversations"
        
        try:
            response = self.session.get(url, timeout=30)
            self.log(f"Get conversations response status: {response.status_code}")
            
            if response.status_code == 200:
                conversations = response.json()
                self.log(f"✅ Found {len(conversations)} existing conversations")
                return conversations
            else:
                self.log(f"❌ Failed to get conversations: {response.status_code}")
                if hasattr(response, 'text'):
                    self.log(f"Response: {response.text}")
                return []
                
        except Exception as e:
            self.log(f"❌ Get conversations error: {str(e)}")
            return []
    
    def test_rename_existing_conversation(self, conversations):
        """Step 3: Test renaming an existing conversation"""
        if not conversations:
            self.log("⚠️ No existing conversations to rename - skipping rename test")
            return True
            
        conversation_id = conversations[0]['id']
        original_title = conversations[0]['title']
        new_title = "Renamed Test Conversation"
        
        self.log(f"🔄 Testing conversation rename (ID: {conversation_id})")
        
        url = f"{BASE_URL}/conversations/{conversation_id}"
        data = {"title": new_title}
        
        try:
            response = self.session.put(url, json=data, timeout=30)
            self.log(f"Rename response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success') and result.get('title') == new_title:
                    self.log("✅ Conversation renamed successfully")
                    return True
                else:
                    self.log(f"❌ Rename failed - unexpected response: {result}")
                    return False
            else:
                self.log(f"❌ Rename failed with status {response.status_code}")
                if hasattr(response, 'text'):
                    self.log(f"Response: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Rename error: {str(e)}")
            return False
    
    def create_test_conversation(self):
        """Step 4: Create a new conversation for deletion test"""
        self.log("➕ Creating test conversation for deletion...")
        
        url = f"{BASE_URL}/conversations"
        data = {"title": "Test Conversation to Delete"}
        
        try:
            response = self.session.post(url, json=data, timeout=30)
            self.log(f"Create conversation response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                conversation_id = result.get('id')
                if conversation_id:
                    self.test_conversation_id = conversation_id
                    self.log(f"✅ Test conversation created (ID: {conversation_id})")
                    return True
                else:
                    self.log("❌ Create failed - no ID in response")
                    return False
            else:
                self.log(f"❌ Create failed with status {response.status_code}")
                if hasattr(response, 'text'):
                    self.log(f"Response: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Create conversation error: {str(e)}")
            return False
    
    def test_delete_conversation(self):
        """Step 5: Test deleting the created conversation"""
        if not self.test_conversation_id:
            self.log("❌ No test conversation ID available for deletion")
            return False
            
        self.log(f"🗑️ Testing conversation deletion (ID: {self.test_conversation_id})")
        
        url = f"{BASE_URL}/conversations/{self.test_conversation_id}"
        
        try:
            response = self.session.delete(url, timeout=30)
            self.log(f"Delete response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.log("✅ Conversation deleted successfully")
                    return True
                else:
                    self.log(f"❌ Delete failed - unexpected response: {result}")
                    return False
            else:
                self.log(f"❌ Delete failed with status {response.status_code}")
                if hasattr(response, 'text'):
                    self.log(f"Response: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Delete error: {str(e)}")
            return False
    
    def verify_deletion(self):
        """Step 6: Verify the conversation was actually deleted"""
        self.log("🔍 Verifying conversation was deleted...")
        
        conversations = self.get_conversations()
        
        # Check if deleted conversation still exists
        for conv in conversations:
            if conv['id'] == self.test_conversation_id:
                self.log("❌ Deleted conversation still found in list!")
                return False
        
        self.log("✅ Deletion verified - conversation no longer in list")
        return True
    
    def test_error_cases(self):
        """Step 7: Test error cases"""
        self.log("🚨 Testing error cases...")
        
        # Test rename with missing title
        fake_id = "00000000-0000-0000-0000-000000000000"
        
        # Test rename non-existent conversation
        url = f"{BASE_URL}/conversations/{fake_id}"
        response = self.session.put(url, json={"title": "New Title"}, timeout=30)
        
        if response.status_code == 404:
            self.log("✅ Rename non-existent conversation correctly returns 404")
        else:
            self.log(f"⚠️ Expected 404 for non-existent conversation rename, got {response.status_code}")
        
        # Test delete non-existent conversation
        response = self.session.delete(url, timeout=30)
        
        if response.status_code == 404:
            self.log("✅ Delete non-existent conversation correctly returns 404")
        else:
            self.log(f"⚠️ Expected 404 for non-existent conversation delete, got {response.status_code}")
        
        # Test rename with empty title
        if self.get_conversations():  # If we have any conversations
            conversations = self.get_conversations()
            if conversations:
                conversation_id = conversations[0]['id']
                url = f"{BASE_URL}/conversations/{conversation_id}"
                response = self.session.put(url, json={"title": ""}, timeout=30)
                
                if response.status_code == 400:
                    self.log("✅ Empty title correctly returns 400")
                else:
                    self.log(f"⚠️ Expected 400 for empty title, got {response.status_code}")
        
        return True
    
    def run_tests(self):
        """Run the complete test suite"""
        self.log("🚀 Starting Conversation Rename & Delete API Tests")
        self.log("=" * 60)
        
        # Test sequence
        tests_passed = 0
        total_tests = 6
        
        # 1. Login
        if self.login():
            tests_passed += 1
        else:
            self.log("❌ Cannot continue without authentication")
            return False
        
        # 2. Get existing conversations
        conversations = self.get_conversations()
        tests_passed += 1
        
        # 3. Test rename (if conversations exist)
        if self.test_rename_existing_conversation(conversations):
            tests_passed += 1
        
        # 4. Create test conversation
        if self.create_test_conversation():
            tests_passed += 1
        
        # 5. Delete test conversation
        if self.test_delete_conversation():
            tests_passed += 1
        
        # 6. Verify deletion
        if self.verify_deletion():
            tests_passed += 1
        
        # 7. Test error cases
        self.test_error_cases()
        
        # Summary
        self.log("=" * 60)
        self.log(f"🏁 Test Results: {tests_passed}/{total_tests} core tests passed")
        
        if tests_passed == total_tests:
            self.log("🎉 ALL CONVERSATION API TESTS PASSED!")
            return True
        else:
            self.log("❌ Some tests failed - see details above")
            return False

def main():
    tester = ConversationAPITester()
    success = tester.run_tests()
    
    if success:
        print("\n✅ Test suite completed successfully")
        sys.exit(0)
    else:
        print("\n❌ Test suite failed")
        sys.exit(1)

if __name__ == "__main__":
    main()