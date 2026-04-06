#!/usr/bin/env python3
"""
Backend Test Suite for Smart Aspect Ratio Recreation Feature
Tests the chat stream endpoint's ability to detect aspect ratio recreation requests
and route them to SmartRecreate instead of standard image editing.
"""

import requests
import json
import time
import sys
import os

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

class SmartRecreateTestSuite:
    def __init__(self):
        self.auth_token = None
        self.conversation_id = None
        self.last_image_url = None
        
    def authenticate(self):
        """Login and get auth token"""
        print("🔐 Testing Authentication...")
        
        try:
            response = requests.post(f"{API_BASE}/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            }, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('token')
                if self.auth_token:
                    print("✅ Authentication successful")
                    return True
                else:
                    print("❌ Authentication failed: No token in response")
                    return False
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def get_auth_headers(self):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }
    
    def create_conversation_with_image(self):
        """Create a conversation and generate an image to set up context"""
        print("\n🖼️ Setting up conversation with image...")
        
        try:
            # First, create a conversation by sending a chat message
            response = requests.post(f"{API_BASE}/chat/stream", 
                headers=self.get_auth_headers(),
                json={
                    "content": "Generate an image of a beautiful sunset over mountains",
                    "model": "gpt-4o"
                },
                timeout=60,
                stream=True
            )
            
            if response.status_code != 200:
                print(f"❌ Failed to create conversation: {response.status_code}")
                return False
            
            # Parse NDJSON response to get conversation ID and image URL
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode('utf-8'))
                        
                        if data.get('type') == 'conversation_id':
                            self.conversation_id = data.get('conversationId')
                            print(f"✅ Conversation created: {self.conversation_id}")
                        
                        elif data.get('type') == 'image':
                            self.last_image_url = data.get('url')
                            print(f"✅ Image generated: {self.last_image_url[:80]}...")
                        
                        elif data.get('type') == 'done':
                            break
                            
                    except json.JSONDecodeError:
                        continue
            
            if self.conversation_id and self.last_image_url:
                print("✅ Conversation with image setup complete")
                return True
            else:
                print("❌ Failed to setup conversation with image")
                return False
                
        except Exception as e:
            print(f"❌ Error setting up conversation: {str(e)}")
            return False
    
    def test_smart_recreate_detection(self, message, should_trigger=True):
        """Test if a message triggers SmartRecreate detection"""
        print(f"\n🔍 Testing message: '{message}'")
        print(f"   Expected to trigger SmartRecreate: {should_trigger}")
        
        try:
            response = requests.post(f"{API_BASE}/chat/stream",
                headers=self.get_auth_headers(),
                json={
                    "content": message,
                    "model": "gpt-4o",
                    "conversationId": self.conversation_id
                },
                timeout=60,
                stream=True
            )
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code}")
                return False
            
            # Parse NDJSON response and look for SmartRecreate indicators
            found_generating_visual = False
            found_recreation_content = False
            found_image_edit = False
            
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode('utf-8'))
                        
                        # Check for generating_visual with visualType: 'image'
                        if (data.get('type') == 'generating_visual' and 
                            data.get('visualType') == 'image'):
                            found_generating_visual = True
                            print("   📊 Found generating_visual event")
                        
                        # Check for recreation-specific content in delta
                        elif data.get('type') == 'delta':
                            content = data.get('content', '')
                            if 'Recreating' in content or 'recreation' in content.lower():
                                found_recreation_content = True
                                print(f"   🔄 Found recreation content: {content[:100]}...")
                            elif 'edit' in content.lower() and 'image' in content.lower():
                                found_image_edit = True
                                print(f"   ✏️ Found image edit content: {content[:100]}...")
                        
                        elif data.get('type') == 'done':
                            break
                            
                    except json.JSONDecodeError:
                        continue
            
            # Determine if SmartRecreate was triggered
            smart_recreate_triggered = found_generating_visual and found_recreation_content
            
            if should_trigger:
                if smart_recreate_triggered:
                    print("   ✅ PASS: SmartRecreate correctly triggered")
                    return True
                else:
                    print("   ❌ FAIL: SmartRecreate should have triggered but didn't")
                    return False
            else:
                if smart_recreate_triggered:
                    print("   ❌ FAIL: SmartRecreate triggered when it shouldn't have")
                    return False
                else:
                    print("   ✅ PASS: SmartRecreate correctly NOT triggered")
                    return True
                    
        except Exception as e:
            print(f"   ❌ Error testing message: {str(e)}")
            return False
    
    def run_intent_detection_tests(self):
        """Run comprehensive intent detection tests"""
        print("\n🧠 Testing Intent Detection Patterns...")
        
        # Messages that SHOULD trigger SmartRecreate
        should_trigger_messages = [
            "recreate this as 1:1",
            "make this square",
            "convert this to portrait",
            "change the aspect ratio to 16:9",
            "make it landscape",
            "I want this in 9:16",
            "give me a square version",
            "change this to 1:1",
            "recreate in portrait format",
            "make this image 16:9",
            "convert to landscape orientation",
            "I need this as a square",
            "fit this to 4:3 ratio"
        ]
        
        # Messages that should NOT trigger SmartRecreate (standard edit)
        should_not_trigger_messages = [
            "add a dog to the image",
            "remove the background",
            "make it blue",
            "change the background to a beach",
            "add some flowers",
            "make the sky darker",
            "remove the person from the image"
        ]
        
        # Messages that are questions (should skip both SmartRecreate AND edit)
        question_messages = [
            "why is this image so dark?",
            "what aspect ratio is this?",
            "how was this image created?",
            "what colors are in this image?",
            "can you tell me about this image?"
        ]
        
        results = []
        
        # Test SmartRecreate triggers
        print("\n📋 Testing SmartRecreate Trigger Messages:")
        for message in should_trigger_messages:
            result = self.test_smart_recreate_detection(message, should_trigger=True)
            results.append(result)
            time.sleep(2)  # Rate limiting
        
        # Test standard edit messages (should NOT trigger SmartRecreate)
        print("\n📋 Testing Standard Edit Messages (should NOT trigger SmartRecreate):")
        for message in should_not_trigger_messages:
            result = self.test_smart_recreate_detection(message, should_trigger=False)
            results.append(result)
            time.sleep(2)  # Rate limiting
        
        # Test question messages (should NOT trigger SmartRecreate)
        print("\n📋 Testing Question Messages (should NOT trigger SmartRecreate):")
        for message in question_messages:
            result = self.test_smart_recreate_detection(message, should_trigger=False)
            results.append(result)
            time.sleep(2)  # Rate limiting
        
        return results
    
    def test_ndjson_response_format(self):
        """Test that SmartRecreate returns proper NDJSON format"""
        print("\n📡 Testing NDJSON Response Format...")
        
        try:
            response = requests.post(f"{API_BASE}/chat/stream",
                headers=self.get_auth_headers(),
                json={
                    "content": "recreate this as 1:1",
                    "model": "gpt-4o",
                    "conversationId": self.conversation_id
                },
                timeout=60,
                stream=True
            )
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code}")
                return False
            
            # Verify response is NDJSON (not SSE)
            content_type = response.headers.get('content-type', '')
            if 'text/event-stream' in content_type:
                print("❌ Response is SSE format, should be NDJSON")
                return False
            
            # Parse lines and verify structure
            required_events = ['generating_visual', 'delta', 'done']
            found_events = set()
            
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode('utf-8'))
                        event_type = data.get('type')
                        if event_type in required_events:
                            found_events.add(event_type)
                            print(f"   ✅ Found {event_type} event")
                        
                        if event_type == 'done':
                            break
                            
                    except json.JSONDecodeError as e:
                        print(f"❌ Invalid JSON in response: {e}")
                        return False
            
            if all(event in found_events for event in required_events):
                print("✅ NDJSON response format is correct")
                return True
            else:
                missing = set(required_events) - found_events
                print(f"❌ Missing required events: {missing}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing NDJSON format: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run the complete test suite"""
        print("🚀 Starting Smart Aspect Ratio Recreation Test Suite")
        print("=" * 60)
        
        # Step 1: Authentication
        if not self.authenticate():
            print("❌ Authentication failed, cannot continue")
            return False
        
        # Step 2: Setup conversation with image
        if not self.create_conversation_with_image():
            print("❌ Failed to setup conversation with image, cannot continue")
            return False
        
        # Step 3: Intent detection tests
        intent_results = self.run_intent_detection_tests()
        
        # Step 4: NDJSON format test
        ndjson_result = self.test_ndjson_response_format()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(intent_results) + 1  # +1 for NDJSON test
        passed_tests = sum(intent_results) + (1 if ndjson_result else 0)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL TESTS PASSED! Smart Aspect Ratio Recreation is working correctly.")
            return True
        else:
            print(f"\n⚠️ {total_tests - passed_tests} tests failed. Please review the issues above.")
            return False

def main():
    """Main test execution"""
    test_suite = SmartRecreateTestSuite()
    
    try:
        success = test_suite.run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⏹️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()