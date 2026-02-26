#!/usr/bin/env python3
"""
Backend testing for SoulPrint Engine Video Generation Fix
Tests the handleMediaStatus fix for video models using useJobsApi=true
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

    def test_video_generation(self, model_name, prompt="A cat playing piano", aspect_ratio="16:9"):
        """Test video generation initiation"""
        self.log(f"=== VIDEO GENERATION TEST: {model_name} ===")
        
        try:
            payload = {
                "type": "video",
                "model": model_name,
                "prompt": prompt,
                "aspectRatio": aspect_ratio
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
                        f"Video generation initiated for {model_name}", True,
                        f"TaskId: {data.get('taskId')}, MediaId: {data.get('mediaId')}, Status: {data.get('status')}"
                    ), data.get('taskId')
                else:
                    return self.test_step(
                        f"Video generation failed for {model_name}", False,
                        f"Response: {json.dumps(data)[:300]}"
                    ), None
            else:
                return self.test_step(
                    f"Video generation failed for {model_name}", False,
                    f"Status: {response.status_code}, Response: {response.text[:300]}"
                ), None
                
        except Exception as e:
            return self.test_step(
                f"Video generation failed for {model_name}", False,
                f"Exception: {str(e)}"
            ), None

    def test_video_status(self, task_id, model_name, max_polls=5):
        """Test video status polling - this is the main fix being tested"""
        self.log(f"=== VIDEO STATUS POLLING TEST: {model_name} ===")
        
        poll_count = 0
        while poll_count < max_polls:
            poll_count += 1
            
            try:
                response = self.session.get(
                    f"{self.base_url}/media/status?taskId={task_id}",
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get('status', 'unknown')
                    
                    # Check for the specific error we're testing the fix for
                    if 'recordInfo is null' in response.text:
                        return self.test_step(
                            f"Video status polling FAILED - recordInfo is null error still present for {model_name}",
                            False,
                            f"Poll {poll_count}: Still getting 'recordInfo is null' error"
                        )
                    
                    # Check for other error indicators
                    if data.get('error') and 'undefined' in str(data.get('error')).lower():
                        return self.test_step(
                            f"Video status polling FAILED - undefined endpoint error for {model_name}",
                            False,
                            f"Poll {poll_count}: Error contains 'undefined': {data.get('error')}"
                        )
                    
                    self.log(f"Poll {poll_count} for {model_name}: Status = {status}, Progress = {data.get('progress', 'N/A')}")
                    
                    if status in ['completed', 'failed']:
                        return self.test_step(
                            f"Video status polling working for {model_name}",
                            True,
                            f"Final status: {status} after {poll_count} polls. No 'recordInfo is null' errors."
                        )
                    elif status == 'generating':
                        # Status is properly being tracked, continue polling
                        if poll_count < max_polls:
                            self.log(f"    Video still generating, waiting 3 seconds before next poll...")
                            time.sleep(3)
                            continue
                        else:
                            return self.test_step(
                                f"Video status polling working for {model_name}",
                                True,
                                f"Status properly returned 'generating' for {poll_count} polls. No errors detected."
                            )
                    else:
                        # Any other status is acceptable as long as no errors
                        self.log(f"    Received status: {status}, continuing...")
                        if poll_count < max_polls:
                            time.sleep(3)
                            continue
                        else:
                            return self.test_step(
                                f"Video status polling working for {model_name}",
                                True,
                                f"No 'recordInfo is null' or undefined errors after {poll_count} polls"
                            )
                else:
                    return self.test_step(
                        f"Video status polling failed for {model_name}",
                        False,
                        f"HTTP {response.status_code}: {response.text[:300]}"
                    )
                    
            except Exception as e:
                return self.test_step(
                    f"Video status polling failed for {model_name}",
                    False,
                    f"Poll {poll_count} exception: {str(e)}"
                )
        
        # If we get here, we completed all polls without errors
        return self.test_step(
            f"Video status polling working for {model_name}",
            True,
            f"Completed {max_polls} polls with no 'recordInfo is null' or undefined errors"
        )

    def test_video_models(self):
        """Test the specific video models mentioned in the review request"""
        # Models that use useJobsApi=true and were affected by the bug
        video_models = [
            "kling-3-720p",
            "sora-2-stable", 
            "kling-2-6",
            "wan-2-6"
        ]
        
        successful_tests = 0
        total_tests = 0
        
        for model in video_models:
            self.log(f"\n{'='*60}")
            self.log(f"TESTING VIDEO MODEL: {model}")
            self.log(f"{'='*60}")
            
            # Test video generation initiation
            generation_success, task_id = self.test_video_generation(model)
            total_tests += 1
            
            if generation_success and task_id:
                # Test video status polling (the main fix)
                status_success = self.test_video_status(task_id, model)
                total_tests += 1
                if status_success:
                    successful_tests += 2
                else:
                    successful_tests += 1  # Generation worked
            elif generation_success:
                successful_tests += 1
                self.test_step(f"Skipping status test for {model}", False, "No taskId returned")
                total_tests += 1
        
        return successful_tests, total_tests

    def run_all_tests(self):
        """Run comprehensive video generation fix tests"""
        self.log("🎬 STARTING SOULPRINT ENGINE VIDEO GENERATION FIX TESTING")
        self.log(f"Base URL: {self.base_url}")
        self.log(f"Test credentials: {TEST_EMAIL}")
        
        # Step 1: Authenticate
        if not self.authenticate():
            self.log("❌ Cannot proceed without authentication")
            return False
        
        # Step 2: Test video models with the fix
        successful_tests, total_tests = self.test_video_models()
        
        # Summary
        self.log(f"\n{'='*60}")
        self.log("🎬 VIDEO GENERATION FIX TEST SUMMARY")
        self.log(f"{'='*60}")
        
        success_rate = (successful_tests / total_tests * 100) if total_tests > 0 else 0
        self.log(f"Overall Success Rate: {successful_tests}/{total_tests} ({success_rate:.1f}%)")
        
        # Detailed results
        passed = sum(1 for r in self.test_results if r['success'])
        failed = len(self.test_results) - passed
        
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
        self.log(f"   • Testing the fix for handleMediaStatus function")
        self.log(f"   • Focus: Models with useJobsApi=true should use 'jobs/recordInfo' endpoint")
        self.log(f"   • Success criteria: No 'recordInfo is null' errors")
        self.log(f"   • Success criteria: No 'undefined' endpoint errors")
        self.log(f"   • Models tested: kling-3-720p, sora-2-stable, kling-2-6, wan-2-6")
        
        return failed == 0

def main():
    tester = VideoGenerationTester()
    
    try:
        success = tester.run_all_tests()
        if success:
            print(f"\n🎉 ALL TESTS PASSED! Video generation fix is working correctly.")
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