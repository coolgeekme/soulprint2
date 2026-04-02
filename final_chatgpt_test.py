#!/usr/bin/env python3
"""
Final ChatGPT Import Memory Extraction Test
Comprehensive test of the complete flow with corrected field checking.
"""

import requests
import json
import sys
import time
import zipfile
import os

# Configuration
BASE_URL = "https://data-import-trace.preview.emergentagent.com"
AUTH_EMAIL = "testchat@example.com"
AUTH_PASSWORD = "Test123456"

class FinalChatGPTImportTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_result(self, test_name, success, message="", details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        })
    
    def authenticate(self):
        """Authenticate and get token"""
        try:
            print(f"\n🔐 Step 1: Login with test credentials...")
            
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={
                    "email": AUTH_EMAIL,
                    "passcode": AUTH_PASSWORD
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                if self.auth_token:
                    self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                    self.log_result("Authentication", True, f"Successfully authenticated as {AUTH_EMAIL}")
                    return True
                else:
                    self.log_result("Authentication", False, "No token in response")
                    return False
            else:
                self.log_result("Authentication", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def create_test_chatgpt_zip(self):
        """Create a test ChatGPT ZIP file with conversations.json containing personal facts"""
        try:
            print(f"\n📦 Step 2: Create test ChatGPT ZIP with conversations.json...")
            
            # Create test conversations data with personal facts for memory extraction
            conversations_data = [
                {
                    "title": "Career Discussion",
                    "mapping": {
                        "node1": {
                            "message": {
                                "author": {"role": "user"},
                                "content": {"parts": ["I'm a software engineer working at a tech startup in San Francisco. I love building web applications and working with Python and JavaScript."]},
                                "create_time": 1640995200
                            }
                        },
                        "node2": {
                            "message": {
                                "author": {"role": "assistant"},
                                "content": {"parts": ["That's great! Software engineering is a fascinating field. What kind of web applications do you enjoy building the most?"]},
                                "create_time": 1640995260
                            }
                        }
                    }
                },
                {
                    "title": "Hobbies and Interests",
                    "mapping": {
                        "node1": {
                            "message": {
                                "author": {"role": "user"},
                                "content": {"parts": ["I love hiking in the mountains on weekends. My favorite trail is in Yosemite National Park. I also enjoy photography and capturing nature scenes."]},
                                "create_time": 1641081600
                            }
                        },
                        "node2": {
                            "message": {
                                "author": {"role": "assistant"},
                                "content": {"parts": ["Yosemite is absolutely beautiful! The combination of hiking and photography sounds like a perfect way to spend weekends."]},
                                "create_time": 1641081660
                            }
                        }
                    }
                },
                {
                    "title": "Personal Life",
                    "mapping": {
                        "node1": {
                            "message": {
                                "author": {"role": "user"},
                                "content": {"parts": ["I live in a small apartment in the Mission District. I have a cat named Whiskers who loves to sit by the window. I'm originally from Portland but moved here for work."]},
                                "create_time": 1641168000
                            }
                        },
                        "node2": {
                            "message": {
                                "author": {"role": "assistant"},
                                "content": {"parts": ["The Mission District is such a vibrant neighborhood! Cats do love their window perches. How do you like San Francisco compared to Portland?"]},
                                "create_time": 1641168060
                            }
                        }
                    }
                }
            ]
            
            # Create temporary ZIP file
            zip_path = "/tmp/test_chatgpt_export.zip"
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add conversations.json to the ZIP
                conversations_json = json.dumps(conversations_data, indent=2)
                zipf.writestr("conversations.json", conversations_json)
            
            # Verify ZIP file was created
            if os.path.exists(zip_path):
                file_size = os.path.getsize(zip_path)
                self.log_result("Create Test ZIP", True, f"Created test ZIP file with 3 conversations containing personal facts ({file_size} bytes)")
                return zip_path
            else:
                self.log_result("Create Test ZIP", False, "Failed to create ZIP file")
                return None
                
        except Exception as e:
            self.log_result("Create Test ZIP", False, f"Exception: {str(e)}")
            return None
    
    def test_chunked_upload_flow(self, zip_path):
        """Test the complete chunked upload flow"""
        try:
            print(f"\n📤 Step 3: Test chunked upload flow...")
            
            file_size = os.path.getsize(zip_path)
            filename = "test_chatgpt_export.zip"
            
            # Step 3a: Initialize upload
            print(f"   3a: POST /api/import/chunked/init...")
            response = self.session.post(
                f"{self.base_url}/api/import/chunked/init",
                json={
                    "filename": filename,
                    "fileSize": file_size,
                    "totalChunks": 1,
                    "type": "chatgpt"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                self.log_result("Chunked Upload Flow", False, f"Init failed: HTTP {response.status_code}")
                return None
            
            upload_id = response.json().get("uploadId")
            if not upload_id:
                self.log_result("Chunked Upload Flow", False, "No uploadId in init response")
                return None
            
            # Step 3b: Upload chunk
            print(f"   3b: POST /api/import/chunked/chunk...")
            with open(zip_path, 'rb') as f:
                files = {
                    'chunk': ('test_chatgpt_export.zip', f, 'application/zip')
                }
                data = {
                    'uploadId': upload_id,
                    'chunkIndex': '0'
                }
                
                response = self.session.post(
                    f"{self.base_url}/api/import/chunked/chunk",
                    files=files,
                    data=data
                )
            
            if response.status_code != 200:
                self.log_result("Chunked Upload Flow", False, f"Chunk upload failed: HTTP {response.status_code}")
                return None
            
            # Step 3c: Complete upload
            print(f"   3c: POST /api/import/chunked/complete...")
            response = self.session.post(
                f"{self.base_url}/api/import/chunked/complete",
                json={"uploadId": upload_id},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                conversation_count = data.get("conversationCount", 0)
                message_count = data.get("messageCount", 0)
                memories_added = data.get("memoriesAdded", 0)
                
                self.log_result("Chunked Upload Flow", True, 
                    f"Complete flow successful - Conversations: {conversation_count}, Messages: {message_count}, Memories: {memories_added}")
                
                # Verify non-zero counts (key requirement from review)
                if conversation_count > 0 and message_count > 0:
                    self.log_result("ZIP Extraction (yauzl vs unzip)", True, 
                        f"ZIP extraction working correctly - found {conversation_count} conversations and {message_count} messages")
                else:
                    self.log_result("ZIP Extraction (yauzl vs unzip)", False, 
                        f"ZIP extraction failed - got {conversation_count} conversations and {message_count} messages")
                
                return data
            else:
                self.log_result("Chunked Upload Flow", False, f"Complete failed: HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Chunked Upload Flow", False, f"Exception: {str(e)}")
            return None
    
    def test_verify_memories(self):
        """Test GET /api/memories to verify new memories were added with source 'chatgpt_import'"""
        try:
            print(f"\n🧠 Step 4a: Verify memories were added...")
            
            response = self.session.get(f"{self.base_url}/api/memories")
            
            if response.status_code == 200:
                data = response.json()
                memories = data.get("memories", [])
                
                # Look for memories with source "chatgpt_import"
                chatgpt_memories = [m for m in memories if m.get("source") == "chatgpt_import"]
                
                if len(chatgpt_memories) > 0:
                    self.log_result("Memory Extraction Integration", True, 
                        f"Found {len(chatgpt_memories)} memories from ChatGPT import with source 'chatgpt_import'")
                    
                    # Show some example memories
                    print(f"   Example memories extracted:")
                    for i, memory in enumerate(chatgpt_memories[:3]):
                        content = memory.get("content", "")[:80]
                        category = memory.get("category", "unknown")
                        print(f"     {i+1}. [{category}] {content}...")
                    
                else:
                    self.log_result("Memory Extraction Integration", False, 
                        f"No memories found with source 'chatgpt_import' (total memories: {len(memories)})")
                
                return len(chatgpt_memories)
            else:
                self.log_result("Memory Extraction Integration", False, f"HTTP {response.status_code}: {response.text}")
                return 0
                
        except Exception as e:
            self.log_result("Memory Extraction Integration", False, f"Exception: {str(e)}")
            return 0
    
    def test_verify_import_history(self):
        """Test GET /api/import/data to verify import history with proper stats"""
        try:
            print(f"\n📋 Step 4b: Verify import history...")
            
            response = self.session.get(f"{self.base_url}/api/import/data")
            
            if response.status_code == 200:
                data = response.json()
                imports = data.get("imports", [])
                
                if len(imports) > 0:
                    # Look for recent ChatGPT import with proper stats
                    recent_import = None
                    for imp in imports:
                        stats = imp.get("stats", {})
                        if (imp.get("source") == "chatgpt" and 
                            stats.get("messageCount", 0) > 0 and 
                            stats.get("conversationCount", 0) > 0):
                            recent_import = imp
                            break
                    
                    if recent_import:
                        stats = recent_import.get("stats", {})
                        message_count = stats.get("messageCount", 0)
                        conversation_count = stats.get("conversationCount", 0)
                        memories_added = stats.get("memoriesAdded", 0)
                        self.log_result("Import Record Creation", True, 
                            f"Found import record with {message_count} messages, {conversation_count} conversations, {memories_added} memories")
                    else:
                        self.log_result("Import Record Creation", False, 
                            f"No recent ChatGPT import found with non-zero stats (total imports: {len(imports)})")
                else:
                    self.log_result("Import Record Creation", False, "No import records found")
                
                return data
            else:
                self.log_result("Import Record Creation", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Import Record Creation", False, f"Exception: {str(e)}")
            return None
    
    def run_comprehensive_test(self):
        """Run the comprehensive end-to-end test as specified in the review"""
        print("🚀 ChatGPT Import Memory Extraction - COMPREHENSIVE END-TO-END TEST")
        print("=" * 90)
        print("TESTING CRITICAL CONTEXT FROM REVIEW:")
        print("• Main fix: yauzl (Node.js library) replacing unzip (system command)")
        print("• Added extractMemoriesFromImport call to create user memories")
        print("• Testing real end-to-end flow with test ZIP file")
        print("• Verifying: ZIP extraction, memory creation, import history")
        print("=" * 90)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Create test ZIP file
        zip_path = self.create_test_chatgpt_zip()
        if not zip_path:
            print("❌ Failed to create test ZIP file. Cannot proceed.")
            return False
        
        # Step 3: Test chunked upload flow
        upload_result = self.test_chunked_upload_flow(zip_path)
        if not upload_result:
            print("❌ Chunked upload flow failed. Cannot proceed.")
            return False
        
        # Step 4: Verify results
        print(f"\n🔍 Step 4: Verify results...")
        
        # Wait a moment for processing to complete
        time.sleep(2)
        
        memories_count = self.test_verify_memories()
        self.test_verify_import_history()
        
        # Cleanup
        try:
            os.remove(zip_path)
            print(f"🧹 Cleaned up test file: {zip_path}")
        except:
            pass
        
        # Summary
        print("\n" + "=" * 90)
        print("📊 COMPREHENSIVE TEST SUMMARY")
        print("=" * 90)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Key findings summary based on review requirements
        print("\n🔑 KEY FINDINGS (Review Requirements):")
        zip_working = any("ZIP Extraction" in r["test"] and r["success"] for r in self.test_results)
        memory_working = any("Memory Extraction Integration" in r["test"] and r["success"] for r in self.test_results)
        import_working = any("Import Record Creation" in r["test"] and r["success"] for r in self.test_results)
        
        print(f"1. ZIP Extraction (yauzl vs unzip): {'✅ Working' if zip_working else '❌ Failed'}")
        print(f"2. Memory Extraction Integration: {'✅ Working' if memory_working else '❌ Failed'}")
        print(f"3. Import Record Creation: {'✅ Working' if import_working else '❌ Failed'}")
        
        if memories_count > 0:
            print(f"4. Memories Added: ✅ {memories_count} memories successfully extracted")
        else:
            print(f"4. Memories Added: ❌ No memories extracted")
        
        # OpenAI API status
        if memories_count > 0:
            print(f"5. OpenAI API Integration: ✅ Working (memories extracted successfully)")
        else:
            print(f"5. OpenAI API Integration: ⚠️  May not be configured (expected graceful failure)")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        print("\n🎯 CONCLUSION:")
        if zip_working and memory_working and import_working:
            print("✅ All critical functionality working correctly!")
            print("✅ yauzl ZIP extraction successful")
            print("✅ extractMemoriesFromImport integration working")
            print("✅ End-to-end flow complete")
        else:
            print("❌ Some critical functionality failed")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = FinalChatGPTImportTester()
    success = tester.run_comprehensive_test()
    sys.exit(0 if success else 1)