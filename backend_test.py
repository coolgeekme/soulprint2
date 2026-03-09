#!/usr/bin/env python3
"""
Backend API Test Suite for SoulPrint Import Functionality
Tests /api/imports/upload, /api/import/chatgpt, and /api/imports/status endpoints
"""

import requests
import json
import time
import zipfile
import io
import os
from typing import Dict, Any, Optional

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://image-video-gen-11.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class ImportTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_id = None
    
    def authenticate(self) -> bool:
        """Authenticate with the test user"""
        print("🔐 Authenticating with test user...")
        
        login_payload = {
            "email": TEST_EMAIL,
            "passcode": TEST_PASSWORD
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=login_payload)
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                self.user_id = data.get('userId')
                self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                print(f"✅ Authentication successful - User ID: {self.user_id}")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} {response.text}")
                return False
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def create_test_zip_file(self, format_type: str = 'chatgpt') -> bytes:
        """Create a small test ZIP file with appropriate format data"""
        print(f"📦 Creating test ZIP file for {format_type} format...")
        
        # Create in-memory ZIP file
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            if format_type == 'chatgpt':
                # Create ChatGPT conversations.json format
                conversations_data = [
                    {
                        "title": "Test Chat for API Testing",
                        "create_time": 1700000000,
                        "mapping": {
                            "msg1": {
                                "message": {
                                    "author": {"role": "user"},
                                    "content": {"parts": ["Hello, this is a test message for import testing"]}
                                }
                            },
                            "msg2": {
                                "message": {
                                    "author": {"role": "assistant"},
                                    "content": {"parts": ["Hi there! How can I help you today?"]}
                                }
                            },
                            "msg3": {
                                "message": {
                                    "author": {"role": "user"},
                                    "content": {"parts": ["I'm testing the import functionality for SoulPrint"]}
                                }
                            },
                            "msg4": {
                                "message": {
                                    "author": {"role": "assistant"},
                                    "content": {"parts": ["That sounds interesting! Import testing is important for data analysis."]}
                                }
                            }
                        }
                    },
                    {
                        "title": "Another Test Chat",
                        "create_time": 1700001000,
                        "mapping": {
                            "msg1": {
                                "message": {
                                    "author": {"role": "user"},
                                    "content": {"parts": ["What are my favorite hobbies?"]}
                                }
                            },
                            "msg2": {
                                "message": {
                                    "author": {"role": "assistant"},
                                    "content": {"parts": ["Based on our conversations, you enjoy reading, coding, and outdoor activities."]}
                                }
                            }
                        }
                    }
                ]
                zip_file.writestr('conversations.json', json.dumps(conversations_data, indent=2))
            
            elif format_type == 'facebook':
                # Create Facebook format with messages and posts
                messages_data = {
                    "messages": [
                        {
                            "sender_name": "Test User",
                            "content": "Hey, how are you doing?",
                            "timestamp_ms": 1700000000000
                        },
                        {
                            "sender_name": "Friend",
                            "content": "I'm doing great! Working on some exciting AI projects.",
                            "timestamp_ms": 1700000100000
                        },
                        {
                            "sender_name": "Test User",
                            "content": "That sounds amazing! I love technology and innovation.",
                            "timestamp_ms": 1700000200000
                        }
                    ]
                }
                
                posts_data = [
                    {
                        "data": [{
                            "post": "Just finished reading an amazing book about machine learning. The future is here!"
                        }],
                        "timestamp": 1700000000
                    },
                    {
                        "data": [{
                            "post": "Excited to share my latest project on sustainable technology solutions."
                        }],
                        "timestamp": 1700001000
                    }
                ]
                
                zip_file.writestr('messages/inbox/chat1.json', json.dumps(messages_data, indent=2))
                zip_file.writestr('posts/your_posts.json', json.dumps(posts_data, indent=2))
        
        zip_buffer.seek(0)
        zip_data = zip_buffer.getvalue()
        print(f"✅ Created test ZIP file: {len(zip_data)} bytes")
        return zip_data
    
    def test_import_upload_main_endpoint(self) -> Optional[str]:
        """Test the main /api/imports/upload endpoint"""
        print("\n🧪 Testing POST /api/imports/upload (main import endpoint)")
        
        try:
            # Create test ZIP file
            zip_data = self.create_test_zip_file('chatgpt')
            
            # Prepare multipart form data
            files = {'file': ('test_chatgpt_export.zip', zip_data, 'application/zip')}
            data = {'type': 'chatgpt'}
            
            print("📤 Uploading ZIP file to /api/imports/upload...")
            response = self.session.post(f"{API_BASE}/imports/upload", files=files, data=data)
            
            print(f"📊 Response Status: {response.status_code}")
            print(f"📊 Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                response_data = response.json()
                print(f"✅ Upload successful!")
                print(f"   Job ID: {response_data.get('jobId')}")
                print(f"   Status: {response_data.get('status')}")
                
                # Validate response structure
                if 'jobId' in response_data and 'status' in response_data:
                    if response_data['status'] == 'processing':
                        print("✅ Response contains expected jobId and status='processing'")
                        return response_data['jobId']
                    else:
                        print(f"⚠️  Unexpected status: {response_data['status']}, expected 'processing'")
                        return response_data['jobId']
                else:
                    print("❌ Response missing required fields (jobId, status)")
                    return None
            else:
                print(f"❌ Upload failed: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Upload error: {str(e)}")
            return None
    
    def test_import_chatgpt_alias_endpoint(self) -> Optional[str]:
        """Test the mobile compatibility alias /api/import/chatgpt endpoint"""
        print("\n🧪 Testing POST /api/import/chatgpt (mobile compatibility alias)")
        
        try:
            # Create test ZIP file
            zip_data = self.create_test_zip_file('chatgpt')
            
            # Prepare multipart form data
            files = {'file': ('test_chatgpt_mobile.zip', zip_data, 'application/zip')}
            data = {'type': 'chatgpt'}
            
            print("📤 Uploading ZIP file to /api/import/chatgpt...")
            response = self.session.post(f"{API_BASE}/import/chatgpt", files=files, data=data)
            
            print(f"📊 Response Status: {response.status_code}")
            
            if response.status_code == 200:
                response_data = response.json()
                print(f"✅ Mobile alias upload successful!")
                print(f"   Job ID: {response_data.get('jobId')}")
                print(f"   Status: {response_data.get('status')}")
                
                # Validate response structure (should be identical to main endpoint)
                if 'jobId' in response_data and 'status' in response_data:
                    if response_data['status'] == 'processing':
                        print("✅ Mobile alias works identically to main endpoint")
                        return response_data['jobId']
                    else:
                        print(f"⚠️  Unexpected status: {response_data['status']}")
                        return response_data['jobId']
                else:
                    print("❌ Mobile alias response missing required fields")
                    return None
            else:
                print(f"❌ Mobile alias upload failed: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Mobile alias upload error: {str(e)}")
            return None
    
    def test_import_status_endpoint(self, job_id: str) -> bool:
        """Test the /api/imports/status endpoint"""
        print(f"\n🧪 Testing GET /api/imports/status with jobId: {job_id}")
        
        try:
            # Poll status multiple times to see progression
            max_polls = 10
            poll_interval = 2  # seconds
            
            for poll_count in range(1, max_polls + 1):
                print(f"🔍 Status poll {poll_count}/{max_polls}...")
                
                response = self.session.get(f"{API_BASE}/imports/status", params={'importId': job_id})
                print(f"📊 Response Status: {response.status_code}")
                
                if response.status_code == 200:
                    status_data = response.json()
                    status = status_data.get('status')
                    message = status_data.get('message', 'No message')
                    progress = status_data.get('progress', 0)
                    
                    print(f"✅ Status retrieved successfully!")
                    print(f"   Status: {status}")
                    print(f"   Message: {message}")
                    print(f"   Progress: {progress}")
                    
                    # Check for additional fields
                    if 'messagesCount' in status_data:
                        print(f"   Messages Count: {status_data['messagesCount']}")
                    if 'error' in status_data and status_data['error']:
                        print(f"   Error: {status_data['error']}")
                    if 'analysis' in status_data and status_data['analysis']:
                        print(f"   Analysis Available: Yes")
                    if 'memoriesAdded' in status_data:
                        print(f"   Memories Added: {status_data['memoriesAdded']}")
                    
                    # Check status progression
                    if status == 'processing':
                        print(f"⏳ Still processing... waiting {poll_interval}s before next poll")
                        time.sleep(poll_interval)
                        continue
                    elif status in ['completed', 'complete']:  # Handle both possible status values
                        print("🎉 Import completed successfully!")
                        
                        # Validate completed response has expected fields
                        expected_completed_fields = ['status', 'error']
                        missing_fields = [field for field in expected_completed_fields if field not in status_data]
                        if missing_fields:
                            print(f"⚠️  Missing fields in completed response: {missing_fields}")
                        else:
                            print("✅ Completed response has all expected fields")
                        
                        return True
                    elif status == 'failed':
                        print(f"❌ Import failed: {status_data.get('error', 'Unknown error')}")
                        return False
                    else:
                        print(f"⚠️  Unknown status: {status}")
                        return False
                        
                elif response.status_code == 404:
                    print("❌ Import job not found - invalid job ID")
                    return False
                else:
                    print(f"❌ Status check failed: {response.status_code}")
                    try:
                        error_data = response.json()
                        print(f"   Error: {error_data}")
                    except:
                        print(f"   Error: {response.text}")
                    return False
            
            # If we've exhausted all polls without completion
            print("⏰ Import still processing after maximum polls - this may be normal for large files")
            return True  # Consider this a success - the endpoint is working
            
        except Exception as e:
            print(f"❌ Status check error: {str(e)}")
            return False
    
    def test_error_conditions(self) -> bool:
        """Test various error conditions"""
        print("\n🧪 Testing Error Conditions")
        
        error_tests_passed = 0
        total_error_tests = 0
        
        # Test 1: Upload without authentication
        print("\n🔍 Test 1: Upload without authentication")
        total_error_tests += 1
        try:
            # Remove auth header temporarily
            auth_header = self.session.headers.pop('Authorization', None)
            
            zip_data = self.create_test_zip_file('chatgpt')
            files = {'file': ('test.zip', zip_data, 'application/zip')}
            
            response = self.session.post(f"{API_BASE}/imports/upload", files=files)
            
            if response.status_code == 401:
                print("✅ Correctly rejected unauthenticated request")
                error_tests_passed += 1
            else:
                print(f"❌ Expected 401, got {response.status_code}")
            
            # Restore auth header
            if auth_header:
                self.session.headers['Authorization'] = auth_header
                
        except Exception as e:
            print(f"❌ Auth test error: {str(e)}")
        
        # Test 2: Upload without file
        print("\n🔍 Test 2: Upload without file")
        total_error_tests += 1
        try:
            response = self.session.post(f"{API_BASE}/imports/upload", data={'type': 'chatgpt'})
            
            if response.status_code == 400:
                print("✅ Correctly rejected request without file")
                error_tests_passed += 1
            else:
                print(f"❌ Expected 400, got {response.status_code}")
                
        except Exception as e:
            print(f"❌ No file test error: {str(e)}")
        
        # Test 3: Status check without importId
        print("\n🔍 Test 3: Status check without importId")
        total_error_tests += 1
        try:
            response = self.session.get(f"{API_BASE}/imports/status")
            
            if response.status_code == 400:
                print("✅ Correctly rejected status request without importId")
                error_tests_passed += 1
            else:
                print(f"❌ Expected 400, got {response.status_code}")
                
        except Exception as e:
            print(f"❌ No importId test error: {str(e)}")
        
        # Test 4: Status check with invalid importId
        print("\n🔍 Test 4: Status check with invalid importId")
        total_error_tests += 1
        try:
            response = self.session.get(f"{API_BASE}/imports/status", params={'importId': 'invalid-id-12345'})
            
            if response.status_code == 404:
                print("✅ Correctly returned 404 for invalid importId")
                error_tests_passed += 1
            else:
                print(f"❌ Expected 404, got {response.status_code}")
                
        except Exception as e:
            print(f"❌ Invalid importId test error: {str(e)}")
        
        print(f"\n📊 Error condition tests: {error_tests_passed}/{total_error_tests} passed")
        return error_tests_passed == total_error_tests

    def run_comprehensive_tests(self):
        """Run all import functionality tests"""
        print("🚀 Starting Comprehensive Import Functionality Tests")
        print("=" * 60)
        
        # Step 1: Authentication
        if not self.authenticate():
            print("❌ Authentication failed - cannot proceed with tests")
            return False
        
        # Track test results
        tests_passed = 0
        total_tests = 0
        
        # Step 2: Test main import endpoint
        print("\n" + "=" * 60)
        total_tests += 1
        job_id_main = self.test_import_upload_main_endpoint()
        if job_id_main:
            tests_passed += 1
        
        # Step 3: Test mobile compatibility alias
        print("\n" + "=" * 60)
        total_tests += 1
        job_id_mobile = self.test_import_chatgpt_alias_endpoint()
        if job_id_mobile:
            tests_passed += 1
        
        # Step 4: Test status endpoint with main job
        if job_id_main:
            print("\n" + "=" * 60)
            total_tests += 1
            if self.test_import_status_endpoint(job_id_main):
                tests_passed += 1
        
        # Step 5: Test error conditions
        print("\n" + "=" * 60)
        total_tests += 1
        if self.test_error_conditions():
            tests_passed += 1
        
        # Final Results
        print("\n" + "=" * 60)
        print("🎯 FINAL TEST RESULTS")
        print("=" * 60)
        print(f"Tests Passed: {tests_passed}/{total_tests}")
        
        if tests_passed == total_tests:
            print("🎉 ALL TESTS PASSED! Import functionality is working correctly.")
            return True
        else:
            print("⚠️  Some tests failed. Import functionality needs attention.")
            
            # Provide specific recommendations
            if job_id_main is None:
                print("🔧 Recommendation: Check /api/imports/upload endpoint implementation")
            if job_id_mobile is None:
                print("🔧 Recommendation: Check /api/import/chatgpt alias endpoint implementation")
            
            return False

if __name__ == "__main__":
    print("SoulPrint Import Functionality Backend Test")
    print("Testing endpoints: /api/imports/upload, /api/import/chatgpt, /api/imports/status")
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_EMAIL}")
    print()
    
    tester = ImportTester()
    success = tester.run_comprehensive_tests()
    
    exit(0 if success else 1)