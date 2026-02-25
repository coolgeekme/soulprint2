#!/usr/bin/env python3
"""
Backend Test Suite for SoulPrint Engine
Testing Kimi AI Integration, Telegram API, and Web Search Integration
"""
import requests
import json
import time
import os

BASE_URL = "https://task-automation-32.preview.emergentagent.com"

# Test credentials
TEST_EMAIL = "test@soulprint.com"  
TEST_PASSCODE = "test123"

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        
    def login(self):
        """Login and get authentication token"""
        try:
            response = requests.post(f"{self.base_url}/api/auth/login", 
                json={"email": TEST_EMAIL, "passcode": TEST_PASSCODE})
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                print(f"✅ LOGIN: Successfully logged in with token: {self.token[:20]}...")
                return True
            else:
                print(f"❌ LOGIN: Failed with status {response.status_code}: {response.text}")
                return False
        except Exception as e:
            print(f"❌ LOGIN: Error - {e}")
            return False
    
    def get_auth_headers(self):
        """Get authorization headers"""
        if not self.token:
            raise Exception("Not authenticated")
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_kimi_ai_integration(self):
        """Test Kimi AI Integration"""
        print("\n🔍 TESTING KIMI AI INTEGRATION...")
        
        # Test 1: POST /api/chat/stream with Kimi K2 model
        try:
            headers = self.get_auth_headers()
            payload = {
                "content": "Say 'Hello from Kimi!' in exactly 5 words", 
                "model": "kimi-k2-0711-preview",
                "provider": "kimi",
                "enableWebSearch": False
            }
            
            response = requests.post(f"{self.base_url}/api/chat/stream", 
                json=payload, headers=headers, stream=True)
            
            if response.status_code == 200:
                print("✅ KIMI K2 STREAM: Response received, parsing NDJSON...")
                
                chunks = []
                meta_found = False
                delta_found = False
                done_found = False
                
                for line in response.iter_lines(decode_unicode=True):
                    if line.strip():
                        try:
                            chunk = json.loads(line)
                            chunks.append(chunk)
                            
                            if chunk.get('type') == 'meta':
                                meta_found = True
                                print(f"  📊 META chunk: {chunk}")
                            elif chunk.get('type') == 'delta':
                                delta_found = True
                                print(f"  📝 DELTA chunk: {chunk.get('content', '')[:50]}")
                            elif chunk.get('type') == 'done':
                                done_found = True
                                print(f"  ✅ DONE chunk: {chunk}")
                        except json.JSONDecodeError as e:
                            print(f"  ⚠️ Invalid JSON chunk: {line}")
                
                print(f"  📈 Total chunks received: {len(chunks)}")
                
                if meta_found and delta_found and done_found:
                    print("✅ KIMI K2: All expected chunk types received (meta, delta, done)")
                else:
                    print(f"❌ KIMI K2: Missing chunk types - meta:{meta_found}, delta:{delta_found}, done:{done_found}")
                    
            else:
                print(f"❌ KIMI K2 STREAM: Failed with status {response.status_code}: {response.text}")
        
        except Exception as e:
            print(f"❌ KIMI K2 STREAM: Error - {e}")
        
        # Test 2: POST /api/chat/stream with Moonshot model
        try:
            headers = self.get_auth_headers()
            payload = {
                "content": "Hello!",
                "model": "moonshot-v1-8k", 
                "provider": "kimi",
                "enableWebSearch": False
            }
            
            response = requests.post(f"{self.base_url}/api/chat/stream", 
                json=payload, headers=headers, stream=True)
            
            if response.status_code == 200:
                print("✅ MOONSHOT STREAM: Response received, parsing NDJSON...")
                
                chunks = []
                for line in response.iter_lines(decode_unicode=True):
                    if line.strip():
                        try:
                            chunk = json.loads(line)
                            chunks.append(chunk)
                            if chunk.get('type') == 'delta':
                                print(f"  📝 DELTA: {chunk.get('content', '')[:30]}")
                        except json.JSONDecodeError:
                            pass
                            
                print(f"  📈 Moonshot chunks received: {len(chunks)}")
                print("✅ MOONSHOT: Streaming response successful")
                    
            else:
                print(f"❌ MOONSHOT STREAM: Failed with status {response.status_code}: {response.text}")
        
        except Exception as e:
            print(f"❌ MOONSHOT STREAM: Error - {e}")
        
        # Test 3: GET /api/models - verify Kimi models appear
        try:
            headers = self.get_auth_headers()
            response = requests.get(f"{self.base_url}/api/models", headers=headers)
            
            if response.status_code == 200:
                models = response.json()
                kimi_models = [m for m in models if m.get('group') == 'Kimi']
                
                print(f"✅ MODELS API: Found {len(kimi_models)} Kimi models")
                for model in kimi_models:
                    print(f"  🤖 {model.get('label')} ({model.get('value')})")
                
                expected_models = ['kimi-k2-0711-preview', 'moonshot-v1-32k', 'moonshot-v1-8k']
                found_values = [m.get('value') for m in kimi_models]
                
                all_found = all(model in found_values for model in expected_models)
                if all_found:
                    print("✅ MODELS: All expected Kimi models found")
                else:
                    missing = [m for m in expected_models if m not in found_values]
                    print(f"⚠️ MODELS: Missing Kimi models: {missing}")
                    
            else:
                print(f"❌ MODELS API: Failed with status {response.status_code}: {response.text}")
        
        except Exception as e:
            print(f"❌ MODELS API: Error - {e}")

    def test_telegram_api(self):
        """Test Telegram model preference API"""
        print("\n📱 TESTING TELEGRAM API...")
        
        # Test 1: GET /api/telegram/status
        try:
            headers = self.get_auth_headers()
            response = requests.get(f"{self.base_url}/api/telegram/status", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                print("✅ TELEGRAM STATUS: API endpoint exists and responds")
                print(f"  📊 Response: {data}")
                
                if 'preferred_model' in data:
                    print(f"  ✅ preferred_model field present: {data['preferred_model']}")
                else:
                    print("  ❌ preferred_model field missing from response")
                    
            else:
                print(f"❌ TELEGRAM STATUS: Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ TELEGRAM STATUS: Error - {e}")
        
        # Test 2: PUT /api/telegram/model with valid model
        try:
            headers = self.get_auth_headers()
            payload = {"model": "gpt-4o"}
            
            response = requests.put(f"{self.base_url}/api/telegram/model", 
                json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                print("✅ TELEGRAM MODEL SET: Successfully set model")
                print(f"  📊 Response: {data}")
                
                expected_fields = ['success', 'model', 'label']
                has_all_fields = all(field in data for field in expected_fields)
                
                if has_all_fields and data.get('success') and data.get('model') == 'gpt-4o':
                    print("✅ TELEGRAM MODEL: Response format correct")
                else:
                    print(f"⚠️ TELEGRAM MODEL: Unexpected response format")
                    
            elif response.status_code == 400:
                data = response.json()
                if 'No linked Telegram account' in data.get('error', ''):
                    print("✅ TELEGRAM MODEL: Expected 'No linked Telegram account' error (OK for test user)")
                else:
                    print(f"❌ TELEGRAM MODEL: Unexpected error: {data}")
            else:
                print(f"❌ TELEGRAM MODEL: Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ TELEGRAM MODEL: Error - {e}")
        
        # Test 3: PUT /api/telegram/model with invalid model
        try:
            headers = self.get_auth_headers()
            payload = {"model": "invalid-model-xyz"}
            
            response = requests.put(f"{self.base_url}/api/telegram/model", 
                json=payload, headers=headers)
            
            if response.status_code == 400:
                data = response.json()
                print("✅ TELEGRAM INVALID MODEL: Correctly rejected invalid model")
                print(f"  📊 Error response: {data}")
            else:
                print(f"⚠️ TELEGRAM INVALID MODEL: Expected 400 error, got {response.status_code}")
                
        except Exception as e:
            print(f"❌ TELEGRAM INVALID MODEL: Error - {e}")

    def test_web_search_integration(self):
        """Test Web search integration"""
        print("\n🌐 TESTING WEB SEARCH INTEGRATION...")
        
        # Test 1: Web search with OpenAI model (should trigger Tavily search)
        try:
            headers = self.get_auth_headers()
            payload = {
                "content": "What is the current price of Bitcoin today?",
                "model": "gpt-4o",
                "enableWebSearch": True
            }
            
            response = requests.post(f"{self.base_url}/api/chat/stream", 
                json=payload, headers=headers, stream=True)
            
            if response.status_code == 200:
                print("✅ WEB SEARCH (GPT-4o): Stream started, checking for search events...")
                
                chunks = []
                search_found = False
                
                for line in response.iter_lines(decode_unicode=True):
                    if line.strip():
                        try:
                            chunk = json.loads(line)
                            chunks.append(chunk)
                            
                            if chunk.get('type') == 'search':
                                search_found = True
                                queries = chunk.get('queries', [])
                                print(f"  🔍 SEARCH event found with queries: {queries}")
                            elif chunk.get('type') == 'meta':
                                print(f"  📊 META: {chunk}")
                            elif chunk.get('type') == 'done':
                                print(f"  ✅ DONE: {chunk}")
                                break
                        except json.JSONDecodeError:
                            pass
                
                if search_found:
                    print("✅ WEB SEARCH: type='search' event confirmed with Tavily integration")
                else:
                    print("⚠️ WEB SEARCH: No type='search' event found - may indicate search not triggered")
                    
            else:
                print(f"❌ WEB SEARCH (GPT-4o): Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ WEB SEARCH (GPT-4o): Error - {e}")
        
        # Test 2: Web search with Perplexity (built-in search, no Tavily)
        try:
            headers = self.get_auth_headers()
            payload = {
                "content": "What is the current price of Bitcoin today?",
                "model": "sonar", 
                "provider": "perplexity",
                "enableWebSearch": True
            }
            
            response = requests.post(f"{self.base_url}/api/chat/stream", 
                json=payload, headers=headers, stream=True)
            
            if response.status_code == 200:
                print("✅ PERPLEXITY SEARCH: Stream started, checking response...")
                
                chunks = []
                has_content = False
                
                for line in response.iter_lines(decode_unicode=True):
                    if line.strip():
                        try:
                            chunk = json.loads(line)
                            chunks.append(chunk)
                            
                            if chunk.get('type') == 'delta' and chunk.get('content'):
                                content = chunk.get('content', '')
                                if 'bitcoin' in content.lower() or 'price' in content.lower():
                                    has_content = True
                                print(f"  📝 DELTA: {content[:50]}...")
                            elif chunk.get('type') == 'done':
                                print(f"  ✅ DONE: {chunk}")
                                break
                        except json.JSONDecodeError:
                            pass
                
                print(f"  📈 Perplexity chunks: {len(chunks)}")
                
                if has_content:
                    print("✅ PERPLEXITY: Received Bitcoin price information (built-in search working)")
                else:
                    print("⚠️ PERPLEXITY: Response received but may not contain expected Bitcoin info")
                    
            else:
                print(f"❌ PERPLEXITY SEARCH: Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ PERPLEXITY SEARCH: Error - {e}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 STARTING SOULPRINT ENGINE BACKEND TESTS")
        print(f"Base URL: {self.base_url}")
        
        if not self.login():
            print("❌ Cannot proceed without authentication")
            return
        
        self.test_kimi_ai_integration()
        self.test_telegram_api() 
        self.test_web_search_integration()
        
        print("\n🎯 BACKEND TESTING COMPLETE!")

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()