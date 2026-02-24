#!/usr/bin/env python3
"""
SoulPrint Engine Backend API Test Suite
Tests all critical backend endpoints for the SoulPrint Engine MVP
"""
import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Test Configuration
BASE_URL = "https://soul-chat-beta.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test data
TEST_EMAIL = "test@soulprint.com"
TEST_PASSCODE = "Test1234!"
TEST_ASSISTANT_NAME = "Alex"

class SoulPrintAPITest:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.conversation_id = None
        self.question_ids = []
        self.test_results = {}
    
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {test_name}")
        if details:
            print(f"    Details: {details}")
        self.test_results[test_name] = {"success": success, "details": details}
        return success
    
    def make_request(self, method: str, endpoint: str, data: Any = None, headers: Optional[Dict] = None) -> Dict:
        """Make HTTP request with error handling"""
        url = f"{API_BASE}/{endpoint}"
        default_headers = {"Content-Type": "application/json"}
        
        if self.token and headers is None:
            default_headers["Authorization"] = f"Bearer {self.token}"
        elif headers:
            default_headers.update(headers)
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=default_headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=default_headers, timeout=30)
            else:
                return {"error": f"Unsupported method: {method}"}
            
            response_data = {
                "status_code": response.status_code,
                "success": response.status_code < 400,
                "data": {}
            }
            
            try:
                response_data["data"] = response.json()
            except:
                response_data["data"] = {"text": response.text[:500]}
            
            return response_data
            
        except requests.exceptions.Timeout:
            return {"error": "Request timeout", "status_code": 408, "success": False}
        except requests.exceptions.ConnectionError:
            return {"error": "Connection error", "status_code": 0, "success": False}
        except Exception as e:
            return {"error": str(e), "status_code": 0, "success": False}
    
    def test_user_registration(self) -> bool:
        """Test POST /api/auth/register - First user becomes superadmin"""
        print("\n=== Testing User Registration ===")
        
        response = self.make_request("POST", "auth/register", {
            "email": TEST_EMAIL,
            "passcode": TEST_PASSCODE
        }, headers={})  # No auth needed for registration
        
        if not response.get("success"):
            return self.log_test("User Registration", False, 
                               f"Status: {response.get('status_code')}, Error: {response.get('data', {}).get('error', 'Unknown error')}")
        
        data = response["data"]
        if not all(key in data for key in ["token", "userId", "role"]):
            return self.log_test("User Registration", False, "Missing required fields in response")
        
        self.token = data["token"]
        self.user_id = data["userId"]
        
        # Verify first user is superadmin
        if data["role"] != "superadmin":
            return self.log_test("User Registration", False, f"Expected superadmin role, got: {data['role']}")
        
        return self.log_test("User Registration", True, 
                           f"User ID: {self.user_id[:8]}..., Role: {data['role']}, Accepted: {data.get('accepted', False)}")
    
    def test_user_login(self) -> bool:
        """Test POST /api/auth/login"""
        print("\n=== Testing User Login ===")
        
        response = self.make_request("POST", "auth/login", {
            "email": TEST_EMAIL,
            "passcode": TEST_PASSCODE
        }, headers={})  # No auth needed for login
        
        if not response.get("success"):
            return self.log_test("User Login", False, 
                               f"Status: {response.get('status_code')}, Error: {response.get('data', {}).get('error', 'Unknown error')}")
        
        data = response["data"]
        expected_fields = ["token", "userId", "role", "accepted", "onboarding_complete", "assessment_complete"]
        if not all(key in data for key in expected_fields):
            return self.log_test("User Login", False, f"Missing required fields. Got: {list(data.keys())}")
        
        # Update token from login (should be same as registration but good practice)
        self.token = data["token"]
        
        return self.log_test("User Login", True, 
                           f"Role: {data['role']}, Accepted: {data['accepted']}, Assessment Complete: {data['assessment_complete']}")
    
    def test_get_me(self) -> bool:
        """Test GET /api/auth/me"""
        print("\n=== Testing Get Current User ===")
        
        if not self.token:
            return self.log_test("Get Current User", False, "No authentication token available")
        
        response = self.make_request("GET", "auth/me")
        
        if not response.get("success"):
            return self.log_test("Get Current User", False, 
                               f"Status: {response.get('status_code')}, Error: {response.get('data', {}).get('error', 'Unknown error')}")
        
        data = response["data"]
        expected_fields = ["id", "email", "role", "accepted", "created_at", "profile"]
        if not all(key in data for key in expected_fields):
            return self.log_test("Get Current User", False, f"Missing required fields. Got: {list(data.keys())}")
        
        if data["id"] != self.user_id:
            return self.log_test("Get Current User", False, f"User ID mismatch. Expected: {self.user_id}, Got: {data['id']}")
        
        return self.log_test("Get Current User", True, 
                           f"Email: {data['email']}, Role: {data['role']}, Profile: {'Present' if data['profile'] else 'None'}")
    
    def test_assessment_questions(self) -> bool:
        """Test GET /api/assessment/questions - No auth needed, should return 36 questions"""
        print("\n=== Testing Assessment Questions ===")
        
        response = self.make_request("GET", "assessment/questions", headers={})  # No auth needed
        
        if not response.get("success"):
            return self.log_test("Assessment Questions", False, 
                               f"Status: {response.get('status_code')}, Error: {response.get('data', {}).get('error', 'Unknown error')}")
        
        data = response["data"]
        if not isinstance(data, list):
            return self.log_test("Assessment Questions", False, f"Expected array, got: {type(data)}")
        
        if len(data) != 36:
            return self.log_test("Assessment Questions", False, f"Expected 36 questions, got: {len(data)}")
        
        # Check question structure
        if data:
            question = data[0]
            expected_fields = ["id", "pillar", "order_index", "question_text"]
            if not all(key in question for key in expected_fields):
                return self.log_test("Assessment Questions", False, f"Question missing required fields. Got: {list(question.keys())}")
        
        # Store question IDs for later tests
        self.question_ids = [q["id"] for q in data]
        
        # Check pillar distribution
        pillars = set(q["pillar"] for q in data)
        expected_pillars = {"communication", "emotional_intelligence", "decision_making", "social_dynamics", "cognitive_style", "assertiveness"}
        
        if pillars != expected_pillars:
            return self.log_test("Assessment Questions", False, f"Pillar mismatch. Expected: {expected_pillars}, Got: {pillars}")
        
        return self.log_test("Assessment Questions", True, 
                           f"Retrieved {len(data)} questions across {len(pillars)} pillars")
    
    def test_submit_answer(self) -> bool:
        """Test POST /api/assessment/answer"""
        print("\n=== Testing Submit Assessment Answer ===")
        
        if not self.token:
            return self.log_test("Submit Assessment Answer", False, "No authentication token available")
        
        if not self.question_ids:
            return self.log_test("Submit Assessment Answer", False, "No question IDs available")
        
        # Submit answer for first question
        test_question_id = self.question_ids[0]
        test_answer = "I prefer face-to-face communication because it allows for better understanding of non-verbal cues and immediate feedback."
        
        response = self.make_request("POST", "assessment/answer", {
            "question_id": test_question_id,
            "answer_text": test_answer
        })
        
        if not response.get("success"):
            return self.log_test("Submit Assessment Answer", False, 
                               f"Status: {response.get('status_code')}, Error: {response.get('data', {}).get('error', 'Unknown error')}")
        
        data = response["data"]
        if not data.get("success"):
            return self.log_test("Submit Assessment Answer", False, "API returned success=false")
        
        return self.log_test("Submit Assessment Answer", True, 
                           f"Answer submitted for question ID: {test_question_id[:8]}...")
    
    def test_assessment_progress(self) -> bool:
        """Test GET /api/assessment/progress"""
        print("\n=== Testing Assessment Progress ===")
        
        if not self.token:
            return self.log_test("Assessment Progress", False, "No authentication token available")
        
        response = self.make_request("GET", "assessment/progress")
        
        if not response.get("success"):
            return self.log_test("Assessment Progress", False, 
                               f"Status: {response.get('status_code')}, Error: {response.get('data', {}).get('error', 'Unknown error')}")
        
        data = response["data"]
        expected_fields = ["answered", "count"]
        if not all(key in data for key in expected_fields):
            return self.log_test("Assessment Progress", False, f"Missing required fields. Got: {list(data.keys())}")
        
        if not isinstance(data["answered"], list) or not isinstance(data["count"], int):
            return self.log_test("Assessment Progress", False, "Invalid data types in response")
        
        # Should have at least 1 answer from previous test
        if data["count"] < 1:
            return self.log_test("Assessment Progress", False, f"Expected at least 1 answer, got: {data['count']}")
        
        return self.log_test("Assessment Progress", True, 
                           f"Answered {data['count']} questions")
    
    def test_assessment_complete(self) -> bool:
        """Test POST /api/assessment/complete"""
        print("\n=== Testing Assessment Complete ===")
        
        if not self.token:
            return self.log_test("Assessment Complete", False, "No authentication token available")
        
        response = self.make_request("POST", "assessment/complete", {
            "assistant_name": TEST_ASSISTANT_NAME
        })
        
        if not response.get("success"):
            return self.log_test("Assessment Complete", False, 
                               f"Status: {response.get('status_code')}, Error: {response.get('data', {}).get('error', 'Unknown error')}")
        
        data = response["data"]
        if not data.get("success"):
            return self.log_test("Assessment Complete", False, "API returned success=false")
        
        return self.log_test("Assessment Complete", True, 
                           f"Assessment completed with assistant name: {TEST_ASSISTANT_NAME}")
    
    def test_create_conversation(self) -> bool:
        """Test POST /api/conversations"""
        print("\n=== Testing Create Conversation ===")
        
        if not self.token:
            return self.log_test("Create Conversation", False, "No authentication token available")
        
        response = self.make_request("POST", "conversations", {
            "title": "Test Conversation"
        })
        
        if not response.get("success"):
            return self.log_test("Create Conversation", False, 
                               f"Status: {response.get('status_code')}, Error: {response.get('data', {}).get('error', 'Unknown error')}")
        
        data = response["data"]
        expected_fields = ["id", "title", "created_at"]
        if not all(key in data for key in expected_fields):
            return self.log_test("Create Conversation", False, f"Missing required fields. Got: {list(data.keys())}")
        
        self.conversation_id = data["id"]
        
        return self.log_test("Create Conversation", True, 
                           f"Conversation ID: {self.conversation_id[:8]}..., Title: {data['title']}")
    
    def test_admin_metrics(self) -> bool:
        """Test GET /api/admin/metrics - Requires admin/superadmin role"""
        print("\n=== Testing Admin Metrics ===")
        
        if not self.token:
            return self.log_test("Admin Metrics", False, "No authentication token available")
        
        response = self.make_request("GET", "admin/metrics")
        
        if not response.get("success"):
            return self.log_test("Admin Metrics", False, 
                               f"Status: {response.get('status_code')}, Error: {response.get('data', {}).get('error', 'Unknown error')}")
        
        data = response["data"]
        expected_fields = ["wau", "total_users", "multi_session_rate", "day7_retention", 
                          "assessment_completion_rate", "import_adoption_rate"]
        
        missing_fields = [field for field in expected_fields if field not in data]
        if missing_fields:
            return self.log_test("Admin Metrics", False, f"Missing fields: {missing_fields}")
        
        return self.log_test("Admin Metrics", True, 
                           f"WAU: {data['wau']}, Total Users: {data['total_users']}, Assessment Rate: {data['assessment_completion_rate']}%")
    
    def test_admin_users(self) -> bool:
        """Test GET /api/admin/users - Requires admin/superadmin role"""
        print("\n=== Testing Admin Users ===")
        
        if not self.token:
            return self.log_test("Admin Users", False, "No authentication token available")
        
        response = self.make_request("GET", "admin/users")
        
        if not response.get("success"):
            return self.log_test("Admin Users", False, 
                               f"Status: {response.get('status_code')}, Error: {response.get('data', {}).get('error', 'Unknown error')}")
        
        data = response["data"]
        expected_fields = ["users", "total", "page", "pages"]
        if not all(key in data for key in expected_fields):
            return self.log_test("Admin Users", False, f"Missing required fields. Got: {list(data.keys())}")
        
        if not isinstance(data["users"], list):
            return self.log_test("Admin Users", False, "Users field is not an array")
        
        # Should have at least our test user
        if data["total"] < 1:
            return self.log_test("Admin Users", False, f"Expected at least 1 user, got: {data['total']}")
        
        return self.log_test("Admin Users", True, 
                           f"Found {data['total']} users on page {data['page']}/{data['pages']}")
    
    def test_connector_stub(self) -> bool:
        """Test POST /api/connectors/telegram/webhook - Should return not_configured"""
        print("\n=== Testing Connector Stub ===")
        
        response = self.make_request("POST", "connectors/telegram/webhook", {}, headers={})  # No auth needed
        
        if not response.get("success"):
            return self.log_test("Connector Stub", False, 
                               f"Status: {response.get('status_code')}, Error: {response.get('data', {}).get('error', 'Unknown error')}")
        
        data = response["data"]
        if data.get("status") != "not_configured":
            return self.log_test("Connector Stub", False, f"Expected status 'not_configured', got: {data.get('status')}")
        
        return self.log_test("Connector Stub", True, 
                           f"Status: {data['status']}, Message: {data.get('message', '')[:50]}...")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting SoulPrint Engine Backend API Tests")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"🔗 API Base: {API_BASE}")
        
        tests = [
            self.test_user_registration,
            self.test_user_login,
            self.test_get_me,
            self.test_assessment_questions,
            self.test_submit_answer,
            self.test_assessment_progress,
            self.test_assessment_complete,
            self.test_create_conversation,
            self.test_admin_metrics,
            self.test_admin_users,
            self.test_connector_stub,
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                failed += 1
                print(f"❌ EXCEPTION | {test.__name__}: {str(e)}")
            
            time.sleep(1)  # Small delay between tests
        
        print(f"\n📊 Test Results Summary:")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed / (passed + failed) * 100):.1f}%")
        
        # Return True if all tests passed
        return failed == 0

def main():
    """Main test runner"""
    tester = SoulPrintAPITest()
    
    try:
        all_passed = tester.run_all_tests()
        
        if all_passed:
            print("\n🎉 All backend tests passed successfully!")
            sys.exit(0)
        else:
            print("\n⚠️  Some backend tests failed. Check the details above.")
            sys.exit(1)
    
    except KeyboardInterrupt:
        print("\n\n⏹️  Tests interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n💥 Fatal error during testing: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()