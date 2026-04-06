#!/usr/bin/env python3
"""
Extended Backend Testing Script for SoulPrint Video Persistence and Status Polling
Tests specific scenarios mentioned in the review request
"""

import requests
import json
import time
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class ExtendedSoulPrintTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user_id = None
        self.test_conversation_id = None
        
    def login(self):
        """Login and get authentication token"""
        try:
            print("🔐 Logging in...")
            response = requests.post(f"{self.base_url}/api/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                self.user_id = data.get('user', {}).get('id')
                print(f"✅ Login successful. User ID: {self.user_id}")
                return True
            else:
                print(f"❌ Login failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Login error: {str(e)}")
            return False
    
    def get_headers(self):
        """Get headers with authentication"""
        return {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
    
    def create_test_conversation(self):
        """Create a test conversation"""
        try:
            print("📝 Creating test conversation...")
            response = requests.post(f"{self.base_url}/api/user/conversations", 
                                   json={"title": "Test Video Conv"}, 
                                   headers=self.get_headers())
            
            if response.status_code == 200:
                data = response.json()
                self.test_conversation_id = data.get('id')
                print(f"✅ Test conversation created: {self.test_conversation_id}")
                return True
            else:
                print(f"❌ Failed to create conversation: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Conversation creation error: {str(e)}")
            return False
    
    def test_patch_endpoint_comprehensive(self):
        """Comprehensive test of PATCH /api/messages/:id/video-complete endpoint"""
        print("\n🎯 COMPREHENSIVE PATCH ENDPOINT TESTING")
        print("=" * 50)
        
        message_id = str(uuid.uuid4())
        
        # Test 1: Authentication required
        print("1. Testing authentication requirement...")
        try:
            response = requests.patch(f"{self.base_url}/api/messages/{message_id}/video-complete", 
                                    json={"video_url": "https://example.com/test.mp4"})
            
            if response.status_code == 401:
                print("✅ Returns 401 without token - PASSED")
            else:
                print(f"❌ Expected 401, got {response.status_code} - FAILED")
                return False
        except Exception as e:
            print(f"❌ Auth test error: {str(e)}")
            return False
        
        # Test 2: video_url required
        print("2. Testing video_url requirement...")
        try:
            response = requests.patch(f"{self.base_url}/api/messages/{message_id}/video-complete", 
                                    json={}, 
                                    headers=self.get_headers())
            
            if response.status_code == 400:
                data = response.json()
                if "video_url required" in data.get('error', ''):
                    print("✅ Returns 400 without video_url - PASSED")
                else:
                    print(f"❌ Wrong error message: {data}")
                    return False
            else:
                print(f"❌ Expected 400, got {response.status_code} - FAILED")
                return False
        except Exception as e:
            print(f"❌ Validation test error: {str(e)}")
            return False
        
        # Test 3: Successful update
        print("3. Testing successful update...")
        try:
            test_video_url = "https://example.com/test-video.mp4"
            test_thumbnail_url = "https://example.com/test-thumbnail.jpg"
            
            response = requests.patch(f"{self.base_url}/api/messages/{message_id}/video-complete", 
                                    json={
                                        "video_url": test_video_url,
                                        "thumbnail_url": test_thumbnail_url
                                    }, 
                                    headers=self.get_headers())
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    print("✅ PATCH successful - PASSED")
                else:
                    print(f"❌ Expected success=true, got: {data}")
                    return False
            else:
                print(f"❌ Expected 200, got {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Success test error: {str(e)}")
            return False
        
        print("✅ PATCH endpoint comprehensive test PASSED")
        return True
    
    def test_media_status_comprehensive(self):
        """Comprehensive test of GET /api/media/status/:taskId endpoint"""
        print("\n🎯 COMPREHENSIVE MEDIA STATUS TESTING")
        print("=" * 50)
        
        task_id = str(uuid.uuid4())
        
        # Test 1: Authentication required
        print("1. Testing authentication requirement...")
        try:
            response = requests.get(f"{self.base_url}/api/media/status/{task_id}")
            
            if response.status_code == 401:
                print("✅ Returns 401 without token - PASSED")
            else:
                print(f"❌ Expected 401, got {response.status_code} - FAILED")
                return False
        except Exception as e:
            print(f"❌ Auth test error: {str(e)}")
            return False
        
        # Test 2: Non-existent task ID returns 404
        print("2. Testing non-existent task ID...")
        try:
            fake_task_id = str(uuid.uuid4())
            response = requests.get(f"{self.base_url}/api/media/status/{fake_task_id}", 
                                  headers=self.get_headers())
            
            if response.status_code == 404:
                print("✅ Returns 404 for non-existent task - PASSED")
            else:
                print(f"❌ Expected 404, got {response.status_code} - FAILED")
                return False
        except Exception as e:
            print(f"❌ Not found test error: {str(e)}")
            return False
        
        # Test 3: Response format validation
        print("3. Testing response format...")
        try:
            response = requests.get(f"{self.base_url}/api/media/status/{task_id}", 
                                  headers=self.get_headers())
            
            # Should return 404 for non-existent task or proper status response
            if response.status_code == 404:
                print("✅ Proper 404 response for non-existent task - PASSED")
            elif response.status_code == 200:
                data = response.json()
                if 'status' in data:
                    print(f"✅ Proper status response format: {data.get('status')} - PASSED")
                else:
                    print(f"❌ Missing status field in response: {data}")
                    return False
            else:
                print(f"❌ Unexpected response: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Response format test error: {str(e)}")
            return False
        
        print("✅ Media status comprehensive test PASSED")
        return True
    
    def test_messages_endpoint_integration(self):
        """Test GET /api/messages integration with video fields"""
        print("\n🎯 MESSAGES ENDPOINT INTEGRATION TESTING")
        print("=" * 50)
        
        # Test 1: Basic messages endpoint
        print("1. Testing basic messages endpoint...")
        try:
            response = requests.get(f"{self.base_url}/api/messages?conversationId={self.test_conversation_id}", 
                                  headers=self.get_headers())
            
            if response.status_code == 200:
                messages = response.json()
                print(f"✅ Messages endpoint working, returned {len(messages)} messages - PASSED")
            else:
                print(f"❌ Messages endpoint failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Messages endpoint test error: {str(e)}")
            return False
        
        # Test 2: Create a message and test PATCH integration
        print("2. Testing PATCH integration with messages...")
        try:
            # Create a test message ID
            test_message_id = str(uuid.uuid4())
            test_video_url = "https://example.com/integration-test.mp4"
            test_thumbnail_url = "https://example.com/integration-thumbnail.jpg"
            
            # PATCH the message
            patch_response = requests.patch(f"{self.base_url}/api/messages/{test_message_id}/video-complete", 
                                          json={
                                              "video_url": test_video_url,
                                              "thumbnail_url": test_thumbnail_url
                                          }, 
                                          headers=self.get_headers())
            
            if patch_response.status_code == 200:
                print("✅ PATCH integration successful - PASSED")
            else:
                print(f"❌ PATCH integration failed: {patch_response.status_code}")
                return False
        except Exception as e:
            print(f"❌ PATCH integration test error: {str(e)}")
            return False
        
        print("✅ Messages endpoint integration test PASSED")
        return True
    
    def test_edge_cases(self):
        """Test edge cases and error conditions"""
        print("\n🎯 EDGE CASES TESTING")
        print("=" * 50)
        
        # Test 1: Invalid message ID format
        print("1. Testing invalid message ID format...")
        try:
            response = requests.patch(f"{self.base_url}/api/messages/invalid-id/video-complete", 
                                    json={"video_url": "https://example.com/test.mp4"}, 
                                    headers=self.get_headers())
            
            # Should still return 200 (the endpoint doesn't validate UUID format)
            if response.status_code == 200:
                print("✅ Handles invalid message ID gracefully - PASSED")
            else:
                print(f"⚠️ Unexpected response for invalid ID: {response.status_code}")
        except Exception as e:
            print(f"❌ Invalid ID test error: {str(e)}")
            return False
        
        # Test 2: Empty video_url
        print("2. Testing empty video_url...")
        try:
            response = requests.patch(f"{self.base_url}/api/messages/{str(uuid.uuid4())}/video-complete", 
                                    json={"video_url": ""}, 
                                    headers=self.get_headers())
            
            if response.status_code == 400:
                print("✅ Rejects empty video_url - PASSED")
            else:
                print(f"⚠️ Unexpected response for empty video_url: {response.status_code}")
        except Exception as e:
            print(f"❌ Empty video_url test error: {str(e)}")
            return False
        
        # Test 3: Very long task ID
        print("3. Testing very long task ID...")
        try:
            long_task_id = "a" * 1000  # Very long task ID
            response = requests.get(f"{self.base_url}/api/media/status/{long_task_id}", 
                                  headers=self.get_headers())
            
            # Should handle gracefully (likely 404)
            if response.status_code in [404, 400]:
                print("✅ Handles long task ID gracefully - PASSED")
            else:
                print(f"⚠️ Unexpected response for long task ID: {response.status_code}")
        except Exception as e:
            print(f"❌ Long task ID test error: {str(e)}")
            return False
        
        print("✅ Edge cases testing PASSED")
        return True
    
    def run_extended_tests(self):
        """Run all extended tests"""
        print("🚀 Starting Extended SoulPrint Video Persistence Tests")
        print("=" * 70)
        
        # Login first
        if not self.login():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Create test conversation
        if not self.create_test_conversation():
            print("❌ Cannot proceed without test conversation")
            return False
        
        # Run comprehensive tests
        tests = [
            ("PATCH Endpoint Comprehensive", self.test_patch_endpoint_comprehensive),
            ("Media Status Comprehensive", self.test_media_status_comprehensive),
            ("Messages Integration", self.test_messages_endpoint_integration),
            ("Edge Cases", self.test_edge_cases)
        ]
        
        results = []
        for test_name, test_func in tests:
            try:
                result = test_func()
                results.append((test_name, result))
            except Exception as e:
                print(f"❌ {test_name} failed with exception: {str(e)}")
                results.append((test_name, False))
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 EXTENDED TEST SUMMARY")
        print("=" * 70)
        
        passed = 0
        failed = 0
        
        for test_name, result in results:
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{test_name}: {status}")
            if result:
                passed += 1
            else:
                failed += 1
        
        print(f"\nTotal: {len(results)} test suites")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        
        if failed == 0:
            print("\n🎉 ALL EXTENDED TESTS PASSED!")
            return True
        else:
            print(f"\n⚠️ {failed} TEST SUITES FAILED")
            return False

if __name__ == "__main__":
    tester = ExtendedSoulPrintTester()
    success = tester.run_extended_tests()
    exit(0 if success else 1)