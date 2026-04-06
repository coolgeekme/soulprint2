#!/usr/bin/env python3
"""
ChatGPT Import Memory Extraction End-to-End Test
Tests the complete flow with a real ZIP file as requested in the review.
"""

import requests
import json
import sys
import time
import zipfile
import os
import tempfile

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
AUTH_EMAIL = "testchat@example.com"
AUTH_PASSWORD = "Test123456"

class ChatGPTImportTester:
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
            print(f"\n🔐 Step 1: Authenticating with {AUTH_EMAIL}...")
            
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
        """Create a test ChatGPT ZIP file with conversations.json"""
        try:
            print(f"\n📦 Step 2: Creating test ChatGPT ZIP file...")
            
            # Create test conversations data with personal facts
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
                self.log_result("Create Test ZIP", True, f"Created test ZIP file at {zip_path} ({file_size} bytes)")
                return zip_path
            else:
                self.log_result("Create Test ZIP", False, "Failed to create ZIP file")
                return None
                
        except Exception as e:
            self.log_result("Create Test ZIP", False, f"Exception: {str(e)}")
            return None
    
    def test_chunked_upload_init(self, filename, file_size):
        """Test POST /api/import/chunked/init"""
        try:
            print(f"\n📤 Step 3a: Testing chunked upload init...")
            
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
            
            if response.status_code == 200:
                data = response.json()
                upload_id = data.get("uploadId")
                if upload_id:
                    self.log_result("Chunked Upload Init", True, f"Created upload session: {upload_id}")
                    return upload_id
                else:
                    self.log_result("Chunked Upload Init", False, "No uploadId in response")
                    return None
            else:
                self.log_result("Chunked Upload Init", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Chunked Upload Init", False, f"Exception: {str(e)}")
            return None
    
    def test_chunked_upload_chunk(self, upload_id, zip_path):
        """Test POST /api/import/chunked/chunk"""
        try:
            print(f"\n📤 Step 3b: Testing chunked upload chunk...")
            
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
            
            if response.status_code == 200:
                data = response.json()
                received = data.get("received")
                if received is not None:
                    self.log_result("Chunked Upload Chunk", True, f"Uploaded chunk {received}")
                    return True
                else:
                    self.log_result("Chunked Upload Chunk", False, "No received index in response")
                    return False
            else:
                self.log_result("Chunked Upload Chunk", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Chunked Upload Chunk", False, f"Exception: {str(e)}")
            return False
    
    def test_chunked_upload_complete(self, upload_id):
        """Test POST /api/import/chunked/complete"""
        try:
            print(f"\n📤 Step 3c: Testing chunked upload complete...")
            
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
                
                self.log_result("Chunked Upload Complete", True, 
                    f"Processing complete - Conversations: {conversation_count}, Messages: {message_count}, Memories: {memories_added}")
                
                # Verify non-zero counts (key requirement from review)
                if conversation_count > 0 and message_count > 0:
                    self.log_result("ZIP Extraction Verification", True, 
                        f"ZIP extraction working - found {conversation_count} conversations and {message_count} messages")
                else:
                    self.log_result("ZIP Extraction Verification", False, 
                        f"ZIP extraction may have failed - got {conversation_count} conversations and {message_count} messages")
                
                return data
            else:
                self.log_result("Chunked Upload Complete", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Chunked Upload Complete", False, f"Exception: {str(e)}")
            return None
    
    def test_verify_memories(self):
        """Test GET /api/memories to verify new memories were added"""
        try:
            print(f"\n🧠 Step 4a: Verifying memories were added...")
            
            response = self.session.get(f"{self.base_url}/api/memories")
            
            if response.status_code == 200:
                data = response.json()
                memories = data.get("memories", [])
                
                # Look for memories with source "chatgpt_import"
                chatgpt_memories = [m for m in memories if m.get("source") == "chatgpt_import"]
                
                if len(chatgpt_memories) > 0:
                    self.log_result("Memory Verification", True, 
                        f"Found {len(chatgpt_memories)} memories from ChatGPT import")
                    
                    # Show some example memories
                    for i, memory in enumerate(chatgpt_memories[:3]):
                        content = memory.get("content", "")[:100]
                        category = memory.get("category", "unknown")
                        print(f"   Memory {i+1}: [{category}] {content}...")
                    
                else:
                    self.log_result("Memory Verification", False, 
                        f"No memories found with source 'chatgpt_import' (total memories: {len(memories)})")
                
                return data
            else:
                self.log_result("Memory Verification", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Memory Verification", False, f"Exception: {str(e)}")
            return None
    
    def test_verify_import_history(self):
        """Test GET /api/import/data to verify import history"""
        try:
            print(f"\n📋 Step 4b: Verifying import history...")
            
            response = self.session.get(f"{self.base_url}/api/import/data")
            
            if response.status_code == 200:
                data = response.json()
                imports = data.get("imports", [])
                
                if len(imports) > 0:
                    # Look for recent ChatGPT import
                    recent_import = None
                    for imp in imports:
                        if imp.get("type") == "chatgpt" and imp.get("messageCount", 0) > 0:
                            recent_import = imp
                            break
                    
                    if recent_import:
                        message_count = recent_import.get("messageCount", 0)
                        conversation_count = recent_import.get("conversationCount", 0)
                        self.log_result("Import History Verification", True, 
                            f"Found import record with {message_count} messages and {conversation_count} conversations")
                    else:
                        self.log_result("Import History Verification", False, 
                            f"No recent ChatGPT import found with non-zero messageCount (total imports: {len(imports)})")
                else:
                    self.log_result("Import History Verification", False, "No import records found")
                
                return data
            else:
                self.log_result("Import History Verification", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Import History Verification", False, f"Exception: {str(e)}")
            return None
    
    def run_end_to_end_test(self):
        """Run the complete end-to-end test as specified in the review"""
        print("🚀 Starting ChatGPT Import Memory Extraction End-to-End Test")
        print("=" * 80)
        print("Testing the complete flow with real ZIP file as requested in review:")
        print("1. Login with test credentials")
        print("2. Create test ChatGPT ZIP with conversations.json")
        print("3. Test chunked upload flow (init → chunk → complete)")
        print("4. Verify results (memories added, import history)")
        print("=" * 80)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Create test ZIP file
        zip_path = self.create_test_chatgpt_zip()
        if not zip_path:
            print("❌ Failed to create test ZIP file. Cannot proceed.")
            return False
        
        file_size = os.path.getsize(zip_path)
        filename = "test_chatgpt_export.zip"
        
        # Step 3: Test chunked upload flow
        upload_id = self.test_chunked_upload_init(filename, file_size)
        if not upload_id:
            print("❌ Failed to initialize upload. Cannot proceed.")
            return False
        
        if not self.test_chunked_upload_chunk(upload_id, zip_path):
            print("❌ Failed to upload chunk. Cannot proceed.")
            return False
        
        complete_result = self.test_chunked_upload_complete(upload_id)
        if not complete_result:
            print("❌ Failed to complete upload. Cannot proceed.")
            return False
        
        # Step 4: Verify results
        print(f"\n🔍 Step 4: Verifying results...")
        
        # Wait a moment for processing to complete
        time.sleep(2)
        
        self.test_verify_memories()
        self.test_verify_import_history()
        
        # Cleanup
        try:
            os.remove(zip_path)
            print(f"🧹 Cleaned up test file: {zip_path}")
        except:
            pass
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 END-TO-END TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Key findings summary
        print("\n🔑 KEY FINDINGS:")
        print("1. ZIP Extraction (yauzl vs unzip):", "✅ Working" if any("ZIP Extraction Verification" in r["test"] and r["success"] for r in self.test_results) else "❌ Failed")
        print("2. Memory Extraction Integration:", "✅ Working" if any("Memory Verification" in r["test"] and r["success"] for r in self.test_results) else "❌ Failed")
        print("3. Import Record Creation:", "✅ Working" if any("Import History Verification" in r["test"] and r["success"] for r in self.test_results) else "❌ Failed")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = ChatGPTImportTester()
    success = tester.run_end_to_end_test()
    sys.exit(0 if success else 1)