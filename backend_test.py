#!/usr/bin/env python3
"""
Backend API Testing Script for SoulPrint Engine
Testing updated delete conversation logic with projects
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

class SoulPrintAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api"
        self.session = requests.Session()
        self.token = None
        self.user_id = None
        
    def login(self, email: str, passcode: str) -> bool:
        """Authenticate user and store token"""
        try:
            response = self.session.post(f"{self.api_url}/auth/login", json={
                "email": email,
                "passcode": passcode
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                self.user_id = data.get('userId')
                if self.token:
                    self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                    print(f"✅ Authentication successful - Role: {data.get('role', 'N/A')}")
                    return True
            print(f"❌ Authentication failed: {response.status_code} - {response.text[:200]}")
            return False
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False

    def create_project(self, name: str, description: str) -> Optional[str]:
        """Create a project and return project ID"""
        try:
            response = self.session.post(f"{self.api_url}/projects", json={
                "name": name,
                "description": description
            })
            
            if response.status_code == 200:
                data = response.json()
                project_id = data.get('id')
                print(f"✅ Project created: {project_id} - {name}")
                return project_id
            else:
                print(f"❌ Project creation failed: {response.status_code} - {response.text[:200]}")
                return None
        except Exception as e:
            print(f"❌ Project creation error: {str(e)}")
            return None

    def create_conversation(self, title: str, project_id: Optional[str] = None) -> Optional[str]:
        """Create a conversation and return conversation ID"""
        try:
            payload = {"title": title}
            if project_id:
                payload["project_id"] = project_id
                
            response = self.session.post(f"{self.api_url}/conversations", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                conversation_id = data.get('id')
                project_info = f" (Project: {project_id})" if project_id else " (No project)"
                print(f"✅ Conversation created: {conversation_id} - {title}{project_info}")
                return conversation_id
            else:
                print(f"❌ Conversation creation failed: {response.status_code} - {response.text[:200]}")
                return None
        except Exception as e:
            print(f"❌ Conversation creation error: {str(e)}")
            return None

    def get_all_conversations(self) -> list:
        """Get all conversations (All Chats view - should exclude hidden)"""
        try:
            response = self.session.get(f"{self.api_url}/conversations")
            
            if response.status_code == 200:
                data = response.json()
                # Handle different response formats - could be array or object with conversations key
                if isinstance(data, list):
                    conversations = data
                else:
                    conversations = data.get('conversations', [])
                print(f"✅ Retrieved {len(conversations)} conversations from All Chats")
                return conversations
            else:
                print(f"❌ Get all conversations failed: {response.status_code} - {response.text[:200]}")
                return []
        except Exception as e:
            print(f"❌ Get all conversations error: {str(e)}")
            return []

    def get_project_conversations(self, project_id: str) -> list:
        """Get conversations for a specific project"""
        try:
            response = self.session.get(f"{self.api_url}/conversations?project_id={project_id}")
            
            if response.status_code == 200:
                data = response.json()
                # Handle different response formats - could be array or object with conversations key
                if isinstance(data, list):
                    conversations = data
                else:
                    conversations = data.get('conversations', [])
                print(f"✅ Retrieved {len(conversations)} conversations for project {project_id}")
                return conversations
            else:
                print(f"❌ Get project conversations failed: {response.status_code} - {response.text[:200]}")
                return []
        except Exception as e:
            print(f"❌ Get project conversations error: {str(e)}")
            return []

    def delete_conversation(self, conversation_id: str, from_project: bool = False) -> Dict[str, Any]:
        """Delete a conversation (with optional from_project parameter)"""
        try:
            url = f"{self.api_url}/conversations/{conversation_id}"
            if from_project:
                url += "?from_project=true"
                
            response = self.session.delete(url)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('hidden'):
                    print(f"✅ Conversation {conversation_id} hidden from All Chats")
                elif data.get('deleted'):
                    print(f"✅ Conversation {conversation_id} permanently deleted")
                else:
                    print(f"✅ Conversation {conversation_id} delete response: {data}")
                return data
            else:
                print(f"❌ Delete conversation failed: {response.status_code} - {response.text[:200]}")
                return {"error": response.status_code}
        except Exception as e:
            print(f"❌ Delete conversation error: {str(e)}")
            return {"error": str(e)}

    def cleanup_project(self, project_id: str):
        """Clean up test project"""
        try:
            response = self.session.delete(f"{self.api_url}/projects/{project_id}")
            if response.status_code == 200:
                print(f"✅ Cleaned up project: {project_id}")
            else:
                print(f"⚠️ Project cleanup warning: {response.status_code}")
        except Exception as e:
            print(f"⚠️ Project cleanup error: {str(e)}")

def run_conversation_delete_tests():
    """Run comprehensive conversation delete logic tests"""
    print("🧪 STARTING CONVERSATION DELETE LOGIC TESTS")
    print("=" * 80)
    
    # Initialize API tester
    base_url = "https://dashboard-profiles.preview.emergentagent.com"
    tester = SoulPrintAPITester(base_url)
    
    # Step 1: Authenticate
    print("\n📝 STEP 1: Authentication")
    if not tester.login("test@soulprint.com", "test123"):
        print("❌ CRITICAL: Authentication failed - cannot proceed with tests")
        return False
    
    # Step 2: Setup - Create test project
    print("\n🏗️ STEP 2: Setup - Create Test Project")
    project_id = tester.create_project("Delete Test Project", "Project for testing conversation delete logic")
    if not project_id:
        print("❌ CRITICAL: Project creation failed - cannot proceed with tests")
        return False
    
    test_results = {
        "test_case_1": False,  # Delete from All Chats (has project) → should hide
        "test_case_2": False,  # Delete from Project view → should permanently delete  
        "test_case_3": False   # Delete no-project conversation from All Chats → should permanently delete
    }
    
    try:
        # TEST CASE 1: Delete from "All Chats" (conversation has project) → should hide
        print("\n🔬 TEST CASE 1: Delete from 'All Chats' (conversation has project)")
        print("-" * 60)
        
        # Create conversation with project
        conv1_id = tester.create_conversation("Test Conv 1 - Has Project", project_id)
        if not conv1_id:
            print("❌ Test Case 1 FAILED: Could not create conversation")
        else:
            # Delete from All Chats (without from_project param)
            delete_result = tester.delete_conversation(conv1_id, from_project=False)
            
            if delete_result.get("hidden"):
                # Verify: Should NOT appear in All Chats
                all_convs = tester.get_all_conversations()
                conv1_in_all = any(c.get("id") == conv1_id for c in all_convs)
                
                # Verify: Should STILL appear in Project view
                project_convs = tester.get_project_conversations(project_id)
                conv1_in_project = any(c.get("id") == conv1_id for c in project_convs)
                
                if not conv1_in_all and conv1_in_project:
                    print("✅ TEST CASE 1 PASSED: Conversation hidden from All Chats but still in project")
                    test_results["test_case_1"] = True
                else:
                    print(f"❌ TEST CASE 1 FAILED: In All Chats: {conv1_in_all}, In Project: {conv1_in_project}")
            else:
                print(f"❌ TEST CASE 1 FAILED: Expected hidden=True, got: {delete_result}")
        
        # TEST CASE 2: Delete from Project view → should permanently delete
        print("\n🔬 TEST CASE 2: Delete from Project view")
        print("-" * 60)
        
        # Create another conversation with project
        conv2_id = tester.create_conversation("Test Conv 2 - Delete from Project", project_id)
        if not conv2_id:
            print("❌ Test Case 2 FAILED: Could not create conversation")
        else:
            # Delete from Project view (with from_project=true)
            delete_result = tester.delete_conversation(conv2_id, from_project=True)
            
            if delete_result.get("deleted"):
                # Verify: Should NOT appear in Project view
                project_convs = tester.get_project_conversations(project_id)
                conv2_in_project = any(c.get("id") == conv2_id for c in project_convs)
                
                if not conv2_in_project:
                    print("✅ TEST CASE 2 PASSED: Conversation permanently deleted from project")
                    test_results["test_case_2"] = True
                else:
                    print("❌ TEST CASE 2 FAILED: Conversation still appears in project view")
            else:
                print(f"❌ TEST CASE 2 FAILED: Expected deleted=True, got: {delete_result}")
        
        # TEST CASE 3: Delete conversation with no project from "All Chats" → should permanently delete
        print("\n🔬 TEST CASE 3: Delete no-project conversation from 'All Chats'")
        print("-" * 60)
        
        # Create conversation without project
        conv3_id = tester.create_conversation("Test Conv 3 - No Project")
        if not conv3_id:
            print("❌ Test Case 3 FAILED: Could not create conversation")
        else:
            # Delete from All Chats (without from_project param, no project_id)
            delete_result = tester.delete_conversation(conv3_id, from_project=False)
            
            if delete_result.get("deleted"):
                # Verify: Should NOT appear in All Chats
                all_convs = tester.get_all_conversations()
                conv3_in_all = any(c.get("id") == conv3_id for c in all_convs)
                
                if not conv3_in_all:
                    print("✅ TEST CASE 3 PASSED: No-project conversation permanently deleted")
                    test_results["test_case_3"] = True
                else:
                    print("❌ TEST CASE 3 FAILED: Conversation still appears in All Chats")
            else:
                print(f"❌ TEST CASE 3 FAILED: Expected deleted=True, got: {delete_result}")
    
    finally:
        # Cleanup
        print("\n🧹 CLEANUP: Removing test project")
        tester.cleanup_project(project_id)
    
    # Final Results
    print("\n" + "=" * 80)
    print("🏆 TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed_tests = sum(test_results.values())
    total_tests = len(test_results)
    
    for test_name, passed in test_results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    success_rate = (passed_tests / total_tests) * 100
    print(f"\n🎯 Overall Success Rate: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
    
    if passed_tests == total_tests:
        print("🎉 ALL CONVERSATION DELETE LOGIC TESTS PASSED!")
        return True
    else:
        print("⚠️ SOME TESTS FAILED - Review implementation needed")
        return False

if __name__ == "__main__":
    try:
        success = run_conversation_delete_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test execution failed: {str(e)}")
        sys.exit(1)