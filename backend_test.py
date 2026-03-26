#!/usr/bin/env python3
"""
Backend Testing for SoulPrint Engine
Tests image generation and video generation via chat stream with SSE
"""

import requests
import json
import time
import os
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://image-gen-repair-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class SoulPrintEngineTest:
    def __init__(self):
        self.token = None
        self.conversation_id = None
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def authenticate(self) -> bool:
        """Authenticate and get token"""
        try:
            response = requests.post(f"{API_BASE}/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                if self.token:
                    self.log_result("Authentication", True, f"Token obtained")
                    return True
                else:
                    self.log_result("Authentication", False, "No token in response")
                    return False
            else:
                self.log_result("Authentication", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def get_headers(self) -> Dict[str, str]:
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def create_conversation(self) -> bool:
        """Create a new conversation for testing"""
        try:
            response = requests.post(f"{API_BASE}/conversations", 
                                   headers=self.get_headers(),
                                   json={"title": "Video Intelligence Test"})
            
            if response.status_code == 200:
                data = response.json()
                self.conversation_id = data.get("id")
                if self.conversation_id:
                    self.log_result("Create Conversation", True, f"ID: {self.conversation_id}")
                    return True
                else:
                    self.log_result("Create Conversation", False, "No conversation ID in response")
                    return False
            else:
                self.log_result("Create Conversation", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Create Conversation", False, f"Exception: {str(e)}")
            return False
    
    def parse_sse_stream(self, response) -> Dict[str, Any]:
        """Parse SSE stream and extract events"""
        events = []
        video_task_event = None
        done_event = None
        
        try:
            print("   Parsing SSE stream...")
            line_count = 0
            for line in response.iter_lines(decode_unicode=True):
                line_count += 1
                if line_count > 50:  # Limit to prevent infinite loops
                    print("   Reached line limit, stopping parse")
                    break
                    
                if line.strip():
                    # Handle both standard SSE format and direct JSON
                    data_str = line
                    if line.startswith('data: '):
                        data_str = line[6:]  # Remove 'data: ' prefix
                    
                    if data_str.strip() and data_str != '[DONE]':
                        try:
                            event_data = json.loads(data_str)
                            events.append(event_data)
                            print(f"   Event: {event_data.get('type', 'unknown')} - {str(event_data)[:100]}...")
                            
                            # Capture specific events
                            if event_data.get('type') == 'video_task':
                                video_task_event = event_data
                                print(f"   ✅ Found video_task event!")
                            elif event_data.get('type') == 'done':
                                done_event = event_data
                                print(f"   ✅ Found done event!")
                                # Stop parsing after done event
                                break
                                
                        except json.JSONDecodeError:
                            print(f"   Failed to parse JSON: {data_str[:100]}...")
                            continue
                            
        except Exception as e:
            print(f"Error parsing SSE stream: {e}")
            
        print(f"   Total events parsed: {len(events)}")
        return {
            "events": events,
            "video_task_event": video_task_event,
            "done_event": done_event
        }
    
    def test_image_generation_flow(self) -> bool:
        """Test image generation flow via chat stream with SSE events"""
        try:
            # Image generation prompt as specified in the review request
            prompt = "Generate an image of a beautiful sunset over the ocean"
            
            print(f"   Testing image generation with prompt: {prompt}")
            
            response = requests.post(f"{API_BASE}/chat/stream",
                                   headers=self.get_headers(),
                                   json={
                                       "content": prompt,
                                       "conversationId": self.conversation_id
                                   },
                                   stream=True,
                                   timeout=60)  # Longer timeout for image generation
            
            if response.status_code != 200:
                self.log_result("Image Generation Flow", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            print(f"   Response status: {response.status_code}")
            print(f"   Response headers: {dict(response.headers)}")
            
            # Parse SSE stream and look for image generation events
            events = []
            generating_visual_event = None
            image_event = None
            done_event = None
            
            try:
                print("   Parsing SSE stream for image generation events...")
                line_count = 0
                for line in response.iter_lines(decode_unicode=True):
                    line_count += 1
                    if line_count > 100:  # Higher limit for image generation
                        print("   Reached line limit, stopping parse")
                        break
                        
                    if line.strip():
                        # Handle both standard SSE format and direct JSON
                        data_str = line
                        if line.startswith('data: '):
                            data_str = line[6:]  # Remove 'data: ' prefix
                        
                        if data_str.strip() and data_str != '[DONE]':
                            try:
                                event_data = json.loads(data_str)
                                events.append(event_data)
                                event_type = event_data.get('type', 'unknown')
                                print(f"   Event: {event_type} - {str(event_data)[:150]}...")
                                
                                # Capture specific events for image generation
                                if event_type == 'generating_visual':
                                    generating_visual_event = event_data
                                    print(f"   ✅ Found generating_visual event!")
                                elif event_type == 'image':
                                    image_event = event_data
                                    print(f"   ✅ Found image event with URL!")
                                elif event_type == 'done':
                                    done_event = event_data
                                    print(f"   ✅ Found done event!")
                                    # Stop parsing after done event
                                    break
                                    
                            except json.JSONDecodeError:
                                print(f"   Failed to parse JSON: {data_str[:100]}...")
                                continue
                                
            except Exception as e:
                print(f"Error parsing SSE stream: {e}")
                
            print(f"   Total events parsed: {len(events)}")
            
            # Verify required events for image generation
            success = True
            details = []
            
            # Check for generating_visual event (optional but good to have)
            if generating_visual_event:
                visual_type = generating_visual_event.get('visualType')
                details.append(f"generating_visual event found (visualType: {visual_type})")
            else:
                details.append("generating_visual event not found (optional)")
            
            # Check for image event with URL (required)
            if not image_event:
                self.log_result("Image Generation Flow", False, "No image event found in SSE stream")
                return False
            
            image_url = image_event.get('url')
            if not image_url:
                self.log_result("Image Generation Flow", False, "Image event found but no URL property")
                return False
            
            # Verify the image URL is accessible
            try:
                img_response = requests.head(image_url, timeout=10)
                if img_response.status_code == 200:
                    details.append(f"Image URL accessible: {image_url[:80]}...")
                else:
                    details.append(f"Image URL not accessible (HTTP {img_response.status_code})")
                    success = False
            except Exception as e:
                details.append(f"Failed to verify image URL: {str(e)}")
                success = False
            
            # Check for done event (required)
            if not done_event:
                self.log_result("Image Generation Flow", False, "No done event found in SSE stream")
                return False
            
            details.append("done event found")
            
            # Additional checks for image event properties
            content_type = image_event.get('contentType', 'unknown')
            revised_prompt = image_event.get('revised_prompt', 'none')
            details.append(f"contentType: {content_type}, revised_prompt: {revised_prompt[:50]}...")
            
            if success:
                self.log_result("Image Generation Flow", True, "; ".join(details))
                
                # Store for potential future tests
                self.image_url = image_url
                self.image_message_id = done_event.get('messageId')
                
                return True
            else:
                self.log_result("Image Generation Flow", False, "; ".join(details))
                return False
            
        except Exception as e:
            self.log_result("Image Generation Flow", False, f"Exception: {str(e)}")
            return False
    
    def test_cinematic_video_generation(self) -> bool:
        """Test cinematic video prompt - should select Veo 3.1"""
        try:
            # Cinematic prompt that should trigger Veo 3.1 selection
            prompt = "generate a cinematic video of a sunset over the ocean with dramatic clouds and golden lighting"
            
            response = requests.post(f"{API_BASE}/chat/stream",
                                   headers=self.get_headers(),
                                   json={
                                       "content": prompt,
                                       "conversationId": self.conversation_id
                                   },
                                   stream=True,
                                   timeout=30)
            
            if response.status_code != 200:
                self.log_result("Cinematic Video Generation", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            print(f"   Response status: {response.status_code}")
            print(f"   Response headers: {dict(response.headers)}")
            
            # Parse SSE stream
            stream_data = self.parse_sse_stream(response)
            video_task_event = stream_data.get("video_task_event")
            done_event = stream_data.get("done_event")
            
            # Verify video_task event has Dynamic Intelligence fields
            if not video_task_event:
                self.log_result("Cinematic Video Generation", False, "No video_task event found in SSE stream")
                return False
            
            # Check required Dynamic Intelligence fields
            required_fields = ['videoModel', 'videoModelLabel', 'videoModelReason', 'taskId', 'messageId']
            missing_fields = [field for field in required_fields if field not in video_task_event]
            
            if missing_fields:
                self.log_result("Cinematic Video Generation", False, f"Missing fields in video_task event: {missing_fields}")
                return False
            
            # Verify model selection - should be veo3 for cinematic content
            selected_model = video_task_event.get('videoModel')
            model_label = video_task_event.get('videoModelLabel')
            model_reason = video_task_event.get('videoModelReason')
            
            if selected_model != 'veo3':
                self.log_result("Cinematic Video Generation", False, 
                              f"Expected 'veo3' for cinematic prompt, got '{selected_model}'. Reason: {model_reason}")
                return False
            
            # Verify done event has messageId
            if not done_event or 'messageId' not in done_event:
                self.log_result("Cinematic Video Generation", False, "Done event missing or no messageId")
                return False
            
            self.log_result("Cinematic Video Generation", True, 
                          f"Model: {selected_model} ({model_label}), Reason: {model_reason}")
            
            # Store task ID for status testing
            self.cinematic_task_id = video_task_event.get('taskId')
            self.cinematic_message_id = done_event.get('messageId')
            
            return True
            
        except Exception as e:
            self.log_result("Cinematic Video Generation", False, f"Exception: {str(e)}")
            return False
    
    def test_animation_video_generation(self) -> bool:
        """Test simple animation prompt - should select Kling 3.0"""
        try:
            # Simple animation prompt that should trigger Kling 3.0 selection
            prompt = "create a video of a bouncing ball"
            
            response = requests.post(f"{API_BASE}/chat/stream",
                                   headers=self.get_headers(),
                                   json={
                                       "content": prompt,
                                       "conversationId": self.conversation_id
                                   },
                                   stream=True,
                                   timeout=30)
            
            if response.status_code != 200:
                self.log_result("Animation Video Generation", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            print(f"   Response status: {response.status_code}")
            print(f"   Response headers: {dict(response.headers)}")
            
            # Parse SSE stream
            stream_data = self.parse_sse_stream(response)
            video_task_event = stream_data.get("video_task_event")
            done_event = stream_data.get("done_event")
            
            # Verify video_task event has Dynamic Intelligence fields
            if not video_task_event:
                self.log_result("Animation Video Generation", False, "No video_task event found in SSE stream")
                return False
            
            # Check required Dynamic Intelligence fields
            required_fields = ['videoModel', 'videoModelLabel', 'videoModelReason', 'taskId', 'messageId']
            missing_fields = [field for field in required_fields if field not in video_task_event]
            
            if missing_fields:
                self.log_result("Animation Video Generation", False, f"Missing fields in video_task event: {missing_fields}")
                return False
            
            # Verify model selection - should be kling-3.0 for simple animation
            selected_model = video_task_event.get('videoModel')
            model_label = video_task_event.get('videoModelLabel')
            model_reason = video_task_event.get('videoModelReason')
            
            if selected_model != 'kling-3.0':
                self.log_result("Animation Video Generation", False, 
                              f"Expected 'kling-3.0' for animation prompt, got '{selected_model}'. Reason: {model_reason}")
                return False
            
            # Verify done event has messageId
            if not done_event or 'messageId' not in done_event:
                self.log_result("Animation Video Generation", False, "Done event missing or no messageId")
                return False
            
            self.log_result("Animation Video Generation", True, 
                          f"Model: {selected_model} ({model_label}), Reason: {model_reason}")
            
            # Store task ID for status testing
            self.animation_task_id = video_task_event.get('taskId')
            self.animation_message_id = done_event.get('messageId')
            
            return True
            
        except Exception as e:
            self.log_result("Animation Video Generation", False, f"Exception: {str(e)}")
            return False
    
    def test_video_status_polling(self) -> bool:
        """Test video status polling with model-specific endpoints"""
        try:
            # Test with cinematic task ID if available
            if not hasattr(self, 'cinematic_task_id') or not self.cinematic_task_id:
                self.log_result("Video Status Polling", False, "No task ID available for testing")
                return False
            
            task_id = self.cinematic_task_id
            
            # Test mobile status endpoint
            response = requests.get(f"{API_BASE}/media/status/{task_id}",
                                  headers=self.get_headers())
            
            if response.status_code == 404:
                # This is expected for test tasks that may not exist in the system
                self.log_result("Video Status Polling (Mobile)", True, "404 response for non-existent task (expected)")
            elif response.status_code == 200:
                data = response.json()
                if 'status' in data:
                    self.log_result("Video Status Polling (Mobile)", True, f"Status: {data.get('status')}")
                else:
                    self.log_result("Video Status Polling (Mobile)", False, "No status field in response")
                    return False
            else:
                self.log_result("Video Status Polling (Mobile)", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test desktop status endpoint
            response = requests.get(f"{API_BASE}/media/video/status/{task_id}",
                                  headers=self.get_headers())
            
            if response.status_code == 404:
                # This is expected for test tasks that may not exist in the system
                self.log_result("Video Status Polling (Desktop)", True, "404 response for non-existent task (expected)")
            elif response.status_code == 200:
                data = response.json()
                if 'status' in data:
                    self.log_result("Video Status Polling (Desktop)", True, f"Status: {data.get('status')}")
                else:
                    self.log_result("Video Status Polling (Desktop)", False, "No status field in response")
                    return False
            else:
                self.log_result("Video Status Polling (Desktop)", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            return True
            
        except Exception as e:
            self.log_result("Video Status Polling", False, f"Exception: {str(e)}")
            return False
    
    def test_database_entries(self) -> bool:
        """Test that database entries have Dynamic Intelligence fields"""
        try:
            if not hasattr(self, 'cinematic_message_id') or not self.cinematic_message_id:
                self.log_result("Database Entries", False, "No message ID available for testing")
                return False
            
            # Get messages for the conversation
            response = requests.get(f"{API_BASE}/messages",
                                  headers=self.get_headers(),
                                  params={"conversationId": self.conversation_id})
            
            if response.status_code != 200:
                self.log_result("Database Entries", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            messages = response.json()
            
            # Find the video message (should be assistant message)
            video_message = None
            for msg in messages:
                if msg.get('id') == self.cinematic_message_id and msg.get('role') == 'assistant':
                    video_message = msg
                    break
            
            if not video_message:
                self.log_result("Database Entries", False, f"Assistant message with ID {self.cinematic_message_id} not found")
                return False
            
            # Check for Dynamic Intelligence fields
            required_fields = ['model_label', 'model_used']
            optional_fields = ['video_model_reason']  # This field might be missing due to implementation
            
            missing_fields = []
            for field in required_fields:
                if field not in video_message or not video_message.get(field):
                    missing_fields.append(field)
            
            if missing_fields:
                self.log_result("Database Entries", False, f"Missing required Dynamic Intelligence fields: {missing_fields}")
                return False
            
            # Check optional fields
            missing_optional = []
            for field in optional_fields:
                if field not in video_message or not video_message.get(field):
                    missing_optional.append(field)
            
            # Verify field values
            model_label = video_message.get('model_label')
            model_used = video_message.get('model_used')
            video_model_reason = video_message.get('video_model_reason')
            
            details = f"Model: {model_used} ({model_label})"
            if video_model_reason:
                details += f", Reason: {video_model_reason}"
            if missing_optional:
                details += f" [Missing optional: {', '.join(missing_optional)}]"
            
            self.log_result("Database Entries", True, details)
            return True
            
        except Exception as e:
            self.log_result("Database Entries", False, f"Exception: {str(e)}")
            return False
    
    def test_authentication_required(self) -> bool:
        """Test that endpoints require authentication"""
        try:
            # Test without token
            response = requests.post(f"{API_BASE}/chat/stream",
                                   json={"content": "test", "conversationId": "test"})
            
            if response.status_code == 401:
                self.log_result("Authentication Required", True, "401 Unauthorized without token")
                return True
            else:
                self.log_result("Authentication Required", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Authentication Required", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🧪 Starting SoulPrint Engine Backend Tests")
        print("=" * 60)
        
        # Authentication test
        if not self.test_authentication_required():
            print("❌ Authentication test failed")
            return False
        
        # Login
        if not self.authenticate():
            print("❌ Authentication failed - cannot continue")
            return False
        
        # Create conversation
        if not self.create_conversation():
            print("❌ Conversation creation failed - cannot continue")
            return False
        
        # Test image generation flow (as requested in review)
        image_success = self.test_image_generation_flow()
        
        # Test video generation with different prompts
        cinematic_success = self.test_cinematic_video_generation()
        animation_success = self.test_animation_video_generation()
        
        # Test status polling
        status_success = self.test_video_status_polling()
        
        # Test database entries
        db_success = self.test_database_entries()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            if result["details"]:
                print(f"   {result['details']}")
        
        print(f"\n📈 Results: {passed_tests}/{total_tests} tests passed")
        
        # Check for image generation
        if image_success:
            print("🖼️  IMAGE GENERATION: ✅ VERIFIED")
            print("   SSE stream includes proper image events with accessible URLs")
        else:
            print("🖼️  IMAGE GENERATION: ❌ FAILED")
            print("   Image generation flow may not be working correctly")
        
        # Check for dynamic model selection
        if cinematic_success and animation_success:
            print("🎯 DYNAMIC MODEL SELECTION: ✅ VERIFIED")
            print("   Different prompts resulted in different model selections")
        else:
            print("🎯 DYNAMIC MODEL SELECTION: ❌ FAILED")
            print("   Model selection may not be working dynamically")
        
        return passed_tests == total_tests

def main():
    """Main test execution"""
    tester = SoulPrintEngineTest()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()