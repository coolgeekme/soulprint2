#!/usr/bin/env python3

import asyncio
import aiohttp
import json
import sys
import traceback

# Configuration
BASE_URL = "https://image-video-gen-11.preview.emergentagent.com/api"
LOGIN_EMAIL = "test@soulprint.com"
LOGIN_PASSWORD = "test123"

class ProjectCollaborationTester:
    def __init__(self):
        self.session = None
        self.token = None
        self.user_id = None
        self.test_project_id = None
        self.test_conversation_id = None
        self.share_code = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def get_auth_headers(self):
        if not self.token:
            return {}
        return {"Authorization": f"Bearer {self.token}"}
    
    async def make_request(self, method, endpoint, data=None, expect_error=False):
        """Make HTTP request and return response"""
        url = f"{BASE_URL}{endpoint}"
        headers = self.get_auth_headers()
        
        try:
            if method.upper() == "GET":
                async with self.session.get(url, headers=headers) as resp:
                    response_text = await resp.text()
                    try:
                        response_data = json.loads(response_text)
                    except json.JSONDecodeError:
                        response_data = {"raw_response": response_text}
                    return resp.status, response_data
            elif method.upper() == "POST":
                headers["Content-Type"] = "application/json"
                async with self.session.post(url, headers=headers, json=data) as resp:
                    response_text = await resp.text()
                    try:
                        response_data = json.loads(response_text)
                    except json.JSONDecodeError:
                        response_data = {"raw_response": response_text}
                    return resp.status, response_data
            elif method.upper() == "PUT":
                headers["Content-Type"] = "application/json"
                async with self.session.put(url, headers=headers, json=data) as resp:
                    response_text = await resp.text()
                    try:
                        response_data = json.loads(response_text)
                    except json.JSONDecodeError:
                        response_data = {"raw_response": response_text}
                    return resp.status, response_data
            elif method.upper() == "DELETE":
                async with self.session.delete(url, headers=headers) as resp:
                    response_text = await resp.text()
                    try:
                        response_data = json.loads(response_text)
                    except json.JSONDecodeError:
                        response_data = {"raw_response": response_text}
                    return resp.status, response_data
        except Exception as e:
            if expect_error:
                return 0, {"error": str(e)}
            print(f"❌ Request failed: {method} {endpoint} - {str(e)}")
            return 0, {"error": str(e)}
    
    async def test_authentication(self):
        """Test 1: Authenticate with test user"""
        print("\n=== TEST 1: Authentication ===")
        try:
            status, response = await self.make_request("POST", "/auth/login", {
                "email": LOGIN_EMAIL,
                "passcode": LOGIN_PASSWORD
            })
            
            if status == 200 and "token" in response:
                self.token = response["token"]
                self.user_id = response.get("userId")
                print(f"✅ Authentication successful")
                print(f"   - Email: {LOGIN_EMAIL}")
                print(f"   - Role: {response.get('role', 'Unknown')}")
                print(f"   - Token: {self.token[:20]}...")
                return True
            else:
                print(f"❌ Authentication failed: Status {status}")
                print(f"   Response: {response}")
                return False
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    async def test_projects_crud(self):
        """Test 2: Projects CRUD Operations"""
        print("\n=== TEST 2: Projects CRUD APIs ===")
        
        try:
            # Test GET /api/projects (empty list initially)
            print("\n2.1. GET /api/projects (initial state)")
            status, response = await self.make_request("GET", "/projects")
            if status == 200:
                print(f"✅ GET /api/projects successful")
                print(f"   - Owned projects: {len(response.get('owned', []))}")
                print(f"   - Shared projects: {len(response.get('shared', []))}")
                print(f"   - Uncategorized conversations: {response.get('uncategorized_count', 0)}")
            else:
                print(f"❌ GET /api/projects failed: Status {status}")
                return False
            
            # Test POST /api/projects (create new project)
            print("\n2.2. POST /api/projects (create project)")
            project_data = {
                "name": "Test Collaboration Project",
                "description": "Testing project creation and collaboration features"
            }
            status, response = await self.make_request("POST", "/projects", project_data)
            if status == 200 and "id" in response:
                self.test_project_id = response["id"]
                print(f"✅ POST /api/projects successful")
                print(f"   - Project ID: {self.test_project_id}")
                print(f"   - Name: {response.get('name')}")
                print(f"   - Description: {response.get('description')}")
                print(f"   - Owner ID: {response.get('owner_id')}")
            else:
                print(f"❌ POST /api/projects failed: Status {status}")
                print(f"   Response: {response}")
                return False
            
            # Test PUT /api/projects/:id (update project)
            print("\n2.3. PUT /api/projects/:id (update project)")
            update_data = {
                "name": "Updated Test Project",
                "description": "Updated description for testing purposes"
            }
            status, response = await self.make_request("PUT", f"/projects/{self.test_project_id}", update_data)
            if status == 200:
                print(f"✅ PUT /api/projects/{self.test_project_id} successful")
                print(f"   - Response: {response}")
            else:
                print(f"❌ PUT /api/projects/{self.test_project_id} failed: Status {status}")
                print(f"   Response: {response}")
                return False
            
            return True
            
        except Exception as e:
            print(f"❌ Projects CRUD test error: {str(e)}")
            traceback.print_exc()
            return False
    
    async def test_project_sharing(self):
        """Test 3: Project Sharing APIs"""
        print("\n=== TEST 3: Project Sharing APIs ===")
        
        if not self.test_project_id:
            print("❌ No test project ID available")
            return False
        
        try:
            # Test POST /api/projects/:id/share (share with non-existent user)
            print("\n3.1. POST /api/projects/:id/share (test validation)")
            share_data = {
                "email": "nonexistent@example.com",
                "role": "collaborator"
            }
            status, response = await self.make_request("POST", f"/projects/{self.test_project_id}/share", share_data, expect_error=True)
            if status == 404:
                print(f"✅ Share validation working correctly")
                print(f"   - Expected 404 for non-existent email")
                print(f"   - Response: {response.get('error', 'User not found')}")
            else:
                print(f"⚠️ Unexpected response for non-existent user: Status {status}")
                print(f"   Response: {response}")
            
            # Test POST /api/projects/:id/share-link (generate share link)
            print("\n3.2. POST /api/projects/:id/share-link (generate share link)")
            share_link_data = {
                "enabled": True,
                "role": "viewer"
            }
            status, response = await self.make_request("POST", f"/projects/{self.test_project_id}/share-link", share_link_data)
            if status == 200 and "share_link" in response:
                share_link_info = response["share_link"]
                if "code" in share_link_info:
                    self.share_code = share_link_info["code"]
                    print(f"✅ Share link generation successful")
                    print(f"   - Share code: {self.share_code}")
                    print(f"   - Enabled: {share_link_info.get('enabled')}")
                    print(f"   - Role: {share_link_info.get('role')}")
                else:
                    print(f"❌ Share link response missing code: {response}")
                    return False
            else:
                print(f"❌ Share link generation failed: Status {status}")
                print(f"   Response: {response}")
                return False
            
            # Test POST /api/projects/:id/unshare (test with invalid user_id)
            print("\n3.3. POST /api/projects/:id/unshare (test validation)")
            unshare_data = {
                "user_id": "invalid-user-id-12345"
            }
            status, response = await self.make_request("POST", f"/projects/{self.test_project_id}/unshare", unshare_data)
            if status == 200:
                print(f"✅ Unshare API working (removes non-existent user silently)")
                print(f"   - Response: {response}")
            else:
                print(f"⚠️ Unshare unexpected response: Status {status}")
                print(f"   Response: {response}")
            
            return True
            
        except Exception as e:
            print(f"❌ Project sharing test error: {str(e)}")
            traceback.print_exc()
            return False
    
    async def test_project_join(self):
        """Test 4: Project Join API"""
        print("\n=== TEST 4: Project Join via Share Link ===")
        
        if not self.share_code:
            print("❌ No share code available from previous test")
            return False
        
        try:
            # Test POST /api/projects/join (join with valid share code)
            print(f"\n4.1. POST /api/projects/join (with code: {self.share_code})")
            join_data = {
                "code": self.share_code
            }
            status, response = await self.make_request("POST", "/projects/join", join_data)
            
            # Since we're joining our own project, this should fail with a validation error
            if status == 400:
                print(f"✅ Join validation working correctly")
                print(f"   - Cannot join own project (expected behavior)")
                print(f"   - Response: {response}")
            elif status == 200:
                print(f"⚠️ Joined project successfully (might be valid if testing with different user)")
                print(f"   - Response: {response}")
            else:
                print(f"❌ Join project unexpected response: Status {status}")
                print(f"   Response: {response}")
                return False
            
            # Test with invalid share code
            print("\n4.2. POST /api/projects/join (invalid code)")
            invalid_join_data = {
                "code": "invalid-share-code-123"
            }
            status, response = await self.make_request("POST", "/projects/join", invalid_join_data, expect_error=True)
            if status == 404:
                print(f"✅ Invalid share code handled correctly")
                print(f"   - Response: {response}")
            else:
                print(f"⚠️ Unexpected response for invalid code: Status {status}")
            
            return True
            
        except Exception as e:
            print(f"❌ Project join test error: {str(e)}")
            traceback.print_exc()
            return False
    
    async def test_conversation_project_integration(self):
        """Test 5: Conversation-Project Integration"""
        print("\n=== TEST 5: Conversation-Project Integration ===")
        
        try:
            # First create a test conversation
            print("\n5.1. POST /api/conversations (create test conversation)")
            conv_data = {
                "title": "Test Conversation for Projects"
            }
            status, response = await self.make_request("POST", "/conversations", conv_data)
            if status == 200 and "id" in response:
                self.test_conversation_id = response["id"]
                print(f"✅ Test conversation created")
                print(f"   - Conversation ID: {self.test_conversation_id}")
                print(f"   - Title: {response.get('title')}")
            else:
                print(f"❌ Failed to create test conversation: Status {status}")
                print(f"   Response: {response}")
                return False
            
            # Test PUT /api/conversations/:id/project (move conversation to project)
            print(f"\n5.2. PUT /api/conversations/:id/project (move to project {self.test_project_id})")
            move_data = {
                "project_id": self.test_project_id
            }
            status, response = await self.make_request("PUT", f"/conversations/{self.test_conversation_id}/project", move_data)
            if status == 200:
                print(f"✅ Conversation moved to project successfully")
                print(f"   - Response: {response}")
            else:
                print(f"❌ Failed to move conversation to project: Status {status}")
                print(f"   Response: {response}")
                return False
            
            # Test GET /api/projects/:id/conversations (get conversations in project)
            print(f"\n5.3. GET /api/projects/:id/conversations (get project conversations)")
            status, response = await self.make_request("GET", f"/projects/{self.test_project_id}/conversations")
            if status == 200:
                conversations = response if isinstance(response, list) else []
                print(f"✅ Retrieved project conversations successfully")
                print(f"   - Found {len(conversations)} conversation(s)")
                if conversations:
                    for conv in conversations:
                        print(f"   - ID: {conv.get('id')}, Title: {conv.get('title')}, Owner: {conv.get('owner_email', 'Unknown')}")
            else:
                print(f"❌ Failed to get project conversations: Status {status}")
                print(f"   Response: {response}")
                return False
            
            # Test GET /api/conversations?project_id=:id (filter conversations by project)
            print(f"\n5.4. GET /api/conversations?project_id={self.test_project_id} (filter by project)")
            status, response = await self.make_request("GET", f"/conversations?project_id={self.test_project_id}")
            if status == 200:
                conversations = response if isinstance(response, list) else []
                print(f"✅ Filtered conversations by project successfully")
                print(f"   - Found {len(conversations)} conversation(s)")
            else:
                print(f"❌ Failed to filter conversations by project: Status {status}")
                print(f"   Response: {response}")
                return False
            
            # Test GET /api/conversations?project_id=general (get uncategorized conversations)
            print(f"\n5.5. GET /api/conversations?project_id=general (uncategorized)")
            status, response = await self.make_request("GET", "/conversations?project_id=general")
            if status == 200:
                conversations = response if isinstance(response, list) else []
                print(f"✅ Retrieved uncategorized conversations successfully")
                print(f"   - Found {len(conversations)} uncategorized conversation(s)")
            else:
                print(f"❌ Failed to get uncategorized conversations: Status {status}")
                print(f"   Response: {response}")
                return False
            
            return True
            
        except Exception as e:
            print(f"❌ Conversation-project integration test error: {str(e)}")
            traceback.print_exc()
            return False
    
    async def test_auth_requirements(self):
        """Test 6: Authentication Requirements"""
        print("\n=== TEST 6: Authentication Requirements ===")
        
        try:
            # Temporarily clear auth token
            original_token = self.token
            self.token = None
            
            print("\n6.1. Testing endpoints without authentication")
            
            # Test various endpoints without auth
            endpoints_to_test = [
                ("GET", "/projects"),
                ("POST", "/projects", {"name": "Test", "description": "Test"}),
                ("GET", f"/projects/{self.test_project_id or 'test-id'}/conversations"),
                ("POST", "/projects/join", {"code": "test-code"})
            ]
            
            auth_working = True
            for method, endpoint, *data in endpoints_to_test:
                payload = data[0] if data else None
                status, response = await self.make_request(method, endpoint, payload, expect_error=True)
                if status == 401:
                    print(f"   ✅ {method} {endpoint} - Correctly requires auth (401)")
                else:
                    print(f"   ❌ {method} {endpoint} - Unexpected status {status} (should be 401)")
                    auth_working = False
            
            # Restore auth token
            self.token = original_token
            
            if auth_working:
                print(f"✅ All endpoints correctly require authentication")
            else:
                print(f"❌ Some endpoints have authentication bypass issues")
            
            return auth_working
            
        except Exception as e:
            # Make sure to restore token even on error
            self.token = original_token
            print(f"❌ Authentication requirements test error: {str(e)}")
            traceback.print_exc()
            return False
    
    async def test_project_deletion(self):
        """Test 7: Project Deletion (Test DELETE last to avoid cleanup issues)"""
        print("\n=== TEST 7: Project Deletion ===")
        
        if not self.test_project_id:
            print("❌ No test project ID available for deletion")
            return False
        
        try:
            # Test DELETE /api/projects/:id (delete project)
            print(f"\n7.1. DELETE /api/projects/{self.test_project_id} (delete project)")
            status, response = await self.make_request("DELETE", f"/projects/{self.test_project_id}")
            if status == 200:
                print(f"✅ Project deleted successfully")
                print(f"   - Response: {response}")
                
                # Verify the conversation is now uncategorized
                if self.test_conversation_id:
                    print(f"\n7.2. Verify conversation moved to uncategorized")
                    status, response = await self.make_request("GET", "/conversations?project_id=general")
                    if status == 200:
                        conversations = response if isinstance(response, list) else []
                        conv_found = any(c.get('id') == self.test_conversation_id for c in conversations)
                        if conv_found:
                            print(f"   ✅ Conversation correctly moved to uncategorized")
                        else:
                            print(f"   ⚠️ Conversation not found in uncategorized (might have different project_id value)")
                    else:
                        print(f"   ❌ Failed to verify uncategorized conversations: Status {status}")
            else:
                print(f"❌ Project deletion failed: Status {status}")
                print(f"   Response: {response}")
                return False
            
            return True
            
        except Exception as e:
            print(f"❌ Project deletion test error: {str(e)}")
            traceback.print_exc()
            return False
    
    async def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Projects & Collaboration Backend API Tests")
        print(f"📡 Base URL: {BASE_URL}")
        print(f"👤 Test User: {LOGIN_EMAIL}")
        
        test_results = []
        
        # Test 1: Authentication
        auth_success = await self.test_authentication()
        test_results.append(("Authentication", auth_success))
        
        if not auth_success:
            print("\n❌ Authentication failed - stopping tests")
            return test_results
        
        # Test 2: Projects CRUD
        crud_success = await self.test_projects_crud()
        test_results.append(("Projects CRUD APIs", crud_success))
        
        # Test 3: Project Sharing
        sharing_success = await self.test_project_sharing()
        test_results.append(("Project Sharing APIs", sharing_success))
        
        # Test 4: Project Join
        join_success = await self.test_project_join()
        test_results.append(("Project Join via Share Link", join_success))
        
        # Test 5: Conversation-Project Integration
        integration_success = await self.test_conversation_project_integration()
        test_results.append(("Conversation-Project Integration", integration_success))
        
        # Test 6: Auth Requirements
        auth_req_success = await self.test_auth_requirements()
        test_results.append(("Authentication Requirements", auth_req_success))
        
        # Test 7: Project Deletion (last to cleanup)
        deletion_success = await self.test_project_deletion()
        test_results.append(("Project Deletion", deletion_success))
        
        return test_results

async def main():
    async with ProjectCollaborationTester() as tester:
        test_results = await tester.run_all_tests()
        
        # Print test summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        passed = 0
        total = len(test_results)
        
        for test_name, success in test_results:
            status = "✅ PASSED" if success else "❌ FAILED"
            print(f"{status} - {test_name}")
            if success:
                passed += 1
        
        print(f"\n🎯 Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 All Projects & Collaboration Backend APIs working correctly!")
            return 0
        else:
            print("⚠️ Some tests failed - check the detailed output above")
            return 1

if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test runner error: {str(e)}")
        traceback.print_exc()
        sys.exit(1)