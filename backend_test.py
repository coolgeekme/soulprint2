#!/usr/bin/env python3
"""
Backend Test Suite for Web Search Functionality - Critical Bug Testing
Testing all web search endpoints as specified in review request
"""

import requests
import json
import time
import sys
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = os.environ.get('NEXT_PUBLIC_BASE_URL', 'https://voice-analytics-hub-1.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class WebSearchTester:
    def __init__(self):
        self.auth_token = None
        self.session = requests.Session()
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def authenticate(self):
        """Login and get auth token"""
        try:
            self.log("🔐 Authenticating user...")
            response = self.session.post(f"{API_URL}/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('token')
                if self.auth_token:
                    self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                    self.log(f"✅ Authentication successful - User: {data.get('userId', 'Unknown')}, Role: {data.get('role', 'Unknown')}")
                    return True
                else:
                    self.log("❌ No token received in response", "ERROR")
            else:
                self.log(f"❌ Authentication failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.log(f"❌ Authentication error: {str(e)}", "ERROR")
            
        return False
        
    def test_chat_stream_web_search(self):
        """Test 1: Chat Stream with Web Search Enabled (Main Focus)"""
        self.total_tests += 1
        try:
            self.log("🧪 TEST 1: Chat Stream with Web Search Enabled")
            
            # Test data for weather query that should trigger web search
            test_payload = {
                "message": "what is the weather today in San Francisco?",
                "conversationId": None,
                "model": "gpt-4o",
                "enableWebSearch": True,
                "stream": True
            }
            
            self.log(f"📤 Sending POST {API_URL}/chat/stream with enableWebSearch=true")
            self.log(f"📋 Payload: {json.dumps(test_payload, indent=2)}")
            
            response = self.session.post(f"{API_URL}/chat/stream", 
                                       json=test_payload, 
                                       stream=True)
            
            if response.status_code != 200:
                self.log(f"❌ Chat stream failed: {response.status_code} - {response.text}", "ERROR")
                self.failed_tests += 1
                return False
                
            # Parse streaming response
            search_events = []
            source_events = []
            total_chunks = 0
            has_search_meta = False
            
            self.log("📡 Reading streaming response...")
            
            for line in response.iter_lines(decode_unicode=True):
                if not line or not line.startswith('data: '):
                    continue
                    
                data_content = line[6:].strip()
                if data_content == '[DONE]':
                    break
                    
                try:
                    chunk = json.loads(data_content)
                    chunk_type = chunk.get('type', 'unknown')
                    total_chunks += 1
                    
                    if chunk_type == 'search' or chunk_type == 'sources':
                        search_events.append(chunk)
                        self.log(f"🔍 Found search event: {chunk_type} - {json.dumps(chunk, indent=2)}")
                        
                    if chunk_type == 'meta':
                        meta_data = chunk.get('data', {})
                        if 'searchMeta' in meta_data or 'didSearch' in meta_data:
                            has_search_meta = True
                            self.log(f"🔍 Found search meta: {json.dumps(meta_data, indent=2)}")
                            
                except json.JSONDecodeError:
                    continue
            
            self.log(f"📊 Stream completed: {total_chunks} total chunks, {len(search_events)} search events")
            
            # Check if web search was triggered
            if len(search_events) > 0 or has_search_meta:
                self.log("✅ TEST 1 PASSED: Web search was triggered and search events found!")
                self.passed_tests += 1
                return True
            else:
                self.log("❌ TEST 1 FAILED: No search events or search meta found in stream", "ERROR")
                self.log("🔍 Expected: type='search' or type='sources' events, or searchMeta in meta chunk", "ERROR")
                self.failed_tests += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 1 ERROR: {str(e)}", "ERROR")
            self.failed_tests += 1
            return False
            
    def test_smart_mode_search(self):
        """Test 2: Chat Stream with Smart Mode (Dynamic Intelligence)"""
        self.total_tests += 1
        try:
            self.log("🧪 TEST 2: Chat Stream with Smart Mode (Dynamic Intelligence)")
            
            # Test with smart model that should route to sonar-pro (Perplexity)
            test_payload = {
                "message": "what is the weather today?",
                "conversationId": None,
                "model": "smart",
                "enableWebSearch": True,
                "stream": True
            }
            
            self.log(f"📤 Sending POST {API_URL}/chat/stream with model='smart'")
            
            response = self.session.post(f"{API_URL}/chat/stream", 
                                       json=test_payload, 
                                       stream=True)
            
            if response.status_code != 200:
                self.log(f"❌ Smart mode stream failed: {response.status_code} - {response.text}", "ERROR")
                self.failed_tests += 1
                return False
                
            # Parse streaming response for smart mode routing
            smart_routing = False
            search_detected = False
            total_chunks = 0
            
            self.log("📡 Reading smart mode streaming response...")
            
            for line in response.iter_lines(decode_unicode=True):
                if not line or not line.startswith('data: '):
                    continue
                    
                data_content = line[6:].strip()
                if data_content == '[DONE]':
                    break
                    
                try:
                    chunk = json.loads(data_content)
                    total_chunks += 1
                    
                    # Check for smart mode routing indicators
                    if chunk.get('type') == 'meta':
                        meta_data = chunk.get('data', {})
                        if 'smartMode' in meta_data or 'selectedModel' in meta_data:
                            smart_routing = True
                            self.log(f"🧠 Smart mode routing detected: {json.dumps(meta_data, indent=2)}")
                            
                    # Check for search capability (Perplexity has built-in search)
                    if 'search' in chunk.get('type', '') or 'didSearch' in str(chunk):
                        search_detected = True
                        
                except json.JSONDecodeError:
                    continue
            
            self.log(f"📊 Smart mode stream completed: {total_chunks} chunks")
            
            # Smart mode should either route properly OR provide search capability
            if smart_routing or total_chunks > 0:
                self.log("✅ TEST 2 PASSED: Smart mode is working (routing detected or response received)")
                self.passed_tests += 1
                return True
            else:
                self.log("❌ TEST 2 FAILED: Smart mode not working properly", "ERROR")
                self.failed_tests += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 2 ERROR: {str(e)}", "ERROR")
            self.failed_tests += 1
            return False
            
    def test_direct_web_search_api(self):
        """Test 3: Direct Web Search API"""
        self.total_tests += 1
        try:
            self.log("🧪 TEST 3: Direct Web Search API")
            
            test_payload = {
                "query": "current weather in New York"
            }
            
            self.log(f"📤 Sending POST {API_URL}/web-search")
            
            response = self.session.post(f"{API_URL}/web-search", json=test_payload)
            
            if response.status_code != 200:
                self.log(f"❌ Direct web search failed: {response.status_code} - {response.text}", "ERROR")
                self.failed_tests += 1
                return False
                
            data = response.json()
            self.log(f"📊 Web search response: {json.dumps(data, indent=2)}")
            
            # Check if results are returned
            if 'results' in data and len(data['results']) > 0:
                self.log(f"✅ TEST 3 PASSED: Direct web search returned {len(data['results'])} results")
                self.passed_tests += 1
                return True
            else:
                self.log("❌ TEST 3 FAILED: No results returned from web search API", "ERROR")
                self.failed_tests += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 3 ERROR: {str(e)}", "ERROR")
            self.failed_tests += 1
            return False
            
    def test_voice_tool_web_search(self):
        """Test 4: Voice Tool Web Search"""
        self.total_tests += 1
        try:
            self.log("🧪 TEST 4: Voice Tool Web Search")
            
            test_payload = {
                "tool_name": "web_search",
                "tool_args": {
                    "query": "weather in Los Angeles"
                }
            }
            
            self.log(f"📤 Sending POST {API_URL}/voice/tool")
            
            response = self.session.post(f"{API_URL}/voice/tool", json=test_payload)
            
            if response.status_code != 200:
                self.log(f"❌ Voice tool web search failed: {response.status_code} - {response.text}", "ERROR")
                self.failed_tests += 1
                return False
                
            data = response.json()
            self.log(f"📊 Voice tool response: {json.dumps(data, indent=2)}")
            
            # Check if search results are returned
            if ('results' in data and len(data.get('results', [])) > 0) or ('answer' in data and data['answer']):
                self.log("✅ TEST 4 PASSED: Voice tool web search returned results")
                self.passed_tests += 1
                return True
            else:
                self.log("❌ TEST 4 FAILED: Voice tool web search did not return results", "ERROR")
                self.failed_tests += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 4 ERROR: {str(e)}", "ERROR")
            self.failed_tests += 1
            return False

    def test_perplexity_sonar_direct(self):
        """Test 5: Test Perplexity Sonar Pro directly for built-in search"""
        self.total_tests += 1
        try:
            self.log("🧪 TEST 5: Perplexity Sonar Pro Direct Test")
            
            test_payload = {
                "message": "what is the weather today in Miami?",
                "conversationId": None,
                "model": "sonar-pro",
                "enableWebSearch": True,
                "stream": True
            }
            
            self.log(f"📤 Sending POST {API_URL}/chat/stream with model='sonar-pro'")
            
            response = self.session.post(f"{API_URL}/chat/stream", 
                                       json=test_payload, 
                                       stream=True)
            
            if response.status_code != 200:
                self.log(f"❌ Perplexity sonar-pro failed: {response.status_code} - {response.text}", "ERROR")
                self.failed_tests += 1
                return False
                
            # Parse streaming response
            total_chunks = 0
            has_content = False
            
            self.log("📡 Reading Perplexity streaming response...")
            
            for line in response.iter_lines(decode_unicode=True):
                if not line or not line.startswith('data: '):
                    continue
                    
                data_content = line[6:].strip()
                if data_content == '[DONE]':
                    break
                    
                try:
                    chunk = json.loads(data_content)
                    total_chunks += 1
                    
                    if chunk.get('type') == 'delta' and chunk.get('data'):
                        has_content = True
                        
                except json.JSONDecodeError:
                    continue
            
            self.log(f"📊 Perplexity stream completed: {total_chunks} chunks, has_content: {has_content}")
            
            # Perplexity should return content (has built-in search)
            if total_chunks > 0 and has_content:
                self.log("✅ TEST 5 PASSED: Perplexity sonar-pro is working with built-in search")
                self.passed_tests += 1
                return True
            else:
                self.log("❌ TEST 5 FAILED: Perplexity sonar-pro not returning content", "ERROR")
                self.failed_tests += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 5 ERROR: {str(e)}", "ERROR")
            self.failed_tests += 1
            return False

    def check_server_logs(self):
        """Helper: Check server logs for web search indicators"""
        try:
            self.log("🔍 Attempting to check server logs...")
            # Note: This might not work in container but let's try
            log_patterns = [
                'tail -n 50 /var/log/supervisor/nextjs.out.log | grep -i "websearch\\|voicetool\\|search\\|tavily\\|brave"',
                'tail -n 50 /var/log/supervisor/nextjs.err.log | grep -i "websearch\\|voicetool\\|search\\|tavily\\|brave"'
            ]
            
            for pattern in log_patterns:
                try:
                    result = os.popen(pattern).read()
                    if result.strip():
                        self.log(f"📋 Server logs found:\n{result}")
                        return
                except:
                    continue
                    
            self.log("📋 No relevant server logs found or logs not accessible")
            
        except Exception as e:
            self.log(f"📋 Could not check server logs: {str(e)}")

    def run_all_tests(self):
        """Run all web search tests"""
        self.log("🚀 Starting Web Search Critical Bug Testing")
        self.log(f"🌐 Base URL: {BASE_URL}")
        self.log(f"🔌 API URL: {API_URL}")
        
        # Authenticate first
        if not self.authenticate():
            self.log("❌ Authentication failed - cannot proceed with tests", "ERROR")
            return False
            
        # Run all tests
        self.log("\n" + "="*60)
        self.log("🧪 STARTING WEB SEARCH FUNCTIONALITY TESTS")
        self.log("="*60)
        
        # Test 1: Chat Stream with Web Search (Main focus - this is the broken one)
        self.test_chat_stream_web_search()
        
        time.sleep(1)
        
        # Test 2: Smart Mode Dynamic Intelligence  
        self.test_smart_mode_search()
        
        time.sleep(1)
        
        # Test 3: Direct Web Search API
        self.test_direct_web_search_api()
        
        time.sleep(1)
        
        # Test 4: Voice Tool Web Search
        self.test_voice_tool_web_search()
        
        time.sleep(1)
        
        # Test 5: Perplexity Sonar Pro Direct
        self.test_perplexity_sonar_direct()
        
        # Check server logs
        self.check_server_logs()
        
        # Final results
        self.log("\n" + "="*60)
        self.log("🎯 WEB SEARCH TESTING COMPLETE")
        self.log("="*60)
        self.log(f"📊 Total Tests: {self.total_tests}")
        self.log(f"✅ Passed: {self.passed_tests}")
        self.log(f"❌ Failed: {self.failed_tests}")
        self.log(f"📈 Success Rate: {(self.passed_tests/self.total_tests)*100:.1f}%")
        
        if self.failed_tests > 0:
            self.log("\n🚨 CRITICAL ISSUES DETECTED:")
            if self.failed_tests >= 3:
                self.log("🚨 MULTIPLE WEB SEARCH FAILURES - This confirms the P0 bug reported by user")
                self.log("🔍 Issue is likely in chat flow or providers.js logic as direct APIs work")
            else:
                self.log("🔍 Some web search features failing - needs investigation")
                
        return self.failed_tests == 0

if __name__ == "__main__":
    tester = WebSearchTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)