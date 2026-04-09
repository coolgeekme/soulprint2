#!/usr/bin/env python3
"""
Backend Test for Image-to-Video Intent Detection Fix
Tests the isImageToVideoRequest check in chat-stream.js
"""

import requests
import json
import time
import sys
from typing import Dict, Any, List

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

class ImageToVideoTester:
    def __init__(self):
        self.token = None
        self.conversation_id = "test-video-intent-conv"
        
    def authenticate(self) -> bool:
        """Test authentication with provided credentials"""
        try:
            print("🔐 Testing authentication...")
            response = requests.post(f"{API_BASE}/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            }, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                print(f"✅ Authentication successful - Token received")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def setup_conversation_with_image(self) -> bool:
        """Create a conversation with an image to test image-to-video intent"""
        try:
            print("🖼️ Setting up conversation with image...")
            
            # First, create a conversation by sending a simple message
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.post(f"{API_BASE}/chat/stream", 
                json={
                    "content": "Hello, I need to test image generation",
                    "model": "gpt-4o",
                    "conversation_id": self.conversation_id
                },
                headers=headers,
                timeout=30
            )
            
            if response.status_code != 200:
                print(f"❌ Failed to create conversation: {response.status_code}")
                return False
            
            # Extract the actual conversation ID from the response
            lines = response.text.strip().split('\n')
            actual_conv_id = None
            for line in lines:
                if line.strip():
                    try:
                        event = json.loads(line)
                        if event.get('type') == 'meta' and event.get('conversationId'):
                            actual_conv_id = event['conversationId']
                            break
                    except json.JSONDecodeError:
                        continue
            
            if actual_conv_id:
                self.conversation_id = actual_conv_id
                print(f"✅ Conversation created with ID: {actual_conv_id}")
            else:
                print("⚠️ Could not extract conversation ID, using original")
            
            # Now generate an image to establish image context
            print("🎨 Generating an image to establish context...")
            response = requests.post(f"{API_BASE}/chat/stream", 
                json={
                    "content": "generate an image of a cat sitting on a couch",
                    "model": "gpt-4o",
                    "conversation_id": self.conversation_id
                },
                headers=headers,
                timeout=60
            )
            
            if response.status_code == 200:
                # Parse NDJSON response to check for image generation
                lines = response.text.strip().split('\n')
                image_generated = False
                for line in lines:
                    if line.strip():
                        try:
                            event = json.loads(line)
                            if event.get('type') == 'image' and event.get('url'):
                                image_generated = True
                                print(f"✅ Image generated successfully: {event['url'][:50]}...")
                                break
                        except json.JSONDecodeError:
                            continue
                
                if image_generated:
                    print("✅ Conversation with image context established")
                    return True
                else:
                    print("⚠️ Image generation may have failed, but continuing with test...")
                    return True
            else:
                print(f"❌ Failed to generate image: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Setup error: {str(e)}")
            return False
    
    def test_video_intent_detection(self, test_phrase: str, should_detect: bool = True) -> bool:
        """Test if a phrase correctly triggers image-to-video intent detection"""
        try:
            print(f"🎬 Testing phrase: '{test_phrase}'")
            
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.post(f"{API_BASE}/chat/stream", 
                json={
                    "content": test_phrase,
                    "model": "gpt-4o", 
                    "conversation_id": self.conversation_id
                },
                headers=headers,
                timeout=45
            )
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code}")
                return False
            
            # Parse NDJSON response
            lines = response.text.strip().split('\n')
            detected_image_to_video = False
            found_generating_visual = False
            found_video_task = False
            found_confirmation = False
            
            for line in lines:
                if line.strip():
                    try:
                        event = json.loads(line)
                        event_type = event.get('type')
                        
                        if event_type == 'generating_visual' and event.get('visualType') == 'video':
                            found_generating_visual = True
                            detected_image_to_video = True
                            
                        elif event_type == 'video_task':
                            found_video_task = True
                            detected_image_to_video = True
                            
                        elif event_type == 'media_confirmation':
                            found_confirmation = True
                            
                    except json.JSONDecodeError:
                        continue
            
            # Check if detection matches expectation
            if should_detect:
                if detected_image_to_video:
                    print(f"✅ Correctly detected image-to-video intent (generating_visual: {found_generating_visual}, video_task: {found_video_task})")
                    return True
                else:
                    print(f"❌ Failed to detect image-to-video intent (found confirmation: {found_confirmation})")
                    return False
            else:
                if not detected_image_to_video:
                    print(f"✅ Correctly did NOT detect image-to-video intent")
                    return True
                else:
                    print(f"❌ Incorrectly detected image-to-video intent when it shouldn't")
                    return False
                    
        except Exception as e:
            print(f"❌ Test error: {str(e)}")
            return False
    
    def test_regression_regular_video(self) -> bool:
        """Test that regular video prompts without conversation image work normally"""
        try:
            print("🔄 Testing regression: regular video prompts...")
            
            # Create a new conversation without image context
            new_conv_id = "test-regular-video-conv"
            headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(f"{API_BASE}/chat/stream", 
                json={
                    "content": "generate a video of a sunset over the ocean",
                    "model": "gpt-4o",
                    "conversation_id": new_conv_id
                },
                headers=headers,
                timeout=30
            )
            
            if response.status_code != 200:
                print(f"❌ Regular video request failed: {response.status_code}")
                return False
            
            # Should NOT trigger isImageToVideoRequest (should go to confirmation or normal video generation)
            lines = response.text.strip().split('\n')
            found_image_to_video_auto_exec = False
            
            for line in lines:
                if line.strip():
                    try:
                        event = json.loads(line)
                        if event.get('type') == 'delta':
                            content = event.get('content', '')
                            if '🎬 **Animating your image...**' in content:
                                found_image_to_video_auto_exec = True
                                break
                    except json.JSONDecodeError:
                        continue
            
            if not found_image_to_video_auto_exec:
                print("✅ Regular video request correctly did NOT trigger image-to-video path")
                return True
            else:
                print("❌ Regular video request incorrectly triggered image-to-video path")
                return False
                
        except Exception as e:
            print(f"❌ Regression test error: {str(e)}")
            return False
    
    def test_regular_chat(self) -> bool:
        """Test that regular chat still works normally"""
        try:
            print("💬 Testing regression: regular chat...")
            
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.post(f"{API_BASE}/chat/stream", 
                json={
                    "content": "What is the weather like?",
                    "model": "gpt-4o",
                    "conversation_id": "test-regular-chat-conv"
                },
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                # Should return normal text response, no video/image generation
                lines = response.text.strip().split('\n')
                found_text_response = False
                found_media_generation = False
                
                for line in lines:
                    if line.strip():
                        try:
                            event = json.loads(line)
                            if event.get('type') == 'delta' and event.get('content'):
                                found_text_response = True
                            elif event.get('type') in ['generating_visual', 'video_task', 'image']:
                                found_media_generation = True
                        except json.JSONDecodeError:
                            continue
                
                if found_text_response and not found_media_generation:
                    print("✅ Regular chat working correctly")
                    return True
                else:
                    print(f"❌ Regular chat issue (text: {found_text_response}, media: {found_media_generation})")
                    return False
            else:
                print(f"❌ Regular chat failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Regular chat test error: {str(e)}")
            return False

def main():
    """Main test execution"""
    print("🚀 Starting Image-to-Video Intent Detection Fix Testing")
    print("=" * 60)
    
    tester = ImageToVideoTester()
    
    # Step 1: Authentication
    if not tester.authenticate():
        print("❌ Authentication failed - cannot proceed")
        sys.exit(1)
    
    # Step 2: Setup conversation with image
    if not tester.setup_conversation_with_image():
        print("❌ Failed to setup conversation with image")
        sys.exit(1)
    
    # Step 3: Test video intent detection phrases that should work
    test_phrases_should_detect = [
        "make a video out of it",
        "generate a video of it", 
        "create a video",
        "turn it into a video",
        "generate a video of the generated image",
        "make a video from this",
        "animate this image",
        "create a video of this",
        "video of it",
        "make it move"
    ]
    
    print("\n🎯 Testing phrases that SHOULD trigger image-to-video detection:")
    print("-" * 50)
    
    success_count = 0
    total_tests = len(test_phrases_should_detect)
    
    for phrase in test_phrases_should_detect:
        if tester.test_video_intent_detection(phrase, should_detect=True):
            success_count += 1
        time.sleep(2)  # Brief pause between tests
    
    # Step 4: Test regression - regular video prompts
    print("\n🔄 Testing regression scenarios:")
    print("-" * 30)
    
    regression_tests = [
        ("Regular video without image context", tester.test_regression_regular_video),
        ("Regular chat functionality", tester.test_regular_chat)
    ]
    
    regression_success = 0
    for test_name, test_func in regression_tests:
        print(f"Testing: {test_name}")
        if test_func():
            regression_success += 1
        time.sleep(2)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"✅ Authentication: {'PASS' if tester.token else 'FAIL'}")
    print(f"✅ Image-to-Video Intent Detection: {success_count}/{total_tests} phrases detected correctly")
    print(f"✅ Regression Tests: {regression_success}/{len(regression_tests)} passed")
    
    overall_success = (success_count == total_tests and regression_success == len(regression_tests))
    
    if overall_success:
        print("\n🎉 ALL TESTS PASSED - Image-to-Video intent detection fix is working correctly!")
        print("✅ The isImageToVideoRequest patterns now correctly detect natural phrases")
        print("✅ Auto-execution bypasses confirmation flow as expected")
        print("✅ No regressions in regular video or chat functionality")
    else:
        print(f"\n⚠️ SOME TESTS FAILED")
        if success_count < total_tests:
            print(f"❌ {total_tests - success_count} intent detection phrases failed")
        if regression_success < len(regression_tests):
            print(f"❌ {len(regression_tests) - regression_success} regression tests failed")
    
    return overall_success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)