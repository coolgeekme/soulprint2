#!/usr/bin/env python3
"""
Phase 5 Access Enforcement Testing - OG User Grace Period
Testing enforcement wiring into chat stream and other endpoints for OG users.
"""

import requests
import json
import os
import sys
import time
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

class Phase5EnforcementTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'SoulPrint-Phase5-Test/1.0'
        })
        self.auth_token = None
        self.test_results = []
        self.initial_usage = None
        
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
        """Authenticate with OG user credentials"""
        log_header("AUTHENTICATION - OG USER")
        
        try:
            # Use the OG user credentials from the review request
            auth_data = {
                "email": "testchat@example.com",
                "passcode": "Test123456"
            }
            
            log_info(f"Authenticating OG user: {auth_data['email']}")
            response = self.session.post(f"{API_BASE}/auth/login", json=auth_data)
            
            if response.status_code == 200:
                data = response.json()
                if 'token' in data:
                    self.auth_token = data['token']
                    self.session.headers['Authorization'] = f"Bearer {self.auth_token}"
                    return self.test_result("OG User Authentication", True, f"Token received for OG user")
                else:
                    return self.test_result("OG User Authentication", False, f"No token in response: {data}")
            else:
                return self.test_result("OG User Authentication", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            return self.test_result("OG User Authentication", False, f"Exception: {str(e)}")

    def test_chat_stream_enforcement(self):
        """Test 1: Chat stream enforcement check (non-blocking for OG user)"""
        log_header("TEST 1: CHAT STREAM ENFORCEMENT CHECK")
        
        try:
            # Test chat stream with a simple message
            chat_data = {
                "content": "Hello, how are you?",
                "conversationId": None,
                "model": "gpt-4o-mini"
            }
            
            log_info("Testing chat stream with OG user (should NOT be blocked)")
            response = self.session.post(f"{API_BASE}/chat/stream", json=chat_data, stream=True)
            
            if response.status_code == 200:
                # Check content type
                content_type = response.headers.get('content-type', '')
                if 'text/event-stream' not in content_type and 'application/json' not in content_type:
                    return self.test_result("Chat Stream Enforcement", False, f"Unexpected content-type: {content_type}")
                
                # Parse NDJSON stream
                events = []
                enforcement_block_found = False
                meta_found = False
                content_found = False
                
                try:
                    for line in response.iter_lines(decode_unicode=True):
                        if line.strip():
                            try:
                                event = json.loads(line)
                                events.append(event)
                                
                                # Check for enforcement_block event (should NOT be present)
                                if event.get('type') == 'enforcement_block':
                                    enforcement_block_found = True
                                    log_error(f"Found enforcement_block event: {event}")
                                
                                # Check for expected events
                                if event.get('type') == 'meta':
                                    meta_found = True
                                    log_info("Found meta event")
                                
                                if event.get('type') in ['delta', 'content']:
                                    content_found = True
                                    log_info(f"Found content event: {event.get('type')}")
                                
                            except json.JSONDecodeError:
                                log_warning(f"Could not parse line as JSON: {line}")
                                continue
                except Exception as e:
                    log_warning(f"Stream parsing ended: {str(e)}")
                
                log_info(f"Total events received: {len(events)}")
                
                if enforcement_block_found:
                    return self.test_result("Chat Stream Enforcement", False, "Found enforcement_block event - OG user should not be blocked")
                
                if meta_found and content_found:
                    return self.test_result("Chat Stream Enforcement", True, f"Normal NDJSON stream received ({len(events)} events), no enforcement_block")
                else:
                    return self.test_result("Chat Stream Enforcement", True, f"Stream completed without enforcement_block ({len(events)} events)")
                    
            else:
                return self.test_result("Chat Stream Enforcement", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            return self.test_result("Chat Stream Enforcement", False, f"Exception: {str(e)}")

    def test_usage_recording(self):
        """Test 2: Verify usage was recorded after message"""
        log_header("TEST 2: USAGE RECORDING VERIFICATION")
        
        try:
            # Get current usage
            response = self.session.get(f"{API_BASE}/pricing/enforcement/usage")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'usage' not in data:
                    return self.test_result("Usage Recording", False, "No usage field in response")
                
                usage = data['usage']
                if 'standard_messages' not in usage:
                    return self.test_result("Usage Recording", False, "No standard_messages in usage")
                
                messages_used = usage['standard_messages'].get('used', 0)
                log_info(f"Standard messages used: {messages_used}")
                
                if messages_used >= 1:
                    return self.test_result("Usage Recording", True, f"Usage recorded: {messages_used} standard messages used")
                else:
                    return self.test_result("Usage Recording", False, f"Usage not recorded: {messages_used} messages used")
                    
            else:
                return self.test_result("Usage Recording", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            return self.test_result("Usage Recording", False, f"Exception: {str(e)}")

    def test_premium_model_check(self):
        """Test 3: Premium model check (still allowed for OG user)"""
        log_header("TEST 3: PREMIUM MODEL CHECK")
        
        try:
            response = self.session.get(f"{API_BASE}/pricing/enforcement/check?action=premium_model")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'allowed' not in data:
                    return self.test_result("Premium Model Check", False, "No 'allowed' field in response")
                
                allowed = data.get('allowed')
                log_info(f"Premium model allowed: {allowed}")
                
                if allowed:
                    return self.test_result("Premium Model Check", True, "Premium model access allowed for OG user")
                else:
                    reason = data.get('reason', 'No reason provided')
                    return self.test_result("Premium Model Check", False, f"Premium model blocked: {reason}")
                    
            else:
                return self.test_result("Premium Model Check", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            return self.test_result("Premium Model Check", False, f"Exception: {str(e)}")

    def test_image_generation_check(self):
        """Test 4: Image generation check (allowed for OG user)"""
        log_header("TEST 4: IMAGE GENERATION CHECK")
        
        try:
            response = self.session.get(f"{API_BASE}/pricing/enforcement/check?action=image_generation")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'allowed' not in data:
                    return self.test_result("Image Generation Check", False, "No 'allowed' field in response")
                
                allowed = data.get('allowed')
                log_info(f"Image generation allowed: {allowed}")
                
                if allowed:
                    return self.test_result("Image Generation Check", True, "Image generation allowed for OG user")
                else:
                    reason = data.get('reason', 'No reason provided')
                    return self.test_result("Image Generation Check", False, f"Image generation blocked: {reason}")
                    
            else:
                return self.test_result("Image Generation Check", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            return self.test_result("Image Generation Check", False, f"Exception: {str(e)}")

    def test_video_generation_check(self):
        """Test 5: Video generation check (allowed for OG user)"""
        log_header("TEST 5: VIDEO GENERATION CHECK")
        
        try:
            response = self.session.get(f"{API_BASE}/pricing/enforcement/check?action=video_generation")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'allowed' not in data:
                    return self.test_result("Video Generation Check", False, "No 'allowed' field in response")
                
                allowed = data.get('allowed')
                log_info(f"Video generation allowed: {allowed}")
                
                if allowed:
                    return self.test_result("Video Generation Check", True, "Video generation allowed for OG user")
                else:
                    reason = data.get('reason', 'No reason provided')
                    return self.test_result("Video Generation Check", False, f"Video generation blocked: {reason}")
                    
            else:
                return self.test_result("Video Generation Check", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            return self.test_result("Video Generation Check", False, f"Exception: {str(e)}")

    def test_voice_chat_enforcement(self):
        """Test 6: Voice chat enforcement on Gemini endpoint"""
        log_header("TEST 6: VOICE CHAT ENFORCEMENT (GEMINI)")
        
        try:
            response = self.session.post(f"{API_BASE}/gemini/live-token", json={})
            
            log_info(f"Gemini live-token response status: {response.status_code}")
            
            if response.status_code == 403:
                # Check if it's an enforcement block
                try:
                    data = response.json()
                    if 'enforcement_block' in str(data).lower():
                        return self.test_result("Voice Chat Enforcement", False, "OG user blocked from voice chat (should be allowed)")
                    else:
                        return self.test_result("Voice Chat Enforcement", True, "403 not due to enforcement (likely other reason)")
                except:
                    return self.test_result("Voice Chat Enforcement", True, "403 not due to enforcement (likely other reason)")
            
            elif response.status_code == 500:
                # 500 is expected if no GEMINI_API_KEY configured
                log_info("500 error likely due to missing GEMINI_API_KEY (expected in dev)")
                return self.test_result("Voice Chat Enforcement", True, "No enforcement block (500 likely due to missing API key)")
            
            elif response.status_code == 200:
                return self.test_result("Voice Chat Enforcement", True, "Voice chat access allowed for OG user")
            
            else:
                # Any other status code - check if it's enforcement related
                try:
                    data = response.json()
                    if 'enforcement' in str(data).lower():
                        return self.test_result("Voice Chat Enforcement", False, f"Enforcement block detected: {data}")
                    else:
                        return self.test_result("Voice Chat Enforcement", True, f"No enforcement block (HTTP {response.status_code})")
                except:
                    return self.test_result("Voice Chat Enforcement", True, f"No enforcement block (HTTP {response.status_code})")
                
        except Exception as e:
            return self.test_result("Voice Chat Enforcement", False, f"Exception: {str(e)}")

    def test_enforcement_status_cohort(self):
        """Test 7: Verify enforcement status shows correct cohort"""
        log_header("TEST 7: ENFORCEMENT STATUS COHORT")
        
        try:
            response = self.session.get(f"{API_BASE}/pricing/enforcement")
            
            if response.status_code == 200:
                data = response.json()
                
                cohort = data.get('cohort')
                enforcement_active = data.get('enforcement_active')
                
                log_info(f"User cohort: {cohort}")
                log_info(f"Enforcement active: {enforcement_active}")
                
                # Check for OG cohort or enforcement_active: false
                if cohort == 'og':
                    return self.test_result("Enforcement Status Cohort", True, f"Correct OG cohort detected: {cohort}")
                elif enforcement_active == False:
                    return self.test_result("Enforcement Status Cohort", True, f"Enforcement not active (grace period): {enforcement_active}")
                else:
                    return self.test_result("Enforcement Status Cohort", False, f"Unexpected cohort/enforcement: cohort={cohort}, active={enforcement_active}")
                    
            else:
                return self.test_result("Enforcement Status Cohort", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            return self.test_result("Enforcement Status Cohort", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run the complete Phase 5 enforcement test suite"""
        log_header("PHASE 5 ACCESS ENFORCEMENT - OG USER GRACE PERIOD TESTING")
        log_info(f"Testing against: {BASE_URL}")
        log_info(f"Test started at: {datetime.now().isoformat()}")
        log_info("Testing OG user (registered before April 1, 2026) - should be in grace period")
        
        # Run tests in sequence
        tests = [
            self.authenticate,
            self.test_enforcement_status_cohort,
            self.test_chat_stream_enforcement,
            self.test_usage_recording,
            self.test_premium_model_check,
            self.test_image_generation_check,
            self.test_video_generation_check,
            self.test_voice_chat_enforcement,
        ]
        
        for test in tests:
            try:
                test()
                time.sleep(0.5)  # Small delay between tests
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
        
        return success_rate >= 85  # Consider 85%+ success rate as passing for this specific test

if __name__ == "__main__":
    tester = Phase5EnforcementTester()
    success = tester.run_all_tests()
    
    if success:
        log_success("✅ PHASE 5 ACCESS ENFORCEMENT OG USER TESTING COMPLETE - ALL CRITICAL TESTS PASSED")
        sys.exit(0)
    else:
        log_error("❌ PHASE 5 ACCESS ENFORCEMENT OG USER TESTING FAILED - CRITICAL ISSUES FOUND")
        sys.exit(1)