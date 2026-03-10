#!/usr/bin/env python3

import requests
import json
import base64
import zipfile
import io
import os
import time
import sys

# Get the base URL from environment variable
NEXT_PUBLIC_BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://image-video-gen-11.preview.emergentagent.com')
BASE_URL = f"{NEXT_PUBLIC_BASE_URL}/api"

class ImportTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user_id = None
        
    def login(self, email="test@soulprint.com", passcode="test123"):
        """Login with test credentials"""
        try:
            print(f"🔐 Authenticating with {email}...")
            response = requests.post(f"{self.base_url}/auth/login", json={
                "email": email,
                "passcode": passcode
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data['token']
                self.user_id = data['userId']
                print(f"✅ Authentication successful - Role: {data.get('role', 'N/A')}")
                return True
            else:
                print(f"❌ Login failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Login error: {str(e)}")
            return False
    
    def get_headers(self):
        """Get authenticated headers"""
        return {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
    
    def get_multipart_headers(self):
        """Get authenticated headers for multipart requests"""
        return {
            'Authorization': f'Bearer {self.token}'
        }
    
    def create_chatgpt_test_file(self):
        """Create a test ChatGPT format ZIP file"""
        conversations = [{
            "title": "AI Discussion Test",
            "create_time": 1700000000,
            "mapping": {
                "msg1": {
                    "message": {
                        "author": {"role": "user"},
                        "content": {"parts": ["What is artificial intelligence and how does it work?"]}
                    }
                },
                "msg2": {
                    "message": {
                        "author": {"role": "assistant"},
                        "content": {"parts": ["AI is a field of computer science..."]}
                    }
                },
                "msg3": {
                    "message": {
                        "author": {"role": "user"},
                        "content": {"parts": ["Can you help me write a Python function for data processing?"]}
                    }
                }
            }
        }, {
            "title": "Programming Help",
            "create_time": 1700001000,
            "mapping": {
                "msg4": {
                    "message": {
                        "author": {"role": "user"},
                        "content": {"parts": ["I need help with machine learning algorithms"]}
                    }
                }
            }
        }]
        
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.writestr('conversations.json', json.dumps(conversations))
        
        zip_buffer.seek(0)
        return zip_buffer.getvalue()
    
    def create_facebook_test_file(self):
        """Create a test Facebook format ZIP file"""
        # Facebook messages format
        messages_data = {
            "participants": [{"name": "John Smith"}],
            "messages": [
                {
                    "sender_name": "John Smith",
                    "content": "Hey, how are you doing today?",
                    "timestamp_ms": 1700000000000
                },
                {
                    "sender_name": "Test User",
                    "content": "I'm doing great! Just working on some interesting machine learning projects.",
                    "timestamp_ms": 1700000060000
                },
                {
                    "sender_name": "John Smith", 
                    "content": "That sounds fascinating! Tell me more about it.",
                    "timestamp_ms": 1700000120000
                }
            ]
        }
        
        # Facebook posts format  
        posts_data = [
            {
                "data": [{
                    "post": "Excited about the future of quantum computing and its applications in AI!"
                }],
                "timestamp": 1700000000
            },
            {
                "data": [{
                    "post": "Just finished reading about sustainable AI development. The future looks promising."
                }],
                "timestamp": 1700001000
            }
        ]
        
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.writestr('messages/inbox/friend_name/message_1.json', json.dumps(messages_data))
            zipf.writestr('posts/your_posts_1.json', json.dumps(posts_data))
        
        zip_buffer.seek(0)
        return zip_buffer.getvalue()
    
    def test_chatgpt_import(self):
        """Test ChatGPT format import"""
        print("\n🧪 Testing ChatGPT format import...")
        
        try:
            # Create test file
            zip_data = self.create_chatgpt_test_file()
            print(f"📁 Created ChatGPT test file ({len(zip_data)} bytes)")
            
            # Upload file
            files = {'file': ('conversations_test.zip', zip_data, 'application/zip')}
            response = requests.post(
                f"{self.base_url}/imports/upload",
                headers=self.get_multipart_headers(),
                files=files
            )
            
            if response.status_code == 200:
                data = response.json()
                job_id = data.get('jobId')
                print(f"✅ Upload successful - JobId: {job_id}")
                print(f"📊 Status: {data.get('status', 'N/A')}")
                
                if job_id:
                    return self.poll_import_status(job_id)
                else:
                    print("❌ No jobId returned")
                    return False
            else:
                print(f"❌ Upload failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ ChatGPT import test error: {str(e)}")
            return False
    
    def test_facebook_import(self):
        """Test Facebook format import"""
        print("\n🧪 Testing Facebook format import...")
        
        try:
            # Create test file
            zip_data = self.create_facebook_test_file()
            print(f"📁 Created Facebook test file ({len(zip_data)} bytes)")
            
            # Upload file
            files = {'file': ('facebook_export_test.zip', zip_data, 'application/zip')}
            response = requests.post(
                f"{self.base_url}/imports/upload",
                headers=self.get_multipart_headers(),
                files=files
            )
            
            if response.status_code == 200:
                data = response.json()
                job_id = data.get('jobId')
                print(f"✅ Upload successful - JobId: {job_id}")
                print(f"📊 Status: {data.get('status', 'N/A')}")
                
                if job_id:
                    return self.poll_import_status(job_id)
                else:
                    print("❌ No jobId returned")
                    return False
            else:
                print(f"❌ Upload failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Facebook import test error: {str(e)}")
            return False
    
    def test_chunked_upload_init(self):
        """Test chunked upload initialization"""
        print("\n🧪 Testing chunked upload init...")
        
        try:
            response = requests.post(
                f"{self.base_url}/data-import/chunked/init",
                headers=self.get_headers(),
                json={
                    "filename": "test_export.zip",
                    "fileSize": 2048,
                    "source": "chatgpt",
                    "totalChunks": 2
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                upload_id = data.get('uploadId')
                print(f"✅ Chunked init successful - UploadId: {upload_id}")
                return upload_id
            else:
                print(f"❌ Chunked init failed: {response.status_code}")
                print(f"Response: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Chunked init test error: {str(e)}")
            return None
    
    def poll_import_status(self, job_id, max_attempts=10):
        """Poll import status until completion"""
        print(f"\n🔄 Polling import status for JobId: {job_id}")
        
        for attempt in range(max_attempts):
            try:
                response = requests.get(
                    f"{self.base_url}/imports/status?importId={job_id}",
                    headers=self.get_headers()
                )
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get('status', 'unknown')
                    print(f"📊 Attempt {attempt + 1}: Status = {status}")
                    
                    if status in ['completed', 'complete']:
                        print("✅ Import completed successfully")
                        self.print_import_results(data)
                        return True
                    elif status == 'failed':
                        print(f"❌ Import failed: {data.get('error', 'Unknown error')}")
                        return False
                    elif status == 'processing':
                        print("⏳ Still processing...")
                        time.sleep(2)
                        continue
                    else:
                        print(f"⚠️ Unknown status: {status}")
                        time.sleep(2)
                        continue
                        
                elif response.status_code == 404:
                    print(f"❌ Import not found: {job_id}")
                    return False
                else:
                    print(f"❌ Status check failed: {response.status_code}")
                    print(f"Response: {response.text}")
                    return False
                    
            except Exception as e:
                print(f"❌ Status polling error: {str(e)}")
                return False
        
        print(f"⏰ Timeout after {max_attempts} attempts")
        return False
    
    def print_import_results(self, data):
        """Print detailed import results"""
        print("\n📋 Import Results:")
        print(f"   Status: {data.get('status', 'N/A')}")
        
        analysis = data.get('analysis')
        if analysis:
            print(f"   Analysis Summary: {analysis.get('summary', 'N/A')}")
            
            comm_style = analysis.get('communicationStyle', {})
            if comm_style:
                print(f"   Communication Style:")
                print(f"     - Formality: {comm_style.get('formality', 'N/A')}")
                print(f"     - Verbosity: {comm_style.get('verbosity', 'N/A')}")  
                print(f"     - Tone: {comm_style.get('tone', 'N/A')}")
            
            interests = analysis.get('interests', [])
            if interests:
                print(f"   Interests: {', '.join(interests[:5])}")
        
        memories_added = data.get('memoriesAdded', 0)
        print(f"   Memories Added: {memories_added}")
    
    def run_all_tests(self):
        """Run all import functionality tests"""
        print("=" * 60)
        print("🚀 IMPORT FUNCTIONALITY TEST SUITE")
        print("=" * 60)
        
        # Step 1: Login
        if not self.login():
            print("💥 Cannot proceed without authentication")
            return False
        
        test_results = []
        
        # Step 2: Test ChatGPT import
        chatgpt_result = self.test_chatgpt_import()
        test_results.append(("ChatGPT Import", chatgpt_result))
        
        # Step 3: Test Facebook import  
        facebook_result = self.test_facebook_import()
        test_results.append(("Facebook Import", facebook_result))
        
        # Step 4: Test chunked upload init
        upload_id = self.test_chunked_upload_init()
        chunked_result = upload_id is not None
        test_results.append(("Chunked Upload Init", chunked_result))
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        all_passed = True
        for test_name, result in test_results:
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{test_name}: {status}")
            if not result:
                all_passed = False
        
        print(f"\n🎯 Overall Result: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
        
        return all_passed

if __name__ == "__main__":
    tester = ImportTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)