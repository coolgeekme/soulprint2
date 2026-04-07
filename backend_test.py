#!/usr/bin/env python3
"""
Backend Testing for Media Confirmation Flow
Tests the SoulPrint Engine chat API media confirmation flow functionality.
"""

import requests
import json
import time
import sys
import os

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

class MediaConfirmationFlowTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def login(self):
        """Authenticate with the API"""
        try:
            response = self.session.post(f"{self.base_url}/api/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                if self.auth_token:
                    self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                    self.log_test("Authentication", True, f"Logged in as {TEST_EMAIL}")
                    return True
                else:
                    self.log_test("Authentication", False, "No token in response")
                    return False
            else:
                self.log_test("Authentication", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def set_user_setting(self, setting_name, value):
        """Update user settings"""
        try:
            response = self.session.patch(f"{self.base_url}/api/user/settings", json={
                setting_name: value
            })
            
            if response.status_code == 200:
                self.log_test(f"Set {setting_name} to {value}", True)
                return True
            else:
                self.log_test(f"Set {setting_name} to {value}", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test(f"Set {setting_name} to {value}", False, f"Exception: {str(e)}")
            return False
    
    def send_chat_message(self, content, model="claude-sonnet-4-20250514", provider="anthropic"):
        """Send a chat message and return the NDJSON stream response"""
        try:
            response = self.session.post(f"{self.base_url}/api/chat/stream", 
                json={
                    "content": content,
                    "model": model,
                    "provider": provider
                },
                stream=True,
                timeout=30
            )
            
            if response.status_code != 200:
                return None, f"HTTP {response.status_code}: {response.text}"
            
            # Parse NDJSON stream
            events = []
            for line in response.iter_lines(decode_unicode=True):
                if line.strip():
                    try:
                        event = json.loads(line)
                        events.append(event)
                    except json.JSONDecodeError:
                        continue
            
            return events, None
            
        except Exception as e:
            return None, f"Exception: {str(e)}"
    
    def check_media_confirmation_event(self, events, expected_type):
        """Check if events contain media_confirmation with expected type"""
        for event in events:
            if event.get("type") == "media_confirmation":
                detected_type = event.get("detectedType")
                if detected_type == expected_type:
                    return True, f"Found media_confirmation with detectedType: {detected_type}"
                else:
                    return False, f"Found media_confirmation but detectedType was {detected_type}, expected {expected_type}"
        return False, "No media_confirmation event found"
    
    def check_no_direct_generation(self, events, media_type):
        """Check that direct generation events are NOT present"""
        forbidden_events = []
        if media_type == "video":
            forbidden_events = ["video_task", "generating_visual"]
        elif media_type == "image":
            forbidden_events = ["image", "generating_visual"]
        
        for event in events:
            if event.get("type") in forbidden_events:
                return False, f"Found forbidden direct generation event: {event.get('type')}"
        return True, "No direct generation events found (confirmation flow working)"
    
    def check_direct_generation(self, events, media_type):
        """Check that direct generation events ARE present (for quick_generate=true)"""
        expected_events = []
        if media_type == "video":
            expected_events = ["video_task", "generating_visual"]
        elif media_type == "image":
            expected_events = ["image", "generating_visual"]
        
        found_events = []
        for event in events:
            if event.get("type") in expected_events:
                found_events.append(event.get("type"))
        
        if found_events:
            return True, f"Found direct generation events: {found_events}"
        else:
            return False, f"No direct generation events found, expected one of: {expected_events}"
    
    def test_video_confirmation_flow(self):
        """Test video confirmation flow with various prompts"""
        print("\n=== Testing Video Confirmation Flow ===")
        
        # Set confirmation mode (quick_generate = false)
        if not self.set_user_setting("quick_generate", False):
            return False
        
        video_test_cases = [
            "need a video prompt for a long horn bull, standing in snow, breathing, steam coming from nostrils",
            "give me a video of a sunset over the ocean with dolphins jumping"
        ]
        
        for i, prompt in enumerate(video_test_cases, 1):
            print(f"\n--- Video Test Case {i}: {prompt[:50]}... ---")
            
            events, error = self.send_chat_message(prompt)
            if error:
                self.log_test(f"Video Test {i} - Send Message", False, error)
                continue
            
            # Check for media_confirmation event
            has_confirmation, conf_details = self.check_media_confirmation_event(events, "video")
            self.log_test(f"Video Test {i} - Media Confirmation", has_confirmation, conf_details)
            
            # Check that direct generation is NOT happening
            no_direct, direct_details = self.check_no_direct_generation(events, "video")
            self.log_test(f"Video Test {i} - No Direct Generation", no_direct, direct_details)
            
            # Check for delta event with intent detection message
            has_delta = any(event.get("type") == "delta" for event in events)
            self.log_test(f"Video Test {i} - Has Delta Event", has_delta, "Found delta event with text response" if has_delta else "No delta event found")
        
        return True
    
    def test_image_confirmation_flow(self):
        """Test image confirmation flow with various prompts"""
        print("\n=== Testing Image Confirmation Flow ===")
        
        # Ensure confirmation mode is still set
        if not self.set_user_setting("quick_generate", False):
            return False
        
        image_test_cases = [
            "need an image of a cyberpunk city at night with neon lights",
            "can I get a picture of a golden retriever puppy playing in the park"
        ]
        
        for i, prompt in enumerate(image_test_cases, 1):
            print(f"\n--- Image Test Case {i}: {prompt[:50]}... ---")
            
            events, error = self.send_chat_message(prompt)
            if error:
                self.log_test(f"Image Test {i} - Send Message", False, error)
                continue
            
            # Check for media_confirmation event
            has_confirmation, conf_details = self.check_media_confirmation_event(events, "image")
            self.log_test(f"Image Test {i} - Media Confirmation", has_confirmation, conf_details)
            
            # Check that direct generation is NOT happening
            no_direct, direct_details = self.check_no_direct_generation(events, "image")
            self.log_test(f"Image Test {i} - No Direct Generation", no_direct, direct_details)
            
            # Check for delta event with intent detection message
            has_delta = any(event.get("type") == "delta" for event in events)
            self.log_test(f"Image Test {i} - Has Delta Event", has_delta, "Found delta event with text response" if has_delta else "No delta event found")
        
        return True
    
    def test_quick_generate_mode(self):
        """Test that quick_generate=true bypasses confirmation"""
        print("\n=== Testing Quick Generate Mode ===")
        
        # Set quick generate mode (quick_generate = true)
        if not self.set_user_setting("quick_generate", True):
            return False
        
        prompt = "generate a video of a majestic eagle soaring over mountains"
        print(f"\n--- Quick Generate Test: {prompt[:50]}... ---")
        
        events, error = self.send_chat_message(prompt)
        if error:
            self.log_test("Quick Generate Test - Send Message", False, error)
            return False
        
        # Check that there's NO media_confirmation event
        has_confirmation = any(event.get("type") == "media_confirmation" for event in events)
        self.log_test("Quick Generate Test - No Confirmation", not has_confirmation, 
                     "No media_confirmation found (correct for quick_generate=true)" if not has_confirmation 
                     else "Found media_confirmation (should not happen with quick_generate=true)")
        
        # Check that direct generation IS happening
        has_direct, direct_details = self.check_direct_generation(events, "video")
        self.log_test("Quick Generate Test - Direct Generation", has_direct, direct_details)
        
        return True
    
    def test_non_media_message(self):
        """Test that non-media messages don't trigger confirmation"""
        print("\n=== Testing Non-Media Message ===")
        
        # Reset to confirmation mode
        if not self.set_user_setting("quick_generate", False):
            return False
        
        prompt = "What is the capital of France?"
        print(f"\n--- Non-Media Test: {prompt} ---")
        
        events, error = self.send_chat_message(prompt)
        if error:
            self.log_test("Non-Media Test - Send Message", False, error)
            return False
        
        # Check that there's NO media_confirmation event
        has_confirmation = any(event.get("type") == "media_confirmation" for event in events)
        self.log_test("Non-Media Test - No Confirmation", not has_confirmation, 
                     "No media_confirmation found (correct for non-media message)" if not has_confirmation 
                     else "Found media_confirmation (should not happen for non-media message)")
        
        # Check for normal delta events
        has_delta = any(event.get("type") == "delta" for event in events)
        self.log_test("Non-Media Test - Has Delta Event", has_delta, "Found normal text response" if has_delta else "No delta event found")
        
        return True
    
    def run_all_tests(self):
        """Run all media confirmation flow tests"""
        print("🚀 Starting Media Confirmation Flow Tests")
        print(f"Base URL: {self.base_url}")
        print(f"Test User: {TEST_EMAIL}")
        
        # Login first
        if not self.login():
            print("❌ Authentication failed, cannot continue tests")
            return False
        
        # Run all test suites
        try:
            self.test_video_confirmation_flow()
            self.test_image_confirmation_flow()
            self.test_quick_generate_mode()
            self.test_non_media_message()
        except Exception as e:
            print(f"❌ Test execution failed: {str(e)}")
            return False
        
        # Summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return failed_tests == 0

def main():
    """Main test execution"""
    tester = MediaConfirmationFlowTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()