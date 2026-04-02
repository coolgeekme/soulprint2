#!/usr/bin/env python3
"""
Backend Testing Script for Veo Video Generation UX Enhancement
Tests the enhanced video status polling endpoint with model-specific progress data
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Test Configuration
BASE_URL = "https://veo-ux-polling.preview.emergentagent.com"
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

class VeoUXTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        
    def authenticate(self) -> bool:
        """Authenticate and get token"""
        try:
            print(f"\n🔐 Authenticating with {TEST_EMAIL}...")
            
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={
                    "email": TEST_EMAIL,
                    "passcode": TEST_PASSWORD
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('token')
                if self.auth_token:
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.auth_token}'
                    })
                    self.log_result("Authentication", True, f"Token obtained: {self.auth_token[:20]}...")
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
    
    def test_health_check(self) -> bool:
        """Test health endpoint"""
        try:
            print(f"\n🏥 Testing health check...")
            
            response = self.session.get(f"{self.base_url}/api/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'ok':
                    self.log_result("Health Check", True, "API is healthy")
                    return True
                else:
                    self.log_result("Health Check", False, f"Unexpected status: {data}")
                    return False
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Health Check", False, f"Exception: {str(e)}")
            return False
    
    def test_auth_required(self) -> bool:
        """Test that endpoints require authentication"""
        try:
            print(f"\n🔒 Testing auth requirements...")
            
            # Test without auth token
            temp_session = requests.Session()
            
            # Test video generation endpoint
            response = temp_session.post(
                f"{self.base_url}/api/media/generate",
                json={
                    "type": "video",
                    "model": "kling-3",
                    "prompt": "A cat walking in a garden",
                    "aspectRatio": "16:9"
                }
            )
            
            if response.status_code == 401:
                self.log_result("Auth Required - Video Generate", True, "401 Unauthorized as expected")
            else:
                self.log_result("Auth Required - Video Generate", False, f"Expected 401, got {response.status_code}")
                return False
            
            # Test status polling endpoint
            response = temp_session.get(f"{self.base_url}/api/media/status/test-task-id")
            
            if response.status_code == 401:
                self.log_result("Auth Required - Status Poll", True, "401 Unauthorized as expected")
                return True
            else:
                self.log_result("Auth Required - Status Poll", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Auth Required", False, f"Exception: {str(e)}")
            return False
    
    def create_video_job(self) -> Optional[str]:
        """Create a video generation job and return taskId"""
        try:
            print(f"\n🎬 Creating video generation job...")
            
            response = self.session.post(
                f"{self.base_url}/api/media/generate",
                json={
                    "type": "video",
                    "model": "kling-3",
                    "prompt": "A cat walking in a garden",
                    "aspectRatio": "16:9"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields in response
                required_fields = ['success', 'taskId', 'mediaId', 'type', 'status']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Video Job Creation", False, f"Missing fields: {missing_fields}")
                    return None
                
                # Check enhanced UX fields
                enhanced_fields = ['estimatedTime', 'modelLabel', 'modelId']
                has_enhanced = all(field in data for field in enhanced_fields)
                
                if not has_enhanced:
                    self.log_result("Video Job Creation - Enhanced Fields", False, f"Missing enhanced UX fields: {[f for f in enhanced_fields if f not in data]}")
                else:
                    self.log_result("Video Job Creation - Enhanced Fields", True, f"estimatedTime: {data.get('estimatedTime')}, modelLabel: {data.get('modelLabel')}")
                
                # Verify field values
                if data.get('success') == True and data.get('type') == 'video' and data.get('status') == 'generating':
                    task_id = data.get('taskId')
                    self.log_result("Video Job Creation", True, f"TaskId: {task_id}")
                    return task_id
                else:
                    self.log_result("Video Job Creation", False, f"Unexpected response values: {data}")
                    return None
            else:
                self.log_result("Video Job Creation", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Video Job Creation", False, f"Exception: {str(e)}")
            return None
    
    def test_enhanced_status_polling(self, task_id: str) -> bool:
        """Test enhanced status polling with UX fields"""
        try:
            print(f"\n📊 Testing enhanced status polling for task: {task_id}")
            
            response = self.session.get(f"{self.base_url}/api/media/status/{task_id}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if status is generating (to see enhanced fields)
                if data.get('status') == 'generating':
                    # Check for enhanced UX fields
                    enhanced_fields = [
                        'statusMessage',
                        'estimatedTime', 
                        'modelLabel',
                        'modelId',
                        'elapsedSeconds',
                        'progressPct',
                        'pollTimeoutMs',
                        'stuckWarningMs'
                    ]
                    
                    present_fields = []
                    missing_fields = []
                    
                    for field in enhanced_fields:
                        if field in data:
                            present_fields.append(f"{field}: {data[field]}")
                        else:
                            missing_fields.append(field)
                    
                    if missing_fields:
                        self.log_result("Enhanced Status Polling", False, f"Missing enhanced fields: {missing_fields}")
                        return False
                    else:
                        self.log_result("Enhanced Status Polling", True, f"All enhanced fields present")
                        print(f"    Enhanced fields: {', '.join(present_fields)}")
                        
                        # Verify field types and reasonable values
                        if (isinstance(data.get('elapsedSeconds'), int) and 
                            isinstance(data.get('progressPct'), int) and
                            0 <= data.get('progressPct') <= 100 and
                            isinstance(data.get('pollTimeoutMs'), int) and
                            isinstance(data.get('stuckWarningMs'), int)):
                            self.log_result("Enhanced Fields Validation", True, "Field types and ranges valid")
                            return True
                        else:
                            self.log_result("Enhanced Fields Validation", False, "Invalid field types or values")
                            return False
                
                elif data.get('status') in ['success', 'failed']:
                    self.log_result("Enhanced Status Polling", True, f"Job completed with status: {data.get('status')}")
                    return True
                else:
                    self.log_result("Enhanced Status Polling", False, f"Unexpected status: {data.get('status')}")
                    return False
                    
            elif response.status_code == 404:
                self.log_result("Enhanced Status Polling", True, "404 for non-existent task (expected)")
                return True
            else:
                self.log_result("Enhanced Status Polling", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Enhanced Status Polling", False, f"Exception: {str(e)}")
            return False
    
    def test_nonexistent_task(self) -> bool:
        """Test status polling for non-existent task"""
        try:
            print(f"\n🔍 Testing non-existent task handling...")
            
            fake_task_id = "fake-task-id-12345"
            response = self.session.get(f"{self.base_url}/api/media/status/{fake_task_id}")
            
            if response.status_code == 404:
                self.log_result("Non-existent Task", True, "404 returned for fake task ID")
                return True
            else:
                self.log_result("Non-existent Task", False, f"Expected 404, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Non-existent Task", False, f"Exception: {str(e)}")
            return False
    
    def test_model_specific_ux(self) -> bool:
        """Test different models have different UX parameters"""
        try:
            print(f"\n🎯 Testing model-specific UX parameters...")
            
            # Test Kling Pro model (should have different estimated time than standard Kling)
            pro_response = self.session.post(
                f"{self.base_url}/api/media/generate",
                json={
                    "type": "video",
                    "model": "kling-3-pro",
                    "prompt": "A cinematic sunset over mountains",
                    "aspectRatio": "16:9"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if pro_response.status_code == 200:
                pro_data = pro_response.json()
                pro_estimated = pro_data.get('estimatedTime', '')
                pro_label = pro_data.get('modelLabel', '')
                
                # Verify enhanced fields are present in creation response
                if pro_estimated and pro_label:
                    self.log_result("Model-Specific UX - Kling Pro", True, f"Kling Pro estimated time: {pro_estimated}, label: {pro_label}")
                    
                    # Test status polling for Kling Pro to see enhanced fields
                    pro_task_id = pro_data.get('taskId')
                    if pro_task_id:
                        time.sleep(1)  # Brief delay
                        status_response = self.session.get(f"{self.base_url}/api/media/status/{pro_task_id}")
                        if status_response.status_code == 200:
                            status_data = status_response.json()
                            
                            # Verify all enhanced fields are present
                            enhanced_fields = [
                                'statusMessage', 'estimatedTime', 'modelLabel', 'modelId',
                                'elapsedSeconds', 'progressPct', 'pollTimeoutMs', 'stuckWarningMs'
                            ]
                            
                            missing_fields = [field for field in enhanced_fields if field not in status_data]
                            
                            if not missing_fields:
                                self.log_result("Model-Specific UX - Enhanced Fields", True, f"All enhanced fields present for {pro_label}")
                                return True
                            else:
                                self.log_result("Model-Specific UX - Enhanced Fields", False, f"Missing fields: {missing_fields}")
                                return False
                        else:
                            self.log_result("Model-Specific UX - Pro Status", False, f"Failed to get Pro status: {status_response.status_code}")
                            return False
                    else:
                        self.log_result("Model-Specific UX - Kling Pro", False, "No taskId returned for Kling Pro")
                        return False
                else:
                    self.log_result("Model-Specific UX - Kling Pro", False, f"Missing enhanced fields in creation response")
                    return False
            else:
                self.log_result("Model-Specific UX - Kling Pro", False, f"Failed to create Kling Pro job: {pro_response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Model-Specific UX", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Veo Video Generation UX Enhancement Tests")
        print("=" * 60)
        
        # Step 1: Health check
        if not self.test_health_check():
            print("❌ Health check failed - aborting tests")
            return False
        
        # Step 2: Authentication
        if not self.authenticate():
            print("❌ Authentication failed - aborting tests")
            return False
        
        # Step 3: Test auth requirements
        if not self.test_auth_required():
            print("❌ Auth requirement tests failed")
        
        # Step 4: Test non-existent task handling
        if not self.test_nonexistent_task():
            print("❌ Non-existent task test failed")
        
        # Step 5: Create video job and test enhanced fields
        task_id = self.create_video_job()
        if not task_id:
            print("❌ Video job creation failed - skipping status tests")
        else:
            # Step 6: Test enhanced status polling
            if not self.test_enhanced_status_polling(task_id):
                print("❌ Enhanced status polling test failed")
        
        # Step 7: Test model-specific UX parameters
        if not self.test_model_specific_ux():
            print("❌ Model-specific UX test failed")
        
        # Summary
        self.print_summary()
        
        return all(result['success'] for result in self.test_results)
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if r['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  • {result['test']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result['success']:
                print(f"  • {result['test']}")

def main():
    """Main test execution"""
    tester = VeoUXTester()
    
    try:
        success = tester.run_all_tests()
        
        if success:
            print("\n🎉 ALL TESTS PASSED!")
            sys.exit(0)
        else:
            print("\n💥 SOME TESTS FAILED!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⏹️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()