#!/usr/bin/env python3
"""
Backend Testing for SoulPrint Engine Admin/Billing System
Testing 3 new features:
1. Staff (admin/superadmin) get unlimited access via access-check endpoint
2. Admin users list endpoint returns subscription plan data per user  
3. Plan change via POST /api/pricing/admin/user-plan
"""

import requests
import json
import os
from typing import Dict, Any, Optional

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://soulprint-engine.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

class SoulPrintTester:
    def __init__(self):
        self.admin_token = None
        self.user_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        
    def login_admin(self) -> bool:
        """Login as admin user"""
        try:
            response = requests.post(f"{API_BASE}/auth/login", json={
                "email": "test@soulprint.com",
                "passcode": "test123"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get('token')
                self.log_test("Admin Login", True, f"Token received: {self.admin_token[:20]}...")
                return True
            else:
                self.log_test("Admin Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False
            
    def login_user(self) -> bool:
        """Login as regular user"""
        try:
            response = requests.post(f"{API_BASE}/auth/login", json={
                "email": "testchat@example.com",
                "passcode": "Test123456"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.user_token = data.get('token')
                self.log_test("User Login", True, f"Token received: {self.user_token[:20]}...")
                return True
            else:
                self.log_test("User Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Login", False, f"Exception: {str(e)}")
            return False
            
    def test_staff_unlimited_access(self) -> bool:
        """Test 1: Staff unlimited access via access-check endpoint"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{API_BASE}/pricing/access-check", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check expected fields for staff unlimited access
                expected_fields = {
                    'plan_id': 'power',
                    'plan_name': 'Power (Staff)',
                    'is_staff': True,
                    'warnings': []
                }
                
                success = True
                details = []
                
                for field, expected_value in expected_fields.items():
                    if field not in data:
                        success = False
                        details.append(f"Missing field: {field}")
                    elif data[field] != expected_value:
                        success = False
                        details.append(f"{field}: expected {expected_value}, got {data[field]}")
                
                # Check unlimited features
                features = data.get('features', {})
                unlimited_checks = {
                    'premium_chat_unlimited': True,
                    'voice_unlimited': True,
                    'images_per_month': None
                }
                
                for field, expected_value in unlimited_checks.items():
                    if field not in features:
                        success = False
                        details.append(f"Missing feature: {field}")
                    elif features[field] != expected_value:
                        success = False
                        details.append(f"features.{field}: expected {expected_value}, got {features[field]}")
                
                self.log_test("Staff Unlimited Access", success, "; ".join(details) if details else "All fields correct")
                return success
                
            else:
                self.log_test("Staff Unlimited Access", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Staff Unlimited Access", False, f"Exception: {str(e)}")
            return False
            
    def test_users_list_includes_plan_data(self) -> bool:
        """Test 2: Admin users list includes subscription plan data"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{API_BASE}/admin/users", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                users = data.get('users', [])
                
                if not users:
                    self.log_test("Users List Plan Data", False, "No users returned")
                    return False
                
                success = True
                details = []
                
                # Check first few users for plan_id and plan_status fields
                for i, user in enumerate(users[:3]):  # Check first 3 users
                    if 'plan_id' not in user:
                        success = False
                        details.append(f"User {i+1} missing plan_id")
                    if 'plan_status' not in user:
                        success = False
                        details.append(f"User {i+1} missing plan_status")
                    
                    # Log the plan data for verification
                    if 'plan_id' in user and 'plan_status' in user:
                        details.append(f"User {i+1}: plan_id={user['plan_id']}, plan_status={user['plan_status']}")
                
                self.log_test("Users List Plan Data", success, "; ".join(details))
                return success
                
            else:
                self.log_test("Users List Plan Data", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Users List Plan Data", False, f"Exception: {str(e)}")
            return False
            
    def test_change_user_plan(self) -> bool:
        """Test 3: Change user plan via POST /api/pricing/admin/user-plan"""
        try:
            # First get a user ID from the users list
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            users_response = requests.get(f"{API_BASE}/admin/users", headers=headers)
            
            if users_response.status_code != 200:
                self.log_test("Change User Plan - Get Users", False, f"Failed to get users: {users_response.status_code}")
                return False
                
            users_data = users_response.json()
            users = users_data.get('users', [])
            
            if not users:
                self.log_test("Change User Plan", False, "No users available for testing")
                return False
                
            # Find a regular user (not admin)
            test_user = None
            for user in users:
                if user.get('role') == 'user':
                    test_user = user
                    break
                    
            if not test_user:
                self.log_test("Change User Plan", False, "No regular users found for testing")
                return False
                
            user_id = test_user['id']
            original_plan = test_user.get('plan_id', 'free')
            
            # Test changing plan to 'base'
            change_response = requests.post(f"{API_BASE}/pricing/admin/user-plan", 
                headers=headers,
                json={
                    "userId": user_id,
                    "planId": "base",
                    "reason": "test_override"
                }
            )
            
            if change_response.status_code == 200:
                change_data = change_response.json()
                
                if change_data.get('success'):
                    # Verify the change by getting users list again
                    verify_response = requests.get(f"{API_BASE}/admin/users", headers=headers)
                    
                    if verify_response.status_code == 200:
                        verify_data = verify_response.json()
                        verify_users = verify_data.get('users', [])
                        
                        # Find the same user and check plan_id
                        updated_user = None
                        for user in verify_users:
                            if user['id'] == user_id:
                                updated_user = user
                                break
                                
                        if updated_user and updated_user.get('plan_id') == 'base':
                            # Success! Now cleanup - change back to original plan
                            cleanup_response = requests.post(f"{API_BASE}/pricing/admin/user-plan", 
                                headers=headers,
                                json={
                                    "userId": user_id,
                                    "planId": original_plan,
                                    "reason": "test_cleanup"
                                }
                            )
                            
                            cleanup_success = cleanup_response.status_code == 200
                            self.log_test("Change User Plan", True, 
                                f"Changed user {user_id} from {original_plan} to base and back. Cleanup: {'✅' if cleanup_success else '❌'}")
                            return True
                        else:
                            self.log_test("Change User Plan", False, 
                                f"Plan change not reflected. Expected: base, Got: {updated_user.get('plan_id') if updated_user else 'user not found'}")
                            return False
                    else:
                        self.log_test("Change User Plan", False, f"Failed to verify change: {verify_response.status_code}")
                        return False
                else:
                    self.log_test("Change User Plan", False, f"Change request failed: {change_data}")
                    return False
            else:
                self.log_test("Change User Plan", False, f"Status: {change_response.status_code}, Response: {change_response.text}")
                return False
                
        except Exception as e:
            self.log_test("Change User Plan", False, f"Exception: {str(e)}")
            return False
            
    def test_regular_user_still_gated(self) -> bool:
        """Test 4: Regular user still gated"""
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = requests.get(f"{API_BASE}/pricing/access-check", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if user is gated
                if data.get('gated') == True and 'Pricing not yet active' in data.get('message', ''):
                    self.log_test("Regular User Still Gated", True, "User correctly gated with expected message")
                    return True
                else:
                    self.log_test("Regular User Still Gated", False, f"User not gated as expected. Response: {data}")
                    return False
                    
            else:
                self.log_test("Regular User Still Gated", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Regular User Still Gated", False, f"Exception: {str(e)}")
            return False
            
    def run_all_tests(self):
        """Run all tests"""
        print("🧪 Starting SoulPrint Engine Admin/Billing System Tests")
        print("=" * 60)
        
        # Login tests
        if not self.login_admin():
            print("❌ Cannot proceed without admin login")
            return
            
        if not self.login_user():
            print("❌ Cannot proceed without user login")
            return
            
        print("\n🔍 Testing 3 New Features:")
        print("-" * 40)
        
        # Test the 3 new features
        self.test_staff_unlimited_access()
        self.test_users_list_includes_plan_data()
        self.test_change_user_plan()
        self.test_regular_user_still_gated()
        
        # Summary
        print("\n📊 Test Summary:")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}")
            
        print(f"\n🎯 Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 All tests passed! The 3 new admin/billing features are working correctly.")
        else:
            print("⚠️  Some tests failed. Please check the details above.")

if __name__ == "__main__":
    tester = SoulPrintTester()
    tester.run_all_tests()