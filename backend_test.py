#!/usr/bin/env python3
"""
Backend Testing Script for Intent Detection Order Fix
Tests the updated intent detection order for mockup vs composite_edit
"""

import requests
import json
import base64
import time
import sys
from io import BytesIO
from PIL import Image

# Configuration
BASE_URL = "https://chat-composite-edit.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_id = None
        
    def authenticate(self):
        """Authenticate with test credentials"""
        try:
            print("🔐 Authenticating...")
            response = self.session.post(f"{API_BASE}/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                self.user_id = data.get('userId')
                self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                print(f"✅ Authentication successful! User ID: {self.user_id}")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False
    
    def create_test_logo_image(self):
        """Create a simple test logo image as base64"""
        try:
            # Create a simple logo image (100x100 red circle)
            img = Image.new('RGBA', (100, 100), (255, 255, 255, 0))
            from PIL import ImageDraw
            draw = ImageDraw.Draw(img)
            draw.ellipse([10, 10, 90, 90], fill=(255, 0, 0, 255))
            
            # Convert to base64
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            img_data = buffer.getvalue()
            base64_data = base64.b64encode(img_data).decode('utf-8')
            
            return f"data:image/png;base64,{base64_data}"
        except Exception as e:
            print(f"❌ Error creating test logo: {e}")
            return None
    
    def test_intent_detection(self, content, attachment_data=None, expected_intent=None, test_name=""):
        """Test intent detection via chat stream"""
        try:
            print(f"\n🧪 Testing: {test_name}")
            print(f"📝 Content: {content}")
            print(f"📎 Has attachment: {'Yes' if attachment_data else 'No'}")
            print(f"🎯 Expected intent: {expected_intent}")
            
            # Prepare request payload
            payload = {
                "content": content,
                "model": "gpt-4o",
                "conversationId": f"test-{int(time.time())}"
            }
            
            # Add attachment if provided
            if attachment_data:
                payload["attachments"] = [{
                    "type": "image",
                    "data": attachment_data,
                    "mimeType": "image/png"
                }]
            
            # Make request to chat stream
            response = self.session.post(f"{API_BASE}/chat/stream", 
                                       json=payload,
                                       stream=True)
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code} - {response.text}")
                return False
            
            # Parse NDJSON stream to find intent detection
            detected_intent = None
            backend_logs = []
            
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode('utf-8'))
                        
                        # Look for meta information with intent
                        if data.get('type') == 'meta':
                            meta = data.get('meta', {})
                            if 'mediaIntent' in meta:
                                detected_intent = meta['mediaIntent']
                                print(f"🔍 Detected intent: {detected_intent}")
                        
                        # Look for delta content that might contain backend logs
                        if data.get('type') == 'delta':
                            content_chunk = data.get('content', '')
                            if '[Mockup]' in content_chunk or '[Composite Edit]' in content_chunk:
                                backend_logs.append(content_chunk)
                                print(f"📋 Backend log: {content_chunk.strip()}")
                        
                        # Stop after getting the intent and some content
                        if detected_intent and len(backend_logs) > 0:
                            break
                            
                    except json.JSONDecodeError:
                        continue
            
            # Verify results
            if expected_intent:
                if detected_intent == expected_intent:
                    print(f"✅ PASS: Intent correctly detected as '{detected_intent}'")
                    return True
                else:
                    print(f"❌ FAIL: Expected '{expected_intent}' but got '{detected_intent}'")
                    return False
            else:
                print(f"ℹ️  Intent detected: {detected_intent}")
                return True
                
        except Exception as e:
            print(f"❌ Test error: {e}")
            return False
    
    def run_critical_test(self):
        """Run the critical test from the review request"""
        print("\n" + "="*80)
        print("🚨 CRITICAL TEST - Must Pass")
        print("="*80)
        
        logo_data = self.create_test_logo_image()
        if not logo_data:
            print("❌ Failed to create test logo")
            return False
        
        # The critical test case
        content = "can you add this logo to the back of a tshirt that someone is wearing that is sitting around campfire?"
        
        result = self.test_intent_detection(
            content=content,
            attachment_data=logo_data,
            expected_intent="mockup",
            test_name="Critical Test - T-shirt with scene context"
        )
        
        return result
    
    def run_additional_tests(self):
        """Run additional test cases"""
        print("\n" + "="*80)
        print("🧪 ADDITIONAL TESTS")
        print("="*80)
        
        logo_data = self.create_test_logo_image()
        if not logo_data:
            print("❌ Failed to create test logo")
            return False
        
        test_cases = [
            {
                "content": "put this logo on a hoodie",
                "attachment": logo_data,
                "expected": "mockup",
                "name": "Simple hoodie mockup"
            },
            {
                "content": "add this logo to the car",
                "attachment": logo_data,
                "expected": "composite_edit",
                "name": "Car composite edit"
            },
            {
                "content": "add this logo to the minivan door",
                "attachment": logo_data,
                "expected": "composite_edit",
                "name": "Minivan door composite edit"
            }
        ]
        
        results = []
        for test_case in test_cases:
            result = self.test_intent_detection(
                content=test_case["content"],
                attachment_data=test_case["attachment"],
                expected_intent=test_case["expected"],
                test_name=test_case["name"]
            )
            results.append(result)
        
        return all(results)
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Intent Detection Order Testing")
        print("="*80)
        
        # Authenticate first
        if not self.authenticate():
            return False
        
        # Run critical test
        critical_passed = self.run_critical_test()
        
        # Run additional tests
        additional_passed = self.run_additional_tests()
        
        # Summary
        print("\n" + "="*80)
        print("📊 TEST SUMMARY")
        print("="*80)
        
        if critical_passed:
            print("✅ CRITICAL TEST: PASSED")
        else:
            print("❌ CRITICAL TEST: FAILED")
        
        if additional_passed:
            print("✅ ADDITIONAL TESTS: PASSED")
        else:
            print("❌ ADDITIONAL TESTS: FAILED")
        
        overall_success = critical_passed and additional_passed
        
        if overall_success:
            print("\n🎉 ALL TESTS PASSED! Intent detection order fix is working correctly.")
        else:
            print("\n⚠️  SOME TESTS FAILED! Intent detection order needs attention.")
        
        return overall_success

def main():
    """Main test execution"""
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ Backend testing completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Backend testing failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()