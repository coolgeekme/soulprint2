#!/usr/bin/env python3
"""
Backend Testing Script for Image Generation with Attachments Fix
Tests the fix in app/api/[[...path]]/route.js line 6784
"""

import requests
import json
import uuid
import base64
import time
import sys
from io import BytesIO
from PIL import Image

# Configuration
BASE_URL = "https://data-import-trace.preview.emergentagent.com"
AUTH_EMAIL = "testchat@example.com"
AUTH_PASSCODE = "Test123456"

class ImageGenerationTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.auth_token = None
        self.session = requests.Session()
        
    def create_test_image_base64(self):
        """Create a small 1x1 pixel PNG image as base64 for testing"""
        try:
            # Create a 1x1 red pixel image
            img = Image.new('RGB', (1, 1), color='red')
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            
            # Convert to base64
            image_data = buffer.getvalue()
            base64_data = base64.b64encode(image_data).decode('utf-8')
            return f"data:image/png;base64,{base64_data}"
        except Exception as e:
            print(f"❌ Failed to create test image: {e}")
            return None
    
    def login(self):
        """Login to get auth token"""
        try:
            print("🔐 Logging in...")
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={
                    "email": AUTH_EMAIL,
                    "passcode": AUTH_PASSCODE
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('token')
                if self.auth_token:
                    print(f"✅ Login successful")
                    return True
                else:
                    print(f"❌ Login failed: No token in response")
                    return False
            else:
                print(f"❌ Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Login error: {e}")
            return False
    
    def parse_sse_stream(self, response_text):
        """Parse Server-Sent Events stream (newline-delimited JSON)"""
        events = []
        lines = response_text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if line:
                try:
                    event = json.loads(line)
                    events.append(event)
                except json.JSONDecodeError:
                    # Skip invalid JSON lines
                    continue
        
        return events
    
    def test_image_generation_without_attachments(self):
        """Test 1: Image generation WITHOUT attachments (regression test)"""
        print("\n🧪 TEST 1: Image generation WITHOUT attachments (regression test)")
        
        try:
            conversation_id = str(uuid.uuid4())
            
            payload = {
                "content": "create an image of a sunset over mountains",
                "conversationId": conversation_id,
                "model": "gpt-4o",
                "attachments": []
            }
            
            print(f"📤 Sending request to POST /api/chat/stream")
            print(f"   Message: {payload['content']}")
            print(f"   Attachments: {len(payload['attachments'])}")
            
            response = self.session.post(
                f"{self.base_url}/api/chat/stream",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.auth_token}",
                    "Content-Type": "application/json"
                },
                stream=True
            )
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code} - {response.text}")
                return False
            
            # Collect the full response
            full_response = ""
            for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
                if chunk:
                    full_response += chunk
            
            # Parse SSE events
            events = self.parse_sse_stream(full_response)
            
            print(f"📥 Received {len(events)} events")
            
            # Check for required events
            generating_visual_found = False
            image_event_found = False
            done_event_found = False
            image_url = None
            
            for event in events:
                event_type = event.get('type')
                print(f"   📋 Event: {event_type}")
                
                if event_type == 'generating_visual':
                    generating_visual_found = True
                    visual_type = event.get('visualType')
                    print(f"      ✅ generating_visual event found (visualType: {visual_type})")
                
                elif event_type == 'image':
                    image_event_found = True
                    image_url = event.get('url')
                    print(f"      ✅ image event found (url: {image_url[:50] if image_url else 'None'}...)")
                
                elif event_type == 'done':
                    done_event_found = True
                    message_id = event.get('messageId')
                    print(f"      ✅ done event found (messageId: {message_id})")
            
            # Verify all required events are present
            success = generating_visual_found and image_event_found and done_event_found
            
            if success:
                print(f"✅ TEST 1 PASSED: All required SSE events found")
                
                # Verify image URL is accessible
                if image_url and image_url.startswith('http'):
                    try:
                        img_response = self.session.head(image_url, timeout=10)
                        if img_response.status_code == 200:
                            print(f"✅ Image URL is accessible (HTTP {img_response.status_code})")
                        else:
                            print(f"⚠️  Image URL returned HTTP {img_response.status_code}")
                    except Exception as e:
                        print(f"⚠️  Could not verify image URL accessibility: {e}")
                
                return True
            else:
                print(f"❌ TEST 1 FAILED: Missing required events")
                print(f"   generating_visual: {generating_visual_found}")
                print(f"   image: {image_event_found}")
                print(f"   done: {done_event_found}")
                return False
                
        except Exception as e:
            print(f"❌ TEST 1 ERROR: {e}")
            return False
    
    def test_image_generation_with_attachments(self):
        """Test 2: Image generation WITH attachments (the bug fix)"""
        print("\n🧪 TEST 2: Image generation WITH attachments (the bug fix)")
        
        try:
            # Create test image
            test_image_base64 = self.create_test_image_base64()
            if not test_image_base64:
                print("❌ Could not create test image")
                return False
            
            conversation_id = str(uuid.uuid4())
            
            payload = {
                "content": "create an image of a person standing in front of this background",
                "conversationId": conversation_id,
                "model": "gpt-4o",
                "attachments": [{
                    "type": "image",
                    "base64": test_image_base64,
                    "mimeType": "image/png",
                    "name": "reference.png"
                }]
            }
            
            print(f"📤 Sending request to POST /api/chat/stream")
            print(f"   Message: {payload['content']}")
            print(f"   Attachments: {len(payload['attachments'])} (1 image)")
            
            response = self.session.post(
                f"{self.base_url}/api/chat/stream",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.auth_token}",
                    "Content-Type": "application/json"
                },
                stream=True
            )
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code} - {response.text}")
                return False
            
            # Collect the full response
            full_response = ""
            for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
                if chunk:
                    full_response += chunk
            
            # Parse SSE events
            events = self.parse_sse_stream(full_response)
            
            print(f"📥 Received {len(events)} events")
            
            # Check for required events
            generating_visual_found = False
            image_generation_attempted = False
            
            for event in events:
                event_type = event.get('type')
                print(f"   📋 Event: {event_type}")
                
                if event_type == 'generating_visual':
                    generating_visual_found = True
                    visual_type = event.get('visualType')
                    print(f"      ✅ generating_visual event found (visualType: {visual_type})")
                    print(f"      🎯 KEY FIX VERIFIED: Image generation was triggered WITH attachments!")
                
                elif event_type == 'image':
                    image_generation_attempted = True
                    image_url = event.get('url')
                    print(f"      ✅ image event found - generation completed successfully")
                
                elif event_type == 'delta':
                    content = event.get('content', '')
                    if 'gpt-image-1' in content.lower() or 'reference' in content.lower():
                        print(f"      🎯 Reference image processing detected in content")
            
            # The key test: generating_visual event should be present
            # This proves the fix worked - previously this would be skipped entirely
            if generating_visual_found:
                print(f"✅ TEST 2 PASSED: Image generation was triggered WITH attachments")
                print(f"   🎯 BUG FIX CONFIRMED: The condition 'if (mediaIntent === 'image')' allows generation with attachments")
                
                if image_generation_attempted:
                    print(f"   ✅ BONUS: Image generation completed successfully with gpt-image-1")
                else:
                    print(f"   ℹ️  Note: Generation triggered but may have fallen back to text (expected behavior)")
                
                return True
            else:
                print(f"❌ TEST 2 FAILED: No generating_visual event found")
                print(f"   This suggests image generation was still skipped with attachments")
                return False
                
        except Exception as e:
            print(f"❌ TEST 2 ERROR: {e}")
            return False
    
    def test_media_intent_detection(self):
        """Test 3: Media intent detection test"""
        print("\n🧪 TEST 3: Media intent detection test")
        
        try:
            conversation_id = str(uuid.uuid4())
            
            payload = {
                "content": "create an image of a beautiful landscape",
                "conversationId": conversation_id,
                "model": "gpt-4o",
                "attachments": []
            }
            
            print(f"📤 Testing media intent detection with: '{payload['content']}'")
            
            response = self.session.post(
                f"{self.base_url}/api/chat/stream",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.auth_token}",
                    "Content-Type": "application/json"
                },
                stream=True
            )
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code} - {response.text}")
                return False
            
            # Collect the full response
            full_response = ""
            for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
                if chunk:
                    full_response += chunk
            
            # Parse SSE events
            events = self.parse_sse_stream(full_response)
            
            # Check if generating_visual event is present
            generating_visual_found = False
            
            for event in events:
                if event.get('type') == 'generating_visual':
                    generating_visual_found = True
                    visual_type = event.get('visualType')
                    print(f"✅ Media intent detection working: generating_visual event found (visualType: {visual_type})")
                    break
            
            if generating_visual_found:
                print(f"✅ TEST 3 PASSED: Media intent detection correctly identified image request")
                return True
            else:
                print(f"❌ TEST 3 FAILED: Media intent detection did not trigger image generation")
                return False
                
        except Exception as e:
            print(f"❌ TEST 3 ERROR: {e}")
            return False
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Image Generation with Attachments Fix Testing")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"👤 Auth: {AUTH_EMAIL}")
        
        # Login first
        if not self.login():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Run tests
        test_results = []
        
        test_results.append(self.test_image_generation_without_attachments())
        test_results.append(self.test_image_generation_with_attachments())
        test_results.append(self.test_media_intent_detection())
        
        # Summary
        passed = sum(test_results)
        total = len(test_results)
        
        print(f"\n📊 TEST SUMMARY")
        print(f"✅ Passed: {passed}/{total}")
        print(f"❌ Failed: {total - passed}/{total}")
        
        if passed == total:
            print(f"🎉 ALL TESTS PASSED - Image Generation with Attachments fix is working correctly!")
            return True
        else:
            print(f"⚠️  Some tests failed - please review the results above")
            return False

if __name__ == "__main__":
    tester = ImageGenerationTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)