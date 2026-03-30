#!/usr/bin/env python3
"""
Backend Testing Script for SoulPrint Engine - Realtime Voice Chat WebRTC Endpoint
Tests the POST /api/realtime/session endpoint which proxies SDP offers to OpenAI's /v1/realtime/calls
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://voice-debug-1.preview.emergentagent.com"
LOGIN_EMAIL = "test@soulprint.com"
LOGIN_PASSCODE = "test123"

# Test SDP offer (dummy WebRTC SDP for testing)
DUMMY_SDP_OFFER = """v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\na=rtcp-mux\r\na=sendrecv\r\na=mid:0\r\na=ice-ufrag:test\r\na=ice-pwd:testpassword1234567890ab\r\na=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\na=setup:actpass\r\n"""

class RealtimeEndpointTester:
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
    
    def test_auth_required(self):
        """Test 1: Authentication required - POST without token should return 401"""
        try:
            response = self.session.post(
                f"{BASE_URL}/api/realtime/session",
                json={
                    "sdp": DUMMY_SDP_OFFER,
                    "model": "gpt-realtime-1.5",
                    "voice": "alloy"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                self.log_result("Auth Required Test", True, "Correctly returns 401 without token")
            else:
                self.log_result("Auth Required Test", False, f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Auth Required Test", False, f"Exception: {str(e)}")
    
    def test_sdp_required(self):
        """Test 2: SDP required - POST with token but no SDP should return 400"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.auth_token}"
            }
            
            response = self.session.post(
                f"{BASE_URL}/api/realtime/session",
                json={
                    "model": "gpt-realtime-1.5",
                    "voice": "alloy"
                },
                headers=headers
            )
            
            if response.status_code == 400:
                data = response.json()
                if "SDP offer is required" in data.get("error", ""):
                    self.log_result("SDP Required Test", True, "Correctly returns 400 with proper error message")
                else:
                    self.log_result("SDP Required Test", False, f"Wrong error message: {data}")
            else:
                self.log_result("SDP Required Test", False, f"Expected 400, got {response.status_code}")
                
        except Exception as e:
            self.log_result("SDP Required Test", False, f"Exception: {str(e)}")
    
    def test_successful_sdp_proxy(self):
        """Test 3: Successful SDP proxy - POST with valid token and SDP should return 200 with SDP answer"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.auth_token}"
            }
            
            payload = {
                "sdp": DUMMY_SDP_OFFER,
                "model": "gpt-realtime-1.5",
                "voice": "alloy",
                "instructions": "You are a helpful assistant."
            }
            
            print("   Making request to OpenAI Realtime API via proxy...")
            response = self.session.post(
                f"{BASE_URL}/api/realtime/session",
                json=payload,
                headers=headers,
                timeout=30  # OpenAI API can be slow
            )
            
            if response.status_code == 200:
                content_type = response.headers.get("Content-Type", "")
                if content_type == "application/sdp":
                    sdp_answer = response.text
                    if sdp_answer.startswith("v=0"):
                        self.log_result("Successful SDP Proxy Test", True, 
                                      f"Returns valid SDP answer (Content-Type: {content_type}, starts with 'v=0')")
                    else:
                        self.log_result("Successful SDP Proxy Test", False, 
                                      f"SDP answer doesn't start with 'v=0': {sdp_answer[:50]}...")
                else:
                    self.log_result("Successful SDP Proxy Test", False, 
                                  f"Wrong Content-Type: {content_type}, expected 'application/sdp'")
            else:
                error_text = response.text
                self.log_result("Successful SDP Proxy Test", False, 
                              f"Expected 200, got {response.status_code}: {error_text}")
                
        except Exception as e:
            self.log_result("Successful SDP Proxy Test", False, f"Exception: {str(e)}")
    
    def test_voice_selection(self):
        """Test 4: Voice selection - Test with different voice options"""
        voices_to_test = ["alloy", "coral", "shimmer"]
        
        for voice in voices_to_test:
            try:
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.auth_token}"
                }
                
                payload = {
                    "sdp": DUMMY_SDP_OFFER,
                    "model": "gpt-realtime-1.5",
                    "voice": voice,
                    "instructions": "You are a helpful assistant."
                }
                
                print(f"   Testing voice: {voice}")
                response = self.session.post(
                    f"{BASE_URL}/api/realtime/session",
                    json=payload,
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code == 200:
                    content_type = response.headers.get("Content-Type", "")
                    if content_type == "application/sdp":
                        self.log_result(f"Voice Selection Test ({voice})", True, 
                                      f"Successfully accepts voice '{voice}'")
                    else:
                        self.log_result(f"Voice Selection Test ({voice})", False, 
                                      f"Wrong Content-Type: {content_type}")
                else:
                    self.log_result(f"Voice Selection Test ({voice})", False, 
                                  f"Failed with status {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result(f"Voice Selection Test ({voice})", False, f"Exception: {str(e)}")
    
    def test_model_parameter(self):
        """Test 5: Model parameter - Test with model 'gpt-realtime-1.5'"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.auth_token}"
            }
            
            payload = {
                "sdp": DUMMY_SDP_OFFER,
                "model": "gpt-realtime-1.5",
                "voice": "alloy",
                "instructions": "You are a helpful assistant."
            }
            
            print("   Testing model parameter: gpt-realtime-1.5")
            response = self.session.post(
                f"{BASE_URL}/api/realtime/session",
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                content_type = response.headers.get("Content-Type", "")
                if content_type == "application/sdp":
                    self.log_result("Model Parameter Test", True, 
                                  "Successfully accepts model 'gpt-realtime-1.5'")
                else:
                    self.log_result("Model Parameter Test", False, 
                                  f"Wrong Content-Type: {content_type}")
            else:
                self.log_result("Model Parameter Test", False, 
                              f"Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Model Parameter Test", False, f"Exception: {str(e)}")
    
    def test_optional_parameters(self):
        """Test 6: Optional parameters - Test with minimal payload (only SDP)"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.auth_token}"
            }
            
            payload = {
                "sdp": DUMMY_SDP_OFFER
                # No model, voice, or instructions - should use defaults
            }
            
            print("   Testing with minimal payload (only SDP)")
            response = self.session.post(
                f"{BASE_URL}/api/realtime/session",
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                content_type = response.headers.get("Content-Type", "")
                if content_type == "application/sdp":
                    self.log_result("Optional Parameters Test", True, 
                                  "Successfully works with minimal payload (defaults applied)")
                else:
                    self.log_result("Optional Parameters Test", False, 
                                  f"Wrong Content-Type: {content_type}")
            else:
                self.log_result("Optional Parameters Test", False, 
                              f"Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Optional Parameters Test", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all realtime endpoint tests"""
        print("=" * 80)
        print("🎯 REALTIME VOICE CHAT WEBRTC ENDPOINT TESTING")
        print("=" * 80)
        print(f"Base URL: {BASE_URL}")
        print(f"Endpoint: POST /api/realtime/session")
        print(f"Testing OpenAI Realtime API integration via SDP proxy")
        print("=" * 80)
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        print(f"\n🧪 Running Realtime Endpoint Tests...")
        print("-" * 50)
        
        # Run all tests
        self.test_auth_required()
        self.test_sdp_required()
        self.test_successful_sdp_proxy()
        self.test_voice_selection()
        self.test_model_parameter()
        self.test_optional_parameters()
        
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
            print("\n🎉 ALL TESTS PASSED! Realtime Voice Chat WebRTC endpoint is working correctly.")
            return True
        else:
            print(f"\n⚠️  {total - passed} test(s) failed. See details above.")
            return False

def main():
    """Main test execution"""
    tester = RealtimeEndpointTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ Realtime Voice Chat WebRTC endpoint testing completed successfully.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Please review the results above.")
        sys.exit(1)

if __name__ == "__main__":
    main()