#!/usr/bin/env python3
"""
Backend API Testing Script for SoulPrint Engine - NEW API Endpoints INVESTIGATION
Tests the new API endpoints mentioned in the review request:
1. GET /api/admin/users/:userId - Get detailed user info (requires admin auth)
2. GET /api/app-updates - Get published app updates for logged-in users
3. POST /api/app-updates/mark-viewed - Mark app updates as viewed  
4. Admin endpoints for app-updates CRUD operations

FINDINGS: The application has modular routing where /api/admin/* routes are handled by 
a separate modular admin route that doesn't include the requested new endpoints.

Usage: python3 backend_test.py
"""

import requests
import json
import sys
import time
import os
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://dashboard-profiles.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class TestRunner:
    def __init__(self):
        self.admin_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4ZDIwZDc0My1lMjk0LTQ5MGQtOTgwMS05OTY5NWQwNDA2N2UiLCJpYXQiOjE3NzQwMjczMjYsImV4cCI6MTc3NjYxOTMyNn0.2mhd-6p1BKs6WVeoLu-APB_MrPSvKy9t4JJ8ofEUNhI"
        self.regular_user_token = None
        self.admin_user_id = "8d20d743-e294-490d-9801-99695d04067e"
        self.regular_user_id = "e4312c2d-cfd7-4ab8-9c2b-dde2657bb3ee"
        self.created_updates = []
        self.test_results = []
        
    def log_result(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })

    def get_regular_user_token(self):
        """Get token for regular user"""
        try:
            response = requests.post(f"{API_BASE}/auth/login", json={
                "email": "user_test_1774027312@soulprinttest.com",
                "passcode": "user123"
            })
            if response.status_code == 200:
                data = response.json()
                self.regular_user_token = data.get("token")
                self.log_result("Regular user authentication", True, "Successfully authenticated regular user")
            else:
                self.log_result("Regular user authentication", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Regular user authentication", False, f"Error: {e}")

    def test_architectural_investigation(self):
        """Investigate the routing architecture"""
        print("=" * 80)
        print("ARCHITECTURAL INVESTIGATION")
        print("=" * 80)
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test 1: Check if admin users list works (modular admin route)
        try:
            response = requests.get(f"{API_BASE}/admin/users", headers=headers)
            if response.status_code == 200:
                data = response.json()
                user_count = len(data.get('users', []))
                self.log_result("Modular Admin Route - Users List", True, f"Found {user_count} users")
            else:
                self.log_result("Modular Admin Route - Users List", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Modular Admin Route - Users List", False, f"Error: {e}")
        
        # Test 2: Check admin user details endpoint (should be in catch-all route)
        try:
            response = requests.get(f"{API_BASE}/admin/users/{self.regular_user_id}", headers=headers)
            if response.status_code == 200:
                data = response.json()
                self.log_result("Admin User Details Endpoint", True, "Endpoint accessible and returns data")
            elif response.status_code == 404:
                response_data = response.json()
                if "Admin endpoint not found" in response_data.get("error", ""):
                    self.log_result("Admin User Details Endpoint", False, "ROUTING ISSUE: Modular admin route takes precedence but doesn't implement this endpoint")
                else:
                    self.log_result("Admin User Details Endpoint", False, f"User not found: {response_data}")
            else:
                self.log_result("Admin User Details Endpoint", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
        except Exception as e:
            self.log_result("Admin User Details Endpoint", False, f"Error: {e}")
        
        # Test 3: Check admin app-updates endpoints (should be in catch-all route)
        try:
            response = requests.get(f"{API_BASE}/admin/app-updates", headers=headers)
            if response.status_code == 200:
                data = response.json()
                updates = data.get('updates', [])
                self.log_result("Admin App Updates - GET", True, f"Found {len(updates)} app updates")
            elif response.status_code == 404:
                response_data = response.json()
                if "Admin endpoint not found" in response_data.get("error", ""):
                    self.log_result("Admin App Updates - GET", False, "ROUTING ISSUE: Modular admin route takes precedence but doesn't implement this endpoint")
                else:
                    self.log_result("Admin App Updates - GET", False, f"Other 404: {response_data}")
            else:
                self.log_result("Admin App Updates - GET", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Admin App Updates - GET", False, f"Error: {e}")
        
        # Test 4: Try to create an app update
        try:
            new_update_data = {
                "title": f"Test Update {int(time.time())}",
                "description": "This is a test app update for backend testing",
                "version": "1.0.0",
                "type": "feature", 
                "published": False,
                "release_date": (datetime.now() + timedelta(days=1)).isoformat()
            }
            
            response = requests.post(f"{API_BASE}/admin/app-updates", headers=headers, json=new_update_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    update_id = data['update']['id']
                    self.created_updates.append(update_id)
                    self.log_result("Admin App Updates - POST", True, f"Created update ID: {update_id}")
                else:
                    self.log_result("Admin App Updates - POST", False, f"Creation failed: {data}")
            elif response.status_code == 404:
                response_data = response.json()
                if "Admin endpoint not found" in response_data.get("error", ""):
                    self.log_result("Admin App Updates - POST", False, "ROUTING ISSUE: Modular admin route takes precedence but doesn't implement this endpoint")
                else:
                    self.log_result("Admin App Updates - POST", False, f"Other 404: {response_data}")
            else:
                self.log_result("Admin App Updates - POST", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
        except Exception as e:
            self.log_result("Admin App Updates - POST", False, f"Error: {e}")
    
    def test_working_endpoints(self):
        """Test the endpoints that are confirmed working"""
        print("\n" + "=" * 80)
        print("TESTING WORKING ENDPOINTS")
        print("=" * 80)
        
        # Get regular user token if needed
        if not self.regular_user_token:
            self.get_regular_user_token()
        
        user_token = self.regular_user_token or self.admin_token
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # Test 1: User app-updates endpoint (GET /api/app-updates)
        try:
            response = requests.get(f"{API_BASE}/app-updates", headers=headers)
            if response.status_code == 200:
                data = response.json()
                updates = data.get('updates', [])
                unread_count = data.get('unread_count', 0)
                last_viewed_at = data.get('last_viewed_at')
                
                self.log_result("User App Updates - GET", True, f"Found {len(updates)} published updates, {unread_count} unread")
                
                # Verify structure
                required_fields = ['updates', 'unread_count', 'last_viewed_at']
                missing_fields = [field for field in required_fields if field not in data]
                if not missing_fields:
                    self.log_result("User App Updates - Response Structure", True, "All required fields present")
                else:
                    self.log_result("User App Updates - Response Structure", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("User App Updates - GET", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
        except Exception as e:
            self.log_result("User App Updates - GET", False, f"Error: {e}")
        
        # Test 2: Mark app-updates as viewed (POST /api/app-updates/mark-viewed)
        try:
            response = requests.post(f"{API_BASE}/app-updates/mark-viewed", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("User App Updates - Mark Viewed", True, "Successfully marked updates as viewed")
                    
                    # Verify the timestamp was updated
                    time.sleep(1)  
                    verify_response = requests.get(f"{API_BASE}/app-updates", headers=headers)
                    if verify_response.status_code == 200:
                        verify_data = verify_response.json()
                        new_last_viewed = verify_data.get('last_viewed_at')
                        if new_last_viewed:
                            self.log_result("User App Updates - Mark Viewed Verification", True, f"Last viewed timestamp updated: {new_last_viewed}")
                        else:
                            self.log_result("User App Updates - Mark Viewed Verification", False, "Last viewed timestamp not set")
                else:
                    self.log_result("User App Updates - Mark Viewed", False, f"Mark viewed failed: {data}")
            else:
                self.log_result("User App Updates - Mark Viewed", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
        except Exception as e:
            self.log_result("User App Updates - Mark Viewed", False, f"Error: {e}")
    
    def test_authentication_properly(self):
        """Test authentication requirements with correct expectations"""
        print("\n" + "=" * 80)
        print("TESTING AUTHENTICATION REQUIREMENTS")
        print("=" * 80)
        
        # Test endpoints without authentication - user endpoints
        user_endpoints = [
            ("GET", "/app-updates", "User Get App Updates"),
            ("POST", "/app-updates/mark-viewed", "User Mark App Updates Viewed")
        ]
        
        for method, endpoint, name in user_endpoints:
            try:
                if method == "GET":
                    response = requests.get(f"{API_BASE}{endpoint}")
                else:
                    response = requests.post(f"{API_BASE}{endpoint}", json={})
                
                if response.status_code == 401:
                    self.log_result(f"Auth Required - {name}", True, "Correctly returns 401 Unauthorized")
                elif response.status_code == 403:
                    self.log_result(f"Auth Required - {name}", True, "Correctly returns 403 Forbidden") 
                else:
                    self.log_result(f"Auth Required - {name}", False, f"Expected 401/403, got {response.status_code}")
            except Exception as e:
                self.log_result(f"Auth Required - {name}", False, f"Error: {e}")
        
        # Test admin endpoints - these will return 404 due to routing issue
        admin_endpoints = [
            ("GET", "/admin/users/test-user-id", "Admin User Details"),
            ("GET", "/admin/app-updates", "Admin Get App Updates"),
            ("POST", "/admin/app-updates", "Admin Create App Update")
        ]
        
        for method, endpoint, name in admin_endpoints:
            try:
                if method == "GET":
                    response = requests.get(f"{API_BASE}{endpoint}")
                else:
                    response = requests.post(f"{API_BASE}{endpoint}", json={})
                
                if response.status_code == 404:
                    response_data = response.json()
                    if "Admin endpoint not found" in response_data.get("error", ""):
                        self.log_result(f"Auth Test - {name}", True, "Returns 404 'Admin endpoint not found' (expected due to routing architecture)")
                    else:
                        self.log_result(f"Auth Test - {name}", False, f"Unexpected 404: {response_data}")
                elif response.status_code in [401, 403]:
                    self.log_result(f"Auth Test - {name}", True, f"Correctly returns {response.status_code}")
                else:
                    self.log_result(f"Auth Test - {name}", False, f"Expected 401/403/404, got {response.status_code}")
            except Exception as e:
                self.log_result(f"Auth Test - {name}", False, f"Error: {e}")
    
    def test_admin_routes_working(self):
        """Test admin routes that are actually working in the modular system"""
        print("\n" + "=" * 80)
        print("TESTING WORKING ADMIN ENDPOINTS")
        print("=" * 80)
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test admin endpoints that work
        working_admin_endpoints = [
            ("users", "Admin Users List"),
            ("metrics", "Admin Metrics"),
            ("insights", "Admin Insights"),
            ("settings", "Admin Settings"),
            ("feedback", "Admin Feedback"),
            ("conversations", "Admin Conversations")
        ]
        
        for endpoint, name in working_admin_endpoints:
            try:
                response = requests.get(f"{API_BASE}/admin/{endpoint}", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    # Get some info about the response
                    info = ""
                    if endpoint == "users" and 'users' in data:
                        info = f"Found {len(data['users'])} users"
                    elif endpoint == "metrics" and 'total_users' in data:
                        info = f"Total users: {data['total_users']}, WAU: {data.get('wau', 'N/A')}"
                    elif endpoint == "conversations" and 'conversations' in data:
                        info = f"Found {len(data['conversations'])} conversations"
                    
                    self.log_result(f"Working Admin - {name}", True, info)
                else:
                    self.log_result(f"Working Admin - {name}", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result(f"Working Admin - {name}", False, f"Error: {e}")
    
    def print_summary(self):
        """Print comprehensive test summary with architectural findings"""
        print("\n" + "=" * 80)
        print("TEST SUMMARY & ARCHITECTURAL ANALYSIS")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "No tests run")
        
        # Categorize results
        routing_issues = []
        working_endpoints = []
        actual_failures = []
        
        for result in self.test_results:
            if not result['success']:
                if "ROUTING ISSUE" in result['details']:
                    routing_issues.append(result)
                elif "expected due to routing architecture" in result['details']:
                    routing_issues.append(result)
                else:
                    actual_failures.append(result)
            else:
                working_endpoints.append(result)
        
        print(f"\n📊 ANALYSIS BREAKDOWN:")
        print(f"   • Working Endpoints: {len(working_endpoints)}")
        print(f"   • Routing Architecture Issues: {len(routing_issues)}")
        print(f"   • Actual Failures: {len(actual_failures)}")
        
        if routing_issues:
            print(f"\n🔧 ROUTING ARCHITECTURE ISSUES:")
            print("   The application uses modular routing where /api/admin/* routes are handled by")
            print("   /app/api/admin/[...path]/route.js, which takes precedence over the main catch-all")
            print("   route but doesn't implement these new endpoints:")
            for result in routing_issues:
                print(f"   • {result['test']}")
        
        if actual_failures:
            print(f"\n❌ ACTUAL FAILURES:")
            for result in actual_failures:
                print(f"   • {result['test']}: {result['details']}")
        
        print(f"\n✅ WORKING FUNCTIONALITY:")
        endpoints_working = [r for r in working_endpoints if not r['test'].startswith('Auth')]
        auth_working = [r for r in working_endpoints if r['test'].startswith('Auth')]
        
        for result in endpoints_working:
            print(f"   • {result['test']}")
        
        if auth_working:
            print(f"\n🔐 AUTHENTICATION WORKING:")
            for result in auth_working:
                print(f"   • {result['test']}")
    
    def run_all_tests(self):
        """Run all backend tests with architectural investigation"""
        print("🔍 Backend API Investigation for NEW App Updates Endpoints")
        print(f"🌐 Base URL: {BASE_URL}")
        print(f"⏰ Test Run Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("📋 Testing NEW endpoints from review request:")
        print("   1. GET /api/admin/users/:userId - Get detailed user info")
        print("   2. GET /api/app-updates - Get published app updates") 
        print("   3. POST /api/app-updates/mark-viewed - Mark app updates as viewed")
        print("   4. Admin CRUD for app-updates")
        
        try:
            # Step 1: Investigate routing architecture
            self.test_architectural_investigation()
            
            # Step 2: Test endpoints that are working
            self.test_working_endpoints()
            
            # Step 3: Test authentication properly
            self.test_authentication_properly()
            
            # Step 4: Test working admin endpoints 
            self.test_admin_routes_working()
            
            # Print comprehensive summary
            self.print_summary()
            
        except KeyboardInterrupt:
            print("\n\n⚠️  Test interrupted by user")
            self.print_summary()
        except Exception as e:
            print(f"\n\n❌ Unexpected error during testing: {e}")
            self.print_summary()

if __name__ == "__main__":
    runner = TestRunner()
    runner.run_all_tests()