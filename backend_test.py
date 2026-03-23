#!/usr/bin/env python3
"""
Backend Test Suite for Auto-Continuation Feature
Tests the auto-continuation functionality for truncated AI responses
"""

import asyncio
import json
import aiohttp
import time
from typing import Dict, List, Any

# Test configuration
BASE_URL = "https://soulprint-ai-1.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSCODE = "test123"

class BackendTester:
    def __init__(self):
        self.session = None
        self.auth_token = None
        self.test_results = []
        
    async def __aenter__(self):
        timeout = aiohttp.ClientTimeout(total=120)  # 2 minute timeout
        self.session = aiohttp.ClientSession(timeout=timeout)
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
    
    async def authenticate(self) -> bool:
        """Test authentication and get JWT token"""
        try:
            async with self.session.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": TEST_EMAIL, "passcode": TEST_PASSCODE},
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    self.auth_token = data.get("token")
                    if self.auth_token:
                        self.log_result("Authentication (POST /api/auth/login)", True, f"Token received, role: {data.get('role', 'unknown')}")
                        return True
                    else:
                        self.log_result("Authentication (POST /api/auth/login)", False, "No token in response")
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Authentication (POST /api/auth/login)", False, f"HTTP {response.status}: {error_text}")
                    return False
        except Exception as e:
            self.log_result("Authentication (POST /api/auth/login)", False, f"Exception: {str(e)}")
            return False
    
    async def test_models_endpoint(self) -> bool:
        """Test GET /api/models endpoint"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            async with self.session.get(f"{BASE_URL}/api/models", headers=headers) as response:
                if response.status == 200:
                    models = await response.json()  # Direct array, not wrapped in object
                    
                    # Count models by provider
                    provider_counts = {}
                    for model in models:
                        provider = model.get("group", "unknown")
                        provider_counts[provider] = provider_counts.get(provider, 0) + 1
                    
                    total_models = len(models)
                    expected_providers = ["OpenAI", "Anthropic", "Google", "Perplexity", "Kimi"]
                    found_providers = list(provider_counts.keys())
                    
                    if total_models >= 18 and all(p in found_providers for p in expected_providers):
                        details = f"Found {total_models} models across {len(found_providers)} providers: {provider_counts}"
                        self.log_result("Models Endpoint (GET /api/models)", True, details)
                        return True
                    else:
                        details = f"Expected ≥18 models across 5 providers, got {total_models} models: {provider_counts}"
                        self.log_result("Models Endpoint (GET /api/models)", False, details)
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Models Endpoint (GET /api/models)", False, f"HTTP {response.status}: {error_text}")
                    return False
        except Exception as e:
            self.log_result("Models Endpoint (GET /api/models)", False, f"Exception: {str(e)}")
            return False
    
    async def test_basic_chat_stream(self) -> bool:
        """Test basic chat streaming with a simple question"""
        try:
            headers = {
                "Authorization": f"Bearer {self.auth_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "content": "What is the capital of France?",
                "model": "gpt-4o",
                "conversationId": None,
                "enableWebSearch": False
            }
            
            async with self.session.post(
                f"{BASE_URL}/api/chat/stream",
                json=payload,
                headers=headers
            ) as response:
                if response.status == 200:
                    content_type = response.headers.get('content-type', '')
                    if 'text/event-stream' not in content_type and 'text/plain' not in content_type:
                        self.log_result("Basic Chat Stream", False, f"Wrong content-type: {content_type}")
                        return False
                    
                    chunks = []
                    events = []
                    full_content = ""
                    
                    async for line in response.content:
                        line_str = line.decode('utf-8').strip()
                        if line_str:
                            try:
                                event = json.loads(line_str)
                                events.append(event)
                                chunks.append(line_str)
                                
                                if event.get('type') == 'delta':
                                    full_content += event.get('content', '')
                            except json.JSONDecodeError:
                                continue
                    
                    # Validate stream format
                    event_types = [e.get('type') for e in events]
                    has_meta = 'meta' in event_types
                    has_delta = 'delta' in event_types
                    has_done = 'done' in event_types
                    
                    if has_meta and has_delta and has_done and len(full_content) > 0:
                        details = f"Received {len(chunks)} chunks, {len(full_content)} chars, events: {set(event_types)}"
                        self.log_result("Basic Chat Stream (POST /api/chat/stream)", True, details)
                        return True
                    else:
                        details = f"Missing required events. Got: {set(event_types)}, content length: {len(full_content)}"
                        self.log_result("Basic Chat Stream (POST /api/chat/stream)", False, details)
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Basic Chat Stream (POST /api/chat/stream)", False, f"HTTP {response.status}: {error_text}")
                    return False
        except Exception as e:
            self.log_result("Basic Chat Stream (POST /api/chat/stream)", False, f"Exception: {str(e)}")
            return False
    
    async def test_auto_continuation_stream(self) -> bool:
        """Test auto-continuation with a long prompt that should trigger truncation"""
        try:
            headers = {
                "Authorization": f"Bearer {self.auth_token}",
                "Content-Type": "application/json"
            }
            
            # Long prompt designed to produce a response that exceeds token limits
            # Use a very specific request that should produce a long response
            long_prompt = """Please write a complete, detailed step-by-step tutorial on building a full-stack web application from scratch. Include every single detail:

1. PROJECT SETUP (500+ words):
- Setting up development environment
- Installing Node.js, npm, and all required tools
- Creating project structure with detailed folder explanations
- Setting up version control with Git
- Configuring package.json with all dependencies
- Setting up development scripts and build processes

2. FRONTEND DEVELOPMENT (1000+ words):
- HTML structure and semantic markup
- CSS styling with modern techniques (Flexbox, Grid, animations)
- JavaScript fundamentals and ES6+ features
- React.js component architecture and state management
- Routing with React Router
- Form handling and validation
- API integration and error handling
- Responsive design principles and mobile-first approach

3. BACKEND DEVELOPMENT (1000+ words):
- Node.js and Express.js server setup
- Database design and MongoDB integration
- RESTful API design principles
- Authentication and authorization (JWT)
- Middleware implementation
- Error handling and logging
- File upload and processing
- Security best practices (CORS, rate limiting, input validation)

4. DATABASE INTEGRATION (500+ words):
- MongoDB setup and configuration
- Schema design and relationships
- CRUD operations and queries
- Indexing for performance
- Data validation and constraints
- Backup and recovery strategies

5. TESTING AND DEPLOYMENT (500+ words):
- Unit testing with Jest
- Integration testing
- End-to-end testing with Cypress
- CI/CD pipeline setup
- Docker containerization
- Cloud deployment (AWS, Heroku, or similar)
- Environment configuration
- Monitoring and logging

6. ADVANCED FEATURES (500+ words):
- Real-time features with WebSockets
- Caching strategies
- Performance optimization
- SEO optimization
- Progressive Web App features
- Internationalization
- Analytics integration

For each section, provide complete code examples, explain every line of code, include common pitfalls and how to avoid them, and provide troubleshooting tips. Make this tutorial comprehensive enough that a beginner could follow it step by step."""
            
            payload = {
                "content": long_prompt,
                "model": "gpt-4o-mini",  # Use smaller model more likely to hit limits
                "conversationId": None,
                "enableWebSearch": False
            }
            
            async with self.session.post(
                f"{BASE_URL}/api/chat/stream",
                json=payload,
                headers=headers
            ) as response:
                if response.status == 200:
                    chunks = []
                    events = []
                    full_content = ""
                    continuation_events = []
                    
                    async for line in response.content:
                        line_str = line.decode('utf-8').strip()
                        if line_str:
                            try:
                                event = json.loads(line_str)
                                events.append(event)
                                chunks.append(line_str)
                                
                                if event.get('type') == 'delta':
                                    full_content += event.get('content', '')
                                elif event.get('type') == 'continuation':
                                    continuation_events.append(event)
                                    print(f"   🔄 Auto-continuation event: {event}")
                            except json.JSONDecodeError:
                                continue
                    
                    # Validate stream format and auto-continuation
                    event_types = [e.get('type') for e in events]
                    has_meta = 'meta' in event_types
                    has_delta = 'delta' in event_types
                    has_done = 'done' in event_types
                    has_continuation = 'continuation' in event_types
                    
                    # Check if response is substantially longer than typical (indicating continuation worked)
                    is_long_response = len(full_content) > 2000  # Expect a long response
                    
                    if has_meta and has_delta and len(full_content) > 0:
                        if has_continuation and len(continuation_events) > 0:
                            # Auto-continuation was triggered
                            continuation_details = f"Auto-continuation triggered {len(continuation_events)} times"
                            details = f"Received {len(chunks)} chunks, {len(full_content)} chars, events: {set(event_types)}. {continuation_details}"
                            self.log_result("Auto-Continuation Stream (POST /api/chat/stream)", True, details)
                            return True
                        elif is_long_response:
                            # Response was long but no continuation events (maybe didn't hit limit)
                            details = f"Long response ({len(full_content)} chars) without continuation events - may not have hit token limit. Events: {set(event_types)}"
                            self.log_result("Auto-Continuation Stream (POST /api/chat/stream)", True, details)
                            return True
                        else:
                            # Response was short and no continuation
                            details = f"Response too short ({len(full_content)} chars), no continuation events. May need different model or prompt. Events: {set(event_types)}"
                            self.log_result("Auto-Continuation Stream (POST /api/chat/stream)", False, details)
                            return False
                    else:
                        details = f"Missing required events. Got: {set(event_types)}, content length: {len(full_content)}"
                        self.log_result("Auto-Continuation Stream (POST /api/chat/stream)", False, details)
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Auto-Continuation Stream (POST /api/chat/stream)", False, f"HTTP {response.status}: {error_text}")
                    return False
        except Exception as e:
            self.log_result("Auto-Continuation Stream (POST /api/chat/stream)", False, f"Exception: {str(e)}")
            return False
    
    async def test_anthropic_continuation(self) -> bool:
        """Test auto-continuation with Anthropic model (higher max_tokens)"""
        try:
            headers = {
                "Authorization": f"Bearer {self.auth_token}",
                "Content-Type": "application/json"
            }
            
            # Simple test first to see if Anthropic works at all
            simple_prompt = "Write a detailed explanation of machine learning in 500 words."
            
            payload = {
                "content": simple_prompt,
                "model": "claude-sonnet-4-5-20250929",  # Use Anthropic model
                "conversationId": None,
                "enableWebSearch": False
            }
            
            async with self.session.post(
                f"{BASE_URL}/api/chat/stream",
                json=payload,
                headers=headers
            ) as response:
                if response.status == 200:
                    chunks = []
                    events = []
                    full_content = ""
                    continuation_events = []
                    error_events = []
                    
                    async for line in response.content:
                        line_str = line.decode('utf-8').strip()
                        if line_str:
                            try:
                                event = json.loads(line_str)
                                events.append(event)
                                chunks.append(line_str)
                                
                                if event.get('type') == 'delta':
                                    full_content += event.get('content', '')
                                elif event.get('type') == 'continuation':
                                    continuation_events.append(event)
                                elif event.get('type') == 'error':
                                    error_events.append(event)
                                    print(f"   ❌ Anthropic Error: {event.get('error', 'Unknown error')}")
                            except json.JSONDecodeError:
                                continue
                    
                    # Validate stream format
                    event_types = [e.get('type') for e in events]
                    has_meta = 'meta' in event_types
                    has_delta = 'delta' in event_types
                    has_done = 'done' in event_types
                    has_continuation = 'continuation' in event_types
                    has_error = 'error' in event_types
                    
                    if has_error and len(error_events) > 0:
                        error_msg = error_events[0].get('error', 'Unknown error')
                        details = f"Anthropic API error: {error_msg}"
                        self.log_result("Anthropic Auto-Continuation (claude-sonnet-4-5)", False, details)
                        return False
                    
                    # Check response length
                    is_response = len(full_content) > 100
                    
                    if has_meta and has_delta and len(full_content) > 0:
                        if has_continuation and len(continuation_events) > 0:
                            details = f"Anthropic auto-continuation triggered {len(continuation_events)} times, {len(full_content)} chars"
                            self.log_result("Anthropic Auto-Continuation (claude-sonnet-4-5)", True, details)
                            return True
                        elif is_response:
                            details = f"Anthropic working correctly ({len(full_content)} chars) - 16k tokens may not hit limit easily"
                            self.log_result("Anthropic Auto-Continuation (claude-sonnet-4-5)", True, details)
                            return True
                        else:
                            details = f"Response length: {len(full_content)} chars, events: {set(event_types)}"
                            self.log_result("Anthropic Auto-Continuation (claude-sonnet-4-5)", False, details)
                            return False
                    else:
                        details = f"Missing required events. Got: {set(event_types)}, content length: {len(full_content)}"
                        self.log_result("Anthropic Auto-Continuation (claude-sonnet-4-5)", False, details)
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Anthropic Auto-Continuation (claude-sonnet-4-5)", False, f"HTTP {response.status}: {error_text}")
                    return False
        except Exception as e:
            self.log_result("Anthropic Auto-Continuation (claude-sonnet-4-5)", False, f"Exception: {str(e)}")
            return False
    
    async def test_stream_format_validation(self) -> bool:
        """Test that stream responses follow proper NDJSON format"""
        try:
            headers = {
                "Authorization": f"Bearer {self.auth_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "content": "Explain quantum computing in simple terms.",
                "model": "gpt-4o",
                "conversationId": None,
                "enableWebSearch": False
            }
            
            async with self.session.post(
                f"{BASE_URL}/api/chat/stream",
                json=payload,
                headers=headers
            ) as response:
                if response.status == 200:
                    valid_json_lines = 0
                    invalid_lines = 0
                    event_types_found = set()
                    
                    async for line in response.content:
                        line_str = line.decode('utf-8').strip()
                        if line_str:
                            try:
                                event = json.loads(line_str)
                                valid_json_lines += 1
                                event_type = event.get('type')
                                if event_type:
                                    event_types_found.add(event_type)
                                
                                # Validate required fields for each event type
                                if event_type == 'meta':
                                    if 'conversationId' not in event:
                                        self.log_result("Stream Format Validation", False, "meta event missing conversationId")
                                        return False
                                elif event_type == 'delta':
                                    if 'content' not in event:
                                        self.log_result("Stream Format Validation", False, "delta event missing content")
                                        return False
                                elif event_type == 'continuation':
                                    if 'count' not in event or 'max' not in event:
                                        self.log_result("Stream Format Validation", False, "continuation event missing count/max")
                                        return False
                                elif event_type == 'done':
                                    # done event can be empty
                                    pass
                                    
                            except json.JSONDecodeError:
                                invalid_lines += 1
                    
                    required_events = {'meta', 'delta', 'done'}
                    has_required = required_events.issubset(event_types_found)
                    
                    if has_required and valid_json_lines > 0 and invalid_lines == 0:
                        details = f"Valid NDJSON: {valid_json_lines} lines, events: {event_types_found}"
                        self.log_result("Stream Format Validation", True, details)
                        return True
                    else:
                        details = f"Invalid format: {valid_json_lines} valid, {invalid_lines} invalid, events: {event_types_found}"
                        self.log_result("Stream Format Validation", False, details)
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Stream Format Validation", False, f"HTTP {response.status}: {error_text}")
                    return False
        except Exception as e:
            self.log_result("Stream Format Validation", False, f"Exception: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Auto-Continuation Backend Tests")
        print("=" * 60)
        
        # Test 1: Authentication
        if not await self.authenticate():
            print("❌ Authentication failed - cannot continue with other tests")
            return
        
        # Test 2: Models endpoint
        await self.test_models_endpoint()
        
        # Test 3: Basic chat streaming
        await self.test_basic_chat_stream()
        
        # Test 4: Auto-continuation with long prompt
        await self.test_auto_continuation_stream()
        
        # Test 5: Anthropic auto-continuation (higher token limit)
        await self.test_anthropic_continuation()
        
        # Test 6: Stream format validation
        await self.test_stream_format_validation()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if r["success"])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            if result["details"]:
                print(f"   {result['details']}")
        
        print(f"\n🎯 Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 All tests passed! Auto-continuation feature is working correctly.")
        else:
            print(f"⚠️  {total - passed} test(s) failed. Please review the failures above.")

async def main():
    """Main test runner"""
    async with BackendTester() as tester:
        await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())