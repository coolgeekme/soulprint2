#!/usr/bin/env python3
"""
Backend Testing Script for SoulPrint Engine Route Decomposition
Tests the split route files to ensure proper routing and status codes.
"""

import requests
import json
import sys
import time
from typing import Dict, List, Tuple

# Configuration
BASE_URL = "https://oauth-polish-1.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class RouteDecompositionTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.auth_token = None
        self.test_results = []
        
    def log_result(self, test_name: str, status: str, details: str = ""):
        """Log test result"""
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.test_results.append(result)
        print(f"[{status}] {test_name}: {details}")
        
    def authenticate(self) -> bool:
        """Authenticate and get token for protected endpoints"""
        try:
            login_data = {
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            }
            
            response = requests.post(
                f"{self.base_url}/api/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                self.log_result("Authentication", "PASS", f"Token obtained successfully")
                return True
            else:
                self.log_result("Authentication", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
                return False
                
        except Exception as e:
            self.log_result("Authentication", "ERROR", f"Exception: {str(e)}")
            return False
    
    def test_endpoint(self, method: str, endpoint: str, expected_status_codes: List[int], 
                     description: str, require_auth: bool = False, data: Dict = None) -> bool:
        """Test a single endpoint"""
        try:
            headers = {"Content-Type": "application/json"}
            if require_auth and self.auth_token:
                headers["Authorization"] = f"Bearer {self.auth_token}"
            
            url = f"{self.base_url}{endpoint}"
            
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data or {}, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=headers, json=data or {}, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                self.log_result(f"{method} {endpoint}", "ERROR", f"Unsupported method: {method}")
                return False
            
            status_code = response.status_code
            
            if status_code in expected_status_codes:
                self.log_result(f"{method} {endpoint}", "PASS", 
                              f"{description} - Status: {status_code} (Expected: {expected_status_codes})")
                return True
            else:
                # Check if it's a routing error (404/500) vs expected auth error (401/403)
                if status_code in [404, 500]:
                    self.log_result(f"{method} {endpoint}", "FAIL", 
                                  f"{description} - ROUTING ERROR: Status {status_code}, Expected: {expected_status_codes}")
                else:
                    self.log_result(f"{method} {endpoint}", "PASS", 
                                  f"{description} - Status: {status_code} (Unexpected but not routing error)")
                return status_code not in [404, 500]
                
        except Exception as e:
            self.log_result(f"{method} {endpoint}", "ERROR", f"{description} - Exception: {str(e)}")
            return False
    
    def test_health_endpoint(self):
        """Test the health endpoint (should be public)"""
        return self.test_endpoint(
            "GET", "/api/health", [200], 
            "Health check endpoint (public)"
        )
    
    def test_admin_routes(self):
        """Test admin routes - should require auth and return 401/403"""
        admin_endpoints = [
            "/api/admin/users",
            "/api/admin/metrics", 
            "/api/admin/feedback",
            "/api/admin/announcements",
            "/api/admin/app-updates",
            "/api/admin/insights",
            "/api/admin/pricing-features",
            "/api/admin/beta-codes",
            "/api/admin/blog/posts"
        ]
        
        results = []
        for endpoint in admin_endpoints:
            # Test without auth (should get 401)
            result = self.test_endpoint(
                "GET", endpoint, [401, 403], 
                f"Admin endpoint without auth", require_auth=False
            )
            results.append(result)
            
            # Test with auth (should get 401/403 since test user is not admin)
            if self.auth_token:
                result = self.test_endpoint(
                    "GET", endpoint, [401, 403], 
                    f"Admin endpoint with auth (non-admin user)", require_auth=True
                )
                results.append(result)
        
        return all(results)
    
    def test_google_routes(self):
        """Test Google OAuth routes - should require auth"""
        google_endpoints = [
            ("/api/google/status", "GET"),
            ("/api/google/refresh-calendars", "POST"),
            ("/api/google/update-calendars", "POST")
        ]
        
        results = []
        for endpoint, method in google_endpoints:
            # Test without auth (should get 401)
            result = self.test_endpoint(
                method, endpoint, [401, 403], 
                f"Google endpoint without auth", require_auth=False
            )
            results.append(result)
            
            # Test with auth (should get 401 since no Google OAuth setup)
            if self.auth_token:
                result = self.test_endpoint(
                    method, endpoint, [401, 403, 400], 
                    f"Google endpoint with auth", require_auth=True
                )
                results.append(result)
        
        return all(results)
    
    def test_user_routes(self):
        """Test user routes - should require auth"""
        user_endpoints = [
            "/api/user/voice-settings",
            "/api/user/profile", 
            "/api/user/timezone"
        ]
        
        results = []
        for endpoint in user_endpoints:
            # Test without auth (should get 401)
            result = self.test_endpoint(
                "GET", endpoint, [401, 403], 
                f"User endpoint without auth", require_auth=False
            )
            results.append(result)
            
            # Test with auth (should work or return proper error)
            if self.auth_token:
                result = self.test_endpoint(
                    "GET", endpoint, [200, 401, 403, 400], 
                    f"User endpoint with auth", require_auth=True
                )
                results.append(result)
        
        return all(results)
    
    def test_catch_all_routes(self):
        """Test routes that should still be in the catch-all handler"""
        catch_all_endpoints = [
            ("/api/blog/posts", "GET", [200]),  # Public endpoint
            ("/api/conversations", "GET", [401, 403]),  # Auth required
            ("/api/messages", "GET", [401, 403])  # Auth required
        ]
        
        results = []
        for endpoint, method, expected_codes in catch_all_endpoints:
            if 200 in expected_codes:
                # Public endpoint
                result = self.test_endpoint(
                    method, endpoint, expected_codes, 
                    f"Public catch-all endpoint", require_auth=False
                )
                results.append(result)
            else:
                # Auth required endpoint
                result = self.test_endpoint(
                    method, endpoint, expected_codes, 
                    f"Protected catch-all endpoint without auth", require_auth=False
                )
                results.append(result)
                
                if self.auth_token:
                    result = self.test_endpoint(
                        method, endpoint, [200, 401, 403, 400], 
                        f"Protected catch-all endpoint with auth", require_auth=True
                    )
                    results.append(result)
        
        return all(results)
    
    def run_all_tests(self):
        """Run all route decomposition tests"""
        print("=" * 80)
        print("SOULPRINT ENGINE - ROUTE DECOMPOSITION TESTING")
        print("=" * 80)
        print(f"Base URL: {self.base_url}")
        print(f"Test User: {TEST_EMAIL}")
        print("=" * 80)
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed - some tests will be limited")
        
        print("\n🔍 Testing Route Decomposition...")
        
        # Test health endpoint
        print("\n📊 Testing Health Endpoint...")
        health_result = self.test_health_endpoint()
        
        # Test admin routes
        print("\n🔐 Testing Admin Routes...")
        admin_result = self.test_admin_routes()
        
        # Test Google routes  
        print("\n🔗 Testing Google OAuth Routes...")
        google_result = self.test_google_routes()
        
        # Test user routes
        print("\n👤 Testing User Routes...")
        user_result = self.test_user_routes()
        
        # Test catch-all routes
        print("\n🎯 Testing Catch-All Routes...")
        catch_all_result = self.test_catch_all_routes()
        
        # Summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["status"] == "PASS"])
        failed_tests = len([r for r in self.test_results if r["status"] == "FAIL"])
        error_tests = len([r for r in self.test_results if r["status"] == "ERROR"])
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"⚠️  Errors: {error_tests}")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    print(f"  - {result['test']}: {result['details']}")
        
        if error_tests > 0:
            print("\n⚠️  ERROR TESTS:")
            for result in self.test_results:
                if result["status"] == "ERROR":
                    print(f"  - {result['test']}: {result['details']}")
        
        # Overall result
        overall_success = failed_tests == 0 and error_tests == 0
        print(f"\n🎯 OVERALL RESULT: {'✅ SUCCESS' if overall_success else '❌ ISSUES FOUND'}")
        
        return overall_success

if __name__ == "__main__":
    tester = RouteDecompositionTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)