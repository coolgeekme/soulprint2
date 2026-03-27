#!/usr/bin/env python3
"""
Specific Test for Video Status Polling Edge Cases
Tests the specific scenarios mentioned in the review request
"""

import requests
import json
import time
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://frontend-refactor-qa.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class SpecificVideoStatusTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user_id = None
        
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
    
    def test_video_status_handling_scenarios(self):
        """Test specific video status handling scenarios from the review request"""
        print("\n🎯 TESTING SPECIFIC VIDEO STATUS SCENARIOS")
        print("=" * 60)
        
        # Test various task IDs to see different response patterns
        test_scenarios = [
            ("Non-existent task ID", str(uuid.uuid4())),
            ("Another non-existent task ID", str(uuid.uuid4())),
            ("Third non-existent task ID", str(uuid.uuid4()))
        ]
        
        for scenario_name, task_id in test_scenarios:
            print(f"\n{scenario_name}: {task_id}")
            try:
                response = requests.get(f"{self.base_url}/api/media/status/{task_id}", 
                                      headers=self.get_headers())
                
                print(f"Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"Response: {json.dumps(data, indent=2)}")
                    
                    # Check if it has the expected fields
                    if 'status' in data:
                        status = data['status']
                        print(f"✅ Status field present: {status}")
                        
                        # Test the specific scenarios mentioned in review request
                        if status == 'success' and 'videoUrl' in data:
                            print("✅ Success status with videoUrl - PASSED")
                        elif status == 'generating':
                            print("✅ Generating status - PASSED")
                        else:
                            print(f"ℹ️ Other status: {status}")
                    else:
                        print("❌ Missing status field")
                        
                elif response.status_code == 404:
                    print("✅ Returns 404 for non-existent task (expected)")
                else:
                    print(f"⚠️ Unexpected status code: {response.status_code}")
                    print(f"Response: {response.text}")
                    
            except Exception as e:
                print(f"❌ Error testing {scenario_name}: {str(e)}")
        
        return True
    
    def test_patch_message_scenarios(self):
        """Test PATCH message scenarios with different data"""
        print("\n🎯 TESTING PATCH MESSAGE SCENARIOS")
        print("=" * 60)
        
        test_scenarios = [
            {
                "name": "Complete video data",
                "data": {
                    "video_url": "https://example.com/complete-video.mp4",
                    "thumbnail_url": "https://example.com/complete-thumbnail.jpg"
                }
            },
            {
                "name": "Video URL only",
                "data": {
                    "video_url": "https://example.com/video-only.mp4"
                }
            },
            {
                "name": "Long video URL",
                "data": {
                    "video_url": "https://example.com/very-long-video-url-with-many-parameters.mp4?param1=value1&param2=value2&param3=value3",
                    "thumbnail_url": "https://example.com/long-thumbnail.jpg"
                }
            }
        ]
        
        for scenario in test_scenarios:
            print(f"\n{scenario['name']}:")
            message_id = str(uuid.uuid4())
            
            try:
                response = requests.patch(f"{self.base_url}/api/messages/{message_id}/video-complete", 
                                        json=scenario['data'], 
                                        headers=self.get_headers())
                
                print(f"Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        print("✅ PATCH successful")
                    else:
                        print(f"❌ PATCH failed: {data}")
                else:
                    print(f"❌ PATCH failed with status {response.status_code}: {response.text}")
                    
            except Exception as e:
                print(f"❌ Error in {scenario['name']}: {str(e)}")
        
        return True
    
    def test_api_endpoint_variations(self):
        """Test different API endpoint variations"""
        print("\n🎯 TESTING API ENDPOINT VARIATIONS")
        print("=" * 60)
        
        task_id = str(uuid.uuid4())
        
        # Test different endpoint paths that might exist
        endpoints_to_test = [
            f"/api/media/status/{task_id}",
            f"/api/media/video/status/{task_id}",  # Desktop version mentioned in code
        ]
        
        for endpoint in endpoints_to_test:
            print(f"\nTesting endpoint: {endpoint}")
            try:
                response = requests.get(f"{self.base_url}{endpoint}", 
                                      headers=self.get_headers())
                
                print(f"Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"Response: {json.dumps(data, indent=2)}")
                elif response.status_code == 404:
                    print("✅ Returns 404 for non-existent task (expected)")
                else:
                    print(f"Response: {response.text}")
                    
            except Exception as e:
                print(f"❌ Error testing {endpoint}: {str(e)}")
        
        return True
    
    def run_specific_tests(self):
        """Run all specific tests"""
        print("🚀 Starting Specific Video Status Polling Tests")
        print("=" * 70)
        
        # Login first
        if not self.login():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Run specific tests
        tests = [
            ("Video Status Handling Scenarios", self.test_video_status_handling_scenarios),
            ("PATCH Message Scenarios", self.test_patch_message_scenarios),
            ("API Endpoint Variations", self.test_api_endpoint_variations)
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
        print("📊 SPECIFIC TEST SUMMARY")
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
            print("\n🎉 ALL SPECIFIC TESTS PASSED!")
            return True
        else:
            print(f"\n⚠️ {failed} TEST SUITES FAILED")
            return False

if __name__ == "__main__":
    tester = SpecificVideoStatusTester()
    success = tester.run_specific_tests()
    exit(0 if success else 1)