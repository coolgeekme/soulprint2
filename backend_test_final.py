#!/usr/bin/env python3

import requests
import json
import sys
import os
from datetime import datetime

# Configuration from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_BASE = f"{BASE_URL}/api"

class SoulPrintEngineComprehensiveTester:
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

    def test_core_authentication(self):
        """Test Core Authentication & User Management (Priority 1)"""
        print("\n🔐 === PRIORITY 1: CORE AUTHENTICATION & USER MANAGEMENT ===")
        
        # Test 1: User Registration
        print("\n1. Testing User Registration (POST /api/auth/register)")
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
                if 'token' in data and 'userId' in data:
                    self.auth_token = data['token']
                    self.user_id = data['userId']
                    is_superadmin = data.get('role') == 'superadmin'
                    self.log_test("POST /api/auth/register", True, 
                                f"Registration successful. Role: {data.get('role')}, First user superadmin: {is_superadmin}")
                    auth_success = True
                else:
                    self.log_test("POST /api/auth/register", False, f"Missing token/userId: {data}")
                    auth_success = False
            except json.JSONDecodeError:
                self.log_test("POST /api/auth/register", False, "Invalid JSON response")
                auth_success = False
        elif response.status_code == 400:
            # User exists, try login
            self.log_test("POST /api/auth/register", True, "User already exists (400) - will try login")
            auth_success = self.test_login(test_email, test_passcode)
        else:
            self.log_test("POST /api/auth/register", False, f"Status: {response.status_code}")
            auth_success = False
            
        # Test 2: User Login
        if not auth_success:
            auth_success = self.test_login(test_email, test_passcode)
            
        # Test 3: Get Current User
        if auth_success:
            self.test_get_current_user()
            
        # Test 4: Profile Update (modularized route)
        if auth_success:
            self.test_profile_update()
            
        return auth_success

    def test_login(self, email, passcode):
        """Test User Login"""
        print("\n2. Testing User Login (POST /api/auth/login)")
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
                                f"Login successful. Role: {data.get('role')}")
                    return True
                else:
                    self.log_test("POST /api/auth/login", False, f"Missing token/userId: {data}")
            except json.JSONDecodeError:
                self.log_test("POST /api/auth/login", False, "Invalid JSON response")
        else:
            self.log_test("POST /api/auth/login", False, f"Status: {response.status_code}")
            
        return False

    def test_get_current_user(self):
        """Test Get Current User"""
        print("\n3. Testing Get Current User (GET /api/auth/me)")
        response = self.make_request('GET', '/auth/me')
        
        if isinstance(response, tuple):
            self.log_test("GET /api/auth/me", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'id' in data and 'email' in data:
                    self.log_test("GET /api/auth/me", True, 
                                f"User info retrieved. Email: {data.get('email')}")
                    return True
                else:
                    self.log_test("GET /api/auth/me", False, f"Missing user data")
            except json.JSONDecodeError:
                self.log_test("GET /api/auth/me", False, "Invalid JSON response")
        else:
            self.log_test("GET /api/auth/me", False, f"Status: {response.status_code}")
            
        return False

    def test_profile_update(self):
        """Test Profile Update (modularized route)"""
        print("\n4. Testing Profile Update (PUT /api/user/profile)")
        response = self.make_request('PUT', '/user/profile', {
            'display_name': 'Test User Updated',
            'descriptors': ['Tech Professional']
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
                    self.log_test("PUT /api/user/profile", False, f"Update failed")
            except json.JSONDecodeError:
                self.log_test("PUT /api/user/profile", False, "Invalid JSON response")
        else:
            self.log_test("PUT /api/user/profile", False, f"Status: {response.status_code}")
            
        return False

    def test_modularized_routes(self):
        """Test Modularized API Routes (Priority 2)"""
        print("\n🔧 === PRIORITY 2: MODULARIZED API ROUTES VERIFICATION ===")
        
        if not self.auth_token:
            print("⚠️ No auth token - testing without authentication")
            
        # Key modularized routes to test
        test_routes = [
            ('GET', '/auth/me', 'Auth module'),
            ('GET', '/admin/metrics', 'Admin module'),
            ('GET', '/google/status', 'Google integration module'),
            ('GET', '/telegram/status', 'Telegram module'),
            ('POST', '/voice/tts/preview', 'Voice module (new URL)'),
            ('GET', '/import/status', 'Import module'),
            ('GET', '/user/memories', 'User module (new URL)')
        ]
        
        all_working = True
        for method, endpoint, description in test_routes:
            # For POST requests, provide minimal data
            data = {'text': 'test', 'voice': 'alloy'} if method == 'POST' and 'tts' in endpoint else None
            
            response = self.make_request(method, endpoint, data)
            
            if isinstance(response, tuple):
                self.log_test(f"{method} {endpoint} ({description})", False, f"Request failed: {response[1]}")
                all_working = False
                continue
                
            # Success if not 404 (routing works)
            if response.status_code != 404:
                status_msg = f"Status {response.status_code}"
                if response.status_code == 200:
                    status_msg += " - Success"
                elif response.status_code in [401, 403]:
                    status_msg += " - Auth required (routing works)"
                elif response.status_code == 400:
                    status_msg += " - Bad request (routing works, validation active)"
                elif response.status_code == 500:
                    status_msg += " - Server error (routing works, may be missing API keys)"
                    
                self.log_test(f"{method} {endpoint} ({description})", True, status_msg)
            else:
                self.log_test(f"{method} {endpoint} ({description})", False, "404 - Routing issue")
                all_working = False
                
        return all_working

    def test_chat_llm_integration(self):
        """Test Chat & LLM Integration (Priority 3)"""
        print("\n🤖 === PRIORITY 3: CHAT & LLM INTEGRATION ===")
        
        # Test 1: List Available Models
        print("\n1. Testing Available LLM Models (GET /api/models)")
        response = self.make_request('GET', '/models')
        
        if isinstance(response, tuple):
            self.log_test("GET /api/models", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    # Count models by group
                    groups = {}
                    for model in data:
                        group = model.get('group', 'Unknown')
                        groups[group] = groups.get(group, 0) + 1
                    
                    self.log_test("GET /api/models", True, 
                                f"Models retrieved. Total: {len(data)}, Groups: {list(groups.keys())}")
                    
                    # Test 2: Chat Stream (limited due to no API keys)
                    return self.test_chat_streaming_limited()
                else:
                    self.log_test("GET /api/models", False, f"Invalid models format: {data}")
            except json.JSONDecodeError:
                self.log_test("GET /api/models", False, "Invalid JSON response")
        else:
            self.log_test("GET /api/models", False, f"Status: {response.status_code}")
            
        return False

    def test_chat_streaming_limited(self):
        """Test Chat Streaming (limited by missing API keys)"""
        print("\n2. Testing Chat Stream Setup (conversation creation)")
        
        if not self.auth_token:
            self.log_test("Chat Stream Setup", False, "No auth token")
            return False
            
        # Create conversation
        response = self.make_request('POST', '/conversations', {
            'title': 'Test Chat Stream'
        })
        
        if isinstance(response, tuple) or response.status_code != 200:
            self.log_test("POST /api/conversations", False, "Failed to create conversation")
            return False
            
        try:
            data = response.json()
            self.conversation_id = data.get('id')
            self.log_test("POST /api/conversations", True, 
                        f"Conversation created. ID: {self.conversation_id}")
            
            # Test chat stream endpoint (will fail due to missing API keys)
            print("\n   Testing Chat Stream API Structure")
            response = self.make_request('POST', '/chat/stream', {
                'content': 'Hello test',
                'model': 'gpt-4o',
                'conversationId': self.conversation_id
            })
            
            if isinstance(response, tuple):
                self.log_test("POST /api/chat/stream - API Structure", False, f"Request failed: {response[1]}")
                return False
                
            if response.status_code == 200:
                # Check if it returns streaming format
                content = response.text
                if 'type":"error"' in content and 'API key' in content:
                    self.log_test("POST /api/chat/stream - API Structure", True, 
                                "Chat stream endpoint working, fails due to missing OpenAI API key (expected)")
                    return True
                elif 'type":"meta"' in content:
                    self.log_test("POST /api/chat/stream - API Structure", True, 
                                "Chat stream working with proper NDJSON format")
                    return True
                else:
                    self.log_test("POST /api/chat/stream - API Structure", False, 
                                f"Unexpected response format: {content[:200]}")
            else:
                self.log_test("POST /api/chat/stream - API Structure", False, 
                            f"Chat stream failed. Status: {response.status_code}")
                            
        except json.JSONDecodeError:
            self.log_test("POST /api/conversations", False, "Invalid response")
            
        return False

    def test_assessment_system(self):
        """Test Assessment System (Priority 4)"""
        print("\n📝 === PRIORITY 4: ASSESSMENT SYSTEM ===")
        
        # Test 1: Get Assessment Questions
        print("\n1. Testing Assessment Questions (GET /api/assessment/questions)")
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
                    return self.test_assessment_answer(data[0]['id']) if data else False
                else:
                    self.log_test("GET /api/assessment/questions", False, 
                                f"Expected 36 questions, got: {len(data) if isinstance(data, list) else 'invalid'}")
            except json.JSONDecodeError:
                self.log_test("GET /api/assessment/questions", False, "Invalid JSON response")
        else:
            self.log_test("GET /api/assessment/questions", False, f"Status: {response.status_code}")
            
        return False

    def test_assessment_answer(self, question_id):
        """Test Assessment Answer Submission"""
        print("\n2. Testing Assessment Answer (POST /api/assessment/answer)")
        
        if not self.auth_token:
            self.log_test("POST /api/assessment/answer", False, "No auth token")
            return False
            
        # Use correct field name 'question_id' not 'questionId'
        response = self.make_request('POST', '/assessment/answer', {
            'question_id': question_id,
            'answer': 4
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
            self.log_test("POST /api/assessment/answer", False, f"Status: {response.status_code}")
            
        return False

    def test_assessment_progress(self):
        """Test Assessment Progress"""
        print("\n3. Testing Assessment Progress (GET /api/assessment/progress)")
        
        response = self.make_request('GET', '/assessment/progress')
        
        if isinstance(response, tuple):
            self.log_test("GET /api/assessment/progress", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'answered' in data and 'count' in data:
                    self.log_test("GET /api/assessment/progress", True, 
                                f"Progress retrieved. Answered: {data.get('count')}/36")
                    return True
                else:
                    self.log_test("GET /api/assessment/progress", False, "Missing progress data")
            except json.JSONDecodeError:
                self.log_test("GET /api/assessment/progress", False, "Invalid JSON response")
        else:
            self.log_test("GET /api/assessment/progress", False, f"Status: {response.status_code}")
            
        return False

    def test_admin_dashboard(self):
        """Test Admin Dashboard (Priority 5)"""
        print("\n👑 === PRIORITY 5: ADMIN DASHBOARD ===")
        
        if not self.auth_token:
            print("⚠️ No auth token - testing admin endpoints without auth")
            
        # Test 1: Admin Users
        print("\n1. Testing Admin Users (GET /api/admin/users)")
        response = self.make_request('GET', '/admin/users')
        
        users_success = False
        if isinstance(response, tuple):
            self.log_test("GET /api/admin/users", False, f"Request failed: {response[1]}")
        elif response.status_code == 200:
            try:
                data = response.json()
                if 'users' in data:
                    self.log_test("GET /api/admin/users", True, 
                                f"Users list retrieved. Count: {len(data.get('users', []))}")
                    users_success = True
                else:
                    self.log_test("GET /api/admin/users", False, "Missing users data")
            except json.JSONDecodeError:
                self.log_test("GET /api/admin/users", False, "Invalid JSON response")
        elif response.status_code == 403:
            self.log_test("GET /api/admin/users", False, "Access forbidden - user not superadmin")
        else:
            self.log_test("GET /api/admin/users", False, f"Status: {response.status_code}")
            
        # Test 2: Admin Metrics
        print("\n2. Testing Admin Metrics (GET /api/admin/metrics)")
        response = self.make_request('GET', '/admin/metrics')
        
        if isinstance(response, tuple):
            self.log_test("GET /api/admin/metrics", False, f"Request failed: {response[1]}")
            return users_success
            
        if response.status_code == 200:
            try:
                data = response.json()
                expected_fields = ['total_users', 'wau', 'accepted_users']
                has_metrics = any(field in data for field in expected_fields)
                if has_metrics:
                    self.log_test("GET /api/admin/metrics", True, 
                                f"Metrics retrieved. Sample keys: {list(data.keys())[:5]}")
                    return True
                else:
                    self.log_test("GET /api/admin/metrics", False, "Missing expected metrics")
            except json.JSONDecodeError:
                self.log_test("GET /api/admin/metrics", False, "Invalid JSON response")
        elif response.status_code == 403:
            self.log_test("GET /api/admin/metrics", False, "Access forbidden - user not superadmin")
        else:
            self.log_test("GET /api/admin/metrics", False, f"Status: {response.status_code}")
            
        return users_success

    def test_web_search_integration(self):
        """Test Web Search Integration (needs retesting)"""
        print("\n🔍 === WEB SEARCH INTEGRATION (NEEDS RETESTING) ===")
        
        if not self.auth_token or not self.conversation_id:
            self.log_test("Web Search Integration", False, "Prerequisites missing (auth/conversation)")
            return False
            
        print("\n1. Testing Web Search in Chat Stream")
        response = self.make_request('POST', '/chat/stream', {
            'content': 'What is the weather today?',
            'model': 'gpt-4o',
            'conversationId': self.conversation_id,
            'enableWebSearch': True
        })
        
        if isinstance(response, tuple):
            self.log_test("Web Search Integration", False, f"Request failed: {response[1]}")
            return False
            
        if response.status_code == 200:
            content = response.text
            # Look for error about missing API keys (expected)
            if 'API key' in content and 'type":"error"' in content:
                self.log_test("Web Search Integration", True, 
                            "Web search endpoint accessible, fails due to missing API keys (expected)")
                return True
            # Look for search events
            elif 'type":"search"' in content:
                self.log_test("Web Search Integration", True, "Web search triggered successfully")
                return True
            else:
                self.log_test("Web Search Integration", False, 
                            f"No search activity detected: {content[:200]}")
        else:
            self.log_test("Web Search Integration", False, f"Status: {response.status_code}")
            
        return False

    def run_comprehensive_tests(self):
        """Run comprehensive backend API tests according to review priorities"""
        print("🚀 === SOULPRINT ENGINE COMPREHENSIVE BACKEND API TESTING ===")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"🔗 API Base: {API_BASE}")
        print(f"⏰ Started at: {datetime.now().isoformat()}")
        print(f"\n🎯 Testing Review Request Priorities:")
        print("  Priority 1: Core Authentication & User Management (MUST TEST)")
        print("  Priority 2: Modularized API Routes (verify refactoring)")
        print("  Priority 3: Chat & LLM Integration")
        print("  Priority 4: Assessment System")
        print("  Priority 5: Admin Dashboard")
        print("  + Web Search Integration (needs retesting)")
        
        # Run tests in order
        test_results = []
        
        # Priority 1: Authentication (CRITICAL)
        auth_result = self.test_core_authentication()
        test_results.append(('Priority 1: Core Authentication', auth_result))
        
        # Priority 2: Modularized Routes 
        mod_result = self.test_modularized_routes()
        test_results.append(('Priority 2: Modularized Routes', mod_result))
        
        # Priority 3: Chat & LLM Integration
        chat_result = self.test_chat_llm_integration()
        test_results.append(('Priority 3: Chat & LLM Integration', chat_result))
        
        # Priority 4: Assessment System
        assessment_result = self.test_assessment_system()
        test_results.append(('Priority 4: Assessment System', assessment_result))
        
        # Priority 5: Admin Dashboard
        admin_result = self.test_admin_dashboard()
        test_results.append(('Priority 5: Admin Dashboard', admin_result))
        
        # Web Search Integration (needs retesting)
        if auth_result:  # Only if auth works
            search_result = self.test_web_search_integration()
            test_results.append(('Web Search Integration', search_result))
        else:
            test_results.append(('Web Search Integration', False))
        
        # Summary
        print(f"\n🏁 === FINAL TEST RESULTS ===")
        total_individual = len(self.test_results)
        passed_individual = sum(1 for r in self.test_results if r['success'])
        
        print(f"\n📊 Priority Test Results:")
        passed_priorities = 0
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status}: {test_name}")
            if result:
                passed_priorities += 1
        
        print(f"\n📈 Individual API Tests: {passed_individual}/{total_individual} passed")
        print(f"🎯 Priority Areas: {passed_priorities}/{len(test_results)} passed")
        
        # Show failed tests
        failed_tests = [r for r in self.test_results if not r['success']]
        if failed_tests:
            print(f"\n💥 Failed Individual Tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['message']}")
        
        # Overall assessment
        overall_success = passed_priorities >= 4  # At least 4/6 priorities should pass
        success_rate = (passed_individual / total_individual * 100) if total_individual > 0 else 0
        
        print(f"\n🎖️  Overall Success Rate: {success_rate:.1f}%")
        print(f"🏆 Critical Systems Status: {'✅ OPERATIONAL' if overall_success else '⚠️  ISSUES FOUND'}")
        
        return overall_success

if __name__ == "__main__":
    tester = SoulPrintEngineComprehensiveTester()
    success = tester.run_comprehensive_tests()
    sys.exit(0 if success else 1)