#!/usr/bin/env python3
"""
Comprehensive Layered Assessment System Test
Tests the complete flow as specified in the review request:
1. Login as test@soulprint.com / test123
2. Get layered questions
3. Submit all Layer 1 answers 
4. Complete the assessment
5. Verify communication profile is created
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "https://multi-model-llm.preview.emergentagent.com/api"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSCODE = "test123"

class ComprehensiveLayeredAssessmentTester:
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
        """Step 1: Login as test@soulprint.com / test123"""
        self.log("=== STEP 1: AUTHENTICATION ===")
        
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
                    return self.test_step("Login successful", True, 
                                        f"Role: {data.get('role', 'N/A')}, User ID: {data.get('userId', 'N/A')}")
                else:
                    return self.test_step("Login failed", False, "No token in response")
            else:
                return self.test_step("Login failed", False, 
                                    f"Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            return self.test_step("Login failed", False, f"Exception: {str(e)}")

    def get_layered_questions(self):
        """Step 2: Get layered questions"""
        self.log("=== STEP 2: GET LAYERED QUESTIONS ===")
        
        try:
            response = self.session.get(
                f"{self.base_url}/assessment/layered/questions",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'layer1' in data and 'progress' in data:
                    layer1_questions = data['layer1']
                    self.layer1_questions = layer1_questions
                    layer1_count = len(layer1_questions)
                    progress = data['progress']
                    
                    # Show sample questions
                    sample_questions = [q['id'] for q in layer1_questions[:3]]
                    
                    return self.test_step(
                        "Retrieved layered assessment questions", True,
                        f"Layer1: {layer1_count} questions (sample: {sample_questions}), "
                        f"Progress: L1 complete: {progress.get('layer1_complete')}"
                    )
                else:
                    return self.test_step(
                        "Failed to get layered questions", False,
                        f"Missing expected fields: {list(data.keys())}"
                    )
            else:
                return self.test_step(
                    "Failed to get layered questions", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                
        except Exception as e:
            return self.test_step(
                "Failed to get layered questions", False,
                f"Exception: {str(e)}"
            )

    def submit_all_layer1_answers(self):
        """Step 3: Submit all Layer 1 answers"""
        self.log("=== STEP 3: SUBMIT ALL LAYER 1 ANSWERS ===")
        
        # Complete set of Layer 1 answers (all 10 questions)
        layer1_answers = {
            "comm_explain": "write",
            "comm_detail": "skim", 
            "comm_misunderstand": "reexplain",
            "emotion_stress": "space",
            "emotion_disappointment": "analyze",
            "decision_approach": "blend",
            "decision_options": "three_clear",
            "feedback_style": "direct",
            "help_with": "I want to improve my productivity and decision-making skills through AI assistance.",
            "ai_personality": "75"  # More towards friendly companion
        }
        
        success_count = 0
        for question_id, answer in layer1_answers.items():
            try:
                response = self.session.post(
                    f"{self.base_url}/assessment/layered/answer",
                    headers={"Content-Type": "application/json"},
                    json={"question_id": question_id, "answer": answer, "layer": 1},
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        success_count += 1
                        layer1_complete = data.get('layer1_complete', False)
                        follow_ups = data.get('follow_up_questions', [])
                        
                        self.test_step(
                            f"Answer submitted for {question_id}", True,
                            f"Answer: {answer}, Layer1 complete: {layer1_complete}, "
                            f"Follow-up questions: {len(follow_ups)}"
                        )
                    else:
                        self.test_step(
                            f"Failed to submit answer for {question_id}", False,
                            f"No success in response: {json.dumps(data)[:200]}"
                        )
                else:
                    self.test_step(
                        f"Failed to submit answer for {question_id}", False,
                        f"Status: {response.status_code}, Response: {response.text[:200]}"
                    )
                    
            except Exception as e:
                self.test_step(
                    f"Failed to submit answer for {question_id}", False,
                    f"Exception: {str(e)}"
                )
        
        self.log(f"Layer 1 completion status: {success_count}/{len(layer1_answers)} answers submitted")
        return success_count == len(layer1_answers)

    def complete_layered_assessment(self):
        """Step 4: Complete the layered assessment"""
        self.log("=== STEP 4: COMPLETE LAYERED ASSESSMENT ===")
        
        try:
            response = self.session.post(
                f"{self.base_url}/assessment/layered/complete",
                headers={"Content-Type": "application/json"},
                json={"assistant_name": "Perseus"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'profile_summary' in data:
                    profile_summary = data['profile_summary']
                    return self.test_step(
                        "Layered assessment completed successfully", True,
                        f"Assistant name: Perseus, Profile summary length: {len(profile_summary)} chars"
                    )
                else:
                    return self.test_step(
                        "Layered assessment completion failed", False,
                        f"Missing success or profile_summary: {json.dumps(data)[:200]}"
                    )
            else:
                return self.test_step(
                    "Layered assessment completion failed", False,
                    f"Status: {response.status_code}, Response: {response.text[:300]}"
                )
                
        except Exception as e:
            return self.test_step(
                "Layered assessment completion failed", False,
                f"Exception: {str(e)}"
            )

    def verify_communication_profile(self):
        """Step 5: Verify communication profile is created"""
        self.log("=== STEP 5: VERIFY COMMUNICATION PROFILE CREATED ===")
        
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
                    updated_at = data.get('updated_at', 'N/A')
                    
                    # Check that profile contains expected fields
                    expected_fields = ['directness', 'emotional_warmth', 'information_density', 
                                     'proactivity', 'modality', 'feedback_style', 
                                     'decision_support', 'stress_response', 'confidence']
                    
                    present_fields = [field for field in expected_fields if field in profile]
                    
                    return self.test_step(
                        "Communication profile successfully created", True,
                        f"Has profile: {has_profile}, Profile fields: {len(present_fields)}/{len(expected_fields)} "
                        f"({present_fields[:5]}...), Adaptations: {len(adaptations)} chars, Updated: {updated_at}"
                    )
                else:
                    return self.test_step(
                        "Communication profile not found", False,
                        "hasProfile is False - assessment completion may have failed"
                    )
            else:
                return self.test_step(
                    "Failed to retrieve communication profile", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                
        except Exception as e:
            return self.test_step(
                "Failed to retrieve communication profile", False,
                f"Exception: {str(e)}"
            )

    def run_complete_flow_test(self):
        """Run the complete layered assessment flow test"""
        self.log("🧠 STARTING COMPREHENSIVE LAYERED ASSESSMENT FLOW TEST")
        self.log("Testing the exact flow from the review request:")
        self.log("1. Login as test@soulprint.com / test123")
        self.log("2. Get layered questions") 
        self.log("3. Submit all Layer 1 answers")
        self.log("4. Complete the assessment")
        self.log("5. Verify communication profile is created")
        self.log(f"Base URL: {self.base_url}")
        
        # Execute the complete flow
        success = True
        
        # Step 1: Login
        if not self.authenticate():
            self.log("❌ Cannot proceed without authentication")
            return False
        
        # Step 2: Get questions
        if not self.get_layered_questions():
            self.log("❌ Cannot proceed without questions")
            success = False
        
        # Step 3: Submit all Layer 1 answers
        if not self.submit_all_layer1_answers():
            self.log("⚠️ Not all Layer 1 answers submitted successfully")
            success = False
        
        # Step 4: Complete assessment
        if not self.complete_layered_assessment():
            self.log("❌ Assessment completion failed")
            success = False
        
        # Step 5: Verify profile created
        if not self.verify_communication_profile():
            self.log("❌ Communication profile verification failed")
            success = False
        
        # Summary
        self.log(f"\n{'='*70}")
        self.log("🧠 COMPREHENSIVE LAYERED ASSESSMENT FLOW TEST SUMMARY")
        self.log(f"{'='*70}")
        
        passed = sum(1 for r in self.test_results if r['success'])
        failed = len(self.test_results) - passed
        total = len(self.test_results)
        
        success_rate = (passed / total * 100) if total > 0 else 0
        self.log(f"Overall Success Rate: {passed}/{total} ({success_rate:.1f}%)")
        
        self.log(f"\nStep-by-Step Results:")
        self.log(f"✅ PASSED: {passed}")
        self.log(f"❌ FAILED: {failed}")
        
        if failed > 0:
            self.log(f"\nFailed Steps:")
            for result in self.test_results:
                if not result['success']:
                    self.log(f"  • {result['description']}")
                    if result['details']:
                        self.log(f"    Details: {result['details']}")
        
        self.log(f"\n✨ LAYERED ASSESSMENT SYSTEM STATUS:")
        if success and failed == 0:
            self.log(f"   🎉 COMPLETE FLOW WORKING: All 5 test steps passed")
            self.log(f"   ✅ Authentication: Working")
            self.log(f"   ✅ Questions retrieval: Working") 
            self.log(f"   ✅ Answer submission: Working")
            self.log(f"   ✅ Assessment completion: Working")
            self.log(f"   ✅ Profile generation: Working")
        else:
            self.log(f"   ⚠️ PARTIAL FUNCTIONALITY: {failed} step(s) failed")
            
        return success and failed == 0

def main():
    tester = ComprehensiveLayeredAssessmentTester()
    
    try:
        success = tester.run_complete_flow_test()
        if success:
            print(f"\n🎉 COMPLETE LAYERED ASSESSMENT FLOW SUCCESSFUL!")
            print(f"All endpoints working correctly according to review request specification.")
            sys.exit(0)
        else:
            print(f"\n⚠️ LAYERED ASSESSMENT FLOW ISSUES DETECTED.")
            print(f"Check the detailed results above for specific failures.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print(f"\n⚠️ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()