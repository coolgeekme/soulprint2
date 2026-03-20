#!/usr/bin/env python3

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://dashboard-profiles.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class SoulPrintTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_id = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    params: Optional[Dict] = None, headers: Optional[Dict] = None) -> requests.Response:
        """Make HTTP request with proper headers"""
        url = f"{API_BASE}/{endpoint.lstrip('/')}"
        
        request_headers = {
            "Content-Type": "application/json",
            "User-Agent": "SoulPrint-Backend-Tester/1.0"
        }
        
        if self.token:
            request_headers["Authorization"] = f"Bearer {self.token}"
            
        if headers:
            request_headers.update(headers)
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, params=params, headers=request_headers, timeout=30)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, params=params, headers=request_headers, timeout=30)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, params=params, headers=request_headers, timeout=30)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, params=params, headers=request_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
                
            self.log(f"{method.upper()} {url} -> {response.status_code}")
            return response
            
        except requests.exceptions.RequestException as e:
            self.log(f"Request failed: {e}", "ERROR")
            raise
            
    def test_smart_chat_deletion(self):
        """Test the smart chat deletion feature"""
        self.log("=== SMART CHAT DELETION FEATURE TEST ===")
        
        try:
            # Step 1: Create test user and login
            self.log("Step 1: Creating test user and logging in...")
            success = self._create_and_login_user()
            if not success:
                return False
                
            # Step 2: Create a Project
            self.log("Step 2: Creating a project...")
            project_id = self._create_project()
            if not project_id:
                return False
                
            # Step 3: Create a conversation and assign it to the Project
            self.log("Step 3: Creating conversation with project assignment...")
            conversation_id = self._create_conversation_with_project(project_id)
            if not conversation_id:
                return False
                
            # Step 4: Verify the conversation has project_id set
            self.log("Step 4: Verifying conversation has project_id set...")
            if not self._verify_conversation_project_id(conversation_id, project_id):
                return False
                
            # Step 5: Delete conversation WITHOUT from_project param (All Chats delete)
            self.log("Step 5: Deleting conversation from All Chats (should hide, not delete)...")
            if not self._delete_conversation_from_all_chats(conversation_id):
                return False
                
            # Step 6: Verify conversation was NOT deleted but hidden
            self.log("Step 6: Verifying conversation was hidden, not deleted...")
            if not self._verify_conversation_hidden(conversation_id):
                return False
                
            # Step 7: Verify conversation still appears in project view
            self.log("Step 7: Verifying conversation still appears in project view...")
            if not self._verify_conversation_in_project_view(project_id, conversation_id):
                return False
                
            # Step 8: Verify conversation does NOT appear in All Chats
            self.log("Step 8: Verifying conversation does NOT appear in All Chats...")
            if not self._verify_conversation_not_in_all_chats(conversation_id):
                return False
                
            # Bonus: Test permanent deletion with from_project=true
            self.log("Bonus: Testing permanent deletion with from_project=true...")
            if not self._test_permanent_deletion_from_project(project_id):
                return False
                
            self.log("✅ ALL SMART CHAT DELETION TESTS PASSED!", "SUCCESS")
            return True
            
        except Exception as e:
            self.log(f"❌ Test failed with exception: {e}", "ERROR")
            return False
            
    def _create_and_login_user(self) -> bool:
        """Create test user and login"""
        try:
            # Use realistic test data
            test_email = "smartchat.test@soulprint.com"
            test_passcode = "SmartChat2026!"
            
            # Try to register (might fail if user exists, that's ok)
            register_data = {
                "email": test_email,
                "passcode": test_passcode,
                "display_name": "Smart Chat Tester"
            }
            
            register_response = self.make_request("POST", "auth/register", register_data)
            if register_response.status_code in [200, 201]:
                self.log("✅ User registered successfully")
                # Check if we got a token directly from registration
                register_result = register_response.json()
                if register_result.get("token"):
                    self.token = register_result.get("token")
                    self.user_id = register_result.get("userId")
                    if self.token and self.user_id:
                        self.log(f"✅ Got token from registration - User ID: {self.user_id}")
                        return True
            elif register_response.status_code == 400:
                self.log("ℹ️ User already exists, proceeding with login")
            else:
                self.log(f"❌ Registration failed: {register_response.status_code} - {register_response.text}", "ERROR")
                return False
                
            # Login
            login_data = {
                "email": test_email,
                "passcode": test_passcode
            }
            
            login_response = self.make_request("POST", "auth/login", login_data)
            if login_response.status_code != 200:
                self.log(f"❌ Login failed: {login_response.status_code} - {login_response.text}", "ERROR")
                return False
                
            login_result = login_response.json()
            self.token = login_result.get("token")
            self.user_id = login_result.get("userId")
            
            if not self.token or not self.user_id:
                self.log("❌ Login response missing token or userId", "ERROR")
                return False
                
            self.log(f"✅ Login successful - User ID: {self.user_id}")
            return True
            
        except Exception as e:
            self.log(f"❌ Login process failed: {e}", "ERROR")
            return False
            
    def _create_project(self) -> Optional[str]:
        """Create a test project"""
        try:
            project_data = {
                "name": "Smart Chat Test Project",
                "description": "Test project for smart chat deletion feature",
                "color": "#4f46e5",
                "icon": "🧪"
            }
            
            response = self.make_request("POST", "projects", project_data)
            if response.status_code != 200:
                self.log(f"❌ Project creation failed: {response.status_code} - {response.text}", "ERROR")
                return None
                
            result = response.json()
            project_id = result.get("id")
            
            if not project_id:
                self.log("❌ Project creation response missing ID", "ERROR")
                return None
                
            self.log(f"✅ Project created successfully - ID: {project_id}")
            return project_id
            
        except Exception as e:
            self.log(f"❌ Project creation failed: {e}", "ERROR")
            return None
            
    def _create_conversation_with_project(self, project_id: str) -> Optional[str]:
        """Create a conversation assigned to the project"""
        try:
            conversation_data = {
                "title": "Smart Chat Test Conversation",
                "project_id": project_id
            }
            
            response = self.make_request("POST", "conversations", conversation_data)
            if response.status_code != 200:
                self.log(f"❌ Conversation creation failed: {response.status_code} - {response.text}", "ERROR")
                return None
                
            result = response.json()
            conversation_id = result.get("id")
            
            if not conversation_id:
                self.log("❌ Conversation creation response missing ID", "ERROR")
                return None
                
            self.log(f"✅ Conversation created with project assignment - ID: {conversation_id}")
            return conversation_id
            
        except Exception as e:
            self.log(f"❌ Conversation creation failed: {e}", "ERROR")
            return None
            
    def _verify_conversation_project_id(self, conversation_id: str, expected_project_id: str) -> bool:
        """Verify conversation has the correct project_id"""
        try:
            # Get all conversations and find our specific one
            response = self.make_request("GET", "conversations")
            if response.status_code != 200:
                self.log(f"❌ Failed to fetch conversations: {response.status_code} - {response.text}", "ERROR")
                return False
                
            conversations = response.json()
            target_conversation = None
            
            for conv in conversations:
                if conv.get("id") == conversation_id:
                    target_conversation = conv
                    break
                    
            if not target_conversation:
                self.log(f"❌ Conversation {conversation_id} not found in conversations list", "ERROR")
                return False
                
            actual_project_id = target_conversation.get("project_id")
            if actual_project_id != expected_project_id:
                self.log(f"❌ Project ID mismatch - Expected: {expected_project_id}, Got: {actual_project_id}", "ERROR")
                return False
                
            self.log(f"✅ Conversation has correct project_id: {actual_project_id}")
            return True
            
        except Exception as e:
            self.log(f"❌ Project ID verification failed: {e}", "ERROR")
            return False
            
    def _delete_conversation_from_all_chats(self, conversation_id: str) -> bool:
        """Delete conversation from All Chats (without from_project param)"""
        try:
            # Delete WITHOUT from_project param - this should hide, not delete
            response = self.make_request("DELETE", f"conversations/{conversation_id}")
            if response.status_code != 200:
                self.log(f"❌ Conversation deletion failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
            result = response.json()
            
            # Should return success=true and hidden=true (not deleted=true)
            if not result.get("success"):
                self.log("❌ Deletion response indicates failure", "ERROR")
                return False
                
            if result.get("deleted"):
                self.log("❌ Conversation was permanently deleted instead of hidden", "ERROR")
                return False
                
            if not result.get("hidden"):
                self.log("❌ Conversation was not marked as hidden", "ERROR")
                return False
                
            self.log("✅ Conversation successfully hidden from All Chats")
            return True
            
        except Exception as e:
            self.log(f"❌ Conversation deletion failed: {e}", "ERROR")
            return False
            
    def _verify_conversation_hidden(self, conversation_id: str) -> bool:
        """Verify conversation is hidden but not deleted"""
        try:
            # Try to get the conversation directly from project view to verify it still exists
            # We'll use the project conversations endpoint for this
            response = self.make_request("GET", "conversations")
            if response.status_code != 200:
                self.log(f"❌ Failed to fetch conversations: {response.status_code} - {response.text}", "ERROR")
                return False
                
            conversations = response.json()
            
            # The conversation should NOT appear in All Chats view
            for conv in conversations:
                if conv.get("id") == conversation_id:
                    self.log(f"❌ Conversation {conversation_id} still appears in All Chats", "ERROR")
                    return False
                    
            self.log("✅ Conversation correctly hidden from All Chats view")
            return True
            
        except Exception as e:
            self.log(f"❌ Hidden verification failed: {e}", "ERROR")
            return False
            
    def _verify_conversation_in_project_view(self, project_id: str, conversation_id: str) -> bool:
        """Verify conversation still appears when fetching with project_id"""
        try:
            # Get conversations for the specific project
            params = {"project_id": project_id}
            response = self.make_request("GET", "conversations", params=params)
            if response.status_code != 200:
                self.log(f"❌ Failed to fetch project conversations: {response.status_code} - {response.text}", "ERROR")
                return False
                
            conversations = response.json()
            
            # The conversation SHOULD appear in project view
            found = False
            for conv in conversations:
                if conv.get("id") == conversation_id:
                    found = True
                    break
                    
            if not found:
                self.log(f"❌ Conversation {conversation_id} not found in project view", "ERROR")
                return False
                
            self.log("✅ Conversation correctly appears in project view")
            return True
            
        except Exception as e:
            self.log(f"❌ Project view verification failed: {e}", "ERROR")
            return False
            
    def _verify_conversation_not_in_all_chats(self, conversation_id: str) -> bool:
        """Verify conversation does NOT appear in All Chats"""
        try:
            # Get all conversations (without project_id filter)
            response = self.make_request("GET", "conversations")
            if response.status_code != 200:
                self.log(f"❌ Failed to fetch all conversations: {response.status_code} - {response.text}", "ERROR")
                return False
                
            conversations = response.json()
            
            # The conversation should NOT appear
            for conv in conversations:
                if conv.get("id") == conversation_id:
                    self.log(f"❌ Conversation {conversation_id} incorrectly appears in All Chats", "ERROR")
                    return False
                    
            self.log("✅ Conversation correctly does NOT appear in All Chats")
            return True
            
        except Exception as e:
            self.log(f"❌ All Chats verification failed: {e}", "ERROR")
            return False
            
    def _test_permanent_deletion_from_project(self, project_id: str) -> bool:
        """Test permanent deletion with from_project=true"""
        try:
            # Create another conversation for permanent deletion test
            conversation_data = {
                "title": "Permanent Deletion Test Conversation",
                "project_id": project_id
            }
            
            response = self.make_request("POST", "conversations", conversation_data)
            if response.status_code != 200:
                self.log(f"❌ Test conversation creation failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
            result = response.json()
            test_conversation_id = result.get("id")
            
            if not test_conversation_id:
                self.log("❌ Test conversation creation response missing ID", "ERROR")
                return False
                
            self.log(f"✅ Test conversation created - ID: {test_conversation_id}")
            
            # Delete WITH from_project=true - this should permanently delete
            params = {"from_project": "true"}
            response = self.make_request("DELETE", f"conversations/{test_conversation_id}", params=params)
            if response.status_code != 200:
                self.log(f"❌ Permanent deletion failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
            result = response.json()
            
            # Should return success=true and deleted=true (not hidden=true)
            if not result.get("success"):
                self.log("❌ Permanent deletion response indicates failure", "ERROR")
                return False
                
            if not result.get("deleted"):
                self.log("❌ Conversation was not permanently deleted", "ERROR")
                return False
                
            if result.get("hidden"):
                self.log("❌ Conversation was hidden instead of permanently deleted", "ERROR")
                return False
                
            # Verify it doesn't appear in project view either
            params = {"project_id": project_id}
            response = self.make_request("GET", "conversations", params=params)
            if response.status_code == 200:
                conversations = response.json()
                for conv in conversations:
                    if conv.get("id") == test_conversation_id:
                        self.log(f"❌ Permanently deleted conversation {test_conversation_id} still appears in project view", "ERROR")
                        return False
                        
            self.log("✅ Permanent deletion with from_project=true works correctly")
            return True
            
        except Exception as e:
            self.log(f"❌ Permanent deletion test failed: {e}", "ERROR")
            return False

def main():
    """Main test execution"""
    print("🧪 SoulPrint Smart Chat Deletion Feature Test")
    print("=" * 60)
    
    tester = SoulPrintTester()
    
    try:
        success = tester.test_smart_chat_deletion()
        
        if success:
            print("\n" + "=" * 60)
            print("🎉 ALL TESTS PASSED! Smart Chat Deletion feature is working correctly.")
            print("✅ Key features verified:")
            print("   • Conversations in projects are hidden (not deleted) when deleted from All Chats")
            print("   • Hidden conversations still appear in project views")
            print("   • Hidden conversations do not appear in All Chats")
            print("   • Permanent deletion works with from_project=true parameter")
            sys.exit(0)
        else:
            print("\n" + "=" * 60)
            print("❌ TESTS FAILED! Smart Chat Deletion feature has issues.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n💥 Test suite crashed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()