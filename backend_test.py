#!/usr/bin/env python3
"""
SoulPrint Engine Cloud Import API Testing Suite
Tests POST /api/imports/cloud and GET /api/imports/status endpoints
"""

import requests
import json
import time
import sys
import os
from urllib.parse import urljoin

# Configuration
BASE_URL = "https://multi-model-chat-15.preview.emergentagent.com"
TEST_CREDENTIALS = {
    "email": "test@soulprint.com",
    "passcode": "test123"
}

class CloudImportTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'SoulPrint-CloudImport-Tester/1.0'
        })

    def authenticate(self):
        """Authenticate and get JWT token"""
        try:
            url = urljoin(self.base_url, '/api/auth/login')
            response = self.session.post(url, json=TEST_CREDENTIALS)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                self.session.headers.update({
                    'Authorization': f'Bearer {self.token}'
                })
                print(f"✅ Authentication successful - Role: {data.get('role', 'unknown')}")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False

    def test_cloud_import_no_auth(self):
        """Test POST /api/imports/cloud without authentication"""
        print("\n🔒 Testing Cloud Import without authentication...")
        try:
            # Remove auth header temporarily
            auth_header = self.session.headers.pop('Authorization', None)
            
            url = urljoin(self.base_url, '/api/imports/cloud')
            response = self.session.post(url, json={
                "url": "https://example.com/test.zip",
                "type": "chatgpt",
                "provider": "direct"
            })
            
            # Restore auth header
            if auth_header:
                self.session.headers['Authorization'] = auth_header
            
            if response.status_code == 401:
                print("✅ PASSED: Returns 401 Unauthorized without auth")
                return True
            else:
                print(f"❌ FAILED: Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return False

    def test_import_status_no_auth(self):
        """Test GET /api/imports/status without authentication"""
        print("\n🔒 Testing Import Status without authentication...")
        try:
            # Remove auth header temporarily
            auth_header = self.session.headers.pop('Authorization', None)
            
            url = urljoin(self.base_url, '/api/imports/status?importId=test123')
            response = self.session.get(url)
            
            # Restore auth header
            if auth_header:
                self.session.headers['Authorization'] = auth_header
            
            if response.status_code == 401:
                print("✅ PASSED: Returns 401 Unauthorized without auth")
                return True
            else:
                print(f"❌ FAILED: Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return False

    def test_cloud_import_validation(self):
        """Test POST /api/imports/cloud validation"""
        print("\n✏️ Testing Cloud Import validation...")
        try:
            url = urljoin(self.base_url, '/api/imports/cloud')
            
            # Test missing URL
            response = self.session.post(url, json={
                "type": "chatgpt",
                "provider": "direct"
            })
            
            if response.status_code == 400 and 'URL required' in response.text:
                print("✅ PASSED: Validates missing URL (400 error)")
                return True
            else:
                print(f"❌ FAILED: Expected URL validation error, got {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return False

    def test_cloud_import_creation(self):
        """Test POST /api/imports/cloud job creation"""
        print("\n📤 Testing Cloud Import job creation...")
        try:
            url = urljoin(self.base_url, '/api/imports/cloud')
            
            # Test with a public test URL (will likely fail download, but should create job)
            test_data = {
                "url": "https://httpbin.org/json",  # This will fail as it's not a ZIP, but tests job creation
                "type": "chatgpt",
                "provider": "direct"
            }
            
            response = self.session.post(url, json=test_data)
            
            if response.status_code == 200:
                data = response.json()
                if 'importId' in data and 'status' in data and data['status'] == 'pending':
                    print(f"✅ PASSED: Created import job with ID: {data['importId']}")
                    return data['importId']
                else:
                    print(f"❌ FAILED: Missing expected response fields: {data}")
                    return None
            else:
                print(f"❌ FAILED: Expected 200, got {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return None

    def test_cloud_import_dropbox_detection(self):
        """Test POST /api/imports/cloud with Dropbox URL format"""
        print("\n📦 Testing Cloud Import with Dropbox URL...")
        try:
            url = urljoin(self.base_url, '/api/imports/cloud')
            
            # Test with Dropbox URL format (will likely fail download, but tests provider detection)
            test_data = {
                "url": "https://www.dropbox.com/s/abc123/test.zip?dl=0",
                "type": "chatgpt",
                "provider": "dropbox"  # or should be auto-detected
            }
            
            response = self.session.post(url, json=test_data)
            
            if response.status_code == 200:
                data = response.json()
                if 'importId' in data and 'status' in data and data['status'] == 'pending':
                    print(f"✅ PASSED: Created Dropbox import job with ID: {data['importId']}")
                    return data['importId']
                else:
                    print(f"❌ FAILED: Missing expected response fields: {data}")
                    return None
            else:
                print(f"❌ FAILED: Expected 200, got {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return None

    def test_import_status_polling(self, import_id):
        """Test GET /api/imports/status for valid importId"""
        print(f"\n📊 Testing Import Status polling for ID: {import_id}")
        try:
            if not import_id:
                print("❌ SKIPPED: No importId provided")
                return False
                
            url = urljoin(self.base_url, f'/api/imports/status?importId={import_id}')
            
            # Poll a few times to see status changes
            for i in range(3):
                response = self.session.get(url)
                
                if response.status_code == 200:
                    data = response.json()
                    required_fields = ['status', 'message', 'progress', 'messagesCount', 'error']
                    
                    # Check if all required fields are present
                    if all(field in data for field in required_fields):
                        print(f"✅ Poll {i+1}: Status={data['status']}, Progress={data['progress']}%, Message='{data['message']}'")
                        
                        # If status is failed or completed, stop polling
                        if data['status'] in ['completed', 'failed']:
                            if data['status'] == 'failed' and data['error']:
                                print(f"   ℹ️  Expected failure reason: {data['error']}")
                            break
                    else:
                        print(f"❌ FAILED: Missing required fields in response: {data}")
                        return False
                else:
                    print(f"❌ FAILED: Expected 200, got {response.status_code} - {response.text}")
                    return False
                
                # Wait a bit before next poll
                if i < 2:
                    time.sleep(2)
            
            print("✅ PASSED: Import status polling working correctly")
            return True
            
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return False

    def test_import_status_invalid_id(self):
        """Test GET /api/imports/status for non-existent importId"""
        print("\n🔍 Testing Import Status with invalid importId...")
        try:
            url = urljoin(self.base_url, '/api/imports/status?importId=non-existent-id-12345')
            response = self.session.get(url)
            
            if response.status_code == 404:
                print("✅ PASSED: Returns 404 for non-existent importId")
                return True
            else:
                print(f"❌ FAILED: Expected 404, got {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return False

    def test_import_status_missing_param(self):
        """Test GET /api/imports/status without importId parameter"""
        print("\n❓ Testing Import Status without importId parameter...")
        try:
            url = urljoin(self.base_url, '/api/imports/status')
            response = self.session.get(url)
            
            if response.status_code == 400 and 'importId required' in response.text:
                print("✅ PASSED: Validates missing importId parameter")
                return True
            else:
                print(f"❌ FAILED: Expected importId validation error, got {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all Cloud Import API tests"""
        print("🚀 Starting SoulPrint Cloud Import API Tests")
        print("=" * 60)
        
        # Authentication
        if not self.authenticate():
            print("❌ Cannot continue without authentication")
            return False
        
        # Track test results
        results = []
        
        # Test scenarios
        test_methods = [
            ("Authentication Required - Cloud Import", self.test_cloud_import_no_auth),
            ("Authentication Required - Import Status", self.test_import_status_no_auth),
            ("Validation - Missing URL", self.test_cloud_import_validation),
            ("Import Status - Missing Parameter", self.test_import_status_missing_param),
            ("Import Status - Invalid ID", self.test_import_status_invalid_id),
        ]
        
        # Run basic tests first
        for test_name, test_method in test_methods:
            try:
                result = test_method()
                results.append((test_name, result))
            except Exception as e:
                print(f"❌ {test_name} ERROR: {str(e)}")
                results.append((test_name, False))
        
        # Test import job creation and status polling
        print("\n" + "=" * 60)
        print("📋 Testing Import Job Flow...")
        
        # Test job creation
        import_id = self.test_cloud_import_creation()
        results.append(("Import Job Creation", import_id is not None))
        
        # Test status polling with the created job
        if import_id:
            status_result = self.test_import_status_polling(import_id)
            results.append(("Import Status Polling", status_result))
        else:
            results.append(("Import Status Polling", False))
        
        # Test Dropbox provider detection
        dropbox_id = self.test_cloud_import_dropbox_detection()
        results.append(("Dropbox Provider Detection", dropbox_id is not None))
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = 0
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{status}: {test_name}")
            if result:
                passed += 1
        
        print(f"\n📈 Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 All Cloud Import API tests PASSED!")
            return True
        else:
            print(f"⚠️ {total-passed} test(s) failed")
            return False

def main():
    """Main test execution"""
    print("SoulPrint Engine - Cloud Import API Test Suite")
    print(f"Testing against: {BASE_URL}")
    print(f"Test credentials: {TEST_CREDENTIALS['email']}")
    
    tester = CloudImportTester()
    success = tester.run_all_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())