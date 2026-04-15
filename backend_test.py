#!/usr/bin/env python3
"""
Backend Testing Script for SoulPrint Engine - Media Create Mode Toggle Feature
Tests the mediaGenMode functionality in POST /api/chat/stream
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
LOGIN_EMAIL = "testchat@example.com"
LOGIN_PASSWORD = "Test123456"

class MediaCreateModeTest:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'SoulPrint-Backend-Test/1.0'
        })

    def authenticate(self):
        """Authenticate and get JWT token"""
        try:
            print("🔐 Authenticating...")
            response = self.session.post(f"{self.base_url}/api/auth/login", json={
                "email": LOGIN_EMAIL,
                "passcode": LOGIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                if self.token:
                    self.session.headers.update({'Authorization': f'Bearer {self.token}'})
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

    def parse_ndjson_stream(self, response_text):
        """Parse NDJSON stream response"""
        events = []
        lines = response_text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if line:
                try:
                    event = json.loads(line)
                    events.append(event)
                except json.JSONDecodeError as e:
                    print(f"⚠️ Failed to parse line: {line} - Error: {e}")
        
        return events

    def send_chat_message(self, content, media_gen_mode=False, conversation_id=None):
        """Send a chat message with specified mediaGenMode"""
        try:
            payload = {
                "conversationId": conversation_id,
                "content": content,
                "model": "claude-sonnet-4-5-20250929",
                "provider": "anthropic",
                "mediaGenMode": media_gen_mode
            }
            
            print(f"📤 Sending: '{content}' with mediaGenMode={media_gen_mode}")
            
            response = self.session.post(f"{self.base_url}/api/chat/stream", json=payload)
            
            if response.status_code == 200:
                events = self.parse_ndjson_stream(response.text)
                return True, events
            else:
                print(f"❌ Chat request failed: {response.status_code} - {response.text}")
                return False, []
                
        except Exception as e:
            print(f"❌ Chat request error: {e}")
            return False, []

    def test_media_gen_mode_off_image(self):
        """Test Case 1: mediaGenMode OFF (default) — should ask for confirmation for image"""
        print("\n" + "="*80)
        print("🧪 TEST CASE 1: mediaGenMode OFF - Image Generation Request")
        print("Expected: media_confirmation event AND delta event with confirmation message")
        print("="*80)
        
        success, events = self.send_chat_message("generate an image of a sunset", media_gen_mode=False)
        
        if not success:
            print("❌ Test Case 1 FAILED: Request failed")
            return False
        
        # Check for required events
        media_confirmation_found = False
        delta_with_confirmation = False
        generating_visual_found = False
        
        for event in events:
            event_type = event.get('type')
            
            if event_type == 'media_confirmation':
                media_confirmation_found = True
                media_type = event.get('mediaType')
                detected_type = event.get('detectedType')
                prompt = event.get('prompt')
                
                print(f"✅ Found media_confirmation event:")
                print(f"   - mediaType: {media_type}")
                print(f"   - detectedType: {detected_type}")
                print(f"   - prompt: {prompt}")
                
                if media_type == 'image' and detected_type == 'image':
                    print("✅ Correct media_confirmation event structure")
                else:
                    print(f"❌ Incorrect media_confirmation structure")
                    
            elif event_type == 'delta':
                content = event.get('content', '')
                if 'Create' in content and 'toggle' in content:
                    delta_with_confirmation = True
                    print(f"✅ Found delta event with confirmation message")
                    print(f"   - Content preview: {content[:100]}...")
                    
            elif event_type == 'generating_visual':
                generating_visual_found = True
                print(f"❌ Unexpected generating_visual event found (should not auto-generate when mediaGenMode=false)")
        
        # Evaluate test results
        if media_confirmation_found and delta_with_confirmation and not generating_visual_found:
            print("✅ TEST CASE 1 PASSED: Confirmation flow working correctly")
            return True
        else:
            print("❌ TEST CASE 1 FAILED:")
            print(f"   - media_confirmation found: {media_confirmation_found}")
            print(f"   - delta with confirmation: {delta_with_confirmation}")
            print(f"   - generating_visual found (should be False): {generating_visual_found}")
            return False

    def test_media_gen_mode_on_image(self):
        """Test Case 2: mediaGenMode ON — should auto-generate image"""
        print("\n" + "="*80)
        print("🧪 TEST CASE 2: mediaGenMode ON - Image Generation Request")
        print("Expected: generating_visual event (auto-generation)")
        print("="*80)
        
        success, events = self.send_chat_message("generate an image of a sunset", media_gen_mode=True)
        
        if not success:
            print("❌ Test Case 2 FAILED: Request failed")
            return False
        
        # Check for required events
        generating_visual_found = False
        media_confirmation_found = False
        
        for event in events:
            event_type = event.get('type')
            
            if event_type == 'generating_visual':
                generating_visual_found = True
                visual_type = event.get('visualType')
                print(f"✅ Found generating_visual event:")
                print(f"   - visualType: {visual_type}")
                
                if visual_type == 'image':
                    print("✅ Correct generating_visual event for image")
                else:
                    print(f"❌ Incorrect visualType: expected 'image', got '{visual_type}'")
                    
            elif event_type == 'media_confirmation':
                media_confirmation_found = True
                print(f"❌ Unexpected media_confirmation event found (should auto-generate when mediaGenMode=true)")
        
        # Evaluate test results
        if generating_visual_found and not media_confirmation_found:
            print("✅ TEST CASE 2 PASSED: Auto-generation working correctly")
            return True
        else:
            print("❌ TEST CASE 2 FAILED:")
            print(f"   - generating_visual found: {generating_visual_found}")
            print(f"   - media_confirmation found (should be False): {media_confirmation_found}")
            return False

    def test_no_media_trigger(self):
        """Test Case 3: No media trigger — normal chat regardless of mode"""
        print("\n" + "="*80)
        print("🧪 TEST CASE 3: No Media Trigger - Normal Chat")
        print("Expected: Normal text response, no media events")
        print("="*80)
        
        success, events = self.send_chat_message("what is the capital of France?", media_gen_mode=False)
        
        if not success:
            print("❌ Test Case 3 FAILED: Request failed")
            return False
        
        # Check for media events (should not exist)
        media_confirmation_found = False
        generating_visual_found = False
        delta_found = False
        done_found = False
        
        for event in events:
            event_type = event.get('type')
            
            if event_type == 'media_confirmation':
                media_confirmation_found = True
                print(f"❌ Unexpected media_confirmation event found")
                
            elif event_type == 'generating_visual':
                generating_visual_found = True
                print(f"❌ Unexpected generating_visual event found")
                
            elif event_type == 'delta':
                delta_found = True
                content = event.get('content', '')
                print(f"✅ Found delta event with text response")
                
            elif event_type == 'done':
                done_found = True
                print(f"✅ Found done event")
        
        # Evaluate test results
        if not media_confirmation_found and not generating_visual_found and delta_found and done_found:
            print("✅ TEST CASE 3 PASSED: Normal chat working correctly")
            return True
        else:
            print("❌ TEST CASE 3 FAILED:")
            print(f"   - media_confirmation found (should be False): {media_confirmation_found}")
            print(f"   - generating_visual found (should be False): {generating_visual_found}")
            print(f"   - delta found: {delta_found}")
            print(f"   - done found: {done_found}")
            return False

    def test_video_trigger_mode_off(self):
        """Test Case 4: Video trigger with mediaGenMode OFF"""
        print("\n" + "="*80)
        print("🧪 TEST CASE 4: mediaGenMode OFF - Video Generation Request")
        print("Expected: media_confirmation event with mediaType 'video'")
        print("="*80)
        
        success, events = self.send_chat_message("generate a video of a dog playing", media_gen_mode=False)
        
        if not success:
            print("❌ Test Case 4 FAILED: Request failed")
            return False
        
        # Check for required events
        media_confirmation_found = False
        correct_video_confirmation = False
        generating_visual_found = False
        
        for event in events:
            event_type = event.get('type')
            
            if event_type == 'media_confirmation':
                media_confirmation_found = True
                media_type = event.get('mediaType')
                detected_type = event.get('detectedType')
                
                print(f"✅ Found media_confirmation event:")
                print(f"   - mediaType: {media_type}")
                print(f"   - detectedType: {detected_type}")
                
                if media_type == 'video' and detected_type == 'video':
                    correct_video_confirmation = True
                    print("✅ Correct video confirmation event structure")
                else:
                    print(f"❌ Incorrect media_confirmation structure for video")
                    
            elif event_type == 'generating_visual':
                generating_visual_found = True
                print(f"❌ Unexpected generating_visual event found (should not auto-generate when mediaGenMode=false)")
        
        # Evaluate test results
        if media_confirmation_found and correct_video_confirmation and not generating_visual_found:
            print("✅ TEST CASE 4 PASSED: Video confirmation flow working correctly")
            return True
        else:
            print("❌ TEST CASE 4 FAILED:")
            print(f"   - media_confirmation found: {media_confirmation_found}")
            print(f"   - correct video confirmation: {correct_video_confirmation}")
            print(f"   - generating_visual found (should be False): {generating_visual_found}")
            return False

    def run_all_tests(self):
        """Run all Media Create Mode tests"""
        print("🚀 Starting Media Create Mode Toggle Feature Tests")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"👤 Test User: {LOGIN_EMAIL}")
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Run all test cases
        test_results = []
        
        test_results.append(self.test_media_gen_mode_off_image())
        test_results.append(self.test_media_gen_mode_on_image())
        test_results.append(self.test_no_media_trigger())
        test_results.append(self.test_video_trigger_mode_off())
        
        # Summary
        passed_tests = sum(test_results)
        total_tests = len(test_results)
        
        print("\n" + "="*80)
        print("📊 MEDIA CREATE MODE TOGGLE FEATURE TEST SUMMARY")
        print("="*80)
        print(f"✅ Passed: {passed_tests}/{total_tests}")
        print(f"❌ Failed: {total_tests - passed_tests}/{total_tests}")
        
        if passed_tests == total_tests:
            print("🎉 ALL TESTS PASSED! Media Create Mode Toggle feature is working correctly.")
            return True
        else:
            print("⚠️ SOME TESTS FAILED. Please review the failed test cases above.")
            return False

def main():
    """Main test execution"""
    tester = MediaCreateModeTest()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ Media Create Mode Toggle testing completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Media Create Mode Toggle testing completed with failures!")
        sys.exit(1)

if __name__ == "__main__":
    main()