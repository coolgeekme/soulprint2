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
NEXT_PUBLIC_BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://oauth-polish-1.preview.emergentagent.com')
BASE_URL = f"{NEXT_PUBLIC_BASE_URL}/api"

class ImportTestAddOn:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        
    def login(self, email="test@soulprint.com", passcode="test123"):
        """Login with test credentials"""
        response = requests.post(f"{self.base_url}/auth/login", json={
            "email": email, "passcode": passcode
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data['token']
            print(f"✅ Authenticated as {data.get('role', 'N/A')}")
            return True
        return False
    
    def get_headers(self):
        return {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
    
    def test_status_with_jobId_param(self):
        """Test that the status endpoint also works with jobId parameter (backward compatibility)"""
        print("\n🧪 Testing import status with jobId parameter...")
        
        # Create a small test file first
        conversations = [{"title": "Test", "create_time": 1700000000, "mapping": {
            "msg1": {"message": {"author": {"role": "user"}, "content": {"parts": ["Test message"]}}}
        }}]
        
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.writestr('conversations.json', json.dumps(conversations))
        zip_buffer.seek(0)
        
        # Upload file
        files = {'file': ('test.zip', zip_buffer.getvalue(), 'application/zip')}
        response = requests.post(
            f"{self.base_url}/imports/upload",
            headers={'Authorization': f'Bearer {self.token}'},
            files=files
        )
        
        if response.status_code != 200:
            print("❌ Upload failed")
            return False
        
        job_id = response.json().get('jobId')
        if not job_id:
            print("❌ No jobId returned")
            return False
        
        print(f"📊 Testing status with jobId: {job_id}")
        
        # Test with jobId parameter (alternate parameter name)
        response = requests.get(
            f"{self.base_url}/imports/status?jobId={job_id}",
            headers=self.get_headers()
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Status with jobId param works: {data.get('status', 'N/A')}")
            return True
        else:
            print(f"❌ Status with jobId failed: {response.status_code}")
            return False

if __name__ == "__main__":
    tester = ImportTestAddOn()
    if tester.login():
        result = tester.test_status_with_jobId_param()
        print(f"\n🎯 Additional test result: {'✅ PASSED' if result else '❌ FAILED'}")