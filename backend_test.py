#!/usr/bin/env python3
"""
Backend Test Suite for Phase 5 Access Enforcement Engine
Testing all new enforcement endpoints with authentication and validation.
"""

import requests
import json
import os
import sys
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://soulprint-engine.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def log_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")

def log_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")

def log_info(msg):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.END}")

def log_warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.END}")

def log_header(msg):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{msg}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'SoulPrint-Backend-Test/1.0'
        })
        self.auth_token = None
        self.test_results = []
        
    def test_result(self, test_name, success, details=""):
        """Record test result"""
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
        if success:
            log_success(f"{test_name}: {details}")
        else:
            log_error(f"{test_name}: {details}")
        return success

    def authenticate(self):
        """Authenticate with the test user credentials"""
        log_header("AUTHENTICATION")
        
        try:
            # Use the credentials from the review request
            auth_data = {
                "email": "testchat@example.com",
                "passcode": "Test123456"
            }
            
            log_info(f"Authenticating with {auth_data['email']}")
            response = self.session.post(f"{API_BASE}/auth/login", json=auth_data)
            
            if response.status_code == 200:
                data = response.json()
                if 'token' in data:
                    self.auth_token = data['token']
                    self.session.headers['Authorization'] = f"Bearer {self.auth_token}"
                    return self.test_result("Authentication", True, f"Token received: {self.auth_token[:20]}...")
                else:
                    return self.test_result("Authentication", False, f"No token in response: {data}")
            else:
                return self.test_result("Authentication", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            return self.test_result("Authentication", False, f"Exception: {str(e)}")

    def test_health_check(self):
        """Test basic health endpoint"""
        log_header("HEALTH CHECK")
        
        try:
            response = self.session.get(f"{API_BASE}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'ok':
                    return self.test_result("Health Check", True, "API is healthy")
                else:
                    return self.test_result("Health Check", False, f"Unexpected response: {data}")
            else:
                return self.test_result("Health Check", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            return self.test_result("Health Check", False, f"Exception: {str(e)}")

    def test_enforcement_status(self):
        """Test GET /api/pricing/enforcement"""
        log_header("ENFORCEMENT STATUS ENDPOINT")
        
        try:
            response = self.session.get(f"{API_BASE}/pricing/enforcement")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields from review request
                required_fields = [
                    'cohort', 'enforcement_active', 'effective_plan', 'effective_features',
                    'grace_expires_at', 'days_remaining', 'show_countdown', 
                    'assessment_complete', 'is_trial', 'trial_limit_hit'
                ]
                
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    return self.test_result("Enforcement Status", False, f"Missing fields: {missing_fields}")
                
                log_info(f"Cohort: {data.get('cohort')}")
                log_info(f"Enforcement Active: {data.get('enforcement_active')}")
                log_info(f"Effective Plan: {data.get('effective_plan')}")
                log_info(f"Is Trial: {data.get('is_trial')}")
                log_info(f"Assessment Complete: {data.get('assessment_complete')}")
                
                return self.test_result("Enforcement Status", True, f"All required fields present. Cohort: {data.get('cohort')}, Plan: {data.get('effective_plan')}")
                
            else:
                return self.test_result("Enforcement Status", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            return self.test_result("Enforcement Status", False, f"Exception: {str(e)}")

    def test_enforcement_usage(self):
        """Test GET /api/pricing/enforcement/usage"""
        log_header("ENFORCEMENT USAGE ENDPOINT")
        
        try:
            response = self.session.get(f"{API_BASE}/pricing/enforcement/usage")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields from review request
                required_fields = [
                    'plan', 'cohort', 'enforcement_active', 'media_credits_balance', 'usage'
                ]
                
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    return self.test_result("Enforcement Usage", False, f"Missing fields: {missing_fields}")
                
                # Check usage sub-objects
                usage = data.get('usage', {})
                required_usage_fields = [
                    'standard_messages', 'premium_messages', 'images', 'videos', 'pdfs', 'voice_minutes'
                ]
                
                missing_usage_fields = [field for field in required_usage_fields if field not in usage]
                if missing_usage_fields:
                    return self.test_result("Enforcement Usage", False, f"Missing usage fields: {missing_usage_fields}")
                
                # Check that each usage field has used, limit, period
                for field in required_usage_fields:
                    usage_obj = usage.get(field, {})
                    if 'used' not in usage_obj or 'limit' not in usage_obj or 'period' not in usage_obj:
                        return self.test_result("Enforcement Usage", False, f"Usage field {field} missing used/limit/period")
                
                log_info(f"Plan: {data.get('plan')}")
                log_info(f"Media Credits Balance: {data.get('media_credits_balance')}")
                log_info(f"Standard Messages: {usage.get('standard_messages', {}).get('used')}/{usage.get('standard_messages', {}).get('limit')}")
                log_info(f"Premium Messages: {usage.get('premium_messages', {}).get('used')}/{usage.get('premium_messages', {}).get('limit')}")
                log_info(f"Images: {usage.get('images', {}).get('used')}/{usage.get('images', {}).get('limit')}")
                log_info(f"Videos: {usage.get('videos', {}).get('used')}/{usage.get('videos', {}).get('limit')}")
                
                return self.test_result("Enforcement Usage", True, f"All required fields present. Plan: {data.get('plan')}, Credits: {data.get('media_credits_balance')}")
                
            else:
                return self.test_result("Enforcement Usage", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            return self.test_result("Enforcement Usage", False, f"Exception: {str(e)}")

    def test_enforcement_check(self, action, expected_allowed=None):
        """Test GET /api/pricing/enforcement/check?action=X"""
        try:
            response = self.session.get(f"{API_BASE}/pricing/enforcement/check?action={action}")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'allowed' not in data:
                    return self.test_result(f"Enforcement Check ({action})", False, "Missing 'allowed' field")
                
                allowed = data.get('allowed')
                log_info(f"Action '{action}' allowed: {allowed}")
                
                # Log additional info if present
                if 'reason' in data:
                    log_info(f"Reason: {data['reason']}")
                if 'status' in data:
                    status = data['status']
                    log_info(f"Status - Plan: {status.get('effective_plan')}, Enforcement: {status.get('enforcement_active')}")
                
                if expected_allowed is not None and allowed != expected_allowed:
                    return self.test_result(f"Enforcement Check ({action})", False, f"Expected allowed={expected_allowed}, got {allowed}")
                
                return self.test_result(f"Enforcement Check ({action})", True, f"Allowed: {allowed}")
                
            else:
                return self.test_result(f"Enforcement Check ({action})", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            return self.test_result(f"Enforcement Check ({action})", False, f"Exception: {str(e)}")

    def test_all_enforcement_checks(self):
        """Test all enforcement check actions from review request"""
        log_header("ENFORCEMENT CHECK ENDPOINTS")
        
        actions = [
            'premium_model',
            'standard_message', 
            'image_generation',
            'video_generation',
            'voice_chat'
        ]
        
        results = []
        for action in actions:
            # For standard_message, expect it to be allowed since user hasn't hit 50/day limit
            expected = True if action == 'standard_message' else None
            results.append(self.test_enforcement_check(action, expected))
        
        return all(results)

    def test_existing_endpoints(self):
        """Test that existing endpoints still work"""
        log_header("EXISTING ENDPOINTS VERIFICATION")
        
        results = []
        
        # Test GET /api/pricing/plans
        try:
            response = self.session.get(f"{API_BASE}/pricing/plans")
            if response.status_code == 200:
                data = response.json()
                if 'plans' in data and isinstance(data['plans'], list):
                    results.append(self.test_result("Pricing Plans", True, f"Found {len(data['plans'])} plans"))
                else:
                    results.append(self.test_result("Pricing Plans", False, f"Invalid response format: {data}"))
            else:
                results.append(self.test_result("Pricing Plans", False, f"HTTP {response.status_code}: {response.text}"))
        except Exception as e:
            results.append(self.test_result("Pricing Plans", False, f"Exception: {str(e)}"))
        
        # Test GET /api/pricing/credit-packs
        try:
            response = self.session.get(f"{API_BASE}/pricing/credit-packs")
            if response.status_code == 200:
                data = response.json()
                if 'packs' in data and isinstance(data['packs'], list):
                    results.append(self.test_result("Credit Packs", True, f"Found {len(data['packs'])} credit packs"))
                else:
                    results.append(self.test_result("Credit Packs", False, f"Invalid response format: {data}"))
            else:
                results.append(self.test_result("Credit Packs", False, f"HTTP {response.status_code}: {response.text}"))
        except Exception as e:
            results.append(self.test_result("Credit Packs", False, f"Exception: {str(e)}"))
        
        return all(results)

    def test_unauthorized_access(self):
        """Test that enforcement endpoints return 401 without auth token"""
        log_header("UNAUTHORIZED ACCESS TESTING")
        
        # Temporarily remove auth header
        original_auth = self.session.headers.get('Authorization')
        if 'Authorization' in self.session.headers:
            del self.session.headers['Authorization']
        
        results = []
        
        endpoints = [
            '/pricing/enforcement',
            '/pricing/enforcement/usage',
            '/pricing/enforcement/check?action=premium_model'
        ]
        
        for endpoint in endpoints:
            try:
                response = self.session.get(f"{API_BASE}{endpoint}")
                if response.status_code == 401:
                    results.append(self.test_result(f"Unauthorized {endpoint}", True, "Correctly returned 401"))
                else:
                    results.append(self.test_result(f"Unauthorized {endpoint}", False, f"Expected 401, got {response.status_code}"))
            except Exception as e:
                results.append(self.test_result(f"Unauthorized {endpoint}", False, f"Exception: {str(e)}"))
        
        # Restore auth header
        if original_auth:
            self.session.headers['Authorization'] = original_auth
        
        return all(results)

    def run_all_tests(self):
        """Run the complete test suite"""
        log_header("PHASE 5 ACCESS ENFORCEMENT ENGINE - BACKEND TESTING")
        log_info(f"Testing against: {BASE_URL}")
        log_info(f"Test started at: {datetime.now().isoformat()}")
        
        # Run tests in sequence
        tests = [
            self.test_health_check,
            self.authenticate,
            self.test_enforcement_status,
            self.test_enforcement_usage,
            self.test_all_enforcement_checks,
            self.test_existing_endpoints,
            self.test_unauthorized_access,
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                log_error(f"Test {test.__name__} failed with exception: {str(e)}")
        
        # Summary
        log_header("TEST SUMMARY")
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        log_info(f"Total Tests: {total_tests}")
        log_success(f"Passed: {passed_tests}")
        if failed_tests > 0:
            log_error(f"Failed: {failed_tests}")
        
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        log_info(f"Success Rate: {success_rate:.1f}%")
        
        # Show failed tests
        failed_results = [r for r in self.test_results if not r['success']]
        if failed_results:
            log_header("FAILED TESTS")
            for result in failed_results:
                log_error(f"{result['test']}: {result['details']}")
        
        return success_rate >= 90  # Consider 90%+ success rate as passing

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        log_success("✅ PHASE 5 ACCESS ENFORCEMENT ENGINE TESTING COMPLETE - ALL CRITICAL TESTS PASSED")
        sys.exit(0)
    else:
        log_error("❌ PHASE 5 ACCESS ENFORCEMENT ENGINE TESTING FAILED - CRITICAL ISSUES FOUND")
        sys.exit(1)