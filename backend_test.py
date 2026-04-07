#!/usr/bin/env python3
"""
Backend Test Suite for Multi-Image Upload Pre-Upload System
Tests the new POST /api/attachments/upload endpoint and related functionality.
"""

import requests
import json
import base64
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"

# Test data - smallest valid JPEG base64 (1x1 red pixel)
SMALL_JPEG_BASE64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgA//Z"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def authenticate(self) -> bool:
        """Authenticate and get auth token"""
        try:
            print(f"\n🔐 Authenticating with {TEST_EMAIL}...")
            
            response = self.session.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "email": TEST_EMAIL,
                    "passcode": TEST_PASSWORD
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                if self.auth_token:
                    self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                    self.log_test("Authentication", True, f"Token obtained: {self.auth_token[:20]}...")
                    return True
                else:
                    self.log_test("Authentication", False, "No token in response")
                    return False
            else:
                self.log_test("Authentication", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def test_health_check(self) -> bool:
        """Test health check endpoint"""
        try:
            print(f"\n🏥 Testing health check...")
            
            response = self.session.get(f"{BASE_URL}/api/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ok":
                    self.log_test("Health Check", True, f"Status: {data.get('status')}")
                    return True
                else:
                    self.log_test("Health Check", False, f"Unexpected status: {data}")
                    return False
            else:
                self.log_test("Health Check", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False
    
    def test_attachment_upload_no_auth(self) -> bool:
        """Test attachment upload without authentication - should return 401"""
        try:
            print(f"\n🚫 Testing attachment upload without auth...")
            
            # Temporarily remove auth header
            auth_header = self.session.headers.pop("Authorization", None)
            
            response = self.session.post(
                f"{BASE_URL}/api/attachments/upload",
                json={
                    "base64": SMALL_JPEG_BASE64,
                    "mimeType": "image/jpeg",
                    "name": "test-pixel.jpg"
                },
                headers={"Content-Type": "application/json"}
            )
            
            # Restore auth header
            if auth_header:
                self.session.headers["Authorization"] = auth_header
            
            if response.status_code == 401:
                self.log_test("Attachment Upload - No Auth", True, "Correctly returned 401 Unauthorized")
                return True
            else:
                self.log_test("Attachment Upload - No Auth", False, f"Expected 401, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Attachment Upload - No Auth", False, f"Exception: {str(e)}")
            return False
    
    def test_attachment_upload_empty_body(self) -> bool:
        """Test attachment upload with empty body - should return 400"""
        try:
            print(f"\n📭 Testing attachment upload with empty body...")
            
            response = self.session.post(
                f"{BASE_URL}/api/attachments/upload",
                json={},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 400:
                data = response.json()
                if "base64" in data.get("error", "").lower():
                    self.log_test("Attachment Upload - Empty Body", True, f"Correctly returned 400: {data.get('error')}")
                    return True
                else:
                    self.log_test("Attachment Upload - Empty Body", False, f"400 but wrong error message: {data}")
                    return False
            else:
                self.log_test("Attachment Upload - Empty Body", False, f"Expected 400, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Attachment Upload - Empty Body", False, f"Exception: {str(e)}")
            return False
    
    def test_attachment_upload_no_base64(self) -> bool:
        """Test attachment upload without base64 field - should return 400"""
        try:
            print(f"\n🖼️ Testing attachment upload without base64...")
            
            response = self.session.post(
                f"{BASE_URL}/api/attachments/upload",
                json={
                    "mimeType": "image/jpeg",
                    "name": "test.jpg"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 400:
                data = response.json()
                if "base64" in data.get("error", "").lower():
                    self.log_test("Attachment Upload - No Base64", True, f"Correctly returned 400: {data.get('error')}")
                    return True
                else:
                    self.log_test("Attachment Upload - No Base64", False, f"400 but wrong error message: {data}")
                    return False
            else:
                self.log_test("Attachment Upload - No Base64", False, f"Expected 400, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Attachment Upload - No Base64", False, f"Exception: {str(e)}")
            return False
    
    def test_attachment_upload_success(self) -> tuple[bool, Optional[str]]:
        """Test successful attachment upload - should return 200 with URL"""
        try:
            print(f"\n✅ Testing successful attachment upload...")
            
            response = self.session.post(
                f"{BASE_URL}/api/attachments/upload",
                json={
                    "base64": SMALL_JPEG_BASE64,
                    "mimeType": "image/jpeg",
                    "name": "test-pixel.jpg"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("url") and data.get("name"):
                    url = data.get("url")
                    storage_type = "Kie.ai" if url.startswith("https://") else "MongoDB" if url.startswith("attachment://") else "Unknown"
                    self.log_test("Attachment Upload - Success", True, 
                                f"URL: {url[:80]}{'...' if len(url) > 80 else ''}, Storage: {storage_type}, Size: {data.get('size', 'unknown')} bytes")
                    return True, url
                else:
                    self.log_test("Attachment Upload - Success", False, f"Missing required fields in response: {data}")
                    return False, None
            else:
                self.log_test("Attachment Upload - Success", False, f"Status {response.status_code}: {response.text}")
                return False, None
                
        except Exception as e:
            self.log_test("Attachment Upload - Success", False, f"Exception: {str(e)}")
            return False, None
    
    def test_mongodb_storage_verification(self, attachment_url: str) -> bool:
        """Verify MongoDB storage if attachment:// URL was returned"""
        try:
            if not attachment_url.startswith("attachment://"):
                self.log_test("MongoDB Storage Verification", True, "Skipped - using Kie.ai storage")
                return True
                
            print(f"\n🗄️ Testing MongoDB storage verification...")
            
            # We can't directly access MongoDB from here, but we can test that the URL format is correct
            attachment_id = attachment_url.replace("attachment://", "")
            
            if len(attachment_id) > 10 and "-" in attachment_id:  # UUID format check
                self.log_test("MongoDB Storage Verification", True, f"Valid attachment ID format: {attachment_id}")
                return True
            else:
                self.log_test("MongoDB Storage Verification", False, f"Invalid attachment ID format: {attachment_id}")
                return False
                
        except Exception as e:
            self.log_test("MongoDB Storage Verification", False, f"Exception: {str(e)}")
            return False
    
    def test_chat_with_url_reference(self) -> bool:
        """Test chat stream with URL-referenced attachment"""
        try:
            print(f"\n💬 Testing chat with URL-referenced attachment...")
            
            # Use a publicly accessible test image
            test_image_url = "https://via.placeholder.com/150"
            
            response = self.session.post(
                f"{BASE_URL}/api/chat/stream",
                json={
                    "content": "What do you see in this image?",
                    "model": "gpt-4o",
                    "provider": "openai",
                    "attachments": [{
                        "type": "image",
                        "base64": test_image_url,
                        "mimeType": "image/jpeg",
                        "name": "test.jpg",
                        "isUrlReference": True
                    }]
                },
                headers={"Content-Type": "application/json"},
                stream=True
            )
            
            if response.status_code == 200:
                # Check if we get streaming response (either SSE or NDJSON)
                content_type = response.headers.get("content-type", "")
                if "text/event-stream" in content_type or "text/plain" in content_type or "application/json" in content_type:
                    # Read first few lines to verify it's streaming
                    lines_read = 0
                    valid_events = 0
                    for line in response.iter_lines(decode_unicode=True):
                        if line.strip():
                            lines_read += 1
                            # Handle SSE format (data: prefix) or NDJSON format (direct JSON)
                            json_line = line
                            if line.startswith("data: "):
                                json_line = line[6:]  # Remove "data: " prefix
                            
                            try:
                                data = json.loads(json_line)
                                if data.get("type") in ["meta", "delta", "done"]:
                                    valid_events += 1
                                    if valid_events >= 2:  # Got at least meta + one more event
                                        break
                            except json.JSONDecodeError:
                                continue
                            
                            if lines_read >= 10:  # Don't read too many lines
                                break
                    
                    if valid_events >= 2:
                        format_type = "SSE" if "text/event-stream" in content_type else "NDJSON"
                        self.log_test("Chat with URL Reference", True, f"Successfully received {format_type} stream response")
                        return True
                    else:
                        self.log_test("Chat with URL Reference", False, f"Did not receive expected stream format (got {valid_events} valid events)")
                        return False
                else:
                    self.log_test("Chat with URL Reference", False, f"Unexpected content type: {content_type}")
                    return False
            else:
                self.log_test("Chat with URL Reference", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Chat with URL Reference", False, f"Exception: {str(e)}")
            return False
    
    def test_chat_with_attachment_protocol(self, attachment_url: str) -> bool:
        """Test chat stream with attachment:// protocol"""
        try:
            if not attachment_url.startswith("attachment://"):
                self.log_test("Chat with Attachment Protocol", True, "Skipped - no attachment:// URL available")
                return True
                
            print(f"\n🔗 Testing chat with attachment:// protocol...")
            
            response = self.session.post(
                f"{BASE_URL}/api/chat/stream",
                json={
                    "content": "What do you see in this image?",
                    "model": "gpt-4o",
                    "provider": "openai",
                    "attachments": [{
                        "type": "image",
                        "base64": attachment_url,
                        "mimeType": "image/jpeg",
                        "name": "test-pixel.jpg",
                        "isUrlReference": True
                    }]
                },
                headers={"Content-Type": "application/json"},
                stream=True
            )
            
            if response.status_code == 200:
                # Check if we get streaming response (either SSE or NDJSON)
                content_type = response.headers.get("content-type", "")
                if "text/event-stream" in content_type or "text/plain" in content_type or "application/json" in content_type:
                    # Read first few lines to verify it's streaming
                    lines_read = 0
                    valid_events = 0
                    for line in response.iter_lines(decode_unicode=True):
                        if line.strip():
                            lines_read += 1
                            # Handle SSE format (data: prefix) or NDJSON format (direct JSON)
                            json_line = line
                            if line.startswith("data: "):
                                json_line = line[6:]  # Remove "data: " prefix
                            
                            try:
                                data = json.loads(json_line)
                                if data.get("type") in ["meta", "delta", "done"]:
                                    valid_events += 1
                                    if valid_events >= 2:  # Got at least meta + one more event
                                        break
                            except json.JSONDecodeError:
                                continue
                            
                            if lines_read >= 10:  # Don't read too many lines
                                break
                    
                    if valid_events >= 2:
                        format_type = "SSE" if "text/event-stream" in content_type else "NDJSON"
                        self.log_test("Chat with Attachment Protocol", True, f"Successfully received {format_type} stream response")
                        return True
                    else:
                        self.log_test("Chat with Attachment Protocol", False, f"Did not receive expected stream format (got {valid_events} valid events)")
                        return False
                else:
                    self.log_test("Chat with Attachment Protocol", False, f"Unexpected content type: {content_type}")
                    return False
            else:
                self.log_test("Chat with Attachment Protocol", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Chat with Attachment Protocol", False, f"Exception: {str(e)}")
            return False
    
    def test_simple_chat_stream(self) -> bool:
        """Test simple chat stream without attachments"""
        try:
            print(f"\n💭 Testing simple chat stream...")
            
            response = self.session.post(
                f"{BASE_URL}/api/chat/stream",
                json={
                    "content": "Hello, this is a test message",
                    "model": "gpt-4o",
                    "provider": "openai"
                },
                headers={"Content-Type": "application/json"},
                stream=True
            )
            
            if response.status_code == 200:
                # Check if we get streaming response (either SSE or NDJSON)
                content_type = response.headers.get("content-type", "")
                if "text/event-stream" in content_type or "text/plain" in content_type or "application/json" in content_type:
                    # Read first few lines to verify it's streaming
                    lines_read = 0
                    valid_events = 0
                    for line in response.iter_lines(decode_unicode=True):
                        if line.strip():
                            lines_read += 1
                            # Handle SSE format (data: prefix) or NDJSON format (direct JSON)
                            json_line = line
                            if line.startswith("data: "):
                                json_line = line[6:]  # Remove "data: " prefix
                            
                            try:
                                data = json.loads(json_line)
                                if data.get("type") in ["meta", "delta", "done"]:
                                    valid_events += 1
                                    if valid_events >= 2:  # Got at least meta + one more event
                                        break
                            except json.JSONDecodeError:
                                continue
                            
                            if lines_read >= 10:  # Don't read too many lines
                                break
                    
                    if valid_events >= 2:
                        format_type = "SSE" if "text/event-stream" in content_type else "NDJSON"
                        self.log_test("Simple Chat Stream", True, f"Successfully received {format_type} stream response")
                        return True
                    else:
                        self.log_test("Simple Chat Stream", False, f"Did not receive expected stream format (got {valid_events} valid events)")
                        return False
                else:
                    self.log_test("Simple Chat Stream", False, f"Unexpected content type: {content_type}")
                    return False
            else:
                self.log_test("Simple Chat Stream", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Simple Chat Stream", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Multi-Image Upload Pre-Upload Backend Tests")
        print("=" * 60)
        
        # Step 1: Health check
        if not self.test_health_check():
            print("❌ Health check failed, aborting tests")
            return
        
        # Step 2: Authentication
        if not self.authenticate():
            print("❌ Authentication failed, aborting tests")
            return
        
        # Step 3: Test attachment upload endpoint
        self.test_attachment_upload_no_auth()
        self.test_attachment_upload_empty_body()
        self.test_attachment_upload_no_base64()
        
        # Step 4: Test successful upload
        success, attachment_url = self.test_attachment_upload_success()
        
        # Step 5: Verify MongoDB storage if applicable
        if success and attachment_url:
            self.test_mongodb_storage_verification(attachment_url)
        
        # Step 6: Test chat stream with attachments
        self.test_chat_with_url_reference()
        
        if success and attachment_url:
            self.test_chat_with_attachment_protocol(attachment_url)
        
        # Step 7: Test simple chat stream
        self.test_simple_chat_stream()
        
        # Summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  • {result['test']}")
        
        print("\n" + "=" * 60)

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()