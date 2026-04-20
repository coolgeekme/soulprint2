#!/usr/bin/env python3
"""
Backend Testing Script for GitHub OAuth Integration
Tests all critical GitHub OAuth endpoints and chat stream integration
"""

import requests
import json
import time
import sys
import os
from urllib.parse import urljoin

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "testchat@example.com"
TEST_PASSCODE = "Test123456"

class GitHubOAuthTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def authenticate(self):
        """Authenticate and get auth token"""
        try:
            self.log("🔐 Authenticating user...")
            response = self.session.post(f"{API_BASE}/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSCODE
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('token')
                self.user_id = data.get('userId')  # Fixed: use 'userId' not 'user.id'
                self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                self.log(f"✅ Authentication successful. User ID: {self.user_id}")
                return True
            else:
                self.log(f"❌ Authentication failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Authentication error: {str(e)}", "ERROR")
            return False
    
    def test_health_check(self):
        """Test basic health check"""
        try:
            self.log("🏥 Testing health check...")
            response = self.session.get(f"{API_BASE}/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'ok':
                    self.log("✅ Health check passed")
                    return True
                else:
                    self.log(f"❌ Health check failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Health check failed: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Health check error: {str(e)}", "ERROR")
            return False
    
    def test_github_connect(self):
        """Test GitHub connect endpoint"""
        try:
            self.log("🔗 Testing GitHub connect endpoint...")
            response = self.session.get(f"{API_BASE}/github/connect", params={
                "user_id": self.user_id
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'authUrl' in data and 'github.com/login/oauth/authorize' in data['authUrl']:
                    self.log("✅ GitHub connect endpoint working - returns valid authUrl")
                    self.log(f"   Auth URL: {data['authUrl'][:100]}...")
                    return True
                else:
                    self.log(f"❌ GitHub connect endpoint failed: Invalid response format", "ERROR")
                    return False
            else:
                self.log(f"❌ GitHub connect endpoint failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GitHub connect error: {str(e)}", "ERROR")
            return False
    
    def test_github_status(self):
        """Test GitHub status endpoint"""
        try:
            self.log("📊 Testing GitHub status endpoint...")
            response = self.session.get(f"{API_BASE}/github/status", params={
                "user_id": self.user_id
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'connected' in data:
                    connected = data['connected']
                    self.log(f"✅ GitHub status endpoint working - connected: {connected}")
                    if not connected:
                        self.log("   (Expected: false - no OAuth flow completed)")
                    return True
                else:
                    self.log(f"❌ GitHub status endpoint failed: Missing 'connected' field", "ERROR")
                    return False
            else:
                self.log(f"❌ GitHub status endpoint failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GitHub status error: {str(e)}", "ERROR")
            return False
    
    def test_github_disconnect(self):
        """Test GitHub disconnect endpoint"""
        try:
            self.log("🔌 Testing GitHub disconnect endpoint...")
            response = self.session.post(f"{API_BASE}/github/disconnect", json={
                "userId": self.user_id
            })
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') == True:
                    self.log("✅ GitHub disconnect endpoint working")
                    return True
                else:
                    self.log(f"❌ GitHub disconnect endpoint failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ GitHub disconnect endpoint failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GitHub disconnect error: {str(e)}", "ERROR")
            return False
    
    def test_github_repos_without_connection(self):
        """Test GitHub repos endpoint without connection (should return 401)"""
        try:
            self.log("📂 Testing GitHub repos endpoint without connection...")
            response = self.session.get(f"{API_BASE}/github/repos", params={
                "user_id": self.user_id
            })
            
            if response.status_code == 401:
                data = response.json()
                if 'GitHub not connected' in data.get('error', ''):
                    self.log("✅ GitHub repos endpoint correctly returns 401 when not connected")
                    return True
                else:
                    self.log(f"❌ GitHub repos endpoint returned 401 but wrong error message: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ GitHub repos endpoint should return 401 but got: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GitHub repos error: {str(e)}", "ERROR")
            return False
    
    def test_github_callback_without_params(self):
        """Test GitHub callback without valid params (should redirect with error)"""
        try:
            self.log("🔄 Testing GitHub callback without valid params...")
            # Don't use session here as we want to test the redirect behavior
            response = requests.get(f"{API_BASE}/github/callback", allow_redirects=False)
            
            if response.status_code == 302:
                location = response.headers.get('Location', '')
                if 'github_error=missing_params' in location:
                    self.log("✅ GitHub callback correctly redirects with missing_params error")
                    return True
                else:
                    self.log(f"❌ GitHub callback redirected but wrong error: {location}", "ERROR")
                    return False
            else:
                self.log(f"❌ GitHub callback should return 302 redirect but got: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GitHub callback error: {str(e)}", "ERROR")
            return False
    
    def test_chat_stream_github_help(self):
        """Test chat stream with /github help command (PREVIOUSLY BROKEN - FIXED)"""
        try:
            self.log("💬 Testing chat stream with '/github help' command...")
            response = self.session.post(f"{API_BASE}/chat/stream", json={
                "content": "/github help",
                "model": "gpt-4o",
                "conversationId": "retest-github"
            })
            
            if response.status_code == 200:
                # The response is NDJSON format regardless of content-type header
                lines = response.text.strip().split('\n')
                found_github_help = False
                found_done = False
                
                for line in lines:
                    if line.strip():
                        try:
                            data = json.loads(line)
                            if data.get('type') == 'delta' and 'GitHub' in data.get('content', ''):
                                found_github_help = True
                            elif data.get('type') == 'done':
                                found_done = True
                        except json.JSONDecodeError:
                            continue
                
                if found_github_help and found_done:
                    self.log("✅ Chat stream with '/github help' working - returns NDJSON with GitHub help text")
                    return True
                else:
                    self.log(f"❌ Chat stream with '/github help' failed: Missing expected content", "ERROR")
                    self.log(f"   Found GitHub help: {found_github_help}, Found done: {found_done}")
                    return False
            else:
                self.log(f"❌ Chat stream with '/github help' failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Chat stream GitHub help error: {str(e)}", "ERROR")
            return False
    
    def test_chat_stream_github_natural_language(self):
        """Test chat stream with natural language GitHub query"""
        try:
            self.log("💬 Testing chat stream with natural language GitHub query...")
            response = self.session.post(f"{API_BASE}/chat/stream", json={
                "content": "show me my github repos",
                "model": "gpt-4o",
                "conversationId": "retest-github-nl"
            })
            
            if response.status_code == 200:
                # The response is NDJSON format regardless of content-type header
                lines = response.text.strip().split('\n')
                found_github_response = False
                found_done = False
                
                for line in lines:
                    if line.strip():
                        try:
                            data = json.loads(line)
                            if data.get('type') == 'delta':
                                content = data.get('content', '').lower()
                                if 'github' in content and ('connect' in content or 'not connected' in content):
                                    found_github_response = True
                            elif data.get('type') == 'done':
                                found_done = True
                        except json.JSONDecodeError:
                            continue
                
                if found_github_response and found_done:
                    self.log("✅ Chat stream with natural language GitHub query working - mentions connecting GitHub")
                    return True
                else:
                    self.log(f"❌ Chat stream with natural language GitHub query failed: Missing expected content", "ERROR")
                    return False
            else:
                self.log(f"❌ Chat stream with natural language GitHub query failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Chat stream natural language GitHub error: {str(e)}", "ERROR")
            return False
    
    def test_chat_stream_normal_regression(self):
        """Test normal chat still works (regression check)"""
        try:
            self.log("💬 Testing normal chat (regression check)...")
            response = self.session.post(f"{API_BASE}/chat/stream", json={
                "content": "hello, how are you?",
                "model": "gpt-4o",
                "conversationId": "retest-normal"
            })
            
            if response.status_code == 200:
                # The response is NDJSON format regardless of content-type header
                lines = response.text.strip().split('\n')
                found_response = False
                found_done = False
                found_github_interference = False
                
                for line in lines:
                    if line.strip():
                        try:
                            data = json.loads(line)
                            if data.get('type') == 'delta':
                                content = data.get('content', '').lower()
                                if content and len(content) > 5:  # Meaningful response
                                    found_response = True
                                if 'github' in content:
                                    found_github_interference = True
                            elif data.get('type') == 'done':
                                found_done = True
                        except json.JSONDecodeError:
                            continue
                
                if found_response and found_done and not found_github_interference:
                    self.log("✅ Normal chat working correctly - no GitHub interference")
                    return True
                else:
                    self.log(f"❌ Normal chat failed: Response: {found_response}, Done: {found_done}, GitHub interference: {found_github_interference}", "ERROR")
                    return False
            else:
                self.log(f"❌ Normal chat failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Normal chat error: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all GitHub OAuth integration tests"""
        self.log("🚀 Starting GitHub OAuth Integration Backend Tests")
        self.log("=" * 60)
        
        tests = [
            ("Health Check", self.test_health_check),
            ("Authentication", self.authenticate),
            ("GitHub Connect Endpoint", self.test_github_connect),
            ("GitHub Status Endpoint", self.test_github_status),
            ("GitHub Disconnect Endpoint", self.test_github_disconnect),
            ("GitHub Repos Without Connection", self.test_github_repos_without_connection),
            ("GitHub Callback Without Params", self.test_github_callback_without_params),
            ("Chat Stream - /github help (FIXED)", self.test_chat_stream_github_help),
            ("Chat Stream - Natural Language GitHub", self.test_chat_stream_github_natural_language),
            ("Chat Stream - Normal Chat (Regression)", self.test_chat_stream_normal_regression),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            self.log(f"\n📋 Running: {test_name}")
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                self.log(f"❌ {test_name} crashed: {str(e)}", "ERROR")
                failed += 1
        
        self.log("\n" + "=" * 60)
        self.log(f"🏁 GitHub OAuth Integration Tests Complete")
        self.log(f"✅ Passed: {passed}")
        self.log(f"❌ Failed: {failed}")
        self.log(f"📊 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed == 0:
            self.log("🎉 All tests passed! GitHub OAuth Integration is working correctly.")
        else:
            self.log("⚠️  Some tests failed. Check the logs above for details.")
        
        return failed == 0

def main():
    """Main test execution"""
    tester = GitHubOAuthTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()