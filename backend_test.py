#!/usr/bin/env python3
"""
Backend Testing Script for SoulPrint Engine
Testing NEW SMART Intent Detection for Mockup vs Composite Edit
"""

import requests
import json
import base64
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://chat-composite-edit.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        
    def authenticate(self) -> bool:
        """Authenticate with test credentials"""
        try:
            print("🔐 Authenticating...")
            response = self.session.post(f"{API_BASE}/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('token')
                self.user_id = data.get('userId')
                self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                print(f"✅ Authentication successful! User ID: {self.user_id}")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def create_test_image_attachment(self) -> str:
        """Create a simple test image as base64 for attachment testing"""
        # Simple 1x1 PNG image in base64
        png_data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg=="
        return f"data:image/png;base64,{png_data}"
    
    def test_intent_detection(self, message: str, expected_intent: str, test_name: str, has_attachment: bool = False) -> bool:
        """Test intent detection via chat stream"""
        try:
            print(f"\n🧪 Testing: {test_name}")
            print(f"📝 Message: '{message}'")
            print(f"🎯 Expected Intent: {expected_intent}")
            
            # Prepare request payload
            payload = {
                "content": message,
                "model": "gpt-4o",
                "conversationId": f"test-{int(time.time())}"
            }
            
            # Add attachment if needed
            if has_attachment:
                payload["attachments"] = [{
                    "type": "image",
                    "data": self.create_test_image_attachment(),
                    "name": "test-logo.png"
                }]
                print("📎 Attachment: Test logo image added")
            
            # Make request to chat stream
            response = self.session.post(
                f"{API_BASE}/chat/stream",
                json=payload,
                stream=True,
                headers={'Accept': 'text/plain'}
            )
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code} - {response.text}")
                return False
            
            # Parse NDJSON stream to find intent detection logs
            detected_intent = None
            backend_logs = []
            
            for line in response.iter_lines(decode_unicode=True):
                if line.strip():
                    try:
                        data = json.loads(line)
                        
                        # Look for meta information that might contain intent
                        if data.get('type') == 'meta':
                            meta = data.get('meta', {})
                            if 'mediaIntent' in meta:
                                detected_intent = meta['mediaIntent']
                                print(f"🎯 Detected Intent: {detected_intent}")
                        
                        # Look for delta content that might contain backend logs
                        if data.get('type') == 'delta':
                            content = data.get('content', '')
                            if '[Mockup]' in content or '[Composite Edit]' in content:
                                backend_logs.append(content)
                                print(f"📋 Backend Log: {content}")
                        
                        # Stop after getting done signal
                        if data.get('type') == 'done':
                            break
                            
                    except json.JSONDecodeError:
                        continue
            
            # Check if intent matches expectation
            if detected_intent == expected_intent:
                print(f"✅ PASS: Intent correctly detected as '{detected_intent}'")
                if backend_logs:
                    print(f"📋 Backend logs confirm: {backend_logs}")
                return True
            else:
                print(f"❌ FAIL: Expected '{expected_intent}' but got '{detected_intent}'")
                if backend_logs:
                    print(f"📋 Backend logs: {backend_logs}")
                return False
                
        except Exception as e:
            print(f"❌ Test error: {str(e)}")
            return False
    
    def run_mockup_tests(self) -> Dict[str, bool]:
        """Run all mockup intent detection tests"""
        print("\n" + "="*80)
        print("🎨 TESTING MOCKUP INTENT DETECTION")
        print("="*80)
        
        mockup_tests = [
            {
                "message": "add this logo to the back of a tshirt that someone is wearing at a campfire",
                "expected": "mockup",
                "name": "Scene-based mockup with lifestyle context",
                "attachment": True
            },
            {
                "message": "put this logo on a surfboard that someone is holding at the beach",
                "expected": "mockup", 
                "name": "Beach lifestyle mockup",
                "attachment": True
            },
            {
                "message": "add this design to a jacket that people are wearing at a concert",
                "expected": "mockup",
                "name": "Concert scene mockup",
                "attachment": True
            },
            {
                "message": "create a mockup of this logo on a skateboard",
                "expected": "mockup",
                "name": "Direct mockup request",
                "attachment": True
            },
            {
                "message": "put this on a coffee mug",
                "expected": "mockup",
                "name": "Product mockup with indefinite article",
                "attachment": True
            },
            {
                "message": "add this logo to a laptop someone is using in an office",
                "expected": "mockup",
                "name": "Office lifestyle mockup",
                "attachment": True
            }
        ]
        
        results = {}
        for test in mockup_tests:
            success = self.test_intent_detection(
                test["message"], 
                test["expected"], 
                test["name"],
                test["attachment"]
            )
            results[test["name"]] = success
            time.sleep(1)  # Brief pause between tests
        
        return results
    
    def run_composite_edit_tests(self) -> Dict[str, bool]:
        """Run all composite edit intent detection tests"""
        print("\n" + "="*80)
        print("🔧 TESTING COMPOSITE_EDIT INTENT DETECTION")
        print("="*80)
        
        composite_tests = [
            {
                "message": "add this logo to the car",
                "expected": "composite_edit",
                "name": "Definite article existing item",
                "attachment": True
            },
            {
                "message": "put this on the image",
                "expected": "composite_edit",
                "name": "Reference to existing image",
                "attachment": True
            },
            {
                "message": "add it there",
                "expected": "composite_edit",
                "name": "Spatial reference to existing",
                "attachment": True
            },
            {
                "message": "put this logo on that picture",
                "expected": "composite_edit",
                "name": "Reference to specific picture",
                "attachment": True
            }
        ]
        
        results = {}
        for test in composite_tests:
            success = self.test_intent_detection(
                test["message"],
                test["expected"],
                test["name"], 
                test["attachment"]
            )
            results[test["name"]] = success
            time.sleep(1)  # Brief pause between tests
        
        return results
    
    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting NEW SMART Intent Detection Testing")
        print(f"🌐 Base URL: {BASE_URL}")
        print(f"👤 Test User: {TEST_EMAIL}")
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Cannot proceed without authentication")
            return
        
        # Run mockup tests
        mockup_results = self.run_mockup_tests()
        
        # Run composite edit tests  
        composite_results = self.run_composite_edit_tests()
        
        # Summary
        print("\n" + "="*80)
        print("📊 TEST RESULTS SUMMARY")
        print("="*80)
        
        all_results = {**mockup_results, **composite_results}
        passed = sum(1 for result in all_results.values() if result)
        total = len(all_results)
        
        print(f"\n🎯 MOCKUP TESTS:")
        for test_name, result in mockup_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status}: {test_name}")
        
        print(f"\n🔧 COMPOSITE_EDIT TESTS:")
        for test_name, result in composite_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status}: {test_name}")
        
        print(f"\n📈 OVERALL RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! NEW SMART Intent Detection is working correctly!")
        else:
            print("⚠️  Some tests failed. Intent detection may need adjustment.")
        
        return all_results

def main():
    """Main test execution"""
    tester = BackendTester()
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    if all(results.values()):
        sys.exit(0)  # Success
    else:
        sys.exit(1)  # Some tests failed

if __name__ == "__main__":
    main()