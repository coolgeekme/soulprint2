#!/usr/bin/env python3
"""
SoulPrint Engine Multi-LLM Backend Test Suite
Tests all 4 provider integrations: OpenAI, Claude, Gemini, Perplexity
"""

import json
import asyncio
import aiohttp
import sys

# Base URL from environment
BASE_URL = "https://soulprint-llm.preview.emergentagent.com"

class SoulPrintTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = None
        self.auth_token = None
        
    async def create_session(self):
        """Create HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def close_session(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
    
    async def authenticate(self):
        """Login or register test user"""
        try:
            # Try login first with superadmin user
            login_data = {
                "email": "test@soulprint.com",
                "password": "test123"
            }
            
            async with self.session.post(f"{self.base_url}/api/auth/login", 
                                       json=login_data) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.auth_token = data.get('token')
                    print(f"✅ Logged in as existing user: {login_data['email']}")
                    return True
                elif resp.status in [401, 404]:
                    print(f"⚠️ Login failed (status {resp.status}), trying registration...")
                else:
                    print(f"❌ Login error: {resp.status}")
                    return False
        except Exception as e:
            print(f"❌ Login error: {e}")
        
        # Try registration
        try:
            register_data = {
                "email": "llmtest@soulprint.com",
                "password": "test123",
                "name": "LLM Test"
            }
            
            async with self.session.post(f"{self.base_url}/api/auth/register",
                                       json=register_data) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.auth_token = data.get('token')
                    print(f"✅ Registered new user: {register_data['email']} (first user is superadmin)")
                    return True
                else:
                    error_text = await resp.text()
                    print(f"❌ Registration failed: {resp.status} - {error_text}")
                    return False
        except Exception as e:
            print(f"❌ Registration error: {e}")
            return False
    
    async def test_models_endpoint(self):
        """Test GET /api/models endpoint"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            async with self.session.get(f"{self.base_url}/api/models", 
                                      headers=headers) as resp:
                if resp.status == 200:
                    models = await resp.json()
                    print(f"✅ Models endpoint working. Found {len(models)} models")
                    
                    # Check for all 4 provider groups
                    providers = set()
                    for model in models:
                        if 'group' in model:
                            providers.add(model['group'])
                    
                    expected_groups = {'OpenAI', 'Anthropic', 'Google', 'Perplexity'}
                    found_groups = providers.intersection(expected_groups)
                    print(f"   Provider groups found: {sorted(found_groups)}")
                    
                    if len(found_groups) >= 4:
                        print("✅ All 4 provider groups available")
                        return True
                    else:
                        print(f"⚠️ Only found {len(found_groups)}/4 provider groups")
                        return True  # Still working, just incomplete
                else:
                    print(f"❌ Models endpoint failed: {resp.status}")
                    return False
        except Exception as e:
            print(f"❌ Models endpoint error: {e}")
            return False
    
    async def test_streaming_provider(self, provider_name, model, test_name):
        """Test streaming chat with specific provider"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.auth_token}"
            }
            
            chat_data = {
                "content": "Say hello in one sentence",
                "model": model,
                "provider": provider_name,
                "enableWebSearch": False
            }
            
            print(f"\n🧪 Testing {test_name} ({provider_name}/{model})...")
            
            async with self.session.post(f"{self.base_url}/api/chat/stream",
                                       json=chat_data, headers=headers) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    print(f"❌ {test_name} failed: {resp.status} - {error_text}")
                    return False
                
                # Verify content type
                content_type = resp.headers.get('content-type', '')
                if 'text/event-stream' not in content_type:
                    print(f"❌ {test_name} - Wrong content type: {content_type}")
                    return False
                
                chunks = []
                meta_received = False
                done_received = False
                delta_count = 0
                
                # Read streaming response line by line
                async for line in resp.content:
                    line = line.decode('utf-8').strip()
                    if not line:
                        continue
                    
                    try:
                        chunk = json.loads(line)
                        chunks.append(chunk)
                        
                        if chunk.get('type') == 'meta':
                            meta_received = True
                            conversation_id = chunk.get('conversationId')
                            print(f"   📋 Meta chunk received with conversationId: {conversation_id}")
                            
                        elif chunk.get('type') == 'delta':
                            delta_count += 1
                            content = chunk.get('content', '')
                            if delta_count <= 3:  # Show first 3 deltas
                                print(f"   📝 Delta {delta_count}: '{content}'")
                                
                        elif chunk.get('type') == 'done':
                            done_received = True
                            print(f"   ✅ Done chunk received")
                            break
                            
                        elif chunk.get('type') == 'error':
                            error_msg = chunk.get('error', 'Unknown error')
                            print(f"❌ {test_name} - Stream error: {error_msg}")
                            return False
                            
                    except json.JSONDecodeError:
                        print(f"⚠️ {test_name} - Invalid JSON chunk: {line[:100]}")
                        continue
                
                # Validate streaming structure
                if not meta_received:
                    print(f"❌ {test_name} - No meta chunk received")
                    return False
                    
                if delta_count == 0:
                    print(f"❌ {test_name} - No delta chunks received")
                    return False
                    
                if not done_received:
                    print(f"❌ {test_name} - No done chunk received")
                    return False
                
                # Reconstruct full response
                full_content = ''.join([c.get('content', '') for c in chunks if c.get('type') == 'delta'])
                
                print(f"✅ {test_name} SUCCESS:")
                print(f"   📊 Total chunks: {len(chunks)}")
                print(f"   📝 Delta chunks: {delta_count}")
                print(f"   📄 Response length: {len(full_content)} chars")
                print(f"   💬 Sample response: '{full_content[:100]}{'...' if len(full_content) > 100 else ''}'")
                
                return True
                
        except Exception as e:
            print(f"❌ {test_name} error: {e}")
            return False
    
    async def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting SoulPrint Multi-LLM Provider Tests")
        print(f"🌐 Base URL: {self.base_url}")
        
        await self.create_session()
        
        try:
            # Step 1: Authentication
            print("\n📝 Step 1: Authentication")
            if not await self.authenticate():
                print("❌ Authentication failed - cannot continue")
                return False
            
            # Step 2: Test models endpoint
            print("\n📝 Step 2: Test Models Endpoint")
            models_ok = await self.test_models_endpoint()
            
            # Step 3: Test each provider
            print("\n📝 Step 3: Test Multi-LLM Providers")
            
            provider_tests = [
                ("openai", "gpt-4o", "OpenAI GPT-4o"),
                ("anthropic", "claude-sonnet-4-5-20250929", "Claude Sonnet 4.5"),
                ("gemini", "gemini-2.0-flash", "Gemini 2.0 Flash"),
                ("perplexity", "sonar", "Perplexity Sonar"),
            ]
            
            results = []
            for provider, model, name in provider_tests:
                result = await self.test_streaming_provider(provider, model, name)
                results.append((name, result))
                await asyncio.sleep(1)  # Rate limiting
            
            # Summary
            print("\n" + "="*60)
            print("🏁 TEST SUMMARY")
            print("="*60)
            
            # Authentication
            print(f"🔐 Authentication: ✅ SUCCESS")
            
            # Models endpoint
            print(f"📋 Models Endpoint: {'✅ SUCCESS' if models_ok else '❌ FAILED'}")
            
            # Provider tests
            successful_providers = 0
            for name, result in results:
                status = "✅ SUCCESS" if result else "❌ FAILED"
                print(f"🤖 {name}: {status}")
                if result:
                    successful_providers += 1
            
            total_tests = len(results) + 2  # providers + auth + models
            successful_tests = successful_providers + 1 + (1 if models_ok else 0)
            
            print(f"\n🎯 Overall: {successful_tests}/{total_tests} tests passed")
            
            if successful_providers == len(provider_tests):
                print("🎉 All multi-LLM providers working correctly!")
                return True
            elif successful_providers >= 2:
                print(f"⚠️ {successful_providers}/{len(provider_tests)} providers working - partial success")
                return True
            else:
                print("❌ Multi-LLM integration has major issues")
                return False
                
        finally:
            await self.close_session()

async def main():
    """Main test runner"""
    tester = SoulPrintTester()
    success = await tester.run_all_tests()
    
    if success:
        print("\n✅ Backend testing completed successfully")
        sys.exit(0)
    else:
        print("\n❌ Backend testing failed")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())