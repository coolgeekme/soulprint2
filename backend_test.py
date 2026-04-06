#!/usr/bin/env python3
"""
Backend Route.js Decomposition Verification Test
Tests all critical endpoints after massive refactoring from 10,473 lines to 835 lines (92% reduction)
"""

import requests
import json
import time
import os
from typing import Dict, Any, Optional

# Test configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple:
        """Make HTTP request and return (success, response, status_code)"""
        try:
            url = f"{self.base_url}/api/{endpoint}"
            req_headers = {"Content-Type": "application/json"}
            if headers:
                req_headers.update(headers)
                
            if method.upper() == "GET":
                response = self.session.get(url, headers=req_headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=req_headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=req_headers)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=req_headers)
            else:
                return False, None, 0
                
            return True, response, response.status_code
        except Exception as e:
            return False, str(e), 0
    
    def authenticate(self) -> bool:
        """Authenticate and get token"""
        print(f"\n🔐 Authenticating with {TEST_EMAIL}...")
        
        success, response, status_code = self.make_request("POST", "auth/login", {
            "email": TEST_EMAIL,
            "passcode": TEST_PASSWORD
        })
        
        if not success:
            self.log_test("Authentication", False, f"Request failed: {response}")
            return False
            
        if status_code == 200:
            try:
                data = response.json()
                if "token" in data:
                    self.auth_token = data["token"]
                    self.log_test("Authentication", True, f"Login successful, token received")
                    return True
                else:
                    self.log_test("Authentication", False, f"No token in response: {data}")
                    return False
            except Exception as e:
                self.log_test("Authentication", False, f"JSON parse error: {e}")
                return False
        else:
            try:
                error_data = response.json()
                self.log_test("Authentication", False, f"Status {status_code}: {error_data}")
            except:
                self.log_test("Authentication", False, f"Status {status_code}: {response.text}")
            return False
    
    def get_auth_headers(self) -> Dict:
        """Get authorization headers"""
        if not self.auth_token:
            return {}
        return {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_health_check(self):
        """Test GET /api/health"""
        print("\n🏥 Testing Health Check...")
        success, response, status_code = self.make_request("GET", "health")
        
        if success and status_code == 200:
            try:
                data = response.json()
                if data.get("status") == "ok":
                    self.log_test("Health Check", True, f"Status: {data.get('status')}")
                else:
                    self.log_test("Health Check", False, f"Unexpected response: {data}")
            except Exception as e:
                self.log_test("Health Check", False, f"JSON parse error: {e}")
        else:
            self.log_test("Health Check", False, f"Status {status_code}: {response}")
    
    def test_auth_me(self):
        """Test GET /api/auth/me"""
        print("\n👤 Testing Auth Me...")
        headers = self.get_auth_headers()
        success, response, status_code = self.make_request("GET", "auth/me", headers=headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if "id" in data and "email" in data:
                    self.log_test("Auth Me", True, f"User data received: {data.get('email')}")
                else:
                    self.log_test("Auth Me", False, f"Missing user fields: {data}")
            except Exception as e:
                self.log_test("Auth Me", False, f"JSON parse error: {e}")
        else:
            self.log_test("Auth Me", False, f"Status {status_code}: {response}")
    
    def test_profile_update(self):
        """Test PUT /api/profile"""
        print("\n📝 Testing Profile Update...")
        headers = self.get_auth_headers()
        test_data = {
            "name": "Test User Updated",
            "bio": "Updated via backend test"
        }
        success, response, status_code = self.make_request("PUT", "profile", test_data, headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if data.get("success"):
                    self.log_test("Profile Update", True, "Profile updated successfully")
                else:
                    self.log_test("Profile Update", False, f"Update failed: {data}")
            except Exception as e:
                self.log_test("Profile Update", False, f"JSON parse error: {e}")
        else:
            self.log_test("Profile Update", False, f"Status {status_code}: {response}")
    
    def test_models(self):
        """Test GET /api/models"""
        print("\n🤖 Testing Models...")
        success, response, status_code = self.make_request("GET", "models")
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    self.log_test("Models", True, f"Received {len(data)} models")
                else:
                    self.log_test("Models", False, f"No models returned: {data}")
            except Exception as e:
                self.log_test("Models", False, f"JSON parse error: {e}")
        else:
            self.log_test("Models", False, f"Status {status_code}: {response}")
    
    def test_feature_flags(self):
        """Test GET /api/feature-flags"""
        print("\n🚩 Testing Feature Flags...")
        headers = self.get_auth_headers()
        success, response, status_code = self.make_request("GET", "feature-flags", headers=headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict):
                    self.log_test("Feature Flags", True, f"Received feature flags: {list(data.keys())}")
                else:
                    self.log_test("Feature Flags", False, f"Unexpected format: {data}")
            except Exception as e:
                self.log_test("Feature Flags", False, f"JSON parse error: {e}")
        else:
            self.log_test("Feature Flags", False, f"Status {status_code}: {response}")
    
    def test_assessment_questions(self):
        """Test GET /api/assessment/questions"""
        print("\n❓ Testing Assessment Questions...")
        success, response, status_code = self.make_request("GET", "assessment/questions")
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    self.log_test("Assessment Questions", True, f"Received {len(data)} questions")
                else:
                    self.log_test("Assessment Questions", False, f"No questions returned: {data}")
            except Exception as e:
                self.log_test("Assessment Questions", False, f"JSON parse error: {e}")
        else:
            self.log_test("Assessment Questions", False, f"Status {status_code}: {response}")
    
    def test_assessment_progress(self):
        """Test GET /api/assessment/progress"""
        print("\n📊 Testing Assessment Progress...")
        headers = self.get_auth_headers()
        success, response, status_code = self.make_request("GET", "assessment/progress", headers=headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict):
                    self.log_test("Assessment Progress", True, f"Progress data received")
                else:
                    self.log_test("Assessment Progress", False, f"Unexpected format: {data}")
            except Exception as e:
                self.log_test("Assessment Progress", False, f"JSON parse error: {e}")
        else:
            self.log_test("Assessment Progress", False, f"Status {status_code}: {response}")
    
    def test_conversations(self):
        """Test GET /api/conversations"""
        print("\n💬 Testing Conversations...")
        headers = self.get_auth_headers()
        success, response, status_code = self.make_request("GET", "conversations", headers=headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Conversations", True, f"Received {len(data)} conversations")
                else:
                    self.log_test("Conversations", False, f"Unexpected format: {data}")
            except Exception as e:
                self.log_test("Conversations", False, f"JSON parse error: {e}")
        else:
            self.log_test("Conversations", False, f"Status {status_code}: {response}")
    
    def test_blog_posts(self):
        """Test GET /api/blog/posts"""
        print("\n📝 Testing Blog Posts...")
        success, response, status_code = self.make_request("GET", "blog/posts")
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict) and 'posts' in data:
                    self.log_test("Blog Posts", True, f"Received {len(data['posts'])} blog posts")
                else:
                    self.log_test("Blog Posts", False, f"Unexpected format: {data}")
            except Exception as e:
                self.log_test("Blog Posts", False, f"JSON parse error: {e}")
        else:
            self.log_test("Blog Posts", False, f"Status {status_code}: {response}")
    
    def test_notifications(self):
        """Test GET /api/notifications"""
        print("\n🔔 Testing Notifications...")
        headers = self.get_auth_headers()
        success, response, status_code = self.make_request("GET", "notifications", headers=headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict) and 'notifications' in data:
                    self.log_test("Notifications", True, f"Received {len(data['notifications'])} notifications")
                else:
                    self.log_test("Notifications", False, f"Unexpected format: {data}")
            except Exception as e:
                self.log_test("Notifications", False, f"JSON parse error: {e}")
        else:
            self.log_test("Notifications", False, f"Status {status_code}: {response}")
    
    def test_schedules(self):
        """Test GET /api/schedules"""
        print("\n📅 Testing Schedules...")
        headers = self.get_auth_headers()
        success, response, status_code = self.make_request("GET", "schedules", headers=headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Schedules", True, f"Received {len(data)} schedules")
                else:
                    self.log_test("Schedules", False, f"Unexpected format: {data}")
            except Exception as e:
                self.log_test("Schedules", False, f"JSON parse error: {e}")
        else:
            self.log_test("Schedules", False, f"Status {status_code}: {response}")
    
    def test_telegram_status(self):
        """Test GET /api/telegram/status"""
        print("\n📱 Testing Telegram Status...")
        headers = self.get_auth_headers()
        success, response, status_code = self.make_request("GET", "telegram/status", headers=headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict):
                    self.log_test("Telegram Status", True, f"Status received")
                else:
                    self.log_test("Telegram Status", False, f"Unexpected format: {data}")
            except Exception as e:
                self.log_test("Telegram Status", False, f"JSON parse error: {e}")
        else:
            self.log_test("Telegram Status", False, f"Status {status_code}: {response}")
    
    def test_voice_settings(self):
        """Test GET /api/voice/settings"""
        print("\n🎤 Testing Voice Settings...")
        headers = self.get_auth_headers()
        success, response, status_code = self.make_request("GET", "user/voice-settings", headers=headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict):
                    self.log_test("Voice Settings", True, f"Settings received")
                else:
                    self.log_test("Voice Settings", False, f"Unexpected format: {data}")
            except Exception as e:
                self.log_test("Voice Settings", False, f"JSON parse error: {e}")
        else:
            self.log_test("Voice Settings", False, f"Status {status_code}: {response}")
    
    def test_user_location(self):
        """Test GET /api/user/location"""
        print("\n📍 Testing User Location...")
        headers = self.get_auth_headers()
        success, response, status_code = self.make_request("GET", "user/location", headers=headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict):
                    self.log_test("User Location", True, f"Location data received")
                else:
                    self.log_test("User Location", False, f"Unexpected format: {data}")
            except Exception as e:
                self.log_test("User Location", False, f"JSON parse error: {e}")
        else:
            self.log_test("User Location", False, f"Status {status_code}: {response}")
    
    def test_user_timezone(self):
        """Test GET /api/user/timezone"""
        print("\n🌍 Testing User Timezone...")
        headers = self.get_auth_headers()
        success, response, status_code = self.make_request("GET", "user/timezone", headers=headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict):
                    self.log_test("User Timezone", True, f"Timezone data received")
                else:
                    self.log_test("User Timezone", False, f"Unexpected format: {data}")
            except Exception as e:
                self.log_test("User Timezone", False, f"JSON parse error: {e}")
        else:
            self.log_test("User Timezone", False, f"Status {status_code}: {response}")
    
    def test_chat_stream(self):
        """Test POST /api/chat/stream"""
        print("\n💭 Testing Chat Stream...")
        headers = self.get_auth_headers()
        headers["Accept"] = "text/event-stream"
        
        test_data = {
            "content": "Hello, this is a test message",
            "model": "gpt-4o",
            "conversationId": None
        }
        
        try:
            url = f"{self.base_url}/api/chat/stream"
            response = self.session.post(url, json=test_data, headers=headers, stream=True, timeout=30)
            
            if response.status_code == 200:
                # Check if we get streaming response
                content_type = response.headers.get('content-type', '')
                if 'text/event-stream' in content_type:
                    # Read first few chunks to verify streaming
                    chunks_received = 0
                    for chunk in response.iter_content(chunk_size=1024):
                        if chunk:
                            chunks_received += 1
                            if chunks_received >= 3:  # Got some streaming data
                                break
                    
                    if chunks_received > 0:
                        self.log_test("Chat Stream", True, f"Streaming response received ({chunks_received} chunks)")
                    else:
                        self.log_test("Chat Stream", False, "No streaming data received")
                else:
                    self.log_test("Chat Stream", False, f"Wrong content type: {content_type}")
            else:
                try:
                    error_data = response.json()
                    self.log_test("Chat Stream", False, f"Status {response.status_code}: {error_data}")
                except:
                    self.log_test("Chat Stream", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Chat Stream", False, f"Request error: {e}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Backend Route.js Decomposition Verification Tests")
        print(f"📍 Base URL: {self.base_url}")
        print(f"👤 Test User: {TEST_EMAIL}")
        print("=" * 80)
        
        # Test health check first (no auth required)
        self.test_health_check()
        
        # Authenticate
        if not self.authenticate():
            print("\n❌ Authentication failed - cannot proceed with authenticated tests")
            return
        
        # Run all authenticated tests
        self.test_auth_me()
        self.test_profile_update()
        self.test_models()
        self.test_feature_flags()
        self.test_assessment_questions()
        self.test_assessment_progress()
        self.test_conversations()
        self.test_blog_posts()
        self.test_notifications()
        self.test_schedules()
        self.test_telegram_status()
        self.test_voice_settings()
        self.test_user_location()
        self.test_user_timezone()
        self.test_chat_stream()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"✅ Passed: {passed}/{total}")
        print(f"❌ Failed: {total - passed}/{total}")
        print(f"📈 Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['details']}")
        
        print("\n🎯 CRITICAL ENDPOINTS VERIFICATION:")
        critical_endpoints = [
            "Health Check", "Authentication", "Auth Me", "Profile Update", 
            "Models", "Feature Flags", "Assessment Questions", "Assessment Progress",
            "Conversations", "Blog Posts", "Notifications", "Schedules",
            "Telegram Status", "Voice Settings", "User Location", "User Timezone",
            "Chat Stream"
        ]
        
        for endpoint in critical_endpoints:
            result = next((r for r in self.test_results if r["test"] == endpoint), None)
            if result:
                status = "✅" if result["success"] else "❌"
                print(f"  {status} {endpoint}")
            else:
                print(f"  ⚠️  {endpoint} (not tested)")

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()