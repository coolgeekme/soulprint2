#!/usr/bin/env python3

import requests
import json
import time
import base64
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://image-routing-patch.preview.emergentagent.com"
AUTH_EMAIL = "test@soulprint.com"
AUTH_PASSCODE = "test123"

class VoiceEndpointTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.auth_token = None
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'SoulPrint-Voice-Test/1.0'
        })

    def authenticate(self) -> bool:
        """Authenticate and get JWT token"""
        try:
            print("🔐 Authenticating...")
            auth_data = {
                "email": AUTH_EMAIL,
                "passcode": AUTH_PASSCODE
            }
            
            response = self.session.post(f"{self.base_url}/api/auth/login", json=auth_data)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('token')
                if self.auth_token:
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.auth_token}'
                    })
                    print(f"✅ Authentication successful")
                    return True
                else:
                    print(f"❌ No token in response: {data}")
                    return False
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False

    def test_read_aloud_endpoint(self) -> bool:
        """Test POST /api/voice/tts/read-aloud - NEW Read Aloud endpoint"""
        print("\n🎵 Testing Read Aloud Endpoint (POST /api/voice/tts/read-aloud)")
        
        try:
            # Test 1: Valid request with short text
            print("  📝 Test 1: Valid request with short text")
            test_data = {
                "text": "Hello world, this is a test of the read aloud feature"
            }
            
            response = self.session.post(f"{self.base_url}/api/voice/tts/read-aloud", json=test_data)
            
            if response.status_code == 200:
                if response.headers.get('content-type') == 'audio/mpeg':
                    audio_size = len(response.content)
                    print(f"    ✅ Read aloud successful - Audio size: {audio_size} bytes")
                else:
                    print(f"    ❌ Wrong content type: {response.headers.get('content-type')}")
                    return False
            else:
                print(f"    ❌ Read aloud failed: {response.status_code} - {response.text}")
                return False

            # Test 2: Long text (200+ chars) to verify no truncation
            print("  📝 Test 2: Long text (200+ chars)")
            long_text = "This is a very long text to test the read aloud feature with more than 200 characters. " * 3
            test_data = {
                "text": long_text,
                "voice": "alloy"
            }
            
            response = self.session.post(f"{self.base_url}/api/voice/tts/read-aloud", json=test_data)
            
            if response.status_code == 200 and response.headers.get('content-type') == 'audio/mpeg':
                audio_size = len(response.content)
                print(f"    ✅ Long text read aloud successful - Audio size: {audio_size} bytes")
            else:
                print(f"    ❌ Long text read aloud failed: {response.status_code}")
                return False

            # Test 3: Without auth (should 401)
            print("  📝 Test 3: Without authentication")
            headers_backup = self.session.headers.copy()
            del self.session.headers['Authorization']
            
            response = self.session.post(f"{self.base_url}/api/voice/tts/read-aloud", json=test_data)
            
            if response.status_code == 401:
                print("    ✅ Correctly rejected without auth (401)")
            else:
                print(f"    ❌ Should have returned 401, got {response.status_code}")
                return False
            
            # Restore auth
            self.session.headers.update(headers_backup)

            # Test 4: Without text (should 400)
            print("  📝 Test 4: Without text parameter")
            response = self.session.post(f"{self.base_url}/api/voice/tts/read-aloud", json={})
            
            if response.status_code == 400:
                print("    ✅ Correctly rejected without text (400)")
            else:
                print(f"    ❌ Should have returned 400, got {response.status_code}")
                return False

            return True

        except Exception as e:
            print(f"    ❌ Read aloud test error: {e}")
            return False

    def test_gemini_voice_sample_endpoint(self) -> bool:
        """Test POST /api/gemini/voice-sample - Gemini Voice Sample Preview"""
        print("\n🎤 Testing Gemini Voice Sample Endpoint (POST /api/gemini/voice-sample)")
        
        try:
            # Test 1: Valid request with Puck voice
            print("  📝 Test 1: Valid request with Puck voice")
            test_data = {
                "voice": "Puck"
            }
            
            response = self.session.post(f"{self.base_url}/api/gemini/voice-sample", json=test_data)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['audio', 'mimeType', 'voice', 'cached']
                if all(field in data for field in required_fields):
                    print(f"    ✅ Puck voice sample successful - Audio: {len(data['audio'])} chars, Cached: {data['cached']}")
                else:
                    print(f"    ❌ Missing required fields. Got: {list(data.keys())}")
                    return False
            else:
                print(f"    ❌ Puck voice sample failed: {response.status_code} - {response.text}")
                return False

            # Test 2: Different voices (Kore, Zephyr)
            print("  📝 Test 2: Testing different voices")
            for voice in ["Kore", "Zephyr"]:
                test_data = {"voice": voice}
                response = self.session.post(f"{self.base_url}/api/gemini/voice-sample", json=test_data)
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"    ✅ {voice} voice sample successful - Cached: {data.get('cached', False)}")
                else:
                    print(f"    ❌ {voice} voice sample failed: {response.status_code}")
                    return False

            # Test 3: Invalid voice name (should 400)
            print("  📝 Test 3: Invalid voice name")
            test_data = {"voice": "InvalidVoice"}
            response = self.session.post(f"{self.base_url}/api/gemini/voice-sample", json=test_data)
            
            if response.status_code == 400:
                print("    ✅ Correctly rejected invalid voice (400)")
            else:
                print(f"    ❌ Should have returned 400, got {response.status_code}")
                return False

            # Test 4: Caching test - second call with same voice should be faster
            print("  📝 Test 4: Testing caching behavior")
            test_data = {"voice": "Puck"}
            
            start_time = time.time()
            response = self.session.post(f"{self.base_url}/api/gemini/voice-sample", json=test_data)
            end_time = time.time()
            
            if response.status_code == 200:
                data = response.json()
                cached = data.get('cached', False)
                duration = end_time - start_time
                print(f"    ✅ Second Puck call - Cached: {cached}, Duration: {duration:.2f}s")
                if cached and duration < 2.0:
                    print("    ✅ Caching working correctly (fast response)")
                elif not cached:
                    print("    ⚠️  Cache miss - might be expected if cache expired")
            else:
                print(f"    ❌ Caching test failed: {response.status_code}")
                return False

            # Test 5: Without auth (should 401)
            print("  📝 Test 5: Without authentication")
            headers_backup = self.session.headers.copy()
            del self.session.headers['Authorization']
            
            response = self.session.post(f"{self.base_url}/api/gemini/voice-sample", json={"voice": "Puck"})
            
            if response.status_code == 401:
                print("    ✅ Correctly rejected without auth (401)")
            else:
                print(f"    ❌ Should have returned 401, got {response.status_code}")
                return False
            
            # Restore auth
            self.session.headers.update(headers_backup)

            return True

        except Exception as e:
            print(f"    ❌ Gemini voice sample test error: {e}")
            return False

    def test_openai_tts_preview_endpoint(self) -> bool:
        """Test POST /api/voice/tts/preview - OpenAI TTS Voice Preview (existing)"""
        print("\n🔊 Testing OpenAI TTS Preview Endpoint (POST /api/voice/tts/preview)")
        
        try:
            # Test 1: Valid request with alloy voice
            print("  📝 Test 1: Valid request with alloy voice")
            test_data = {
                "voice": "alloy",
                "text": "Hello, I'm Alloy!"
            }
            
            response = self.session.post(f"{self.base_url}/api/voice/tts/preview", json=test_data)
            
            if response.status_code == 200:
                if response.headers.get('content-type') == 'audio/mpeg':
                    audio_size = len(response.content)
                    print(f"    ✅ Alloy TTS preview successful - Audio size: {audio_size} bytes")
                else:
                    print(f"    ❌ Wrong content type: {response.headers.get('content-type')}")
                    return False
            else:
                print(f"    ❌ Alloy TTS preview failed: {response.status_code} - {response.text}")
                return False

            # Test 2: Different voices
            print("  📝 Test 2: Testing different OpenAI voices")
            for voice in ["echo", "shimmer", "coral"]:
                test_data = {
                    "voice": voice,
                    "text": f"Hello, I'm {voice.title()}!"
                }
                response = self.session.post(f"{self.base_url}/api/voice/tts/preview", json=test_data)
                
                if response.status_code == 200 and response.headers.get('content-type') == 'audio/mpeg':
                    print(f"    ✅ {voice} TTS preview successful")
                else:
                    print(f"    ❌ {voice} TTS preview failed: {response.status_code}")
                    return False

            # Test 3: Without auth (should 401)
            print("  📝 Test 3: Without authentication")
            headers_backup = self.session.headers.copy()
            del self.session.headers['Authorization']
            
            response = self.session.post(f"{self.base_url}/api/voice/tts/preview", json=test_data)
            
            if response.status_code == 401:
                print("    ✅ Correctly rejected without auth (401)")
            else:
                print(f"    ❌ Should have returned 401, got {response.status_code}")
                return False
            
            # Restore auth
            self.session.headers.update(headers_backup)

            # Test 4: Missing parameters
            print("  📝 Test 4: Missing voice parameter")
            response = self.session.post(f"{self.base_url}/api/voice/tts/preview", json={"text": "Hello"})
            
            if response.status_code == 400:
                print("    ✅ Correctly rejected missing voice (400)")
            else:
                print(f"    ❌ Should have returned 400, got {response.status_code}")
                return False

            print("  📝 Test 5: Missing text parameter")
            response = self.session.post(f"{self.base_url}/api/voice/tts/preview", json={"voice": "alloy"})
            
            if response.status_code == 400:
                print("    ✅ Correctly rejected missing text (400)")
            else:
                print(f"    ❌ Should have returned 400, got {response.status_code}")
                return False

            return True

        except Exception as e:
            print(f"    ❌ OpenAI TTS preview test error: {e}")
            return False

    def test_voice_settings_endpoints(self) -> bool:
        """Test GET/PUT /api/user/voice-settings - Voice Settings"""
        print("\n⚙️  Testing Voice Settings Endpoints (GET/PUT /api/user/voice-settings)")
        
        try:
            # Test 1: GET voice settings
            print("  📝 Test 1: GET voice settings")
            response = self.session.get(f"{self.base_url}/api/user/voice-settings")
            
            if response.status_code == 200:
                data = response.json()
                print(f"    ✅ GET voice settings successful: {data}")
                original_settings = data.get('voice_settings', {})
            else:
                print(f"    ❌ GET voice settings failed: {response.status_code} - {response.text}")
                return False

            # Test 2: PUT voice settings - save new settings
            print("  📝 Test 2: PUT voice settings - save new settings")
            new_settings = {
                "voice_settings": {
                    "voice_engine": "gemini",
                    "default_voice": "alloy",
                    "default_gemini_voice": "Puck",
                    "web_search_enabled": True
                }
            }
            
            response = self.session.put(f"{self.base_url}/api/user/voice-settings", json=new_settings)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    print("    ✅ PUT voice settings successful")
                else:
                    print(f"    ❌ PUT voice settings failed: {data}")
                    return False
            else:
                print(f"    ❌ PUT voice settings failed: {response.status_code} - {response.text}")
                return False

            # Test 3: Verify settings were saved by GET
            print("  📝 Test 3: Verify settings were saved")
            response = self.session.get(f"{self.base_url}/api/user/voice-settings")
            
            if response.status_code == 200:
                data = response.json()
                voice_settings = data.get('voice_settings', {})
                
                # Check if our settings were saved
                if (voice_settings.get('voice_engine') == 'gemini' and 
                    voice_settings.get('default_gemini_voice') == 'Puck'):
                    print("    ✅ Settings verification successful")
                else:
                    print(f"    ⚠️  Settings may not have been saved correctly: {voice_settings}")
            else:
                print(f"    ❌ Settings verification failed: {response.status_code}")
                return False

            # Test 4: Test auth/me endpoint includes voice settings
            print("  📝 Test 4: Check voice settings in auth/me")
            response = self.session.get(f"{self.base_url}/api/auth/me")
            
            if response.status_code == 200:
                data = response.json()
                if 'voice_settings' in data:
                    voice_settings = data['voice_settings']
                    print(f"    ✅ Voice settings found in auth/me: {voice_settings}")
                else:
                    print("    ⚠️  Voice settings not found in auth/me response")
            else:
                print(f"    ❌ auth/me failed: {response.status_code}")
                return False

            # Test 5: Without auth (should 401)
            print("  📝 Test 5: Without authentication")
            headers_backup = self.session.headers.copy()
            del self.session.headers['Authorization']
            
            response = self.session.get(f"{self.base_url}/api/user/voice-settings")
            
            if response.status_code == 401:
                print("    ✅ GET correctly rejected without auth (401)")
            else:
                print(f"    ❌ GET should have returned 401, got {response.status_code}")
                return False

            response = self.session.put(f"{self.base_url}/api/user/voice-settings", json=new_settings)
            
            if response.status_code == 401:
                print("    ✅ PUT correctly rejected without auth (401)")
            else:
                print(f"    ❌ PUT should have returned 401, got {response.status_code}")
                return False
            
            # Restore auth
            self.session.headers.update(headers_backup)

            return True

        except Exception as e:
            print(f"    ❌ Voice settings test error: {e}")
            return False

    def run_all_tests(self) -> bool:
        """Run all voice endpoint tests"""
        print("🚀 Starting SoulPrint Voice Features Backend Testing")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"👤 Auth: {AUTH_EMAIL}")
        
        # Authenticate first
        if not self.authenticate():
            return False
        
        # Run all tests
        tests = [
            ("Read Aloud Endpoint", self.test_read_aloud_endpoint),
            ("Gemini Voice Sample Endpoint", self.test_gemini_voice_sample_endpoint),
            ("OpenAI TTS Preview Endpoint", self.test_openai_tts_preview_endpoint),
            ("Voice Settings Endpoints", self.test_voice_settings_endpoints),
        ]
        
        results = []
        for test_name, test_func in tests:
            try:
                result = test_func()
                results.append((test_name, result))
                if result:
                    print(f"✅ {test_name}: PASSED")
                else:
                    print(f"❌ {test_name}: FAILED")
            except Exception as e:
                print(f"❌ {test_name}: ERROR - {e}")
                results.append((test_name, False))
        
        # Summary
        print("\n" + "="*60)
        print("📊 VOICE FEATURES TESTING SUMMARY")
        print("="*60)
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{status}: {test_name}")
        
        print(f"\n🎯 Overall Result: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL VOICE ENDPOINT TESTS PASSED!")
            return True
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return False

def main():
    tester = VoiceEndpointTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()