#!/usr/bin/env python3
"""
Backend API Testing - Chunked Upload Endpoints for Large File Imports
Tests the chunked upload endpoints for ChatGPT history imports:
- POST /api/imports/chunked/init - Initialize a chunked upload session
- POST /api/imports/chunked/chunk - Upload a test chunk  
- POST /api/imports/chunked/process-batch - Process uploaded chunks
"""

import requests
import json
import os
import sys
import zipfile
import io
import time
from pathlib import Path

# Base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://chunked-upload-2.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def create_test_chatgpt_zip():
    """Create a test ChatGPT export ZIP file for chunked upload testing."""
    try:
        # Create conversations.json content (realistic ChatGPT export format)
        conversations_data = {
            "conversations": [
                {
                    "id": "test-conversation-1",
                    "title": "Python Help",
                    "create_time": 1703980800.0,  # 2023-12-30
                    "update_time": 1703980800.0,
                    "mapping": {
                        "msg-1": {
                            "id": "msg-1",
                            "message": {
                                "id": "msg-1",
                                "author": {"role": "user"},
                                "create_time": 1703980800.0,
                                "content": {
                                    "content_type": "text",
                                    "parts": ["Help me write a Python function to calculate fibonacci numbers."]
                                }
                            }
                        },
                        "msg-2": {
                            "id": "msg-2",
                            "message": {
                                "id": "msg-2",
                                "author": {"role": "assistant"},
                                "create_time": 1703980820.0,
                                "content": {
                                    "content_type": "text",
                                    "parts": ["I'll help you create a Python function to calculate Fibonacci numbers. Here's an efficient recursive approach with memoization..."]
                                }
                            }
                        }
                    }
                },
                {
                    "id": "test-conversation-2", 
                    "title": "Machine Learning Discussion",
                    "create_time": 1703984400.0,
                    "update_time": 1703984400.0,
                    "mapping": {
                        "msg-3": {
                            "id": "msg-3",
                            "message": {
                                "id": "msg-3",
                                "author": {"role": "user"},
                                "create_time": 1703984400.0,
                                "content": {
                                    "content_type": "text",
                                    "parts": ["What's the difference between supervised and unsupervised learning?"]
                                }
                            }
                        },
                        "msg-4": {
                            "id": "msg-4", 
                            "message": {
                                "id": "msg-4",
                                "author": {"role": "assistant"},
                                "create_time": 1703984420.0,
                                "content": {
                                    "content_type": "text",
                                    "parts": ["Great question! The main difference lies in whether the training data includes labels or target outputs..."]
                                }
                            }
                        }
                    }
                }
            ]
        }
        
        # Create ZIP file in memory
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Add conversations.json (standard ChatGPT export format)
            conversations_json = json.dumps(conversations_data, indent=2)
            zf.writestr('conversations.json', conversations_json)
            
        buffer.seek(0)
        return buffer.getvalue()
        
    except Exception as e:
        print(f"Error creating test ChatGPT ZIP: {e}")
        return None

def split_into_chunks(data, chunk_size=1024):
    """Split data into chunks of specified size."""
    chunks = []
    for i in range(0, len(data), chunk_size):
        chunks.append(data[i:i + chunk_size])
    return chunks

def login_and_get_token():
    """Login with test credentials and get authentication token."""
    try:
        print("🔐 STEP 1: Authentication Test")
        
        login_url = f"{API_BASE}/auth/login"
        login_data = {
            "email": "test@soulprint.com",
            "passcode": "test123"
        }
        
        print(f"POST {login_url}")
        print(f"Request body: {json.dumps(login_data, indent=2)}")
        
        response = requests.post(login_url, json=login_data)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            if 'token' in data:
                print("✅ Authentication successful!")
                return data['token']
            else:
                print("❌ No token in response")
                return None
        else:
            print(f"❌ Authentication failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Authentication error: {e}")
        return None

def test_chunked_init(token):
    """Test /api/imports/chunked/init - Initialize a chunked upload session."""
    try:
        print("\n🚀 STEP 2: Chunked Upload Init Test")
        
        # Create test file and calculate chunks
        zip_data = create_test_chatgpt_zip()
        if not zip_data:
            print("❌ Failed to create test ZIP file")
            return None, None
            
        chunk_size = 1024  # 1KB chunks for testing
        chunks = split_into_chunks(zip_data, chunk_size)
        
        print(f"Created test ChatGPT export ZIP: {len(zip_data)} bytes")
        print(f"Split into {len(chunks)} chunks of {chunk_size} bytes each")
        
        # Initialize chunked upload
        url = f"{API_BASE}/imports/chunked/init"
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        data = {
            'filename': 'test_chatgpt_export.zip',
            'fileSize': len(zip_data),
            'totalChunks': len(chunks),
            'type': 'chatgpt'
        }
        
        print(f"POST {url}")
        print(f"Headers: Authorization: Bearer {token[:20]}...")
        print(f"Request body: {json.dumps(data, indent=2)}")
        
        response = requests.post(url, headers=headers, json=data)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            resp_data = response.json()
            print(f"Response: {json.dumps(resp_data, indent=2)}")
            
            if 'uploadId' in resp_data:
                upload_id = resp_data['uploadId']
                print(f"✅ Chunked upload init successful! uploadId: {upload_id}")
                return upload_id, chunks
            else:
                print("❌ No uploadId in response")
                return None, None
        else:
            print(f"❌ Chunked upload init failed: {response.text}")
            return None, None
            
    except Exception as e:
        print(f"❌ Chunked upload init error: {e}")
        return None, None

def test_chunked_chunk_upload(token, upload_id, chunks):
    """Test /api/imports/chunked/chunk - Upload chunks."""
    try:
        print("\n📦 STEP 3: Chunked Chunk Upload Test")
        
        if not upload_id or not chunks:
            print("❌ Missing uploadId or chunks")
            return False
            
        url = f"{API_BASE}/imports/chunked/chunk"
        headers = {
            'Authorization': f'Bearer {token}'
        }
        
        print(f"Uploading {len(chunks)} chunks to {upload_id}...")
        
        # Upload each chunk
        for i, chunk_data in enumerate(chunks):
            print(f"Uploading chunk {i + 1}/{len(chunks)} ({len(chunk_data)} bytes)...")
            
            # Prepare multipart form data
            files = {
                'uploadId': (None, upload_id),
                'chunkIndex': (None, str(i)),
                'chunk': ('chunk', chunk_data, 'application/octet-stream')
            }
            
            response = requests.post(url, headers=headers, files=files)
            print(f"Chunk {i + 1} - Status: {response.status_code}")
            
            if response.status_code == 200:
                resp_data = response.json()
                print(f"Chunk {i + 1} - Response: {json.dumps(resp_data, indent=2)}")
                
                if resp_data.get('received') == i:
                    print(f"✅ Chunk {i + 1} uploaded successfully!")
                else:
                    print(f"❌ Chunk {i + 1} received mismatch: expected {i}, got {resp_data.get('received')}")
                    return False
            else:
                print(f"❌ Chunk {i + 1} upload failed: {response.text}")
                return False
                
            # Small delay between chunks
            time.sleep(0.1)
        
        print("✅ All chunks uploaded successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Chunked chunk upload error: {e}")
        return False

def test_chunked_process_batch(token, upload_id):
    """Test /api/imports/chunked/process-batch - Process uploaded chunks."""
    try:
        print("\n⚡ STEP 4: Chunked Process Batch Test")
        
        if not upload_id:
            print("❌ Missing uploadId")
            return False
            
        url = f"{API_BASE}/imports/chunked/process-batch"
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        data = {
            'uploads': [
                {
                    'uploadId': upload_id,
                    'fileName': 'test_chatgpt_export.zip'
                }
            ],
            'type': 'chatgpt'
        }
        
        print(f"POST {url}")
        print(f"Headers: Authorization: Bearer {token[:20]}...")
        print(f"Request body: {json.dumps(data, indent=2)}")
        
        response = requests.post(url, headers=headers, json=data)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            resp_data = response.json()
            print(f"Response: {json.dumps(resp_data, indent=2)}")
            
            if 'importId' in resp_data and resp_data.get('status') == 'pending':
                import_id = resp_data['importId']
                print(f"✅ Chunked process batch successful! importId: {import_id}")
                return import_id
            else:
                print(f"❌ Unexpected response format or status")
                return False
        else:
            print(f"❌ Chunked process batch failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Chunked process batch error: {e}")
        return False

def test_authentication_required():
    """Test that authentication is required for all chunked endpoints."""
    try:
        print("\n🔒 STEP 5: Authentication Required Test")
        
        # Test chunked init without auth
        print("Testing /api/imports/chunked/init without authentication...")
        url = f"{API_BASE}/imports/chunked/init"
        data = {
            'filename': 'test.zip',
            'fileSize': 1000,
            'totalChunks': 2,
            'type': 'chatgpt'
        }
        
        response = requests.post(url, json=data)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Chunked init properly requires authentication!")
        else:
            print(f"❌ Expected 401 for chunked init, got {response.status_code}")
            return False
            
        # Test chunked chunk without auth
        print("Testing /api/imports/chunked/chunk without authentication...")
        url = f"{API_BASE}/imports/chunked/chunk"
        files = {
            'uploadId': (None, 'test-upload-id'),
            'chunkIndex': (None, '0'),
            'chunk': ('chunk', b'test data', 'application/octet-stream')
        }
        
        response = requests.post(url, files=files)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Chunked chunk properly requires authentication!")
        else:
            print(f"❌ Expected 401 for chunked chunk, got {response.status_code}")
            return False
            
        # Test process batch without auth
        print("Testing /api/imports/chunked/process-batch without authentication...")
        url = f"{API_BASE}/imports/chunked/process-batch"
        data = {
            'uploads': [{'uploadId': 'test', 'fileName': 'test.zip'}],
            'type': 'chatgpt'
        }
        
        response = requests.post(url, json=data)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Process batch properly requires authentication!")
            return True
        else:
            print(f"❌ Expected 401 for process batch, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Authentication required test failed: {e}")
        return False

def test_error_handling(token):
    """Test error handling for various invalid requests."""
    try:
        print("\n⚠️ STEP 6: Error Handling Test")
        
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        
        # Test chunked init with missing fields
        print("Testing chunked init with missing required fields...")
        url = f"{API_BASE}/imports/chunked/init"
        data = {'filename': 'test.zip'}  # Missing fileSize, totalChunks
        
        response = requests.post(url, headers=headers, json=data)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 400:
            print("✅ Proper error handling for missing fields in chunked init!")
        else:
            print(f"❌ Expected 400 for missing fields, got {response.status_code}")
            return False
            
        # Test chunked chunk with invalid uploadId
        print("Testing chunked chunk with invalid uploadId...")
        url = f"{API_BASE}/imports/chunked/chunk"
        headers_chunk = {'Authorization': f'Bearer {token}'}
        files = {
            'uploadId': (None, 'invalid-upload-id'),
            'chunkIndex': (None, '0'),
            'chunk': ('chunk', b'test data', 'application/octet-stream')
        }
        
        response = requests.post(url, headers=headers_chunk, files=files)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 404:
            print("✅ Proper error handling for invalid uploadId!")
        else:
            print(f"❌ Expected 404 for invalid uploadId, got {response.status_code}")
            return False
            
        print("✅ All error handling tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Error handling test failed: {e}")
        return False

def main():
    """Run all chunked upload API tests."""
    print("🧪 Chunked Upload API Testing Suite")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print("Testing endpoints for large file imports:")
    print("- POST /api/imports/chunked/init")
    print("- POST /api/imports/chunked/chunk") 
    print("- POST /api/imports/chunked/process-batch")
    print("=" * 60)
    
    results = {
        'authentication': False,
        'chunked_init': False,
        'chunked_chunk_upload': False,
        'chunked_process_batch': False,
        'auth_required': False,
        'error_handling': False
    }
    
    upload_id = None
    chunks = None
    
    try:
        # Test 1: Authentication
        token = login_and_get_token()
        if token:
            results['authentication'] = True
            
            # Test 2: Chunked Init
            upload_id, chunks = test_chunked_init(token)
            if upload_id and chunks:
                results['chunked_init'] = True
                
                # Test 3: Chunked Chunk Upload
                if test_chunked_chunk_upload(token, upload_id, chunks):
                    results['chunked_chunk_upload'] = True
                    
                    # Test 4: Chunked Process Batch
                    if test_chunked_process_batch(token, upload_id):
                        results['chunked_process_batch'] = True
            
            # Test 5: Error Handling
            if test_error_handling(token):
                results['error_handling'] = True
        
        # Test 6: Authentication Required (no token)
        if test_authentication_required():
            results['auth_required'] = True
        
    except Exception as e:
        print(f"❌ Testing suite error: {e}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("🏁 TEST SUMMARY")
    print("=" * 60)
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title():<30} {status}")
    
    print("-" * 60)
    print(f"Tests Passed: {passed_tests}/{total_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    if passed_tests == total_tests:
        print("\n🎉 ALL TESTS PASSED! Chunked Upload API is working correctly!")
        print("\n📋 Test Results:")
        print("✅ /api/imports/chunked/init - Initialize chunked upload session")
        print("✅ /api/imports/chunked/chunk - Upload file chunks")
        print("✅ /api/imports/chunked/process-batch - Process uploaded chunks")
        print("✅ Authentication and error handling working properly")
        return True
    else:
        print(f"\n⚠️ {total_tests - passed_tests} test(s) failed. See details above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)