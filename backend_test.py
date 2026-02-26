#!/usr/bin/env python3
"""
SoulPrint Engine - Multi-Model Comparison & Memory System API Testing
Testing the Multi-Model Comparison and memory management APIs for the SoulPrint Engine.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://personal-ai-twin-6.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test@soulprint.com"
TEST_PASSCODE = "test123"

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