#!/usr/bin/env python3

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://veo-ux-polling.preview.emergentagent.com"
AUTH_EMAIL = "testchat@example.com"
AUTH_PASSCODE = "Test123456"

class ImageGenerationTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.auth_token = None
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'SoulPrint-Image-Test/1.0'
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

    def create_conversation(self) -> Optional[str]:
        """Create a new conversation and return its ID"""
        try:
            print("📝 Creating conversation...")
            conv_data = {"title": "Image Generation Test"}
            
            response = self.session.post(f"{self.base_url}/api/conversations", json=conv_data)
            
            if response.status_code == 200:
                data = response.json()
                conv_id = data.get('id')
                print(f"✅ Conversation created: {conv_id}")
                return conv_id
            else:
                print(f"❌ Conversation creation failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Conversation creation error: {e}")
            return None

    def parse_sse_stream(self, response) -> list:
        """Parse Server-Sent Events stream and return list of events"""
        events = []
        
        try:
            print(f"    📡 Response status: {response.status_code}")
            print(f"    📡 Response headers: {dict(response.headers)}")
            
            line_count = 0
            for line in response.iter_lines(decode_unicode=True):
                line_count += 1
                if line_count <= 5:  # Debug first few lines
                    print(f"    📡 Line {line_count}: {repr(line)}")
                
                if line and line.startswith('data: '):
                    # Standard SSE format with "data: " prefix
                    data_str = line[6:]  # Remove 'data: ' prefix
                    if data_str.strip() == '[DONE]':
                        print("    📡 Found [DONE] marker")
                        break
                    try:
                        event_data = json.loads(data_str)
                        events.append(event_data)
                        print(f"    📡 Parsed event: {event_data.get('type', 'unknown')}")
                    except json.JSONDecodeError as e:
                        print(f"    ⚠️  JSON decode error for line: {repr(data_str[:100])}")
                        continue
                elif line.strip():
                    # Try to parse as raw JSON (non-standard SSE format)
                    try:
                        event_data = json.loads(line.strip())
                        events.append(event_data)
                        print(f"    📡 Parsed raw JSON event: {event_data.get('type', 'unknown')}")
                    except json.JSONDecodeError:
                        # Not JSON, skip
                        if line_count <= 10:  # Only show first 10 non-JSON lines
                            print(f"    📡 Non-JSON line: {repr(line)}")
                        continue
            
            print(f"    📡 Total lines processed: {line_count}")
            print(f"    📡 Total events parsed: {len(events)}")
            
        except Exception as e:
            print(f"⚠️  Error parsing SSE stream: {e}")
            import traceback
            traceback.print_exc()
        
        return events

    def test_image_generation_stream(self) -> bool:
        """Test POST /api/chat/stream with image generation prompt"""
        print("\n🖼️  Testing Image Generation via Chat Stream")
        
        try:
            # Create conversation first
            conv_id = self.create_conversation()
            if not conv_id:
                return False

            # Test image generation request
            print("  📝 Test 1: Image generation request")
            chat_data = {
                "content": "Generate an image of a sunset over mountains",
                "model": "gpt-4o",
                "conversationId": conv_id
            }
            
            print("    🔄 Sending image generation request...")
            response = self.session.post(
                f"{self.base_url}/api/chat/stream", 
                json=chat_data,
                stream=True,
                timeout=120  # 2 minutes timeout for image generation
            )
            
            if response.status_code != 200:
                print(f"    ❌ Chat stream failed: {response.status_code} - {response.text}")
                return False

            print("    📡 Parsing SSE stream...")
            events = self.parse_sse_stream(response)
            
            if not events:
                print("    ❌ No events received from stream")
                return False

            print(f"    📊 Received {len(events)} events")
            
            # Check for required events
            meta_event = None
            generating_visual_event = None
            image_event = None
            done_event = None
            
            for event in events:
                event_type = event.get('type')
                if event_type == 'meta':
                    meta_event = event
                elif event_type == 'generating_visual':
                    generating_visual_event = event
                elif event_type == 'image':
                    image_event = event
                elif event_type == 'done':
                    done_event = event

            # Verify required events
            if not meta_event:
                print("    ❌ Missing 'meta' event")
                return False
            else:
                print("    ✅ Found 'meta' event")

            if not generating_visual_event:
                print("    ❌ Missing 'generating_visual' event")
                return False
            else:
                print("    ✅ Found 'generating_visual' event")

            if not image_event:
                print("    ❌ Missing 'image' event")
                return False
            else:
                print("    ✅ Found 'image' event")

            if not done_event:
                print("    ❌ Missing 'done' event")
                return False
            else:
                print("    ✅ Found 'done' event")

            # Verify image URL
            image_url = image_event.get('url')
            if not image_url:
                print("    ❌ Image event missing 'url' field")
                return False

            print(f"    🔗 Image URL: {image_url}")

            # Check if URL is from the correct domain (persisted storage)
            if 'tempfile.redpandaai.co' in image_url:
                print("    ✅ Image URL is from persisted storage (tempfile.redpandaai.co)")
            elif 'oaidalleapiprodscus.blob.core.windows.net' in image_url:
                print("    ❌ Image URL is from expired storage (oaidalleapiprodscus.blob.core.windows.net)")
                return False
            else:
                print(f"    ⚠️  Image URL from unexpected domain: {image_url}")

            # Verify image URL is accessible
            print("    🔍 Verifying image URL accessibility...")
            try:
                head_response = requests.head(image_url, timeout=10)
                if head_response.status_code == 200:
                    print("    ✅ Image URL is accessible (HTTP 200)")
                else:
                    print(f"    ❌ Image URL not accessible: {head_response.status_code}")
                    return False
            except Exception as e:
                print(f"    ❌ Error checking image URL: {e}")
                return False

            # Store conversation ID for message verification
            self.test_conv_id = conv_id
            
            return True

        except Exception as e:
            print(f"    ❌ Image generation test error: {e}")
            return False

    def test_text_only_stream(self) -> bool:
        """Test POST /api/chat/stream with text-only prompt (should NOT trigger image generation)"""
        print("\n📝 Testing Text-Only Chat Stream")
        
        try:
            # Create conversation first
            conv_id = self.create_conversation()
            if not conv_id:
                return False

            # Test text-only request
            print("  📝 Test 1: Text-only request")
            chat_data = {
                "content": "Tell me about the weather today",
                "model": "gpt-4o",
                "conversationId": conv_id
            }
            
            print("    🔄 Sending text-only request...")
            response = self.session.post(
                f"{self.base_url}/api/chat/stream", 
                json=chat_data,
                stream=True,
                timeout=60
            )
            
            if response.status_code != 200:
                print(f"    ❌ Chat stream failed: {response.status_code} - {response.text}")
                return False

            print("    📡 Parsing SSE stream...")
            events = self.parse_sse_stream(response)
            
            if not events:
                print("    ❌ No events received from stream")
                return False

            print(f"    📊 Received {len(events)} events")
            
            # Check event types
            event_types = [event.get('type') for event in events]
            
            # Should have meta, delta events, and done - but NO generating_visual or image events
            if 'generating_visual' in event_types:
                print("    ❌ Found 'generating_visual' event - should not be present for text-only")
                return False
            
            if 'image' in event_types:
                print("    ❌ Found 'image' event - should not be present for text-only")
                return False

            if 'meta' not in event_types:
                print("    ❌ Missing 'meta' event")
                return False

            if 'done' not in event_types:
                print("    ❌ Missing 'done' event")
                return False

            # Should have delta events for text content
            delta_events = [e for e in events if e.get('type') == 'delta']
            if not delta_events:
                print("    ❌ No 'delta' events found - expected for text response")
                return False

            print("    ✅ Text-only stream working correctly - no image generation triggered")
            print(f"    📊 Found {len(delta_events)} delta events for text content")
            
            return True

        except Exception as e:
            print(f"    ❌ Text-only test error: {e}")
            return False

    def test_saved_messages(self) -> bool:
        """Test GET /api/messages?conversationId={conv_id} to verify saved message structure"""
        print("\n💾 Testing Saved Messages Structure")
        
        try:
            if not hasattr(self, 'test_conv_id'):
                print("    ⚠️  No test conversation ID available - skipping message verification")
                return True

            conv_id = self.test_conv_id
            
            print(f"  📝 Test 1: Get messages for conversation {conv_id}")
            response = self.session.get(f"{self.base_url}/api/messages?conversationId={conv_id}")
            
            if response.status_code != 200:
                print(f"    ❌ Get messages failed: {response.status_code} - {response.text}")
                return False

            messages = response.json()
            if not isinstance(messages, list):
                print(f"    ❌ Expected array of messages, got: {type(messages)}")
                return False

            print(f"    📊 Found {len(messages)} messages")
            
            # Look for image messages
            image_messages = [msg for msg in messages if msg.get('content_type') == 'image']
            text_messages = [msg for msg in messages if msg.get('content_type') == 'text' or msg.get('content_type') is None]
            
            print(f"    🖼️  Image messages: {len(image_messages)}")
            print(f"    📝 Text messages: {len(text_messages)}")
            
            # Verify image messages have proper structure
            for i, img_msg in enumerate(image_messages):
                print(f"    🔍 Checking image message {i+1}:")
                
                if not img_msg.get('image_url'):
                    print(f"      ❌ Image message missing 'image_url' field")
                    return False
                
                image_url = img_msg.get('image_url')
                if not image_url.strip():
                    print(f"      ❌ Image message has empty 'image_url'")
                    return False
                
                print(f"      ✅ Has non-empty image_url: {image_url[:50]}...")
                
                # Verify content_type is 'image'
                if img_msg.get('content_type') != 'image':
                    print(f"      ❌ Expected content_type 'image', got: {img_msg.get('content_type')}")
                    return False
                
                print(f"      ✅ Correct content_type: image")

            # Verify text messages don't have image_url or have empty image_url
            for i, txt_msg in enumerate(text_messages):
                image_url = txt_msg.get('image_url')
                if image_url and image_url.strip():
                    print(f"    ⚠️  Text message {i+1} has image_url: {image_url}")
                    # This might be OK depending on implementation
                
            print("    ✅ Message structure verification completed")
            return True

        except Exception as e:
            print(f"    ❌ Saved messages test error: {e}")
            return False

    def run_all_tests(self) -> bool:
        """Run all image generation fix tests"""
        print("🚀 Starting SoulPrint Image Generation Fix Testing")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"👤 Auth: {AUTH_EMAIL}")
        
        # Authenticate first
        if not self.authenticate():
            return False
        
        # Run all tests
        tests = [
            ("Image Generation Stream", self.test_image_generation_stream),
            ("Text-Only Stream", self.test_text_only_stream),
            ("Saved Messages Structure", self.test_saved_messages),
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
        print("📊 IMAGE GENERATION FIX TESTING SUMMARY")
        print("="*60)
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{status}: {test_name}")
        
        print(f"\n🎯 Overall Result: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL IMAGE GENERATION FIX TESTS PASSED!")
            return True
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return False

def main():
    tester = ImageGenerationTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()