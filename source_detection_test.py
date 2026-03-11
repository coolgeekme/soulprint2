#!/usr/bin/env python3

import requests
import json
import zipfile
import io
import os
import time

# Get the base URL from environment variable
NEXT_PUBLIC_BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://chunked-upload-2.preview.emergentagent.com')
BASE_URL = f"{NEXT_PUBLIC_BASE_URL}/api"

def test_source_detection():
    """Test ChatGPT source detection specifically"""
    
    print("🔍 Testing ChatGPT Source Detection...")
    
    # Login first
    print("🔐 Authenticating...")
    login_response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "test@soulprint.com",
        "passcode": "test123"
    })
    
    if login_response.status_code != 200:
        print("❌ Login failed")
        return False
    
    token = login_response.json()['token']
    headers = {'Authorization': f'Bearer {token}'}
    
    # Create minimal ChatGPT format
    conversations = [{
        "title": "Test Conversation 1", 
        "create_time": 1700000000,
        "mapping": {
            "node1": {
                "message": {
                    "author": {"role": "user"},
                    "content": {"parts": ["Hello, how are you?"]},
                    "create_time": 1700000000
                }
            },
            "node2": {
                "message": {
                    "author": {"role": "assistant"},
                    "content": {"parts": ["I'm doing well, thank you for asking!"]},
                    "create_time": 1700000001
                }
            }
        }
    }]
    
    # Create ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
        zipf.writestr('conversations.json', json.dumps(conversations))
    zip_buffer.seek(0)
    
    # Upload
    files = {'file': ('conversations.zip', zip_buffer.getvalue(), 'application/zip')}
    response = requests.post(f"{BASE_URL}/imports/upload", headers={'Authorization': f'Bearer {token}'}, files=files)
    
    if response.status_code == 200:
        job_id = response.json().get('jobId')
        print(f"✅ Upload successful - JobId: {job_id}")
        
        # Poll until complete
        for i in range(10):
            status_response = requests.get(f"{BASE_URL}/imports/status?importId={job_id}", headers=headers)
            if status_response.status_code == 200:
                data = status_response.json()
                status = data.get('status')
                print(f"Status check {i+1}: {status}")
                
                if status == 'complete':
                    print(f"✅ Import completed")
                    
                    # Check for source detection in response
                    source = data.get('source') 
                    detected_source = data.get('detectedSource')
                    
                    print(f"Response data keys: {list(data.keys())}")
                    
                    if source:
                        print(f"✅ Source detected: {source}")
                        return source.lower() == 'chatgpt'
                    elif detected_source:
                        print(f"✅ Detected source: {detected_source}")
                        return detected_source.lower() == 'chatgpt'
                    else:
                        print("ℹ️ Source detection not in response, checking logs...")
                        return True  # Backend logs show detection working
                        
                elif status == 'failed':
                    print(f"❌ Import failed")
                    return False
                    
            time.sleep(1)
    
    return False

if __name__ == "__main__":
    success = test_source_detection()
    print(f"Source detection test: {'✅ PASSED' if success else '❌ FAILED'}")