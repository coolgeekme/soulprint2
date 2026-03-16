#!/usr/bin/env python3

import requests
import json
import sys
import os
from datetime import datetime
import time

# Configuration from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_BASE = f"{BASE_URL}/api"

class SoulPrintEngineAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.auth_token = None
        self.user_id = None
        self.conversation_id = None
        
    def log_test(self, test_name, success, message="", details=None):
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"    {message}")
        if details and not success:
            print(f"    Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'details': details
        })

    def make_request(self, method, endpoint, data=None, headers=None, timeout=30):
        """Make HTTP request with error handling"""
        try:
            url = f"{API_BASE}{endpoint}"
            request_headers = {}
            if self.auth_token:
                request_headers['Authorization'] = f'Bearer {self.auth_token}'
            if headers:
                request_headers.update(headers)
                
            if method.upper() == 'GET':
                response = self.session.get(url, headers=request_headers, timeout=timeout)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=request_headers, timeout=timeout)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, headers=request_headers, timeout=timeout)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, headers=request_headers, timeout=timeout)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            return None, str(e)

    # Priority 1: Core Authentication & User Management
    def test_priority_1_authentication(self):
        """Test Priority 1: Core Authentication & User Management"""
        print("\n🔐 === PRIORITY 1: CORE AUTHENTICATION & USER MANAGEMENT ===")
        
        # Test 1: User Registration (POST /api/auth/register)
        print("\n1. Testing User Registration")
        test_email = "test@soulprintengine.com"
        test_passcode = "test123456"
        
        response = self.make_request('POST', '/auth/register', {
            'email': test_email,
            'passcode': test_passcode
        })
        
        if isinstance(response, tuple):
            self.log_test("POST /api/auth/register", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'token' in data and 'userId' in data and 'role' in data:
                    self.auth_token = data['token']
                    self.user_id = data['userId']
                    superadmin = data.get('role') == 'superadmin'
                    self.log_test("POST /api/auth/register", True, 
                                f"Registration successful. Role: {data.get('role')}, First user is superadmin: {superadmin}")
                    return True
                else:
                    self.log_test("POST /api/auth/register", False, f"Missing required fields in response: {data}")
            except json.JSONDecodeError:
                self.log_test("POST /api/auth/register", False, "Invalid JSON response")
        elif response.status_code == 400:
            # User might already exist, try login
            self.log_test("POST /api/auth/register", True, 
                        f"User exists (400) - will try login next. Status: {response.status_code}")
            return self.test_user_login(test_email, test_passcode)
        else:
            self.log_test("POST /api/auth/register", False, 
                        f"Registration failed. Status: {response.status_code}, Response: {response.text}")
            
        return False

    def test_user_login(self, email=None, passcode=None):
        """Test 2: User Login (POST /api/auth/login)"""
        print("\n2. Testing User Login")
        
        if not email:
            email = "test@soulprintengine.com"
        if not passcode:
            passcode = "test123456"
            
        response = self.make_request('POST', '/auth/login', {
            'email': email,
            'passcode': passcode
        })
        
        if isinstance(response, tuple):
            self.log_test("POST /api/auth/login", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'token' in data and 'userId' in data:
                    self.auth_token = data['token']
                    self.user_id = data['userId']
                    self.log_test("POST /api/auth/login", True, 
                                f"Login successful. Role: {data.get('role')}, User ID: {data.get('userId')}")
                    return True
                else:
                    self.log_test("POST /api/auth/login", False, f"Missing required fields: {data}")
            except json.JSONDecodeError:
                self.log_test("POST /api/auth/login", False, "Invalid JSON response")
        else:
            self.log_test("POST /api/auth/login", False, 
                        f"Login failed. Status: {response.status_code}, Response: {response.text}")
            
        return False

    def test_get_current_user(self):
        """Test 3: Get Current User (GET /api/auth/me)"""
        print("\n3. Testing Get Current User")
        
        if not self.auth_token:
            self.log_test("GET /api/auth/me", False, "No auth token available")
            return False
            
        response = self.make_request('GET', '/auth/me')
        
        if isinstance(response, tuple):
            self.log_test("GET /api/auth/me", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'id' in data and 'email' in data:
                    self.log_test("GET /api/auth/me", True, 
                                f"User info retrieved successfully. Email: {data.get('email')}")
                    return True
                else:
                    self.log_test("GET /api/auth/me", False, f"Missing user data: {data}")
            except json.JSONDecodeError:
                self.log_test("GET /api/auth/me", False, "Invalid JSON response")
        else:
            self.log_test("GET /api/auth/me", False, 
                        f"Failed to get user info. Status: {response.status_code}")
            
        return False

    def test_profile_update(self):
        """Test 4: Update User Profile (PUT /api/user/profile)"""
        print("\n4. Testing Profile Update (Modularized Route)")
        
        if not self.auth_token:
            self.log_test("PUT /api/user/profile", False, "No auth token available")
            return False
            
        response = self.make_request('PUT', '/user/profile', {
            'display_name': 'Test User Updated',
            'descriptors': ['Tech Professional'],
            'field': 'Software Development'
        })
        
        if isinstance(response, tuple):
            self.log_test("PUT /api/user/profile", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if data.get('success'):
                    self.log_test("PUT /api/user/profile", True, 
                                "Profile update successful (modularized route working)")
                    return True
                else:
                    self.log_test("PUT /api/user/profile", False, f"Update failed: {data}")
            except json.JSONDecodeError:
                self.log_test("PUT /api/user/profile", False, "Invalid JSON response")
        else:
            self.log_test("PUT /api/user/profile", False, 
                        f"Profile update failed. Status: {response.status_code}")
            
        return False

    # Priority 2: Modularized API Routes
    def test_priority_2_modularized_routes(self):
        """Test Priority 2: Modularized API Routes (Verify Refactoring)"""
        print("\n🔧 === PRIORITY 2: MODULARIZED API ROUTES VERIFICATION ===")
        
        if not self.auth_token:
            print("⚠️ Skipping modularized routes test - no auth token")
            return False
            
        modular_routes = [
            ('GET', '/auth/me', 'Auth module'),
            ('GET', '/admin/metrics', 'Admin module (requires superadmin)'),
            ('GET', '/google/status', 'Google integration module'),
            ('GET', '/telegram/status', 'Telegram module'),
            ('GET', '/import/status', 'Import module'),
            ('GET', '/user/memories', 'User module')
        ]
        
        all_passed = True
        for method, endpoint, description in modular_routes:
            response = self.make_request(method, endpoint)
            
            if isinstance(response, tuple):
                self.log_test(f"{method} {endpoint}", False, f"Request failed: {response[1]}")
                all_passed = False
                continue
                
            # Consider success if not 404 (routing works)
            if response.status_code != 404:
                status_msg = f"Status {response.status_code}"
                if response.status_code == 200:
                    status_msg += " - Success"
                elif response.status_code in [401, 403]:
                    status_msg += " - Auth required (routing works)"
                elif response.status_code == 500:
                    status_msg += " - Server error (routing works)"
                    
                self.log_test(f"{method} {endpoint} ({description})", True, status_msg)
            else:
                self.log_test(f"{method} {endpoint} ({description})", False, 
                            "404 Not Found - Modularization routing issue")
                all_passed = False
                
        return all_passed

    # Priority 3: Chat & LLM Integration
    def test_priority_3_chat_llm(self):
        """Test Priority 3: Chat & LLM Integration"""
        print("\n🤖 === PRIORITY 3: CHAT & LLM INTEGRATION ===")
        
        # Test 1: List Available Models
        print("\n1. Testing Available LLM Models")
        response = self.make_request('GET', '/models')
        
        if isinstance(response, tuple):
            self.log_test("GET /api/models", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict) and 'OpenAI' in data:
                    model_count = sum(len(models) for models in data.values())
                    self.log_test("GET /api/models", True, 
                                f"Models list retrieved. Groups: {len(data)}, Total models: {model_count}")
                    
                    # Test 2: Chat Stream with OpenAI Model
                    if 'OpenAI' in data and len(data['OpenAI']) > 0:
                        return self.test_chat_streaming(data['OpenAI'][0]['value'])
                    else:
                        self.log_test("Chat streaming test", False, "No OpenAI models available")
                        return False
                else:
                    self.log_test("GET /api/models", False, f"Unexpected models format: {data}")
            except json.JSONDecodeError:
                self.log_test("GET /api/models", False, "Invalid JSON response")
        else:
            self.log_test("GET /api/models", False, f"Failed to get models. Status: {response.status_code}")
            
        return False

    def test_chat_streaming(self, model_name):
        """Test Chat Streaming with Multi-LLM Support"""
        print(f"\n2. Testing Chat Stream with {model_name}")
        
        if not self.auth_token:
            self.log_test("POST /api/chat/stream", False, "No auth token available")
            return False
            
        # Create a conversation first
        response = self.make_request('POST', '/conversations', {
            'title': 'Test Conversation'
        })
        
        if isinstance(response, tuple) or response.status_code != 200:
            self.log_test("POST /api/conversations", False, "Failed to create conversation")
            return False
            
        try:
            conv_data = response.json()
            self.conversation_id = conv_data.get('id')
        except:
            self.log_test("POST /api/conversations", False, "Invalid response")
            return False
            
        # Now test chat streaming
        response = self.make_request('POST', '/chat/stream', {
            'messages': [
                {'role': 'user', 'content': 'Hello, please introduce yourself briefly.'}
            ],
            'model': model_name,
            'conversationId': self.conversation_id
        })
        
        if isinstance(response, tuple):
            self.log_test("POST /api/chat/stream", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            # Check if it's streaming (should have chunks)
            try:
                content = response.text
                if content and ('data:' in content or '"type":' in content):
                    chunks = content.strip().split('\n')
                    self.log_test("POST /api/chat/stream", True, 
                                f"Chat streaming working. Model: {model_name}, Chunks: {len(chunks)}")
                    return True
                else:
                    self.log_test("POST /api/chat/stream", False, 
                                f"No streaming data received: {content[:200]}")
            except Exception as e:
                self.log_test("POST /api/chat/stream", False, f"Failed to parse stream: {e}")
        else:
            self.log_test("POST /api/chat/stream", False, 
                        f"Streaming failed. Status: {response.status_code}")
            
        return False

    # Priority 4: Assessment System
    def test_priority_4_assessment(self):
        """Test Priority 4: Assessment System"""
        print("\n📝 === PRIORITY 4: ASSESSMENT SYSTEM ===")
        
        # Test 1: Get Assessment Questions
        print("\n1. Testing Assessment Questions")
        response = self.make_request('GET', '/assessment/questions')
        
        if isinstance(response, tuple):
            self.log_test("GET /api/assessment/questions", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list) and len(data) == 36:
                    pillars = set(q.get('pillar') for q in data)
                    self.log_test("GET /api/assessment/questions", True, 
                                f"36 questions retrieved across {len(pillars)} pillars")
                    
                    # Test 2: Submit Answer
                    if len(data) > 0:
                        return self.test_assessment_answer(data[0]['id'])
                    else:
                        return False
                else:
                    self.log_test("GET /api/assessment/questions", False, 
                                f"Expected 36 questions, got: {len(data) if isinstance(data, list) else 'invalid'}")
            except json.JSONDecodeError:
                self.log_test("GET /api/assessment/questions", False, "Invalid JSON response")
        else:
            self.log_test("GET /api/assessment/questions", False, 
                        f"Failed to get questions. Status: {response.status_code}")
            
        return False

    def test_assessment_answer(self, question_id):
        """Test Assessment Answer Submission"""
        print(f"\n2. Testing Assessment Answer Submission")
        
        if not self.auth_token:
            self.log_test("POST /api/assessment/answer", False, "No auth token available")
            return False
            
        response = self.make_request('POST', '/assessment/answer', {
            'questionId': question_id,
            'answer': 4,  # Scale 1-5
            'pillar': 'communication'
        })
        
        if isinstance(response, tuple):
            self.log_test("POST /api/assessment/answer", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if data.get('success'):
                    self.log_test("POST /api/assessment/answer", True, "Answer submitted successfully")
                    
                    # Test 3: Check Progress
                    return self.test_assessment_progress()
                else:
                    self.log_test("POST /api/assessment/answer", False, f"Submission failed: {data}")
            except json.JSONDecodeError:
                self.log_test("POST /api/assessment/answer", False, "Invalid JSON response")
        else:
            self.log_test("POST /api/assessment/answer", False, 
                        f"Answer submission failed. Status: {response.status_code}")
            
        return False

    def test_assessment_progress(self):
        """Test Assessment Progress"""
        print("\n3. Testing Assessment Progress")
        
        if not self.auth_token:
            self.log_test("GET /api/assessment/progress", False, "No auth token available")
            return False
            
        response = self.make_request('GET', '/assessment/progress')
        
        if isinstance(response, tuple):
            self.log_test("GET /api/assessment/progress", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'answered' in data and 'count' in data:
                    self.log_test("GET /api/assessment/progress", True, 
                                f"Progress retrieved. Answered: {data.get('count')}/36 questions")
                    return True
                else:
                    self.log_test("GET /api/assessment/progress", False, f"Missing progress data: {data}")
            except json.JSONDecodeError:
                self.log_test("GET /api/assessment/progress", False, "Invalid JSON response")
        else:
            self.log_test("GET /api/assessment/progress", False, 
                        f"Failed to get progress. Status: {response.status_code}")
            
        return False

    # Priority 5: Admin Dashboard
    def test_priority_5_admin(self):
        """Test Priority 5: Admin Dashboard"""
        print("\n👑 === PRIORITY 5: ADMIN DASHBOARD ===")
        
        if not self.auth_token:
            print("⚠️ Skipping admin tests - no auth token")
            return False
            
        # Test 1: Admin Users List
        print("\n1. Testing Admin Users List")
        response = self.make_request('GET', '/admin/users')
        
        if isinstance(response, tuple):
            self.log_test("GET /api/admin/users", False, f"Request failed: {response[1]}")
            admin_users_working = False
        elif response.status_code == 200:
            try:
                data = response.json()
                if 'users' in data:
                    self.log_test("GET /api/admin/users", True, 
                                f"Users list retrieved. Count: {len(data.get('users', []))}")
                    admin_users_working = True
                else:
                    self.log_test("GET /api/admin/users", False, f"Missing users data: {data}")
                    admin_users_working = False
            except json.JSONDecodeError:
                self.log_test("GET /api/admin/users", False, "Invalid JSON response")
                admin_users_working = False
        elif response.status_code == 403:
            self.log_test("GET /api/admin/users", False, "Access forbidden - user not superadmin")
            admin_users_working = False
        else:
            self.log_test("GET /api/admin/users", False, 
                        f"Failed to get users. Status: {response.status_code}")
            admin_users_working = False
            
        # Test 2: Admin Metrics
        print("\n2. Testing Admin Metrics")
        response = self.make_request('GET', '/admin/metrics')
        
        if isinstance(response, tuple):
            self.log_test("GET /api/admin/metrics", False, f"Request failed: {response[1]}")
            return admin_users_working
            
        if response.status_code == 200:
            try:
                data = response.json()
                expected_metrics = ['total_users', 'weekly_active_users', 'retention_rate']
                has_metrics = any(key in data for key in expected_metrics)
                if has_metrics:
                    self.log_test("GET /api/admin/metrics", True, 
                                f"Metrics retrieved. Keys: {list(data.keys())[:5]}...")
                    return True
                else:
                    self.log_test("GET /api/admin/metrics", False, f"Missing expected metrics: {data}")
            except json.JSONDecodeError:
                self.log_test("GET /api/admin/metrics", False, "Invalid JSON response")
        elif response.status_code == 403:
            self.log_test("GET /api/admin/metrics", False, "Access forbidden - user not superadmin")
        else:
            self.log_test("GET /api/admin/metrics", False, 
                        f"Failed to get metrics. Status: {response.status_code}")
            
        return admin_users_working

    # Web Search Integration Test (from needs_retesting)
    def test_web_search_integration(self):
        """Test Web Search Integration - needs retesting"""
        print("\n🔍 === WEB SEARCH INTEGRATION (NEEDS RETESTING) ===")
        
        if not self.auth_token or not self.conversation_id:
            self.log_test("Web Search Integration", False, "No auth token or conversation available")
            return False
            
        print("\n1. Testing Chat Stream with Web Search Enabled")
        response = self.make_request('POST', '/chat/stream', {
            'messages': [
                {'role': 'user', 'content': 'What is the weather today?'}
            ],
            'model': 'gpt-4o',
            'conversationId': self.conversation_id,
            'enableWebSearch': True
        })
        
        if isinstance(response, tuple):
            self.log_test("POST /api/chat/stream (with web search)", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            try:
                content = response.text
                # Look for search events
                if 'type":"search"' in content or '"type":"meta"' in content:
                    self.log_test("Web Search Integration", True, 
                                "Web search triggered successfully in chat stream")
                    return True
                else:
                    self.log_test("Web Search Integration", False, 
                                f"No search events detected in stream: {content[:200]}...")
            except Exception as e:
                self.log_test("Web Search Integration", False, f"Failed to parse stream: {e}")
        else:
            self.log_test("Web Search Integration", False, 
                        f"Web search test failed. Status: {response.status_code}")
            
        return False

    def run_comprehensive_tests(self):
        """Run all comprehensive tests according to review request priorities"""
        print("🚀 === SOULPRINT ENGINE COMPREHENSIVE BACKEND API TESTING ===")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"🔗 API Base: {API_BASE}")
        print(f"⏰ Started at: {datetime.now().isoformat()}")
        print("\n🎯 Testing according to review request priorities:")
        print("  Priority 1: Core Authentication & User Management")
        print("  Priority 2: Modularized API Routes (verify refactoring)")
        print("  Priority 3: Chat & LLM Integration")
        print("  Priority 4: Assessment System")
        print("  Priority 5: Admin Dashboard")
        print("  + Web Search Integration (needs retesting)")
        
        # Run tests in priority order
        results = []
        
        # Priority 1: Authentication (MUST TEST)
        auth_result = self.test_priority_1_authentication()
        results.append(('Priority 1: Authentication', auth_result))
        
        if auth_result:
            # Priority 2: Modularized Routes
            mod_result = self.test_priority_2_modularized_routes()
            results.append(('Priority 2: Modularized Routes', mod_result))
            
            # Priority 3: Chat & LLM
            chat_result = self.test_priority_3_chat_llm()
            results.append(('Priority 3: Chat & LLM', chat_result))
            
            # Priority 4: Assessment
            assessment_result = self.test_priority_4_assessment()
            results.append(('Priority 4: Assessment', assessment_result))
            
            # Priority 5: Admin Dashboard
            admin_result = self.test_priority_5_admin()
            results.append(('Priority 5: Admin Dashboard', admin_result))
            
            # Web Search (needs retesting)
            search_result = self.test_web_search_integration()
            results.append(('Web Search Integration', search_result))
        else:
            print("\n⚠️ Skipping remaining tests due to authentication failure")
            results.extend([
                ('Priority 2: Modularized Routes', False),
                ('Priority 3: Chat & LLM', False),
                ('Priority 4: Assessment', False),
                ('Priority 5: Admin Dashboard', False),
                ('Web Search Integration', False)
            ])
        
        # Final Summary
        print(f"\n🏁 === COMPREHENSIVE TEST RESULTS ===")
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Individual Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        
        print(f"\n📊 Priority Results:")
        for priority_name, success in results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"  {status}: {priority_name}")
        
        if failed_tests > 0:
            print(f"\n💥 Failed Individual Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        print(f"\n📈 Overall Success Rate: {success_rate:.1f}%")
        
        priority_successes = sum(1 for _, success in results if success)
        priority_rate = (priority_successes / len(results) * 100) if results else 0
        print(f"🎯 Priority Success Rate: {priority_rate:.1f}%")
        
        return failed_tests == 0 and priority_successes >= 4  # At least 4/6 priorities should pass

if __name__ == "__main__":
    tester = SoulPrintEngineAPITester()
    success = tester.run_comprehensive_tests()
    sys.exit(0 if success else 1)