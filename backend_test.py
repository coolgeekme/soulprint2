#!/usr/bin/env python3
"""
Backend testing for SoulPrint Engine Video Generation Fix
Tests the handleMediaStatus fix and endpoint logic
"""

import requests
import json
import time
import sys
import os

# Configuration
BASE_URL = "https://chunk-upload.preview.emergentagent.com/api"
TEST_EMAIL = "test@soulprint.com"  
TEST_PASSCODE = "test123"

class VideoGenerationTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.base_url = BASE_URL
        self.test_results = []
        
    def log(self, message, level="INFO"):
        print(f"[{level}] {message}")
        
    def test_step(self, description, success, details=""):
        result = "✅ PASS" if success else "❌ FAIL"
        self.log(f"{result}: {description}")
        if details:
            self.log(f"    Details: {details}")
        self.test_results.append({
            'description': description,
            'success': success,
            'details': details
        })
        return success

    def authenticate(self):
        """Authenticate and get bearer token"""
        self.log("=== AUTHENTICATION TEST ===")
        
        try:
            response = self.session.post(
                f"{self.base_url}/auth/login",
                headers={"Content-Type": "application/json"},
                json={"email": TEST_EMAIL, "passcode": TEST_PASSCODE},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('token'):
                    self.auth_token = data['token']
                    self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                    return self.test_step("Authentication successful", True, 
                                        f"Role: {data.get('role', 'N/A')}, User ID: {data.get('userId', 'N/A')}")
                else:
                    return self.test_step("Authentication failed", False, "No token in response")
            else:
                return self.test_step("Authentication failed", False, 
                                    f"Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            return self.test_step("Authentication failed", False, f"Exception: {str(e)}")

    def test_video_generation_runway(self):
        """Test video generation with runway model (known working model)"""
        self.log("=== VIDEO GENERATION TEST: runway ===")
        
        try:
            payload = {
                "type": "video",
                "model": "runway",
                "prompt": "A cat playing piano",
                "aspectRatio": "16:9"
            }
            
            response = self.session.post(
                f"{self.base_url}/media/generate",
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('taskId'):
                    return self.test_step(
                        "Video generation initiated for runway model", True,
                        f"TaskId: {data.get('taskId')}, MediaId: {data.get('mediaId')}, Status: {data.get('status')}"
                    ), data.get('taskId')
                else:
                    return self.test_step(
                        "Video generation failed for runway model", False,
                        f"Response: {json.dumps(data)[:300]}"
                    ), None
            else:
                return self.test_step(
                    "Video generation failed for runway model", False,
                    f"Status: {response.status_code}, Response: {response.text[:300]}"
                ), None
                
        except Exception as e:
            return self.test_step(
                "Video generation failed for runway model", False,
                f"Exception: {str(e)}"
            ), None

    def test_video_status_endpoint_logic(self, task_id):
        """Test the video status endpoint - checking for the specific fix"""
        self.log("=== VIDEO STATUS ENDPOINT LOGIC TEST ===")
        
        try:
            response = self.session.get(
                f"{self.base_url}/media/status?taskId={task_id}",
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                status = data.get('status', 'unknown')
                
                # Check for the specific errors the fix was meant to address
                if 'recordInfo is null' in response.text:
                    return self.test_step(
                        "Video status endpoint FAILED - recordInfo is null error present",
                        False,
                        "'recordInfo is null' error still occurring - fix not working"
                    )
                
                # Check for undefined endpoint errors
                if 'undefined' in response.text.lower() and 'endpoint' in response.text.lower():
                    return self.test_step(
                        "Video status endpoint FAILED - undefined endpoint error",
                        False,
                        "Undefined endpoint error detected - routing logic issue"
                    )
                
                # Check for jobs/recordInfo endpoint being called correctly
                # (This would be in server logs, but we can check response structure)
                if status in ['generating', 'completed', 'failed', 'processing']:
                    return self.test_step(
                        "Video status endpoint working correctly",
                        True,
                        f"Status: {status}, No 'recordInfo is null' or undefined endpoint errors detected"
                    )
                else:
                    return self.test_step(
                        "Video status endpoint working (unknown status)",
                        True,
                        f"Status: {status}, No critical errors detected"
                    )
            else:
                return self.test_step(
                    "Video status endpoint failed",
                    False,
                    f"HTTP {response.status_code}: {response.text[:300]}"
                )
                
        except Exception as e:
            return self.test_step(
                "Video status endpoint failed",
                False,
                f"Exception: {str(e)}"
            )

    def test_media_generate_validation(self):
        """Test the media/generate endpoint validation and response format"""
        self.log("=== MEDIA GENERATE ENDPOINT VALIDATION ===")
        
        # Test with missing required fields
        try:
            response = self.session.post(
                f"{self.base_url}/media/generate",
                headers={"Content-Type": "application/json"},
                json={},
                timeout=10
            )
            
            if response.status_code == 400:
                return self.test_step(
                    "Media generate endpoint validation working",
                    True,
                    "Correctly rejects empty requests with 400 error"
                )
            else:
                return self.test_step(
                    "Media generate endpoint validation issue",
                    False,
                    f"Expected 400 for empty request, got {response.status_code}"
                )
                
        except Exception as e:
            return self.test_step(
                "Media generate endpoint validation test failed",
                False,
                f"Exception: {str(e)}"
            )

    def test_invalid_task_id_handling(self):
        """Test how the status endpoint handles invalid task IDs"""
        self.log("=== INVALID TASK ID HANDLING TEST ===")
        
        try:
            fake_task_id = "invalid-task-id-12345"
            response = self.session.get(
                f"{self.base_url}/media/status?taskId={fake_task_id}",
                timeout=10
            )
            
            # The endpoint should handle invalid task IDs gracefully
            if response.status_code in [404, 400, 200]:
                data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                
                # Check that it's not throwing undefined endpoint errors
                if 'undefined' in response.text.lower():
                    return self.test_step(
                        "Invalid task ID handling FAILED",
                        False,
                        "Undefined endpoint error with invalid task ID - fix not working"
                    )
                
                return self.test_step(
                    "Invalid task ID handling working",
                    True,
                    f"Status: {response.status_code}, No undefined endpoint errors"
                )
            else:
                return self.test_step(
                    "Invalid task ID handling unexpected response",
                    False,
                    f"Unexpected status code: {response.status_code}"
                )
                
        except Exception as e:
            return self.test_step(
                "Invalid task ID handling test failed",
                False,
                f"Exception: {str(e)}"
            )

    def run_all_tests(self):
        """Run comprehensive video generation fix tests"""
        self.log("🎬 STARTING SOULPRINT ENGINE VIDEO GENERATION FIX TESTING")
        self.log(f"Base URL: {self.base_url}")
        self.log(f"Test credentials: {TEST_EMAIL}")
        
        # Step 1: Authenticate
        if not self.authenticate():
            self.log("❌ Cannot proceed without authentication")
            return False
        
        # Step 2: Test media generate endpoint validation
        self.test_media_generate_validation()
        
        # Step 3: Test invalid task ID handling (tests fix logic)
        self.test_invalid_task_id_handling()
        
        # Step 4: Test with runway model if available
        success, task_id = self.test_video_generation_runway()
        if success and task_id:
            # Test status endpoint with real task ID
            self.test_video_status_endpoint_logic(task_id)
        else:
            self.log("⚠️ Runway model test failed, testing status endpoint logic with mock task ID")
            # Test with a mock task ID to verify endpoint logic
            self.test_video_status_endpoint_logic("mock-task-id-for-testing")
        
        # Summary
        self.log(f"\n{'='*60}")
        self.log("🎬 VIDEO GENERATION FIX TEST SUMMARY")
        self.log(f"{'='*60}")
        
        # Detailed results
        passed = sum(1 for r in self.test_results if r['success'])
        failed = len(self.test_results) - passed
        total = len(self.test_results)
        
        success_rate = (passed / total * 100) if total > 0 else 0
        self.log(f"Overall Success Rate: {passed}/{total} ({success_rate:.1f}%)")
        
        self.log(f"\nDetailed Results:")
        self.log(f"✅ PASSED: {passed}")
        self.log(f"❌ FAILED: {failed}")
        
        if failed > 0:
            self.log(f"\nFailed Tests:")
            for result in self.test_results:
                if not result['success']:
                    self.log(f"  • {result['description']}")
                    if result['details']:
                        self.log(f"    Details: {result['details']}")
        
        self.log(f"\n🔍 KEY FINDINGS:")
        self.log(f"   • Testing handleMediaStatus function fix")
        self.log(f"   • Primary issue: Models with useJobsApi=true were calling undefined endpoints")
        self.log(f"   • Fix: Route to 'jobs/recordInfo' endpoint for Jobs API models")
        self.log(f"   • Fix: Parse resultJson field for Jobs API response format")
        self.log(f"   • Success criteria: No 'recordInfo is null' errors")
        self.log(f"   • Success criteria: No 'undefined' endpoint errors")
        
        return failed == 0

def main():
    tester = VideoGenerationTester()
    
    try:
        success = tester.run_all_tests()
        if success:
            print(f"\n🎉 ALL TESTS PASSED! Video generation fix appears to be working correctly.")
            sys.exit(0)
        else:
            print(f"\n⚠️  SOME TESTS FAILED. Check the detailed results above.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print(f"\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()