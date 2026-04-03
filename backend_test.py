#!/usr/bin/env python3
"""
Backend Test for Question vs Edit Detection Fix in Chat Stream Endpoint
Tests the fix that prevents questions from triggering image edits.
"""

import requests
import json
import time
import sys
from typing import Dict, Any, List, Optional

# Configuration
BASE_URL = "https://veo-ux-polling.preview.emergentagent.com"
AUTH_EMAIL = "testchat@example.com"
AUTH_PASSCODE = "Test123456"

class ChatStreamTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.conversation_id = None
        
    def authenticate(self) -> bool:
        """Authenticate and get token with retry logic"""
        max_retries = 3
        retry_delay = 30
        
        for attempt in range(max_retries):
            try:
                print(f"🔐 Authenticating... (attempt {attempt + 1}/{max_retries})")
                response = self.session.post(
                    f"{BASE_URL}/api/auth/login",
                    json={"email": AUTH_EMAIL, "passcode": AUTH_PASSCODE},
                    headers={"Content-Type": "application/json"},
                    timeout=30
                )
                
                print(f"   Response status: {response.status_code}")
                print(f"   Response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    data = response.json()
                    self.auth_token = data.get("token")
                    if self.auth_token:
                        self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                        print(f"✅ Authentication successful")
                        return True
                    else:
                        print(f"❌ No token in response: {data}")
                        return False
                elif response.status_code == 503:
                    print(f"⚠️ Service temporarily unavailable (503). Waiting {retry_delay}s before retry...")
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue
                    else:
                        print(f"❌ Authentication failed after {max_retries} attempts: {response.text}")
                        return False
                else:
                    print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                    return False
                    
            except Exception as e:
                print(f"❌ Authentication error (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    print(f"   Waiting {retry_delay}s before retry...")
                    time.sleep(retry_delay)
                else:
                    return False
        
        return False
    
    def create_conversation(self) -> bool:
        """Create a test conversation"""
        try:
            print("💬 Creating conversation...")
            response = self.session.post(
                f"{BASE_URL}/api/conversations",
                json={"title": "Test Question Detection"},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.conversation_id = data.get("id")
                if self.conversation_id:
                    print(f"✅ Conversation created: {self.conversation_id}")
                    return True
                else:
                    print(f"❌ No conversation ID in response: {data}")
                    return False
            else:
                print(f"❌ Conversation creation failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Conversation creation error: {e}")
            return False
    
    def send_chat_message(self, message: str, timeout: int = 60) -> Dict[str, Any]:
        """Send a chat message and parse SSE stream response"""
        try:
            print(f"📤 Sending message: '{message[:50]}{'...' if len(message) > 50 else ''}'")
            
            response = self.session.post(
                f"{BASE_URL}/api/chat/stream",
                json={
                    "content": message,
                    "conversationId": self.conversation_id
                },
                headers={"Content-Type": "application/json"},
                stream=True,
                timeout=timeout
            )
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}",
                    "events": []
                }
            
            # Parse SSE stream
            events = []
            content_buffer = ""
            
            start_time = time.time()
            for line in response.iter_lines(decode_unicode=True):
                if time.time() - start_time > timeout:
                    print(f"⏰ Timeout after {timeout}s")
                    break
                    
                if line and line.strip():
                    try:
                        event_data = json.loads(line)
                        events.append(event_data)
                        
                        # Track content for analysis
                        if event_data.get("type") == "delta":
                            content_buffer += event_data.get("content", "")
                        
                        # Print key events for debugging
                        event_type = event_data.get("type")
                        if event_type in ["generating_visual", "image", "done"]:
                            print(f"  📡 Event: {event_type} - {event_data}")
                        
                        # Stop early if we detect image editing or completion
                        if event_type == "generating_visual" and event_data.get("visualType") == "edit":
                            print(f"  🎨 IMAGE EDIT DETECTED!")
                            # Continue reading a bit more to get the full context
                            time.sleep(2)
                            
                        elif event_type == "done":
                            print(f"  ✅ Stream completed")
                            break
                            
                    except json.JSONDecodeError as e:
                        print(f"  ⚠️ Failed to parse line as JSON: {line[:100]}")
                        continue
            
            return {
                "success": True,
                "events": events,
                "content": content_buffer,
                "has_image_edit": any(
                    e.get("type") == "generating_visual" and e.get("visualType") == "edit" 
                    for e in events
                ),
                "has_edit_message": "Editing your image" in content_buffer,
                "has_image_generation": any(
                    e.get("type") == "generating_visual" and e.get("visualType") == "image"
                    for e in events
                ),
                "has_image_url": any(e.get("type") == "image" for e in events)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "events": []
            }
    
    def test_image_generation(self) -> bool:
        """Generate an image to establish context for edit testing"""
        print("\n🎨 STEP 1: Generating initial image for context...")
        
        result = self.send_chat_message(
            "generate a photo realistic image of a cat sitting on a couch",
            timeout=90  # Image generation takes longer
        )
        
        if not result["success"]:
            print(f"❌ Image generation failed: {result['error']}")
            return False
        
        if result["has_image_generation"] and result["has_image_url"]:
            print("✅ Image generation successful - context established")
            return True
        else:
            print("❌ Image generation did not complete properly")
            print(f"   Has image generation event: {result['has_image_generation']}")
            print(f"   Has image URL: {result['has_image_url']}")
            return False
    
    def test_question_messages(self) -> bool:
        """Test that question messages do NOT trigger image editing"""
        print("\n❓ STEP 2: Testing question messages (should NOT trigger image editing)...")
        
        question_messages = [
            "why is the cat sitting on the couch?",
            "what color is the cat in the image?", 
            "how was this image generated?",
            "in this image, why does the cat look so realistic?",
            "is the cat a specific breed?",
            "tell me about the image style",
            "that is not an edit. I'm asking a question."
        ]
        
        failed_tests = []
        
        for i, message in enumerate(question_messages, 1):
            print(f"\n  Test {i}/{len(question_messages)}: '{message}'")
            
            result = self.send_chat_message(message, timeout=30)
            
            if not result["success"]:
                print(f"    ❌ Request failed: {result['error']}")
                failed_tests.append(f"Question {i}: Request failed")
                continue
            
            # Check if image editing was triggered (it should NOT be)
            if result["has_image_edit"] or result["has_edit_message"]:
                print(f"    ❌ FAILED: Question triggered image editing!")
                print(f"       Has image edit event: {result['has_image_edit']}")
                print(f"       Has edit message: {result['has_edit_message']}")
                failed_tests.append(f"Question {i}: Incorrectly triggered image editing")
            else:
                print(f"    ✅ PASSED: Question did not trigger image editing")
        
        if failed_tests:
            print(f"\n❌ Question test failures:")
            for failure in failed_tests:
                print(f"   - {failure}")
            return False
        else:
            print(f"\n✅ All {len(question_messages)} question tests passed!")
            return True
    
    def test_edit_messages(self) -> bool:
        """Test that real edit messages DO trigger image editing"""
        print("\n✏️ STEP 3: Testing edit messages (should trigger image editing)...")
        
        # First, let's check if we can find the image in the conversation
        print("🔍 Checking conversation for recent images...")
        try:
            response = self.session.get(
                f"{BASE_URL}/api/messages?conversationId={self.conversation_id}",
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                messages = response.json()
                print(f"   Found {len(messages)} messages in conversation")
                for i, msg in enumerate(messages[-5:]):  # Check last 5 messages
                    print(f"   Message {i+1}: role={msg.get('role')}, content_type={msg.get('content_type')}, image_url={bool(msg.get('image_url'))}")
                    if msg.get('image_url'):
                        print(f"      Image URL: {msg.get('image_url')[:80]}...")
                    if msg.get('content') and '![' in str(msg.get('content')):
                        print(f"      Content has image markdown: {str(msg.get('content'))[:100]}...")
            else:
                print(f"   Failed to get messages: {response.status_code}")
        except Exception as e:
            print(f"   Error checking messages: {e}")
        
        edit_messages = [
            "make the cat wear sunglasses",
            "change the couch to red", 
            "add a hat to the cat"
        ]
        
        failed_tests = []
        
        for i, message in enumerate(edit_messages, 1):
            print(f"\n  Test {i}/{len(edit_messages)}: '{message}'")
            
            result = self.send_chat_message(message, timeout=60)
            
            if not result["success"]:
                print(f"    ❌ Request failed: {result['error']}")
                failed_tests.append(f"Edit {i}: Request failed")
                continue
            
            # Check if image editing was triggered (it SHOULD be)
            if result["has_image_edit"] or result["has_edit_message"]:
                print(f"    ✅ PASSED: Edit request correctly triggered image editing")
            else:
                print(f"    ❌ FAILED: Edit request did not trigger image editing!")
                print(f"       Has image edit event: {result['has_image_edit']}")
                print(f"       Has edit message: {result['has_edit_message']}")
                failed_tests.append(f"Edit {i}: Did not trigger image editing")
        
        if failed_tests:
            print(f"\n❌ Edit test failures:")
            for failure in failed_tests:
                print(f"   - {failure}")
            return False
        else:
            print(f"\n✅ All {len(edit_messages)} edit tests passed!")
            return True
    
    def test_edge_cases(self) -> bool:
        """Test edge cases - questions with edit-like words that should NOT trigger edits"""
        print("\n🔍 STEP 4: Testing edge cases (questions with edit-like words)...")
        
        edge_case_messages = [
            "why did you change the background in the last version?",
            "can you explain what makes this image look so realistic?",
            "what would happen if we remove the couch from the concept?"
        ]
        
        failed_tests = []
        
        for i, message in enumerate(edge_case_messages, 1):
            print(f"\n  Test {i}/{len(edge_case_messages)}: '{message}'")
            
            result = self.send_chat_message(message, timeout=30)
            
            if not result["success"]:
                print(f"    ❌ Request failed: {result['error']}")
                failed_tests.append(f"Edge case {i}: Request failed")
                continue
            
            # These should be treated as questions, not edits
            if result["has_image_edit"] or result["has_edit_message"]:
                print(f"    ❌ FAILED: Edge case question triggered image editing!")
                print(f"       Has image edit event: {result['has_image_edit']}")
                print(f"       Has edit message: {result['has_edit_message']}")
                failed_tests.append(f"Edge case {i}: Incorrectly triggered image editing")
            else:
                print(f"    ✅ PASSED: Edge case question did not trigger image editing")
        
        if failed_tests:
            print(f"\n❌ Edge case test failures:")
            for failure in failed_tests:
                print(f"   - {failure}")
            return False
        else:
            print(f"\n✅ All {len(edge_case_messages)} edge case tests passed!")
            return True
    
    def run_all_tests(self) -> bool:
        """Run the complete test suite"""
        print("🚀 Starting Question vs Edit Detection Test Suite")
        print(f"   Base URL: {BASE_URL}")
        print(f"   Auth: {AUTH_EMAIL}")
        
        # Step 1: Authentication
        if not self.authenticate():
            return False
        
        # Step 2: Create conversation
        if not self.create_conversation():
            return False
        
        # Step 3: Generate initial image
        if not self.test_image_generation():
            return False
        
        # Step 4: Test questions (should NOT trigger edits)
        questions_passed = self.test_question_messages()
        
        # Step 5: Test real edits (should trigger edits)
        edits_passed = self.test_edit_messages()
        
        # Step 6: Test edge cases
        edge_cases_passed = self.test_edge_cases()
        
        # Final results
        print("\n" + "="*60)
        print("📊 FINAL TEST RESULTS")
        print("="*60)
        print(f"✅ Authentication: PASSED")
        print(f"✅ Conversation Creation: PASSED") 
        print(f"✅ Image Generation: PASSED")
        print(f"{'✅' if questions_passed else '❌'} Question Detection: {'PASSED' if questions_passed else 'FAILED'}")
        print(f"{'✅' if edits_passed else '❌'} Edit Detection: {'PASSED' if edits_passed else 'FAILED'}")
        print(f"{'✅' if edge_cases_passed else '❌'} Edge Cases: {'PASSED' if edge_cases_passed else 'FAILED'}")
        
        all_passed = questions_passed and edits_passed and edge_cases_passed
        
        if all_passed:
            print("\n🎉 ALL TESTS PASSED! Question vs Edit Detection is working correctly.")
        else:
            print("\n❌ SOME TESTS FAILED! Question vs Edit Detection needs attention.")
        
        return all_passed

def main():
    """Main test execution"""
    tester = ChatStreamTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()