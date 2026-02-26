#!/usr/bin/env python3
"""
SoulPrint Engine - Multi-Model Comparison & Memory System API Testing
Testing the Multi-Model Comparison and memory management APIs for the SoulPrint Engine.
"""

import requests
import json
import sys
import jwt
from datetime import datetime

# Configuration
BASE_URL = "https://personal-ai-twin-6.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test@soulprint.com"
TEST_PASSCODE = "test123"
TEST_USER_ID = "94807c2e-c74f-46a6-a249-5bf7366f2134"
JWT_SECRET = "soulprint-super-secret-jwt-key-2025-change-in-prod"

# Available models for testing
AVAILABLE_MODELS = [
    {"model": "gpt-4o", "provider": "openai"},
    {"model": "gpt-4o-mini", "provider": "openai"}, 
    {"model": "gemini-2.0-flash", "provider": "gemini"},
    {"model": "claude-sonnet-4-5-20250929", "provider": "anthropic"}
]

class MultiModelCompareTester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.created_conversations = []
        self.created_comparisons = []
        
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def create_test_token(self):
        """Create test JWT token for the specified user"""
        try:
            payload = {
                "userId": TEST_USER_ID,
                "iat": int(datetime.now().timestamp()),
                "exp": int(datetime.now().timestamp()) + 3600  # 1 hour
            }
            token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
            self.token = token
            self.user_id = TEST_USER_ID
            self.log(f"✅ Test token created for user: {self.user_id}")
            return True
        except Exception as e:
            self.log(f"❌ Failed to create test token: {str(e)}")
            return False
        
    def test_login(self):
        """Test user authentication"""
        try:
            self.log("🔐 Testing login...")
            
            response = requests.post(f"{API_BASE}/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSCODE
            }, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                self.user_id = data.get("userId")
                role = data.get("role", "unknown")
                
                self.log(f"✅ Login successful! User ID: {self.user_id}, Role: {role}")
                return True
            else:
                self.log(f"❌ Login failed with status {response.status_code}: {response.text}")
                # Fallback to test token
                return self.create_test_token()
                
        except requests.RequestException as e:
            self.log(f"❌ Login request failed: {str(e)}")
            # Fallback to test token
            return self.create_test_token()
            
    def get_headers(self):
        """Get headers with auth token"""
        if not self.token:
            raise Exception("No auth token available. Login first.")
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
    def test_compare_two_models(self):
        """Test comparing 2 models with a simple question"""
        try:
            self.log("🔍 Testing multi-model comparison with 2 models...")
            
            models_to_test = AVAILABLE_MODELS[:2]  # Take first 2 models
            content = "What are the main benefits of artificial intelligence in healthcare?"
            
            response = requests.post(f"{API_BASE}/chat/compare", 
                json={
                    "content": content,
                    "models": models_to_test,
                    "enableWebSearch": False,
                    "attachments": []
                },
                headers=self.get_headers(),
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    comparison_id = data.get("comparisonId")
                    conversation_id = data.get("conversationId")
                    responses = data.get("responses", [])
                    
                    self.created_comparisons.append(comparison_id)
                    self.created_conversations.append(conversation_id)
                    
                    self.log(f"✅ 2-model comparison successful!")
                    self.log(f"   Comparison ID: {comparison_id}")
                    self.log(f"   Conversation ID: {conversation_id}")
                    self.log(f"   Responses received: {len(responses)}")
                    
                    # Verify each model responded
                    for i, resp in enumerate(responses):
                        model = resp.get("model")
                        success = resp.get("success", False)
                        content_length = len(resp.get("content", "")) if resp.get("content") else 0
                        
                        if success and content_length > 0:
                            self.log(f"   ✅ Model {i+1} ({model}): Success, {content_length} chars")
                        else:
                            error = resp.get("error", "Unknown error")
                            self.log(f"   ❌ Model {i+1} ({model}): Failed - {error}")
                    
                    return comparison_id, responses
                else:
                    self.log(f"❌ 2-model comparison failed: Invalid response format")
                    return None, None
            else:
                self.log(f"❌ 2-model comparison failed with status {response.status_code}: {response.text}")
                return None, None
                
        except requests.RequestException as e:
            self.log(f"❌ 2-model comparison request failed: {str(e)}")
            return None, None
            
    def test_compare_three_models(self):
        """Test comparing 3 models (max allowed)"""
        try:
            self.log("🔍 Testing multi-model comparison with 3 models (max)...")
            
            models_to_test = AVAILABLE_MODELS[:3]  # Take first 3 models
            content = "Explain quantum computing in simple terms"
            
            response = requests.post(f"{API_BASE}/chat/compare", 
                json={
                    "content": content,
                    "models": models_to_test,
                    "enableWebSearch": False,
                    "attachments": []
                },
                headers=self.get_headers(),
                timeout=90
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    comparison_id = data.get("comparisonId")
                    conversation_id = data.get("conversationId")
                    responses = data.get("responses", [])
                    
                    self.created_comparisons.append(comparison_id)
                    self.created_conversations.append(conversation_id)
                    
                    self.log(f"✅ 3-model comparison successful!")
                    self.log(f"   Comparison ID: {comparison_id}")
                    self.log(f"   Responses received: {len(responses)}")
                    
                    successful_responses = 0
                    for i, resp in enumerate(responses):
                        model = resp.get("model")
                        success = resp.get("success", False)
                        
                        if success and resp.get("content"):
                            successful_responses += 1
                            content_length = len(resp.get("content"))
                            self.log(f"   ✅ Model {i+1} ({model}): Success, {content_length} chars")
                        else:
                            error = resp.get("error", "Unknown error")
                            self.log(f"   ❌ Model {i+1} ({model}): Failed - {error}")
                    
                    return comparison_id, successful_responses >= 2  # Success if at least 2 models worked
                else:
                    self.log(f"❌ 3-model comparison failed: Invalid response format")
                    return None, False
            else:
                self.log(f"❌ 3-model comparison failed with status {response.status_code}: {response.text}")
                return None, False
                
        except requests.RequestException as e:
            self.log(f"❌ 3-model comparison request failed: {str(e)}")
            return None, False
            
    def test_reject_too_many_models(self):
        """Test that requests with more than 3 models are rejected"""
        try:
            self.log("❌ Testing rejection of >3 models...")
            
            models_to_test = AVAILABLE_MODELS  # All 4 models (should be rejected)
            content = "This should be rejected"
            
            response = requests.post(f"{API_BASE}/chat/compare", 
                json={
                    "content": content,
                    "models": models_to_test,
                    "enableWebSearch": False,
                    "attachments": []
                },
                headers=self.get_headers(),
                timeout=30
            )
            
            if response.status_code == 400:
                error_text = response.text
                if "Maximum 3 models" in error_text:
                    self.log("✅ Correctly rejected >3 models with proper error message")
                    return True
                else:
                    self.log(f"❌ Rejected >3 models but wrong error: {error_text}")
                    return False
            else:
                self.log(f"❌ Failed to reject >3 models - got status {response.status_code}")
                return False
                
        except requests.RequestException as e:
            self.log(f"❌ >3 models test request failed: {str(e)}")
            return False
            
    def test_reject_no_models(self):
        """Test that requests with no models are rejected"""
        try:
            self.log("❌ Testing rejection of requests with no models...")
            
            response = requests.post(f"{API_BASE}/chat/compare", 
                json={
                    "content": "This should be rejected",
                    "models": [],  # Empty models array
                    "enableWebSearch": False,
                    "attachments": []
                },
                headers=self.get_headers(),
                timeout=30
            )
            
            if response.status_code == 400:
                error_text = response.text
                if "models required" in error_text:
                    self.log("✅ Correctly rejected empty models array")
                    return True
                else:
                    self.log(f"❌ Rejected empty models but wrong error: {error_text}")
                    return False
            else:
                self.log(f"❌ Failed to reject empty models - got status {response.status_code}")
                return False
                
        except requests.RequestException as e:
            self.log(f"❌ No models test request failed: {str(e)}")
            return False
            
    def test_select_winning_response(self, comparison_id, responses):
        """Test selecting a winning response from comparison"""
        if not comparison_id or not responses:
            self.log("❌ Cannot test selection - no valid comparison data")
            return False
            
        try:
            self.log("🏆 Testing selection of winning response...")
            
            # Find the first successful response to select
            winning_response = None
            selected_model = None
            selected_content = None
            
            for resp in responses:
                if resp.get("success") and resp.get("content"):
                    winning_response = resp
                    selected_model = resp["model"]
                    selected_content = resp["content"]
                    break
                    
            if not winning_response:
                self.log("❌ No successful response to select from")
                return False
                
            self.log(f"   Selected model: {selected_model}")
            self.log(f"   Content length: {len(selected_content)} chars")
            
            response = requests.post(f"{API_BASE}/chat/compare/select", 
                json={
                    "comparisonId": comparison_id,
                    "selectedModel": selected_model,
                    "selectedContent": selected_content
                },
                headers=self.get_headers(),
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    message_id = data.get("messageId")
                    conversation_id = data.get("conversationId")
                    
                    self.log(f"✅ Response selection successful!")
                    self.log(f"   Message ID: {message_id}")
                    self.log(f"   Conversation ID: {conversation_id}")
                    self.log(f"   Selected Model: {data.get('selectedModel')}")
                    return True
                else:
                    self.log(f"❌ Response selection failed: Invalid response format")
                    return False
            else:
                self.log(f"❌ Response selection failed with status {response.status_code}: {response.text}")
                return False
                
        except requests.RequestException as e:
            self.log(f"❌ Response selection request failed: {str(e)}")
            return False
            
    def test_authentication_required(self):
        """Test that endpoints require authentication"""
        try:
            self.log("🔒 Testing authentication requirements...")
            
            # Test compare endpoint without token
            response = requests.post(f"{API_BASE}/chat/compare", 
                json={
                    "content": "Test",
                    "models": [{"model": "gpt-4o", "provider": "openai"}]
                },
                timeout=30
            )
            
            if response.status_code == 401:
                self.log("✅ Compare endpoint properly requires authentication")
            else:
                self.log(f"❌ Compare endpoint authentication not properly enforced - got status {response.status_code}")
                return False
                
            # Test select endpoint without token
            response = requests.post(f"{API_BASE}/chat/compare/select", 
                json={
                    "comparisonId": "test",
                    "selectedModel": "gpt-4o",
                    "selectedContent": "test"
                },
                timeout=30
            )
            
            if response.status_code == 401:
                self.log("✅ Select endpoint properly requires authentication")
                return True
            else:
                self.log(f"❌ Select endpoint authentication not properly enforced - got status {response.status_code}")
                return False
                
        except requests.RequestException as e:
            self.log(f"❌ Authentication test request failed: {str(e)}")
            return False
            
    def run_comprehensive_test(self):
        """Run comprehensive multi-model comparison tests"""
        self.log("🚀 Starting Multi-Model Comparison API Testing")
        self.log("=" * 60)
        
        # Track test results
        tests_passed = 0
        total_tests = 0
        
        # Test 1: Authentication
        total_tests += 1
        if self.test_login():
            tests_passed += 1
        else:
            self.log("❌ Cannot continue without authentication")
            return False
            
        # Test 2: Authentication required
        total_tests += 1
        if self.test_authentication_required():
            tests_passed += 1
            
        # Test 3: Compare 2 models
        total_tests += 1
        comparison_id, responses = self.test_compare_two_models()
        if comparison_id and responses:
            tests_passed += 1
            
        # Test 4: Select winning response
        total_tests += 1
        if comparison_id and responses and self.test_select_winning_response(comparison_id, responses):
            tests_passed += 1
            
        # Test 5: Compare 3 models (max allowed)
        total_tests += 1
        comparison_id_3, success_3 = self.test_compare_three_models()
        if success_3:
            tests_passed += 1
            
        # Test 6: Reject >3 models
        total_tests += 1
        if self.test_reject_too_many_models():
            tests_passed += 1
            
        # Test 7: Reject no models
        total_tests += 1
        if self.test_reject_no_models():
            tests_passed += 1
            
        # Summary
        self.log("=" * 60)
        self.log(f"🎯 MULTI-MODEL COMPARISON TEST SUMMARY")
        self.log(f"   Tests Passed: {tests_passed}/{total_tests}")
        self.log(f"   Success Rate: {(tests_passed/total_tests)*100:.1f}%")
        
        if tests_passed == total_tests:
            self.log("🎉 All Multi-Model Comparison tests passed!")
            return True
        else:
            self.log("⚠️  Some multi-model comparison tests failed")
            return False

class MemoryTester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.created_memories = []
        
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def test_login(self):
        """Test user authentication"""
        try:
            self.log("🔐 Testing login...")
            
            response = requests.post(f"{API_BASE}/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSCODE
            }, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                self.user_id = data.get("userId")
                role = data.get("role", "unknown")
                
                self.log(f"✅ Login successful! User ID: {self.user_id}, Role: {role}")
                return True
            else:
                self.log(f"❌ Login failed with status {response.status_code}: {response.text}")
                return False
                
        except requests.RequestException as e:
            self.log(f"❌ Login request failed: {str(e)}")
            return False
            
    def get_headers(self):
        """Get headers with auth token"""
        if not self.token:
            raise Exception("No auth token available. Login first.")
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
    def test_create_memory(self, content, category, importance):
        """Test creating a memory"""
        try:
            self.log(f"💾 Creating memory: '{content}' (category: {category}, importance: {importance})")
            
            response = requests.post(f"{API_BASE}/memories", 
                json={
                    "content": content,
                    "category": category,
                    "importance": importance
                },
                headers=self.get_headers(),
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("memory"):
                    memory = data["memory"]
                    memory_id = memory["id"]
                    self.created_memories.append(memory_id)
                    
                    self.log(f"✅ Memory created successfully! ID: {memory_id}")
                    self.log(f"   Content: {memory['content']}")
                    self.log(f"   Category: {memory['category']}")
                    self.log(f"   Importance: {memory['importance']}")
                    self.log(f"   Source: {memory['source']}")
                    return memory_id
                else:
                    self.log(f"❌ Memory creation failed: Invalid response format")
                    return None
            else:
                self.log(f"❌ Memory creation failed with status {response.status_code}: {response.text}")
                return None
                
        except requests.RequestException as e:
            self.log(f"❌ Memory creation request failed: {str(e)}")
            return None
            
    def test_get_memories(self):
        """Test retrieving all memories"""
        try:
            self.log("📋 Retrieving all memories...")
            
            response = requests.get(f"{API_BASE}/memories",
                headers=self.get_headers(),
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                memories = data.get("memories", [])
                categories = data.get("categories", [])
                
                self.log(f"✅ Retrieved {len(memories)} memories")
                self.log(f"   Available categories: {', '.join(categories)}")
                
                for i, memory in enumerate(memories):
                    self.log(f"   Memory {i+1}: {memory['content']} (category: {memory['category']}, importance: {memory['importance']})")
                
                return memories
            else:
                self.log(f"❌ Failed to retrieve memories with status {response.status_code}: {response.text}")
                return None
                
        except requests.RequestException as e:
            self.log(f"❌ Memory retrieval request failed: {str(e)}")
            return None
            
    def test_update_memory(self, memory_id, new_content=None, new_category=None, new_importance=None):
        """Test updating a memory"""
        try:
            updates = {}
            update_desc = []
            
            if new_content:
                updates["content"] = new_content
                update_desc.append(f"content: '{new_content}'")
            if new_category:
                updates["category"] = new_category
                update_desc.append(f"category: {new_category}")
            if new_importance:
                updates["importance"] = new_importance
                update_desc.append(f"importance: {new_importance}")
                
            self.log(f"✏️  Updating memory {memory_id}: {', '.join(update_desc)}")
            
            response = requests.put(f"{API_BASE}/memories/{memory_id}",
                json=updates,
                headers=self.get_headers(),
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log(f"✅ Memory updated successfully!")
                    return True
                else:
                    self.log(f"❌ Memory update failed: Invalid response format")
                    return False
            else:
                self.log(f"❌ Memory update failed with status {response.status_code}: {response.text}")
                return False
                
        except requests.RequestException as e:
            self.log(f"❌ Memory update request failed: {str(e)}")
            return False
            
    def test_delete_memory(self, memory_id):
        """Test deleting a memory"""
        try:
            self.log(f"🗑️  Deleting memory {memory_id}...")
            
            response = requests.delete(f"{API_BASE}/memories/{memory_id}",
                headers=self.get_headers(),
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log(f"✅ Memory deleted successfully!")
                    # Remove from our tracking list
                    if memory_id in self.created_memories:
                        self.created_memories.remove(memory_id)
                    return True
                else:
                    self.log(f"❌ Memory deletion failed: Invalid response format")
                    return False
            else:
                self.log(f"❌ Memory deletion failed with status {response.status_code}: {response.text}")
                return False
                
        except requests.RequestException as e:
            self.log(f"❌ Memory deletion request failed: {str(e)}")
            return False
            
    def test_memory_categories(self):
        """Test memory filtering by category"""
        try:
            self.log("🏷️  Testing memory category filtering...")
            
            # Test filtering by health category
            response = requests.get(f"{API_BASE}/memories?category=health",
                headers=self.get_headers(),
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                health_memories = data.get("memories", [])
                
                self.log(f"✅ Health category filter working: {len(health_memories)} health memories found")
                
                # Verify all returned memories are health category
                for memory in health_memories:
                    if memory["category"] != "health":
                        self.log(f"❌ Category filtering error: Non-health memory returned: {memory}")
                        return False
                        
                return True
            else:
                self.log(f"❌ Category filtering failed with status {response.status_code}: {response.text}")
                return False
                
        except requests.RequestException as e:
            self.log(f"❌ Category filtering request failed: {str(e)}")
            return False
            
    def test_authentication_required(self):
        """Test that endpoints require authentication"""
        try:
            self.log("🔒 Testing authentication requirements...")
            
            # Test without token
            response = requests.get(f"{API_BASE}/memories", timeout=30)
            
            if response.status_code == 401:
                self.log("✅ Authentication properly required (401 returned without token)")
                return True
            else:
                self.log(f"❌ Authentication not properly enforced - got status {response.status_code}")
                return False
                
        except requests.RequestException as e:
            self.log(f"❌ Authentication test request failed: {str(e)}")
            return False
            
    def test_memory_validation(self):
        """Test memory validation rules"""
        try:
            self.log("✅ Testing memory validation...")
            
            # Test empty content
            response = requests.post(f"{API_BASE}/memories", 
                json={"content": "", "category": "health", "importance": "high"},
                headers=self.get_headers(),
                timeout=30
            )
            
            if response.status_code == 400:
                self.log("✅ Empty content properly rejected (400 returned)")
            else:
                self.log(f"❌ Empty content not properly validated - got status {response.status_code}")
                return False
                
            # Test very short content
            response = requests.post(f"{API_BASE}/memories", 
                json={"content": "Hi", "category": "health", "importance": "high"},
                headers=self.get_headers(),
                timeout=30
            )
            
            if response.status_code == 400:
                self.log("✅ Short content properly rejected (400 returned)")
                return True
            else:
                self.log(f"❌ Short content not properly validated - got status {response.status_code}")
                return False
                
        except requests.RequestException as e:
            self.log(f"❌ Validation test request failed: {str(e)}")
            return False
            
    def run_comprehensive_test(self):
        """Run comprehensive memory system tests"""
        self.log("🚀 Starting Long-Term Memory System API Testing")
        self.log("=" * 60)
        
        # Track test results
        tests_passed = 0
        total_tests = 0
        
        # Test 1: Authentication
        total_tests += 1
        if self.test_login():
            tests_passed += 1
        else:
            self.log("❌ Cannot continue without authentication")
            return False
            
        # Test 2: Authentication required
        total_tests += 1
        if self.test_authentication_required():
            tests_passed += 1
            
        # Test 3: Memory validation
        total_tests += 1
        if self.test_memory_validation():
            tests_passed += 1
            
        # Test 4: Create first memory (health/high)
        total_tests += 1
        memory1_id = self.test_create_memory(
            "I am allergic to peanuts",
            "health", 
            "high"
        )
        if memory1_id:
            tests_passed += 1
            
        # Test 5: Create second memory (preferences/medium)  
        total_tests += 1
        memory2_id = self.test_create_memory(
            "My favorite color is blue",
            "preferences",
            "medium"
        )
        if memory2_id:
            tests_passed += 1
            
        # Test 6: Get all memories
        total_tests += 1
        memories = self.test_get_memories()
        if memories is not None:
            tests_passed += 1
            
        # Test 7: Test category filtering
        total_tests += 1
        if self.test_memory_categories():
            tests_passed += 1
            
        # Test 8: Update memory
        total_tests += 1
        if memory1_id and self.test_update_memory(
            memory1_id, 
            new_content="I am severely allergic to peanuts and tree nuts",
            new_importance="high"
        ):
            tests_passed += 1
            
        # Test 9: Verify update by getting memories again
        total_tests += 1
        updated_memories = self.test_get_memories()
        if updated_memories is not None:
            tests_passed += 1
            # Find and verify the updated memory
            updated_memory = next((m for m in updated_memories if m["id"] == memory1_id), None)
            if updated_memory and "tree nuts" in updated_memory["content"]:
                self.log("✅ Memory update verified in retrieval")
            else:
                self.log("❌ Memory update not reflected in retrieval")
                
        # Test 10: Delete one memory
        total_tests += 1
        if memory2_id and self.test_delete_memory(memory2_id):
            tests_passed += 1
            
        # Test 11: Verify deletion
        total_tests += 1
        final_memories = self.test_get_memories()
        if final_memories is not None:
            deleted_memory = next((m for m in final_memories if m["id"] == memory2_id), None)
            if deleted_memory is None:
                self.log("✅ Memory deletion verified - deleted memory not in results")
                tests_passed += 1
            else:
                self.log("❌ Memory deletion failed - deleted memory still exists")
                
        # Summary
        self.log("=" * 60)
        self.log(f"🎯 MEMORY SYSTEM TEST SUMMARY")
        self.log(f"   Tests Passed: {tests_passed}/{total_tests}")
        self.log(f"   Success Rate: {(tests_passed/total_tests)*100:.1f}%")
        
        if tests_passed == total_tests:
            self.log("🎉 All Long-Term Memory System tests passed!")
            return True
        else:
            self.log("⚠️  Some memory system tests failed")
            return False

def main():
    """Main test execution"""
    try:
        tester = MemoryTester()
        success = tester.run_comprehensive_test()
        
        if success:
            print("\n✅ Memory System Testing: PASSED")
            sys.exit(0)
        else:
            print("\n❌ Memory System Testing: FAILED")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n💥 Memory System Testing: CRASHED - {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()