#!/usr/bin/env python3
"""
Backend Testing for Video Edit Auto-Execution Fix
Tests the video edit intent detection and auto-execution pipeline.
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

class VideoEditAutoExecutionTester:
    def __init__(self):
        self.token = None
        self.conversation_id = None
        
    def authenticate(self):
        """Authenticate and get token"""
        print("🔐 Authenticating...")
        
        response = requests.post(f"{API_BASE}/auth/login", json={
            "email": TEST_EMAIL,
            "passcode": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get('token')
            print(f"✅ Authentication successful")
            return True
        else:
            print(f"❌ Authentication failed: {response.status_code} - {response.text}")
            return False
    
    def get_headers(self):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_health_check(self):
        """Test basic health check"""
        print("\n🏥 Testing health check...")
        
        response = requests.get(f"{API_BASE}/health")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'ok':
                print("✅ Health check passed")
                return True
            else:
                print(f"❌ Health check failed: {data}")
                return False
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    
    def test_video_edit_intent_detection(self):
        """Test video edit intent detection patterns"""
        print("\n🎬 Testing Video Edit Intent Detection...")
        
        # Test messages that SHOULD trigger video edit intent
        video_edit_messages = [
            "can you edit this video and remove the tags from both ears of the bull?",
            "edit the clip to remove the background noise",
            "modify this video and change the color of the car",
            "remove the watermark from the video",
            "can you fix the lighting in this footage?",
            "edit this video to make it brighter",
            "can you remove the person in the background from this clip?",
            "modify the video to add text overlay",
            "change the color grading in this footage",
            "crop this video to remove the edges"
        ]
        
        # Test messages that should NOT trigger video edit intent
        non_video_edit_messages = [
            "what is video editing?",
            "tell me about video formats",
            "how do I edit videos in premiere pro?",
            "what are the best video editing tools?",
            "explain video compression",
            "what's the difference between MP4 and AVI?"
        ]
        
        success_count = 0
        total_tests = len(video_edit_messages) + len(non_video_edit_messages)
        
        # Test video edit messages (should trigger video generation pipeline)
        for message in video_edit_messages:
            print(f"  Testing: '{message[:50]}...'")
            
            response = requests.post(f"{API_BASE}/chat/stream", 
                headers=self.get_headers(),
                json={
                    "content": message,
                    "model": "gpt-4o"
                }
            )
            
            if response.status_code == 200:
                # Parse NDJSON response
                lines = response.text.strip().split('\n')
                events = []
                for line in lines:
                    if line.strip() and not line.startswith(':'):
                        try:
                            events.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
                
                # Check for video generation events
                has_generating_visual = any(e.get('type') == 'generating_visual' for e in events)
                has_video_task = any(e.get('type') == 'video_task' for e in events)
                
                if has_generating_visual or has_video_task:
                    print(f"    ✅ Correctly detected video edit intent")
                    success_count += 1
                else:
                    print(f"    ❌ Failed to detect video edit intent")
                    # Print events for debugging
                    event_types = [e.get('type') for e in events]
                    print(f"    Events: {event_types}")
            else:
                print(f"    ❌ Request failed: {response.status_code}")
            
            time.sleep(1)  # Rate limiting
        
        # Test non-video edit messages (should NOT trigger video generation)
        for message in non_video_edit_messages:
            print(f"  Testing: '{message[:50]}...'")
            
            response = requests.post(f"{API_BASE}/chat/stream", 
                headers=self.get_headers(),
                json={
                    "content": message,
                    "model": "gpt-4o"
                }
            )
            
            if response.status_code == 200:
                # Parse NDJSON response
                lines = response.text.strip().split('\n')
                events = []
                for line in lines:
                    if line.strip() and not line.startswith(':'):
                        try:
                            events.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
                
                # Check for video generation events (should NOT be present)
                has_generating_visual = any(e.get('type') == 'generating_visual' for e in events)
                has_video_task = any(e.get('type') == 'video_task' for e in events)
                
                if not has_generating_visual and not has_video_task:
                    print(f"    ✅ Correctly did NOT trigger video edit")
                    success_count += 1
                else:
                    print(f"    ❌ Incorrectly triggered video edit")
                    event_types = [e.get('type') for e in events]
                    print(f"    Events: {event_types}")
            else:
                print(f"    ❌ Request failed: {response.status_code}")
            
            time.sleep(1)  # Rate limiting
        
        print(f"\n📊 Video Edit Intent Detection: {success_count}/{total_tests} tests passed ({success_count/total_tests*100:.1f}%)")
        return success_count == total_tests
    
    def test_chat_stream_video_edit_flow(self):
        """Test chat stream video edit flow with video context"""
        print("\n🎥 Testing Chat Stream Video Edit Flow...")
        
        # First, create a conversation with video context
        print("  Setting up conversation with video context...")
        
        # Generate a video first to establish context
        video_gen_response = requests.post(f"{API_BASE}/chat/stream", 
            headers=self.get_headers(),
            json={
                "content": "generate a video of a bull in a field",
                "model": "gpt-4o"
            }
        )
        
        if video_gen_response.status_code != 200:
            print(f"❌ Failed to generate initial video: {video_gen_response.status_code}")
            return False
        
        # Parse response to get conversation ID
        lines = video_gen_response.text.strip().split('\n')
        conversation_id = None
        for line in lines:
            if line.strip() and not line.startswith(':'):
                try:
                    event = json.loads(line)
                    if event.get('type') == 'meta':
                        conversation_id = event.get('conversationId')
                        break
                except json.JSONDecodeError:
                    continue
        
        if not conversation_id:
            print("❌ Failed to get conversation ID from video generation")
            return False
        
        print(f"  ✅ Created conversation: {conversation_id}")
        
        # Now test video edit request in the same conversation
        print("  Testing video edit request...")
        
        edit_response = requests.post(f"{API_BASE}/chat/stream", 
            headers=self.get_headers(),
            json={
                "conversationId": conversation_id,
                "content": "edit this video to remove the tags from the bull's ears",
                "model": "gpt-4o"
            }
        )
        
        if edit_response.status_code == 200:
            # Parse NDJSON response
            lines = edit_response.text.strip().split('\n')
            events = []
            for line in lines:
                if line.strip() and not line.startswith(':'):
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
            
            # Check for required events
            has_generating_visual = any(e.get('type') == 'generating_visual' for e in events)
            has_video_task = any(e.get('type') == 'video_task' for e in events)
            
            video_task_event = next((e for e in events if e.get('type') == 'video_task'), None)
            
            if has_generating_visual and has_video_task:
                print("  ✅ Video edit flow triggered correctly")
                
                # Verify video_task event has required fields
                if video_task_event:
                    required_fields = ['taskId', 'status']
                    missing_fields = [f for f in required_fields if f not in video_task_event]
                    
                    if not missing_fields:
                        print("  ✅ video_task event has required fields")
                        return True
                    else:
                        print(f"  ❌ video_task event missing fields: {missing_fields}")
                        return False
                else:
                    print("  ❌ video_task event not found")
                    return False
            else:
                print("  ❌ Video edit flow did not trigger")
                event_types = [e.get('type') for e in events]
                print(f"  Events: {event_types}")
                return False
        else:
            print(f"  ❌ Video edit request failed: {edit_response.status_code}")
            return False
    
    def test_system_prompt_update(self):
        """Test that system prompt includes video editing capabilities"""
        print("\n📝 Testing System Prompt Update...")
        
        # Test a simple chat to see if the system prompt includes video editing info
        response = requests.post(f"{API_BASE}/chat/stream", 
            headers=self.get_headers(),
            json={
                "content": "what are your video editing capabilities?",
                "model": "gpt-4o"
            }
        )
        
        if response.status_code == 200:
            # Parse NDJSON response
            lines = response.text.strip().split('\n')
            full_response = ""
            for line in lines:
                if line.strip() and not line.startswith(':'):
                    try:
                        event = json.loads(line)
                        if event.get('type') == 'delta':
                            full_response += event.get('content', '')
                    except json.JSONDecodeError:
                        continue
            
            # Check if response mentions video editing capabilities
            video_edit_keywords = [
                "video edit", "extract", "frame", "generate", "new video",
                "edit description", "video generation", "pipeline"
            ]
            
            response_lower = full_response.lower()
            found_keywords = [kw for kw in video_edit_keywords if kw in response_lower]
            
            # Also check if it mentions NOT saying "I'll get started"
            avoids_promise = "i'll get started" not in response_lower and "i'll work on it" not in response_lower
            
            if found_keywords and avoids_promise:
                print(f"  ✅ System prompt includes video editing capabilities")
                print(f"  Found keywords: {found_keywords}")
                return True
            else:
                print(f"  ❌ System prompt may not include proper video editing info")
                print(f"  Found keywords: {found_keywords}")
                print(f"  Avoids promises: {avoids_promise}")
                print(f"  Response preview: {full_response[:200]}...")
                return False
        else:
            print(f"  ❌ System prompt test failed: {response.status_code}")
            return False
    
    def test_regression_endpoints(self):
        """Test that existing functionality still works"""
        print("\n🔄 Testing Regression - Core Endpoints...")
        
        tests = []
        
        # Test auth/login
        print("  Testing POST /api/auth/login...")
        response = requests.post(f"{API_BASE}/auth/login", json={
            "email": TEST_EMAIL,
            "passcode": TEST_PASSWORD
        })
        tests.append(("Auth Login", response.status_code == 200))
        
        # Test media/pending
        print("  Testing GET /api/media/pending...")
        response = requests.get(f"{API_BASE}/media/pending", headers=self.get_headers())
        tests.append(("Media Pending", response.status_code == 200))
        
        # Test regular chat (non-video-edit)
        print("  Testing regular chat message...")
        response = requests.post(f"{API_BASE}/chat/stream", 
            headers=self.get_headers(),
            json={
                "content": "Hello, how are you today?",
                "model": "gpt-4o"
            }
        )
        tests.append(("Regular Chat", response.status_code == 200))
        
        # Test video generation request
        print("  Testing video generation request...")
        response = requests.post(f"{API_BASE}/chat/stream", 
            headers=self.get_headers(),
            json={
                "content": "generate a video of a sunset",
                "model": "gpt-4o"
            }
        )
        
        if response.status_code == 200:
            # Check for media_confirmation or generating_visual events
            lines = response.text.strip().split('\n')
            events = []
            for line in lines:
                if line.strip() and not line.startswith(':'):
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
            
            has_media_flow = any(e.get('type') in ['media_confirmation', 'generating_visual', 'video_task'] for e in events)
            tests.append(("Video Generation", has_media_flow))
        else:
            tests.append(("Video Generation", False))
        
        # Summary
        passed = sum(1 for _, result in tests if result)
        total = len(tests)
        
        print(f"\n📊 Regression Tests: {passed}/{total} passed")
        for test_name, result in tests:
            status = "✅" if result else "❌"
            print(f"  {status} {test_name}")
        
        return passed == total
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Video Edit Auto-Execution Fix Testing")
        print("=" * 60)
        
        if not self.authenticate():
            print("❌ Authentication failed, cannot continue")
            return False
        
        if not self.test_health_check():
            print("❌ Health check failed, cannot continue")
            return False
        
        # Run all test categories
        test_results = []
        
        test_results.append(("Video Edit Intent Detection", self.test_video_edit_intent_detection()))
        test_results.append(("Chat Stream Video Edit Flow", self.test_chat_stream_video_edit_flow()))
        test_results.append(("System Prompt Update", self.test_system_prompt_update()))
        test_results.append(("Regression Tests", self.test_regression_endpoints()))
        
        # Final summary
        print("\n" + "=" * 60)
        print("📊 FINAL TEST RESULTS")
        print("=" * 60)
        
        passed = 0
        total = len(test_results)
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name}")
            if result:
                passed += 1
        
        print(f"\nOverall: {passed}/{total} test categories passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 All tests passed! Video Edit Auto-Execution Fix is working correctly.")
            return True
        else:
            print("⚠️  Some tests failed. Please review the issues above.")
            return False

if __name__ == "__main__":
    tester = VideoEditAutoExecutionTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)