#!/usr/bin/env python3

"""
Backend API Testing Suite - Voice Chat Feature Testing
Tests the 5 new Voice Chat APIs as requested in review.
"""

import requests
import json
import os
import time
from datetime import datetime

# Configuration
BASE_URL = "https://voice-chat-metrics.preview.emergentagent.com/api"
TEST_EMAIL = "test@soulprint.com"  
TEST_PASSWORD = "test123"

class VoiceChatAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.admin_token = None
        self.session_id = None
        
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def test_authentication(self):
        """Test 1: Authentication - Login to get token"""
        try:
            self.log("🔐 Testing Authentication...")
            
            response = self.session.post(f"{BASE_URL}/auth/login", 
                json={"email": TEST_EMAIL, "passcode": TEST_PASSWORD})
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                self.admin_token = self.token  # test@soulprint.com should be superadmin
                
                # Set authorization header for future requests
                self.session.headers.update({
                    'Authorization': f'Bearer {self.token}',
                    'Content-Type': 'application/json'
                })
                
                self.log(f"✅ LOGIN SUCCESS: Token obtained, Role: {data.get('role', 'unknown')}")
                return True
            else:
                error_msg = response.json().get('error', 'Unknown error') if response.content else f"HTTP {response.status_code}"
                self.log(f"❌ LOGIN FAILED: {error_msg}")
                return False
                
        except Exception as e:
            self.log(f"❌ LOGIN ERROR: {str(e)}")
            return False
    
    def test_tts_preview_api(self):
        """Test 2: TTS Voice Preview API (POST /api/tts/preview)"""
        try:
            self.log("🎤 Testing TTS Voice Preview API...")
            
            # Test different voices as specified
            test_voices = ["alloy", "echo", "shimmer"]
            
            for voice in test_voices:
                test_data = {
                    "voice": voice,
                    "text": "Hello, this is a voice preview."
                }
                
                response = self.session.post(f"{BASE_URL}/tts/preview", json=test_data)
                
                if response.status_code == 200:
                    # Should return audio/mpeg binary data
                    content_type = response.headers.get('Content-Type', '')
                    content_length = len(response.content)
                    
                    if 'audio/mpeg' in content_type and content_length > 0:
                        self.log(f"✅ TTS PREVIEW SUCCESS: Voice '{voice}' - {content_length} bytes audio data")
                    else:
                        self.log(f"⚠️  TTS PREVIEW WARNING: Voice '{voice}' - Unexpected content type: {content_type}, Length: {content_length}")
                else:
                    error_msg = response.json().get('error', 'Unknown error') if response.content else f"HTTP {response.status_code}"
                    self.log(f"❌ TTS PREVIEW FAILED: Voice '{voice}' - {error_msg}")
                    return False
            
            return True
            
        except Exception as e:
            self.log(f"❌ TTS PREVIEW ERROR: {str(e)}")
            return False
    
    def test_voice_session_create_api(self):
        """Test 3: Voice Session Create API (POST /api/voice-sessions)"""
        try:
            self.log("📞 Testing Voice Session Create API...")
            
            test_data = {
                "voice": "alloy",
                "mode": "vad", 
                "web_search_enabled": True
            }
            
            response = self.session.post(f"{BASE_URL}/voice-sessions", json=test_data)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('success') and data.get('session_id'):
                    self.session_id = data['session_id']
                    self.log(f"✅ VOICE SESSION CREATE SUCCESS: Session ID: {self.session_id}")
                    return True
                else:
                    self.log(f"❌ VOICE SESSION CREATE FAILED: Invalid response format - {data}")
                    return False
            else:
                error_msg = response.json().get('error', 'Unknown error') if response.content else f"HTTP {response.status_code}"
                self.log(f"❌ VOICE SESSION CREATE FAILED: {error_msg}")
                return False
                
        except Exception as e:
            self.log(f"❌ VOICE SESSION CREATE ERROR: {str(e)}")
            return False
    
    def test_voice_session_update_api(self):
        """Test 4: Voice Session Update API (PATCH /api/voice-sessions/:id)"""
        try:
            self.log("📝 Testing Voice Session Update API...")
            
            if not self.session_id:
                self.log("❌ VOICE SESSION UPDATE FAILED: No session ID from create test")
                return False
            
            test_data = {
                "status": "completed",
                "duration_seconds": 120,
                "message_count": 10,
                "transcript_preview": "Test transcript"
            }
            
            response = self.session.patch(f"{BASE_URL}/voice-sessions/{self.session_id}", json=test_data)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('success'):
                    self.log(f"✅ VOICE SESSION UPDATE SUCCESS: Session {self.session_id} updated")
                    return True
                else:
                    self.log(f"❌ VOICE SESSION UPDATE FAILED: Invalid response format - {data}")
                    return False
            else:
                error_msg = response.json().get('error', 'Unknown error') if response.content else f"HTTP {response.status_code}"
                self.log(f"❌ VOICE SESSION UPDATE FAILED: {error_msg}")
                return False
                
        except Exception as e:
            self.log(f"❌ VOICE SESSION UPDATE ERROR: {str(e)}")
            return False
    
    def test_web_search_api(self):
        """Test 5: Web Search API (POST /api/web-search)"""
        try:
            self.log("🔍 Testing Web Search API...")
            
            test_data = {
                "query": "current weather in New York",
                "limit": 3
            }
            
            response = self.session.post(f"{BASE_URL}/web-search", json=test_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Should have results array and query field
                if 'results' in data and 'query' in data:
                    results_count = len(data['results'])
                    self.log(f"✅ WEB SEARCH SUCCESS: {results_count} results for query '{data['query']}'")
                    
                    # Log first result as example
                    if results_count > 0:
                        first_result = data['results'][0]
                        self.log(f"   Sample result: {first_result.get('title', 'No title')[:50]}...")
                    
                    return True
                else:
                    self.log(f"❌ WEB SEARCH FAILED: Invalid response format - {data}")
                    return False
            else:
                error_msg = response.json().get('error', 'Unknown error') if response.content else f"HTTP {response.status_code}"
                self.log(f"❌ WEB SEARCH FAILED: {error_msg}")
                return False
                
        except Exception as e:
            self.log(f"❌ WEB SEARCH ERROR: {str(e)}")
            return False
    
    def test_admin_voice_sessions_api(self):
        """Test 6: Admin Voice Sessions (GET /api/admin/voice-sessions)"""
        try:
            self.log("👑 Testing Admin Voice Sessions API...")
            
            response = self.session.get(f"{BASE_URL}/admin/voice-sessions")
            
            if response.status_code == 200:
                data = response.json()
                
                # Should have sessions array, total, page, limit, and stats
                expected_fields = ['sessions', 'total', 'page', 'limit', 'stats']
                if all(field in data for field in expected_fields):
                    sessions_count = len(data['sessions'])
                    total_sessions = data['total']
                    stats = data['stats']
                    
                    self.log(f"✅ ADMIN VOICE SESSIONS SUCCESS: {sessions_count} sessions returned, {total_sessions} total")
                    self.log(f"   Stats: {stats.get('total_sessions', 0)} total, {stats.get('completed_count', 0)} completed")
                    
                    # Verify our test session appears
                    if self.session_id:
                        session_found = any(session.get('id') == self.session_id for session in data['sessions'])
                        if session_found:
                            self.log(f"✅ TEST SESSION VERIFIED: Session {self.session_id} found in admin list")
                        else:
                            self.log(f"⚠️  TEST SESSION NOT FOUND: Session {self.session_id} not in admin list (may be pagination)")
                    
                    return True
                else:
                    missing_fields = [f for f in expected_fields if f not in data]
                    self.log(f"❌ ADMIN VOICE SESSIONS FAILED: Missing fields: {missing_fields}")
                    return False
            else:
                error_msg = response.json().get('error', 'Unknown error') if response.content else f"HTTP {response.status_code}"
                self.log(f"❌ ADMIN VOICE SESSIONS FAILED: {error_msg}")
                return False
                
        except Exception as e:
            self.log(f"❌ ADMIN VOICE SESSIONS ERROR: {str(e)}")
            return False
    
    def test_admin_metrics_voice_chat(self):
        """Test 7: Admin Metrics Voice Chat (GET /api/admin/metrics)"""
        try:
            self.log("📊 Testing Admin Metrics Voice Chat...")
            
            response = self.session.get(f"{BASE_URL}/admin/metrics")
            
            if response.status_code == 200:
                data = response.json()
                
                # Should include voice_chat object with metrics
                if 'voice_chat' in data:
                    voice_metrics = data['voice_chat']
                    
                    # Check expected voice_chat fields
                    expected_fields = ['total_sessions', 'sessions_7d', 'sessions_30d', 'completed_sessions', 
                                     'unique_users', 'total_duration_seconds', 'avg_duration_seconds', 
                                     'total_voice_messages', 'avg_messages_per_session', 'voice_distribution']
                    
                    missing_fields = [f for f in expected_fields if f not in voice_metrics]
                    
                    if not missing_fields:
                        self.log(f"✅ ADMIN METRICS VOICE CHAT SUCCESS: All voice_chat metrics present")
                        self.log(f"   Voice metrics: {voice_metrics.get('total_sessions', 0)} sessions, {voice_metrics.get('unique_users', 0)} users")
                        return True
                    else:
                        self.log(f"❌ ADMIN METRICS VOICE CHAT FAILED: Missing voice_chat fields: {missing_fields}")
                        return False
                else:
                    self.log(f"❌ ADMIN METRICS VOICE CHAT FAILED: No voice_chat object in response")
                    return False
            else:
                error_msg = response.json().get('error', 'Unknown error') if response.content else f"HTTP {response.status_code}"
                self.log(f"❌ ADMIN METRICS VOICE CHAT FAILED: {error_msg}")
                return False
                
        except Exception as e:
            self.log(f"❌ ADMIN METRICS VOICE CHAT ERROR: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all Voice Chat API tests"""
        self.log("🚀 Starting Voice Chat API Testing Suite...")
        self.log(f"   Base URL: {BASE_URL}")
        self.log(f"   Test User: {TEST_EMAIL}")
        
        test_results = []
        
        # Test 1: Authentication
        result = self.test_authentication()
        test_results.append(("Authentication", result))
        if not result:
            self.log("❌ CRITICAL: Cannot proceed without authentication")
            return test_results
        
        # Test 2: TTS Voice Preview API  
        result = self.test_tts_preview_api()
        test_results.append(("TTS Voice Preview API", result))
        
        # Test 3: Voice Session Create API
        result = self.test_voice_session_create_api()
        test_results.append(("Voice Session Create API", result))
        
        # Test 4: Voice Session Update API
        result = self.test_voice_session_update_api()
        test_results.append(("Voice Session Update API", result))
        
        # Test 5: Web Search API
        result = self.test_web_search_api()
        test_results.append(("Web Search API", result))
        
        # Test 6: Admin Voice Sessions API
        result = self.test_admin_voice_sessions_api()
        test_results.append(("Admin Voice Sessions API", result))
        
        # Test 7: Admin Metrics Voice Chat
        result = self.test_admin_metrics_voice_chat()
        test_results.append(("Admin Metrics Voice Chat", result))
        
        # Summary
        self.log("\n" + "="*60)
        self.log("📋 VOICE CHAT API TESTING SUMMARY")
        self.log("="*60)
        
        passed_count = 0
        for test_name, passed in test_results:
            status = "✅ PASS" if passed else "❌ FAIL"
            self.log(f"{status}: {test_name}")
            if passed:
                passed_count += 1
        
        total_tests = len(test_results)
        success_rate = (passed_count / total_tests) * 100
        
        self.log("="*60)
        self.log(f"📊 RESULTS: {passed_count}/{total_tests} tests passed ({success_rate:.1f}% success rate)")
        
        if passed_count == total_tests:
            self.log("🎉 ALL VOICE CHAT APIS WORKING PERFECTLY!")
        else:
            failed_tests = [name for name, passed in test_results if not passed]
            self.log(f"⚠️  FAILED TESTS: {', '.join(failed_tests)}")
        
        return test_results

if __name__ == "__main__":
    tester = VoiceChatAPITester()
    tester.run_all_tests()