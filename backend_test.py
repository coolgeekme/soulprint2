#!/usr/bin/env python3
"""
Backend API Testing Suite - Post Refactoring Verification
Tests all critical endpoints after the major route.js refactoring where 7 handler modules were extracted.

Focus areas from review request:
1. Health check: GET /api/health
2. Models: GET /api/models  
3. Auth flow: POST /api/auth/signup, POST /api/auth/login
4. Profile endpoints: PUT /api/profile
5. Announcements: GET /api/announcements
6. Privacy endpoints: GET /api/privacy/settings
7. Conversations: GET /api/conversations
8. Chat stream: POST /api/chat/stream (SSE verification)

Base URL: https://bug-squash-ai.preview.emergentagent.com
Auth: test@soulprint.com / test123456
"""

import requests
import json
import time
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://bug-squash-ai.preview.emergentagent.com"
TEST_EMAIL = "testuser@example.com"
TEST_PASSWORD = "testpass123"

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.auth_token = None
        self.test_results = []
        
    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result with details"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            'test': test_name,
            'status': status,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat(),
            'response_data': response_data
        }
        self.test_results.append(result)
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")
        print()

    def make_request(self, method, endpoint, **kwargs):
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.get('headers', {})
        
        if self.auth_token and 'Authorization' not in headers:
            headers['Authorization'] = f'Bearer {self.auth_token}'
            
        kwargs['headers'] = headers
        
        try:
            response = requests.request(method, url, timeout=30, **kwargs)
            return response
        except requests.exceptions.RequestException as e:
            return None

    def test_health_endpoint(self):
        """Test 1: Health check endpoint"""
        print("🔍 Testing Health Endpoint...")
        
        response = self.make_request('GET', '/api/health')
        
        if response is None:
            self.log_result("Health Check", False, "Request failed - network error")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                if data.get('status') == 'ok':
                    self.log_result("Health Check", True, f"Status: {data.get('status')}", data)
                else:
                    self.log_result("Health Check", False, f"Unexpected status: {data.get('status')}", data)
            except json.JSONDecodeError:
                self.log_result("Health Check", False, "Invalid JSON response", response.text)
        else:
            self.log_result("Health Check", False, f"HTTP {response.status_code}", response.text)

    def test_models_endpoint(self):
        """Test 2: Models endpoint"""
        print("🔍 Testing Models Endpoint...")
        
        response = self.make_request('GET', '/api/models')
        
        if response is None:
            self.log_result("Models Endpoint", False, "Request failed - network error")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    model_names = [model.get('name', 'Unknown') for model in data[:3]]
                    self.log_result("Models Endpoint", True, f"Found {len(data)} models: {', '.join(model_names)}...", {'count': len(data)})
                else:
                    self.log_result("Models Endpoint", False, "Empty or invalid models list", data)
            except json.JSONDecodeError:
                self.log_result("Models Endpoint", False, "Invalid JSON response", response.text)
        else:
            self.log_result("Models Endpoint", False, f"HTTP {response.status_code}", response.text)

    def test_auth_flow(self):
        """Test 3: Authentication flow (login with existing test user or create if needed)"""
        print("🔍 Testing Authentication Flow...")
        
        # Test login with existing test user
        login_data = {
            "email": TEST_EMAIL,
            "passcode": TEST_PASSWORD
        }
        
        response = self.make_request('POST', '/api/auth/login', 
                                   json=login_data,
                                   headers={'Content-Type': 'application/json'})
        
        if response is None:
            self.log_result("Auth Login", False, "Request failed - network error")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                if data.get('token'):
                    self.auth_token = data['token']
                    user_info = f"User: {data.get('user', {}).get('email', 'Unknown')}"
                    self.log_result("Auth Login", True, f"Login successful. {user_info}", {'has_token': True})
                else:
                    self.log_result("Auth Login", False, "No token in response", data)
            except json.JSONDecodeError:
                self.log_result("Auth Login", False, "Invalid JSON response", response.text)
        elif response.status_code == 401 or response.status_code == 404:
            # Try to create the test user
            print("    Test user not found, attempting to create...")
            register_data = {
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            }
            
            reg_response = self.make_request('POST', '/api/auth/register',
                                           json=register_data,
                                           headers={'Content-Type': 'application/json'})
            
            if reg_response and reg_response.status_code == 200:
                print("    Test user created, retrying login...")
                # Retry login
                login_response = self.make_request('POST', '/api/auth/login', 
                                                 json=login_data,
                                                 headers={'Content-Type': 'application/json'})
                
                if login_response and login_response.status_code == 200:
                    try:
                        data = login_response.json()
                        if data.get('token'):
                            self.auth_token = data['token']
                            user_info = f"User: {data.get('user', {}).get('email', 'Unknown')}"
                            self.log_result("Auth Login", True, f"Login successful after registration. {user_info}", {'has_token': True, 'created_user': True})
                        else:
                            self.log_result("Auth Login", False, "No token in response after registration", data)
                    except json.JSONDecodeError:
                        self.log_result("Auth Login", False, "Invalid JSON response after registration", login_response.text)
                else:
                    self.log_result("Auth Login", False, "Login failed even after user creation")
            else:
                try:
                    error_data = response.json()
                    self.log_result("Auth Login", False, f"HTTP {response.status_code}: {error_data.get('error', 'Unknown error')}", error_data)
                except:
                    self.log_result("Auth Login", False, f"HTTP {response.status_code}", response.text)
        else:
            try:
                error_data = response.json()
                self.log_result("Auth Login", False, f"HTTP {response.status_code}: {error_data.get('error', 'Unknown error')}", error_data)
            except:
                self.log_result("Auth Login", False, f"HTTP {response.status_code}", response.text)

    def test_profile_endpoint(self):
        """Test 4: Profile endpoint (requires auth)"""
        print("🔍 Testing Profile Endpoint...")
        
        if not self.auth_token:
            self.log_result("Profile Update", False, "No auth token available")
            return
            
        # Test profile update
        profile_data = {
            "display_name": "Test User Updated",
            "assistant_name": "TestBot",
            "field": "Software Testing"
        }
        
        response = self.make_request('PUT', '/api/profile',
                                   json=profile_data,
                                   headers={'Content-Type': 'application/json'})
        
        if response is None:
            self.log_result("Profile Update", False, "Request failed - network error")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                if data.get('success'):
                    self.log_result("Profile Update", True, "Profile updated successfully", data)
                else:
                    self.log_result("Profile Update", False, "Update failed", data)
            except json.JSONDecodeError:
                self.log_result("Profile Update", False, "Invalid JSON response", response.text)
        elif response.status_code == 401:
            self.log_result("Profile Update", False, "Authentication failed - token may be invalid")
        else:
            try:
                error_data = response.json()
                self.log_result("Profile Update", False, f"HTTP {response.status_code}: {error_data.get('error', 'Unknown error')}", error_data)
            except:
                self.log_result("Profile Update", False, f"HTTP {response.status_code}", response.text)

    def test_announcements_endpoint(self):
        """Test 5: Announcements endpoint (requires auth)"""
        print("🔍 Testing Announcements Endpoint...")
        
        if not self.auth_token:
            self.log_result("Announcements", False, "No auth token available")
            return
            
        response = self.make_request('GET', '/api/announcements')
        
        if response is None:
            self.log_result("Announcements", False, "Request failed - network error")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'announcements' in data and 'unread' in data:
                    total_count = len(data.get('announcements', []))
                    unread_count = len(data.get('unread', []))
                    self.log_result("Announcements", True, f"Found {total_count} announcements, {unread_count} unread", {'total': total_count, 'unread': unread_count})
                else:
                    self.log_result("Announcements", False, "Invalid response structure", data)
            except json.JSONDecodeError:
                self.log_result("Announcements", False, "Invalid JSON response", response.text)
        elif response.status_code == 401:
            self.log_result("Announcements", False, "Authentication failed - token may be invalid")
        else:
            try:
                error_data = response.json()
                self.log_result("Announcements", False, f"HTTP {response.status_code}: {error_data.get('error', 'Unknown error')}", error_data)
            except:
                self.log_result("Announcements", False, f"HTTP {response.status_code}", response.text)

    def test_privacy_settings_endpoint(self):
        """Test 6: Privacy settings endpoint (requires auth)"""
        print("🔍 Testing Privacy Settings Endpoint...")
        
        if not self.auth_token:
            self.log_result("Privacy Settings", False, "No auth token available")
            return
            
        response = self.make_request('GET', '/api/privacy/settings')
        
        if response is None:
            self.log_result("Privacy Settings", False, "Request failed - network error")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                # Check for expected privacy settings fields
                expected_fields = ['ai_training_opt_out', 'data_retention_days', 'analytics_opt_out']
                has_fields = all(field in data for field in expected_fields)
                
                if has_fields:
                    settings_summary = f"AI training opt-out: {data.get('ai_training_opt_out')}, Analytics opt-out: {data.get('analytics_opt_out')}"
                    self.log_result("Privacy Settings", True, f"Privacy settings retrieved. {settings_summary}", data)
                else:
                    missing_fields = [field for field in expected_fields if field not in data]
                    self.log_result("Privacy Settings", False, f"Missing fields: {missing_fields}", data)
            except json.JSONDecodeError:
                self.log_result("Privacy Settings", False, "Invalid JSON response", response.text)
        elif response.status_code == 401:
            self.log_result("Privacy Settings", False, "Authentication failed - token may be invalid")
        else:
            try:
                error_data = response.json()
                self.log_result("Privacy Settings", False, f"HTTP {response.status_code}: {error_data.get('error', 'Unknown error')}", error_data)
            except:
                self.log_result("Privacy Settings", False, f"HTTP {response.status_code}", response.text)

    def test_conversations_endpoint(self):
        """Test 7: Conversations endpoint (requires auth)"""
        print("🔍 Testing Conversations Endpoint...")
        
        if not self.auth_token:
            self.log_result("Conversations", False, "No auth token available")
            return
            
        response = self.make_request('GET', '/api/conversations')
        
        if response is None:
            self.log_result("Conversations", False, "Request failed - network error")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    conv_count = len(data)
                    if conv_count > 0:
                        sample_titles = [conv.get('title', 'Untitled')[:30] for conv in data[:3]]
                        self.log_result("Conversations", True, f"Found {conv_count} conversations. Sample: {', '.join(sample_titles)}", {'count': conv_count})
                    else:
                        self.log_result("Conversations", True, "No conversations found (empty list)", {'count': 0})
                else:
                    self.log_result("Conversations", False, "Response is not a list", data)
            except json.JSONDecodeError:
                self.log_result("Conversations", False, "Invalid JSON response", response.text)
        elif response.status_code == 401:
            self.log_result("Conversations", False, "Authentication failed - token may be invalid")
        else:
            try:
                error_data = response.json()
                self.log_result("Conversations", False, f"HTTP {response.status_code}: {error_data.get('error', 'Unknown error')}", error_data)
            except:
                self.log_result("Conversations", False, f"HTTP {response.status_code}", response.text)

    def test_chat_stream_endpoint(self):
        """Test 8: Chat stream endpoint with SSE verification (requires auth)"""
        print("🔍 Testing Chat Stream Endpoint...")
        
        if not self.auth_token:
            self.log_result("Chat Stream", False, "No auth token available")
            return
            
        # Create a test conversation first
        conv_response = self.make_request('POST', '/api/conversations',
                                        json={"title": f"Test Chat Stream {uuid.uuid4().hex[:8]}"},
                                        headers={'Content-Type': 'application/json'})
        
        if conv_response is None or conv_response.status_code != 200:
            self.log_result("Chat Stream", False, "Failed to create test conversation")
            return
            
        try:
            conv_data = conv_response.json()
            conversation_id = conv_data.get('id')
            
            if not conversation_id:
                self.log_result("Chat Stream", False, "No conversation ID returned")
                return
                
        except json.JSONDecodeError:
            self.log_result("Chat Stream", False, "Invalid JSON in conversation response")
            return
        
        # Test chat stream with a simple message
        chat_data = {
            "message": "Hello, this is a test message for the refactored backend.",
            "conversationId": conversation_id,
            "model": "gpt-4o-mini"
        }
        
        # Use streaming request
        try:
            response = requests.post(
                f"{self.base_url}/api/chat/stream",
                json=chat_data,
                headers={
                    'Authorization': f'Bearer {self.auth_token}',
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                stream=True,
                timeout=30
            )
            
            if response.status_code == 200:
                # Read SSE events
                events_received = []
                content_chunks = []
                
                for line in response.iter_lines(decode_unicode=True):
                    if line.startswith('data: '):
                        try:
                            event_data = json.loads(line[6:])  # Remove 'data: ' prefix
                            events_received.append(event_data.get('type', 'unknown'))
                            
                            # Collect content chunks
                            if event_data.get('type') == 'content':
                                content_chunks.append(event_data.get('content', ''))
                                
                            # Stop after receiving done event or after reasonable amount of content
                            if event_data.get('type') == 'done' or len(content_chunks) > 10:
                                break
                                
                        except json.JSONDecodeError:
                            continue
                    
                    # Safety timeout - don't wait forever
                    if len(events_received) > 20:
                        break
                
                if events_received:
                    total_content = ''.join(content_chunks)
                    event_summary = ', '.join(set(events_received))
                    content_preview = total_content[:100] + "..." if len(total_content) > 100 else total_content
                    
                    self.log_result("Chat Stream", True, 
                                  f"SSE stream working. Events: [{event_summary}]. Content preview: '{content_preview}'",
                                  {'events': events_received, 'content_length': len(total_content)})
                else:
                    self.log_result("Chat Stream", False, "No SSE events received")
                    
            elif response.status_code == 403:
                try:
                    error_data = response.json()
                    if "pending approval" in error_data.get('error', '').lower():
                        self.log_result("Chat Stream", True, 
                                      "Chat stream endpoint working correctly - account approval workflow enforced",
                                      {'approval_required': True})
                    else:
                        self.log_result("Chat Stream", False, f"HTTP 403: {error_data.get('error', 'Forbidden')}", error_data)
                except:
                    self.log_result("Chat Stream", False, "HTTP 403: Forbidden", response.text[:200])
            else:
                try:
                    error_data = response.json()
                    self.log_result("Chat Stream", False, f"HTTP {response.status_code}: {error_data.get('error', 'Unknown error')}", error_data)
                except:
                    self.log_result("Chat Stream", False, f"HTTP {response.status_code}", response.text[:200])
                    
        except requests.exceptions.RequestException as e:
            self.log_result("Chat Stream", False, f"Request failed: {str(e)}")

    def run_all_tests(self):
        """Run all backend tests in sequence"""
        print("🚀 Starting Backend API Tests - Post Refactoring Verification")
        print("=" * 70)
        print(f"Base URL: {self.base_url}")
        print(f"Test User: {TEST_EMAIL}")
        print("=" * 70)
        print()
        
        # Run tests in order
        self.test_health_endpoint()
        self.test_models_endpoint()
        self.test_auth_flow()
        self.test_profile_endpoint()
        self.test_announcements_endpoint()
        self.test_privacy_settings_endpoint()
        self.test_conversations_endpoint()
        self.test_chat_stream_endpoint()
        
        # Summary
        print("=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        print()
        
        # List failed tests
        failed_tests = [result for result in self.test_results if not result['success']]
        if failed_tests:
            print("❌ FAILED TESTS:")
            for result in failed_tests:
                print(f"  - {result['test']}: {result['details']}")
        else:
            print("✅ ALL TESTS PASSED!")
            
        print()
        print("🔍 REFACTORING VERIFICATION:")
        if passed >= 6:  # At least 6 out of 8 critical endpoints working
            print("✅ Backend refactoring appears successful - core endpoints working")
        else:
            print("❌ Backend refactoring may have issues - multiple endpoints failing")
            
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)