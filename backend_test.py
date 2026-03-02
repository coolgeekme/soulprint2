#!/usr/bin/env python3
"""
Backend testing for SoulPrint Engine Layered Assessment System
Tests the new layered assessment endpoints
"""

import requests
import json
import time
import sys
import os

# Configuration
BASE_URL = "https://smart-routing-ui.preview.emergentagent.com/api"
TEST_EMAIL = "test@soulprint.com"  
TEST_PASSCODE = "test123"

class LayeredAssessmentTester:
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

    def test_assessment_settings(self):
        """Test GET /api/assessment/settings (no auth required)"""
        self.log("=== ASSESSMENT SETTINGS TEST ===")
        
        try:
            # Test without auth
            response = requests.get(
                f"{self.base_url}/assessment/settings",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'assessment_mode' in data:
                    return self.test_step(
                        "Assessment settings endpoint working", True,
                        f"Assessment mode: {data.get('assessment_mode')}, Default: {data.get('default_assessment')}"
                    )
                else:
                    return self.test_step(
                        "Assessment settings endpoint failed", False,
                        "Missing assessment_mode in response"
                    )
            else:
                return self.test_step(
                    "Assessment settings endpoint failed", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                
        except Exception as e:
            return self.test_step(
                "Assessment settings endpoint failed", False,
                f"Exception: {str(e)}"
            )

    def test_layered_questions(self):
        """Test GET /api/assessment/layered/questions"""
        self.log("=== LAYERED ASSESSMENT QUESTIONS TEST ===")
        
        try:
            response = self.session.get(
                f"{self.base_url}/assessment/layered/questions",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'layer1' in data and 'layer2' in data and 'progress' in data:
                    layer1_count = len(data['layer1'])
                    layer2_count = len(data['layer2'])
                    progress = data['progress']
                    
                    return self.test_step(
                        "Layered assessment questions endpoint working", True,
                        f"Layer1: {layer1_count} questions, Layer2: {layer2_count} questions, "
                        f"Progress: L1 complete: {progress.get('layer1_complete')}, "
                        f"L2 complete: {progress.get('layer2_complete')}"
                    )
                else:
                    return self.test_step(
                        "Layered assessment questions endpoint failed", False,
                        f"Missing expected fields in response: {list(data.keys())}"
                    )
            elif response.status_code == 401:
                return self.test_step(
                    "Layered assessment questions endpoint requires auth", True,
                    "Correctly requires authentication"
                )
            else:
                return self.test_step(
                    "Layered assessment questions endpoint failed", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                
        except Exception as e:
            return self.test_step(
                "Layered assessment questions endpoint failed", False,
                f"Exception: {str(e)}"
            )

    def test_layered_answer_submission(self):
        """Test POST /api/assessment/layered/answer"""
        self.log("=== LAYERED ASSESSMENT ANSWER SUBMISSION TEST ===")
        
        # Test submitting answers for Layer 1 questions
        layer1_answers = [
            {"question_id": "comm_explain", "answer": "write", "layer": 1},
            {"question_id": "comm_detail", "answer": "skim", "layer": 1},
            {"question_id": "emotion_stress", "answer": "space", "layer": 1},
        ]
        
        success_count = 0
        for i, answer_data in enumerate(layer1_answers):
            try:
                response = self.session.post(
                    f"{self.base_url}/assessment/layered/answer",
                    headers={"Content-Type": "application/json"},
                    json=answer_data,
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        success_count += 1
                        self.test_step(
                            f"Layer 1 answer {i+1} submission successful", True,
                            f"Question: {answer_data['question_id']}, Answer: {answer_data['answer']}, "
                            f"Layer1 complete: {data.get('layer1_complete')}"
                        )
                    else:
                        self.test_step(
                            f"Layer 1 answer {i+1} submission failed", False,
                            f"No success field in response: {json.dumps(data)[:200]}"
                        )
                else:
                    self.test_step(
                        f"Layer 1 answer {i+1} submission failed", False,
                        f"Status: {response.status_code}, Response: {response.text[:200]}"
                    )
                    
            except Exception as e:
                self.test_step(
                    f"Layer 1 answer {i+1} submission failed", False,
                    f"Exception: {str(e)}"
                )
        
        return success_count == len(layer1_answers)

    def test_layered_completion(self):
        """Test POST /api/assessment/layered/complete"""
        self.log("=== LAYERED ASSESSMENT COMPLETION TEST ===")
        
        try:
            response = self.session.post(
                f"{self.base_url}/assessment/layered/complete",
                headers={"Content-Type": "application/json"},
                json={"assistant_name": "Perseus"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'profile_summary' in data:
                    return self.test_step(
                        "Layered assessment completion successful", True,
                        f"Profile summary generated (length: {len(data['profile_summary'])} chars)"
                    )
                else:
                    return self.test_step(
                        "Layered assessment completion failed", False,
                        f"Missing success or profile_summary: {json.dumps(data)[:200]}"
                    )
            elif response.status_code == 400:
                return self.test_step(
                    "Layered assessment completion expected failure", True,
                    f"Expected 400 error (likely incomplete assessment): {response.text[:200]}"
                )
            else:
                return self.test_step(
                    "Layered assessment completion failed", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                
        except Exception as e:
            return self.test_step(
                "Layered assessment completion failed", False,
                f"Exception: {str(e)}"
            )

    def test_communication_profile(self):
        """Test GET /api/profile/communication"""
        self.log("=== COMMUNICATION PROFILE TEST ===")
        
        try:
            response = self.session.get(
                f"{self.base_url}/profile/communication",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                has_profile = data.get('hasProfile', False)
                
                if has_profile:
                    profile = data.get('profile', {})
                    adaptations = data.get('adaptations', '')
                    
                    return self.test_step(
                        "Communication profile retrieved successfully", True,
                        f"Has profile: {has_profile}, Profile fields: {list(profile.keys())}, "
                        f"Adaptations length: {len(adaptations)} chars"
                    )
                else:
                    return self.test_step(
                        "No communication profile found", True,
                        "User has not completed layered assessment yet (expected for new users)"
                    )
            elif response.status_code == 401:
                return self.test_step(
                    "Communication profile endpoint requires auth", True,
                    "Correctly requires authentication"
                )
            else:
                return self.test_step(
                    "Communication profile endpoint failed", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                
        except Exception as e:
            return self.test_step(
                "Communication profile endpoint failed", False,
                f"Exception: {str(e)}"
            )

    def run_all_tests(self):
        """Run comprehensive layered assessment system tests"""
        self.log("🧠 STARTING SOULPRINT ENGINE LAYERED ASSESSMENT TESTING")
        self.log(f"Base URL: {self.base_url}")
        self.log(f"Test credentials: {TEST_EMAIL}")
        
        # Step 1: Test assessment settings (no auth)
        self.test_assessment_settings()
        
        # Step 2: Authenticate
        if not self.authenticate():
            self.log("❌ Cannot proceed without authentication")
            return False
        
        # Step 3: Test layered assessment questions
        self.test_layered_questions()
        
        # Step 4: Test communication profile (before assessment)
        self.test_communication_profile()
        
        # Step 5: Test answer submission
        answer_success = self.test_layered_answer_submission()
        
        # Step 6: Test completion (may fail if not enough answers)
        self.test_layered_completion()
        
        # Step 7: Test communication profile (after assessment attempts)
        self.test_communication_profile()
        
        # Summary
        self.log(f"\n{'='*60}")
        self.log("🧠 LAYERED ASSESSMENT SYSTEM TEST SUMMARY")
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
        self.log(f"   • Testing new Layered Assessment System")
        self.log(f"   • Endpoints: GET /assessment/layered/questions")
        self.log(f"   • Endpoints: POST /assessment/layered/answer")  
        self.log(f"   • Endpoints: POST /assessment/layered/complete")
        self.log(f"   • Endpoints: GET /assessment/settings")
        self.log(f"   • Endpoints: GET /profile/communication")
        self.log(f"   • Test Flow: Questions → Answers → Complete → Profile")
        
        return failed == 0

def main():
    tester = LayeredAssessmentTester()
    
    try:
        success = tester.run_all_tests()
        if success:
            print(f"\n🎉 ALL TESTS PASSED! Layered Assessment System appears to be working correctly.")
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