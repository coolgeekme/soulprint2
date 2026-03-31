#!/usr/bin/env python3
"""
Backend Testing Script for SoulPrint Engine - Gemini Voice Chat Endpoints
Tests the Gemini voice chat backend endpoints:
1. POST /api/gemini/voice-sample (requires auth)
2. POST /api/gemini/live-token (requires auth)
"""

import requests
import json
import sys
import time
import base64
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://gemini-voice-fix.preview.emergentagent.com"
LOGIN_EMAIL = "testchat@example.com"
LOGIN_PASSCODE = "Test123456"

class GeminiVoiceEndpointTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def authenticate(self) -> bool:
        """Authenticate and get token"""
        try:
            print(f"\n🔐 Authenticating with {LOGIN_EMAIL}...")
            
            response = self.session.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "email": LOGIN_EMAIL,
                    "passcode": LOGIN_PASSCODE
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                if self.auth_token:
                    print(f"✅ Authentication successful")
                    return True
                else:
                    print(f"❌ No token in response: {data}")
                    return False
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False

    # ============================================================
    # VOICE SAMPLE ENDPOINT TESTS
    # ============================================================
    
    def test_voice_sample_auth_required(self):
        """Test 1: Voice sample without auth should return 401"""
        try:
            response = self.session.post(
                f"{BASE_URL}/api/gemini/voice-sample",
                json={"voice": "Puck"},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                self.log_result("Voice Sample Auth Required", True, "Correctly returns 401 without token")
            else:
                self.log_result("Voice Sample Auth Required", False, f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Voice Sample Auth Required", False, f"Exception: {str(e)}")
    
    def test_voice_sample_puck_voice(self):
        """Test 2: Voice sample with Puck voice should return valid audio"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.auth_token}"
            }
            
            print("   Generating voice sample for Puck (may take 3-4 seconds)...")
            response = self.session.post(
                f"{BASE_URL}/api/gemini/voice-sample",
                json={"voice": "Puck"},
                headers=headers,
                timeout=30  # Voice generation can take time
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ["audio", "mimeType", "voice", "cached"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Voice Sample Puck", False, f"Missing fields: {missing_fields}")
                    return
                
                # Check audio is base64 string with reasonable length
                audio_b64 = data.get("audio", "")
                if len(audio_b64) > 10000:
                    audio_valid = True
                    audio_details = f"Audio length: {len(audio_b64)} chars"
                else:
                    audio_valid = False
                    audio_details = f"Audio too short: {len(audio_b64)} chars (expected > 10000)"
                
                # Check mimeType contains "audio"
                mime_type = data.get("mimeType", "")
                mime_valid = "audio" in mime_type.lower()
                
                # Check voice matches
                voice_valid = data.get("voice") == "Puck"
                
                if audio_valid and mime_valid and voice_valid:
                    cached_status = "cached" if data.get("cached") else "fresh"
                    self.log_result("Voice Sample Puck", True, 
                                  f"Valid response - {audio_details}, mimeType: {mime_type}, voice: Puck, {cached_status}")
                else:
                    issues = []
                    if not audio_valid: issues.append(audio_details)
                    if not mime_valid: issues.append(f"Invalid mimeType: {mime_type}")
                    if not voice_valid: issues.append(f"Wrong voice: {data.get('voice')}")
                    self.log_result("Voice Sample Puck", False, f"Issues: {'; '.join(issues)}")
            else:
                self.log_result("Voice Sample Puck", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Voice Sample Puck", False, f"Exception: {str(e)}")
    
    def test_voice_sample_cached_response(self):
        """Test 3: Second request for same voice should return cached=true (faster)"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.auth_token}"
            }
            
            print("   Testing cached response for Puck voice...")
            start_time = time.time()
            response = self.session.post(
                f"{BASE_URL}/api/gemini/voice-sample",
                json={"voice": "Puck"},
                headers=headers,
                timeout=30
            )
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                cached = data.get("cached", False)
                
                if cached and response_time < 2.0:  # Cached should be fast
                    self.log_result("Voice Sample Cached", True, 
                                  f"Cached response returned in {response_time:.2f}s")
                elif cached:
                    self.log_result("Voice Sample Cached", True, 
                                  f"Cached=true but slow response: {response_time:.2f}s")
                else:
                    self.log_result("Voice Sample Cached", False, 
                                  f"Expected cached=true, got cached={cached}")
            else:
                self.log_result("Voice Sample Cached", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Voice Sample Cached", False, f"Exception: {str(e)}")
    
    def test_voice_sample_kore_voice(self):
        """Test 4: Voice sample with Kore voice should work"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.auth_token}"
            }
            
            print("   Generating voice sample for Kore...")
            response = self.session.post(
                f"{BASE_URL}/api/gemini/voice-sample",
                json={"voice": "Kore"},
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check basic structure
                if all(field in data for field in ["audio", "mimeType", "voice"]):
                    voice_correct = data.get("voice") == "Kore"
                    audio_length = len(data.get("audio", ""))
                    
                    if voice_correct and audio_length > 10000:
                        self.log_result("Voice Sample Kore", True, 
                                      f"Valid Kore voice sample, audio length: {audio_length}")
                    else:
                        issues = []
                        if not voice_correct: issues.append(f"Wrong voice: {data.get('voice')}")
                        if audio_length <= 10000: issues.append(f"Audio too short: {audio_length}")
                        self.log_result("Voice Sample Kore", False, f"Issues: {'; '.join(issues)}")
                else:
                    self.log_result("Voice Sample Kore", False, "Missing required fields in response")
            else:
                self.log_result("Voice Sample Kore", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Voice Sample Kore", False, f"Exception: {str(e)}")
    
    def test_voice_sample_invalid_voice(self):
        """Test 5: Voice sample with invalid voice should return 400"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.auth_token}"
            }
            
            response = self.session.post(
                f"{BASE_URL}/api/gemini/voice-sample",
                json={"voice": "InvalidVoice"},
                headers=headers
            )
            
            if response.status_code == 400:
                data = response.json()
                error_msg = data.get("error", "")
                if "invalid" in error_msg.lower() or "voice" in error_msg.lower():
                    self.log_result("Voice Sample Invalid Voice", True, 
                                  f"Correctly returns 400 with error: {error_msg}")
                else:
                    self.log_result("Voice Sample Invalid Voice", True, 
                                  f"Returns 400 but generic error: {error_msg}")
            else:
                self.log_result("Voice Sample Invalid Voice", False, 
                              f"Expected 400, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Voice Sample Invalid Voice", False, f"Exception: {str(e)}")

    # ============================================================
    # LIVE TOKEN ENDPOINT TESTS
    # ============================================================
    
    def test_live_token_auth_required(self):
        """Test 6: Live token without auth should return 401"""
        try:
            response = self.session.post(
                f"{BASE_URL}/api/gemini/live-token",
                json={},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                self.log_result("Live Token Auth Required", True, "Correctly returns 401 without token")
            else:
                self.log_result("Live Token Auth Required", False, f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Live Token Auth Required", False, f"Exception: {str(e)}")
    
    def test_live_token_success(self):
        """Test 7: Live token with auth should return valid credentials"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.auth_token}"
            }
            
            response = self.session.post(
                f"{BASE_URL}/api/gemini/live-token",
                json={},
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ["apiKey", "model", "wsUrl"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Live Token Success", False, f"Missing fields: {missing_fields}")
                    return
                
                # Check field values
                api_key = data.get("apiKey", "")
                model = data.get("model", "")
                ws_url = data.get("wsUrl", "")
                
                api_key_valid = len(api_key) > 0
                model_valid = model == "gemini-2.5-flash-native-audio-latest"
                ws_url_valid = "generativelanguage.googleapis.com" in ws_url
                
                if api_key_valid and model_valid and ws_url_valid:
                    self.log_result("Live Token Success", True, 
                                  f"Valid response - model: {model}, wsUrl contains googleapis.com, apiKey present")
                else:
                    issues = []
                    if not api_key_valid: issues.append("apiKey empty")
                    if not model_valid: issues.append(f"Wrong model: {model}")
                    if not ws_url_valid: issues.append(f"Invalid wsUrl: {ws_url}")
                    self.log_result("Live Token Success", False, f"Issues: {'; '.join(issues)}")
            else:
                self.log_result("Live Token Success", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Live Token Success", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all Gemini voice chat endpoint tests"""
        print("=" * 80)
        print("🎯 GEMINI VOICE CHAT BACKEND ENDPOINT TESTING")
        print("=" * 80)
        print(f"Base URL: {BASE_URL}")
        print(f"Endpoints:")
        print(f"  - POST /api/gemini/voice-sample")
        print(f"  - POST /api/gemini/live-token")
        print(f"Auth: {LOGIN_EMAIL} / {LOGIN_PASSCODE}")
        print("=" * 80)
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        print(f"\n🧪 Running Gemini Voice Chat Tests...")
        print("-" * 50)
        
        # Run voice sample tests
        print("\n📢 Voice Sample Endpoint Tests:")
        self.test_voice_sample_auth_required()
        self.test_voice_sample_puck_voice()
        self.test_voice_sample_cached_response()
        self.test_voice_sample_kore_voice()
        self.test_voice_sample_invalid_voice()
        
        # Run live token tests
        print("\n🔗 Live Token Endpoint Tests:")
        self.test_live_token_auth_required()
        self.test_live_token_success()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("\n🎉 ALL TESTS PASSED! Gemini voice chat endpoints are working correctly.")
            return True
        else:
            print(f"\n⚠️  {total - passed} test(s) failed. See details above.")
            return False

def main():
    """Main test execution"""
    tester = GeminiVoiceEndpointTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ Gemini voice chat endpoint testing completed successfully.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Please review the results above.")
        sys.exit(1)

if __name__ == "__main__":
    main()