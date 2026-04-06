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

    def test_user_settings_api(self):
        """Test User Settings API (Quick Generate toggle) - GET/PATCH /api/user/settings"""
        print("\n⚙️ Testing User Settings API (Quick Generate)...")
        headers = self.get_auth_headers()
        
        # Test GET /api/user/settings - should return { quick_generate: false } (default)
        print("  📖 Testing GET /api/user/settings...")
        success, response, status_code = self.make_request("GET", "user/settings", headers=headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict):
                    quick_generate = data.get("quick_generate", False)
                    self.log_test("User Settings GET", True, f"Settings received, quick_generate: {quick_generate}")
                else:
                    self.log_test("User Settings GET", False, f"Unexpected format: {data}")
            except Exception as e:
                self.log_test("User Settings GET", False, f"JSON parse error: {e}")
        else:
            self.log_test("User Settings GET", False, f"Status {status_code}: {response}")
        
        # Test PATCH /api/user/settings with { quick_generate: true }
        print("  ✏️ Testing PATCH /api/user/settings (enable quick_generate)...")
        patch_data = {"quick_generate": True}
        success, response, status_code = self.make_patch_request("user/settings", patch_data, headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if data.get("success"):
                    self.log_test("User Settings PATCH (enable)", True, "quick_generate enabled successfully")
                else:
                    self.log_test("User Settings PATCH (enable)", False, f"Update failed: {data}")
            except Exception as e:
                self.log_test("User Settings PATCH (enable)", False, f"JSON parse error: {e}")
        else:
            self.log_test("User Settings PATCH (enable)", False, f"Status {status_code}: {response}")
        
        # Verify the setting was updated
        print("  🔍 Verifying quick_generate was enabled...")
        success, response, status_code = self.make_request("GET", "user/settings", headers=headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                quick_generate = data.get("quick_generate", False)
                if quick_generate:
                    self.log_test("User Settings Verify (enabled)", True, f"quick_generate is now: {quick_generate}")
                else:
                    self.log_test("User Settings Verify (enabled)", False, f"quick_generate not enabled: {quick_generate}")
            except Exception as e:
                self.log_test("User Settings Verify (enabled)", False, f"JSON parse error: {e}")
        else:
            self.log_test("User Settings Verify (enabled)", False, f"Status {status_code}: {response}")
        
        # Test PATCH /api/user/settings with { quick_generate: false } - reset it
        print("  🔄 Testing PATCH /api/user/settings (disable quick_generate)...")
        patch_data = {"quick_generate": False}
        success, response, status_code = self.make_patch_request("user/settings", patch_data, headers)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if data.get("success"):
                    self.log_test("User Settings PATCH (disable)", True, "quick_generate disabled successfully")
                else:
                    self.log_test("User Settings PATCH (disable)", False, f"Update failed: {data}")
            except Exception as e:
                self.log_test("User Settings PATCH (disable)", False, f"JSON parse error: {e}")
        else:
            self.log_test("User Settings PATCH (disable)", False, f"Status {status_code}: {response}")

    def make_patch_request(self, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple:
        """Make PATCH request and return (success, response, status_code)"""
        try:
            url = f"{self.base_url}/api/{endpoint}"
            req_headers = {"Content-Type": "application/json"}
            if headers:
                req_headers.update(headers)
                
            response = self.session.patch(url, json=data, headers=req_headers)
            return True, response, response.status_code
        except Exception as e:
            return False, str(e), 0

    def parse_ndjson_stream(self, response_text: str) -> list:
        """Parse NDJSON stream response"""
        lines = []
        for line in response_text.strip().split('\n'):
            line = line.strip()
            if line:
                try:
                    # Handle SSE format (data: {...}) or plain NDJSON
                    if line.startswith('data: '):
                        json_str = line[6:]  # Remove 'data: ' prefix
                    else:
                        json_str = line
                    
                    if json_str and json_str != '[DONE]':
                        parsed = json.loads(json_str)
                        lines.append(parsed)
                except json.JSONDecodeError:
                    continue
        return lines

    def test_media_confirmation_flow(self):
        """Test Chat Stream - Media Confirmation Flow"""
        print("\n🎨 Testing Media Confirmation Flow...")
        headers = self.get_auth_headers()
        headers["Content-Type"] = "application/json"
        
        # First ensure quick_generate is disabled
        print("  🔧 Ensuring quick_generate is disabled...")
        patch_data = {"quick_generate": False}
        self.make_patch_request("user/settings", patch_data, headers)
        
        # Test with image-triggering message
        print("  🖼️ Testing image generation request (should trigger confirmation)...")
        test_data = {
            "message": "generate an image of a sunset over the ocean",
            "model": "gpt-4o"
        }
        
        try:
            url = f"{self.base_url}/api/chat/stream"
            response = self.session.post(url, json=test_data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                response_text = response.text
                parsed_lines = self.parse_ndjson_stream(response_text)
                
                # Look for media_confirmation type
                media_confirmation_found = False
                detected_text_found = False
                done_found = False
                
                for line in parsed_lines:
                    if line.get("type") == "media_confirmation":
                        media_confirmation_found = True
                        required_fields = ["detectedType", "originalPrompt", "refinedPrompt", "availableModels", "recommendedModel"]
                        missing_fields = [field for field in required_fields if field not in line]
                        
                        if not missing_fields:
                            self.log_test("Media Confirmation Structure", True, f"All required fields present: {required_fields}")
                            
                            # Check specific values
                            if line.get("detectedType") == "image":
                                self.log_test("Media Confirmation Type", True, f"detectedType: {line.get('detectedType')}")
                            else:
                                self.log_test("Media Confirmation Type", False, f"Expected 'image', got: {line.get('detectedType')}")
                                
                            if line.get("recommendedModel") == "smart":
                                self.log_test("Media Confirmation Model", True, f"recommendedModel: {line.get('recommendedModel')}")
                            else:
                                self.log_test("Media Confirmation Model", False, f"Expected 'smart', got: {line.get('recommendedModel')}")
                        else:
                            self.log_test("Media Confirmation Structure", False, f"Missing fields: {missing_fields}")
                    
                    elif line.get("type") == "delta" and "detected" in line.get("content", "").lower():
                        detected_text_found = True
                        self.log_test("Media Confirmation Text", True, f"Detection message: {line.get('content', '')[:50]}...")
                    
                    elif line.get("type") == "done":
                        done_found = True
                
                if media_confirmation_found:
                    self.log_test("Media Confirmation Flow", True, "media_confirmation type found in stream")
                else:
                    self.log_test("Media Confirmation Flow", False, "media_confirmation type not found in stream")
                
                if detected_text_found:
                    self.log_test("Media Detection Message", True, "Detection message found")
                else:
                    self.log_test("Media Detection Message", False, "Detection message not found")
                
                if done_found:
                    self.log_test("Media Confirmation End", True, "Stream ended with done type")
                else:
                    self.log_test("Media Confirmation End", False, "Stream did not end with done type")
                    
            else:
                try:
                    error_data = response.json()
                    self.log_test("Media Confirmation Flow", False, f"Status {response.status_code}: {error_data}")
                except:
                    self.log_test("Media Confirmation Flow", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Media Confirmation Flow", False, f"Request error: {e}")

    def test_quick_generate_flow(self):
        """Test Chat Stream - Confirmed MediaFlow (Quick Generate test)"""
        print("\n⚡ Testing Quick Generate Flow...")
        headers = self.get_auth_headers()
        headers["Content-Type"] = "application/json"
        
        # First enable quick_generate
        print("  🔧 Enabling quick_generate...")
        patch_data = {"quick_generate": True}
        success, response, status_code = self.make_patch_request("user/settings", patch_data, headers)
        
        if not (success and status_code == 200):
            self.log_test("Quick Generate Setup", False, "Failed to enable quick_generate")
            return
        
        # Test with image-triggering message - should skip confirmation
        print("  🚀 Testing image generation with quick_generate enabled...")
        test_data = {
            "message": "generate an image of a mountain landscape",
            "model": "gpt-4o"
        }
        
        try:
            url = f"{self.base_url}/api/chat/stream"
            response = self.session.post(url, json=test_data, headers=headers, timeout=45)
            
            if response.status_code == 200:
                response_text = response.text
                parsed_lines = self.parse_ndjson_stream(response_text)
                
                # Look for generation types (should skip confirmation)
                media_confirmation_found = False
                generating_visual_found = False
                image_result_found = False
                
                for line in parsed_lines:
                    if line.get("type") == "media_confirmation":
                        media_confirmation_found = True
                    elif line.get("type") == "generating_visual":
                        generating_visual_found = True
                        self.log_test("Quick Generate Visual", True, f"generating_visual type found")
                    elif line.get("type") == "image_result" or line.get("type") == "image":
                        image_result_found = True
                        self.log_test("Quick Generate Result", True, f"Image result type found")
                
                if media_confirmation_found:
                    self.log_test("Quick Generate Skip", False, "media_confirmation found - should have been skipped")
                else:
                    self.log_test("Quick Generate Skip", True, "media_confirmation correctly skipped")
                
                if generating_visual_found or image_result_found:
                    self.log_test("Quick Generate Flow", True, "Direct generation flow detected")
                else:
                    self.log_test("Quick Generate Flow", False, "No generation flow detected")
                    
            else:
                try:
                    error_data = response.json()
                    self.log_test("Quick Generate Flow", False, f"Status {response.status_code}: {error_data}")
                except:
                    self.log_test("Quick Generate Flow", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Quick Generate Flow", False, f"Request error: {e}")
        
        # Reset quick_generate to false
        print("  🔄 Resetting quick_generate to false...")
        patch_data = {"quick_generate": False}
        self.make_patch_request("user/settings", patch_data, headers)

    def test_mediaflow_confirmed_payload(self):
        """Test Chat Stream - MediaFlow Confirmed Payload"""
        print("\n✅ Testing MediaFlow Confirmed Payload...")
        headers = self.get_auth_headers()
        headers["Content-Type"] = "application/json"
        
        # Test with confirmed mediaFlow payload
        test_data = {
            "message": "generate a sunset image",
            "mediaFlow": {
                "step": "confirmed",
                "type": "image",
                "finalPrompt": "A beautiful golden sunset",
                "selectedModel": "nano-banana"
            }
        }
        
        try:
            url = f"{self.base_url}/api/chat/stream"
            response = self.session.post(url, json=test_data, headers=headers, timeout=45)
            
            if response.status_code == 200:
                response_text = response.text
                parsed_lines = self.parse_ndjson_stream(response_text)
                
                # Should skip confirmation and proceed directly to generation
                media_confirmation_found = False
                generating_visual_found = False
                
                for line in parsed_lines:
                    if line.get("type") == "media_confirmation":
                        media_confirmation_found = True
                    elif line.get("type") == "generating_visual":
                        generating_visual_found = True
                        self.log_test("MediaFlow Confirmed Generation", True, "generating_visual type found")
                
                if media_confirmation_found:
                    self.log_test("MediaFlow Confirmed Skip", False, "media_confirmation found - should have been skipped")
                else:
                    self.log_test("MediaFlow Confirmed Skip", True, "media_confirmation correctly skipped")
                
                if generating_visual_found:
                    self.log_test("MediaFlow Confirmed Payload", True, "Direct generation flow with confirmed payload")
                else:
                    self.log_test("MediaFlow Confirmed Payload", False, "No generation flow detected")
                    
            else:
                try:
                    error_data = response.json()
                    self.log_test("MediaFlow Confirmed Payload", False, f"Status {response.status_code}: {error_data}")
                except:
                    self.log_test("MediaFlow Confirmed Payload", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("MediaFlow Confirmed Payload", False, f"Request error: {e}")

    def test_mediaflow_chat_fallback(self):
        """Test Chat Stream - MediaFlow Chat Fallback"""
        print("\n💬 Testing MediaFlow Chat Fallback...")
        headers = self.get_auth_headers()
        headers["Content-Type"] = "application/json"
        
        # Test with chat fallback mediaFlow payload
        test_data = {
            "message": "generate a sunset image",
            "mediaFlow": {
                "step": "confirmed",
                "type": "chat"
            }
        }
        
        try:
            url = f"{self.base_url}/api/chat/stream"
            response = self.session.post(url, json=test_data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                response_text = response.text
                parsed_lines = self.parse_ndjson_stream(response_text)
                
                # Should produce normal text response (deltas), NOT media_confirmation or image generation
                media_confirmation_found = False
                generating_visual_found = False
                delta_found = False
                
                for line in parsed_lines:
                    if line.get("type") == "media_confirmation":
                        media_confirmation_found = True
                    elif line.get("type") == "generating_visual":
                        generating_visual_found = True
                    elif line.get("type") == "delta":
                        delta_found = True
                
                if media_confirmation_found:
                    self.log_test("MediaFlow Chat No Confirmation", False, "media_confirmation found - should not be present")
                else:
                    self.log_test("MediaFlow Chat No Confirmation", True, "media_confirmation correctly absent")
                
                if generating_visual_found:
                    self.log_test("MediaFlow Chat No Generation", False, "generating_visual found - should not be present")
                else:
                    self.log_test("MediaFlow Chat No Generation", True, "generating_visual correctly absent")
                
                if delta_found:
                    self.log_test("MediaFlow Chat Fallback", True, "Normal text response (deltas) produced")
                else:
                    self.log_test("MediaFlow Chat Fallback", False, "No text response deltas found")
                    
            else:
                try:
                    error_data = response.json()
                    self.log_test("MediaFlow Chat Fallback", False, f"Status {response.status_code}: {error_data}")
                except:
                    self.log_test("MediaFlow Chat Fallback", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("MediaFlow Chat Fallback", False, f"Request error: {e}")
    
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
        
        # Test Media Generation Confirmation Flow features
        print("\n" + "="*60)
        print("🎨 MEDIA GENERATION CONFIRMATION FLOW TESTS")
        print("="*60)
        self.test_user_settings_api()
        self.test_media_confirmation_flow()
        self.test_quick_generate_flow()
        self.test_mediaflow_confirmed_payload()
        self.test_mediaflow_chat_fallback()
        
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