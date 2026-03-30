#!/usr/bin/env python3
"""
Additional test for desktop video status polling path
Tests GET /api/media/video/status/:taskId (desktop path) vs GET /api/media/status/:taskId (mobile path)
"""

import requests
import json
import uuid

# Configuration
BASE_URL = "https://realtime-voice-beta.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

def login():
    """Login and get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "passcode": TEST_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        return data.get('token')
    return None

def get_headers(token):
    """Get headers with authentication"""
    return {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

def test_desktop_vs_mobile_status_paths():
    """Test both desktop and mobile status polling paths"""
    print("🧪 Testing Desktop vs Mobile Status Polling Paths")
    print("=" * 60)
    
    token = login()
    if not token:
        print("❌ Login failed")
        return False
    
    headers = get_headers(token)
    fake_task_id = str(uuid.uuid4())
    
    # Test mobile path: GET /api/media/status/:taskId
    print("📱 Testing mobile path: GET /api/media/status/:taskId")
    mobile_response = requests.get(f"{BASE_URL}/api/media/status/{fake_task_id}", headers=headers)
    print(f"   Status: {mobile_response.status_code}")
    if mobile_response.status_code == 200:
        print(f"   Response: {mobile_response.json()}")
    elif mobile_response.status_code == 404:
        print("   Response: 404 (expected for non-existent task)")
    
    # Test desktop path: GET /api/media/video/status/:taskId  
    print("🖥️  Testing desktop path: GET /api/media/video/status/:taskId")
    desktop_response = requests.get(f"{BASE_URL}/api/media/video/status/{fake_task_id}", headers=headers)
    print(f"   Status: {desktop_response.status_code}")
    if desktop_response.status_code == 200:
        print(f"   Response: {desktop_response.json()}")
    elif desktop_response.status_code == 404:
        print("   Response: 404 (expected for non-existent task)")
    
    # Compare responses
    if mobile_response.status_code == desktop_response.status_code:
        print("✅ Both paths return same status code - PASSED")
        
        if mobile_response.status_code == 200:
            mobile_data = mobile_response.json()
            desktop_data = desktop_response.json()
            if mobile_data == desktop_data:
                print("✅ Both paths return identical response data - PASSED")
                return True
            else:
                print("❌ Response data differs between paths - FAILED")
                print(f"   Mobile: {mobile_data}")
                print(f"   Desktop: {desktop_data}")
                return False
        else:
            print("✅ Both paths handle non-existent tasks identically - PASSED")
            return True
    else:
        print("❌ Status codes differ between paths - FAILED")
        print(f"   Mobile: {mobile_response.status_code}")
        print(f"   Desktop: {desktop_response.status_code}")
        return False

if __name__ == "__main__":
    success = test_desktop_vs_mobile_status_paths()
    print(f"\n{'✅ PASSED' if success else '❌ FAILED'}: Desktop and mobile status polling paths")
    exit(0 if success else 1)