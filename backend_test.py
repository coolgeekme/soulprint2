#!/usr/bin/env python3
"""
Backend API Testing for SoulPrint Engine - Announcement System & Feedback Fix
"""

import requests
import json
import sys
from urllib.parse import urljoin

# Configuration
BASE_URL = "https://personality-engine-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def make_request(method, endpoint, data=None, headers=None, token=None):
    """Make HTTP request with proper error handling"""
    url = urljoin(API_BASE + "/", endpoint)
    
    request_headers = {"Content-Type": "application/json"}
    if headers:
        request_headers.update(headers)
    if token:
        request_headers["Authorization"] = f"Bearer {token}"
    
    try:
        response = requests.request(
            method=method,
            url=url,
            json=data,
            headers=request_headers,
            timeout=30
        )
        
        print(f"{method} {url}")
        print(f"Status: {response.status_code}")
        
        # Try to parse JSON response
        try:
            json_response = response.json()
            print(f"Response: {json.dumps(json_response, indent=2)[:500]}...")
        except:
            print(f"Response Text: {response.text[:500]}...")
        
        return response
    except Exception as e:
        print(f"Request failed: {str(e)}")
        return None

def test_login():
    """Test user login"""
    print("\n" + "="*60)
    print("🔐 Testing Login (POST /api/auth/login)")
    print("="*60)
    
    login_data = {
        "email": "test@soulprint.com",
        "passcode": "test123"
    }
    
    response = make_request("POST", "auth/login", login_data)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "token" in data:
                print("✅ Login successful!")
                return data["token"]
            else:
                print("❌ Login failed - no token in response")
                return None
        except:
            print("❌ Login failed - invalid response format")
            return None
    else:
        print("❌ Login failed")
        return None

def test_admin_announcements(token):
    """Test admin announcement endpoints"""
    print("\n" + "="*60)
    print("📢 Testing Admin Announcement APIs")
    print("="*60)
    
    # Test 1: Create announcement
    print("\n1️⃣ Testing POST /api/admin/announcements (Create)")
    announcement_data = {
        "title": "Test Announcement",
        "content": "This is a test announcement with a link.",
        "type": "update",
        "link": "https://example.com",
        "published": True
    }
    
    response = make_request("POST", "admin/announcements", announcement_data, token=token)
    announcement_id = None
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if data.get("success") and "announcement" in data:
                announcement_id = data["announcement"]["id"]
                print("✅ Announcement created successfully!")
                print(f"   Announcement ID: {announcement_id}")
            else:
                print("❌ Create announcement failed - unexpected response")
        except:
            print("❌ Create announcement failed - invalid response")
    else:
        print("❌ Create announcement failed")
    
    # Test 2: Get all announcements
    print("\n2️⃣ Testing GET /api/admin/announcements (Get All)")
    
    response = make_request("GET", "admin/announcements", token=token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "announcements" in data:
                print(f"✅ Retrieved {len(data['announcements'])} announcements")
                # Verify our created announcement is in the list
                if announcement_id:
                    found = any(a.get("id") == announcement_id for a in data["announcements"])
                    if found:
                        print("✅ Created announcement found in list!")
                    else:
                        print("⚠️  Created announcement not found in list")
            else:
                print("❌ Get announcements failed - no announcements field")
        except:
            print("❌ Get announcements failed - invalid response")
    else:
        print("❌ Get announcements failed")
    
    # Test 3: Update announcement (unpublish)
    if announcement_id:
        print("\n3️⃣ Testing PUT /api/admin/announcements/:id (Update)")
        
        update_data = {"published": False}
        
        response = make_request("PUT", f"admin/announcements/{announcement_id}", update_data, token=token)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success"):
                    print("✅ Announcement updated successfully!")
                else:
                    print("❌ Update announcement failed - no success field")
            except:
                print("❌ Update announcement failed - invalid response")
        else:
            print("❌ Update announcement failed")
    else:
        print("\n3️⃣ Skipping update test (no announcement ID)")
    
    return announcement_id

def test_user_announcements(token):
    """Test user announcement endpoints"""
    print("\n" + "="*60)
    print("👤 Testing User Announcement APIs")
    print("="*60)
    
    # Test 1: Get published announcements
    print("\n1️⃣ Testing GET /api/announcements (Get Published)")
    
    response = make_request("GET", "announcements", token=token)
    
    announcement_id_to_dismiss = None
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if "announcements" in data and "unread" in data:
                print(f"✅ Retrieved announcements - Total: {len(data['announcements'])}, Unread: {len(data['unread'])}")
                
                # Get an announcement ID for dismissal test
                if data["announcements"]:
                    announcement_id_to_dismiss = data["announcements"][0]["id"]
                    print(f"   Will use announcement ID for dismiss test: {announcement_id_to_dismiss}")
            else:
                print("❌ Get announcements failed - missing required fields")
        except:
            print("❌ Get announcements failed - invalid response")
    else:
        print("❌ Get announcements failed")
    
    # Test 2: Dismiss announcement
    if announcement_id_to_dismiss:
        print("\n2️⃣ Testing POST /api/announcements/dismiss (Dismiss)")
        
        dismiss_data = {"announcementId": announcement_id_to_dismiss}
        
        response = make_request("POST", "announcements/dismiss", dismiss_data, token=token)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success"):
                    print("✅ Announcement dismissed successfully!")
                else:
                    print("❌ Dismiss announcement failed - no success field")
            except:
                print("❌ Dismiss announcement failed - invalid response")
        else:
            print("❌ Dismiss announcement failed")
    else:
        print("\n2️⃣ Skipping dismiss test (no announcement ID available)")

def test_user_feedback(token):
    """Test user feedback endpoint"""
    print("\n" + "="*60)
    print("💬 Testing User Feedback API")
    print("="*60)
    
    print("\n1️⃣ Testing POST /api/user-feedback (Submit Feedback)")
    
    feedback_data = {
        "message": "Great app!",
        "category": "general",
        "rating": 5
    }
    
    response = make_request("POST", "user-feedback", feedback_data, token=token)
    
    if response and response.status_code == 200:
        try:
            data = response.json()
            if data.get("success"):
                print("✅ Feedback submitted successfully!")
            else:
                print("❌ Submit feedback failed - no success field")
        except:
            print("❌ Submit feedback failed - invalid response")
    else:
        print("❌ Submit feedback failed")

def main():
    print("🚀 Starting SoulPrint Engine API Testing")
    print("🎯 Focus: Announcement System & Feedback APIs")
    print(f"🌐 Base URL: {BASE_URL}")
    
    # Step 1: Login to get token
    token = test_login()
    if not token:
        print("❌ Cannot proceed without authentication token")
        sys.exit(1)
    
    try:
        # Step 2: Test admin announcement APIs
        announcement_id = test_admin_announcements(token)
        
        # Step 3: Test user announcement APIs  
        test_user_announcements(token)
        
        # Step 4: Test user feedback API
        test_user_feedback(token)
        
    except Exception as e:
        print(f"❌ Testing failed with error: {str(e)}")
        sys.exit(1)
    
    print("\n" + "="*60)
    print("🎉 All API testing completed!")
    print("="*60)

if __name__ == "__main__":
    main()