#!/usr/bin/env python3
"""
Backend Test: Admin Delete User Functionality
Tests complete user deletion and re-registration with same email
"""

import requests
import json
import time
import sys
from pymongo import MongoClient
import os

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://soulprint-engine.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test-delete@example.com"
TEST_PASSCODE = "Test123!"
NEW_PASSCODE = "NewPass456!"

# Admin credentials (from test_result.md)
ADMIN_EMAIL = "test@soulprint.com"
ADMIN_PASSCODE = "test123"

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL')

def print_test(msg):
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_success(msg):
    print(f"✅ SUCCESS: {msg}")

def print_error(msg):
    print(f"❌ ERROR: {msg}")

def print_info(msg):
    print(f"ℹ️  INFO: {msg}")

def check_mongodb_deletion(email):
    """Check MongoDB directly to verify complete deletion"""
    try:
        client = MongoClient(MONGO_URL)
        db = client['soulprint']
        
        print_info(f"Checking MongoDB for email: {email}")
        
        # Check all collections that might have user data
        collections_to_check = [
            'users',
            'user_subscriptions',
            'subscriptions',
            'profiles',
            'conversations',
            'messages',
            'soul_profiles',
            'assessment_responses',
            'user_memories',
            'media_gallery',
            'imported_messages',
            'imported_data',
            'telegram_links',
            'user_feedback',
            'user_preferences',
            'communication_profiles',
            'video_jobs',
            'scheduled_tasks',
            'announcement_dismissals',
            'announcement_clicks',
            'imprints',
            'projects',
            'invite_codes'
        ]
        
        found_records = {}
        for collection_name in collections_to_check:
            try:
                collection = db[collection_name]
                # Check by email
                count_by_email = collection.count_documents({'email': email.lower()})
                if count_by_email > 0:
                    found_records[collection_name] = count_by_email
                    print_error(f"Found {count_by_email} records in {collection_name} with email={email}")
            except Exception as e:
                print_info(f"Could not check {collection_name}: {e}")
        
        client.close()
        
        if found_records:
            print_error(f"INCOMPLETE DELETION: Found records in {len(found_records)} collections")
            return False
        else:
            print_success("MongoDB verification: All records deleted")
            return True
            
    except Exception as e:
        print_error(f"MongoDB check failed: {e}")
        return None

def test_admin_delete_user():
    """
    Test Flow:
    1. Create test user
    2. Admin deletes user
    3. Verify complete deletion
    4. Re-register with same email
    5. Cleanup
    """
    
    test_user_id = None
    test_token = None
    admin_token = None
    new_user_id = None
    new_token = None
    
    try:
        # ============================================================
        # STEP 1: Create Test User
        # ============================================================
        print_test("Step 1: Create Test User")
        
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSCODE
            },
            headers={"Content-Type": "application/json"}
        )
        
        print_info(f"POST /api/auth/register - Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            test_token = data.get('token')
            test_user_id = data.get('userId')
            print_success(f"User created successfully - userId: {test_user_id}")
            print_info(f"Token: {test_token[:20]}...")
        else:
            print_error(f"Failed to create user: {response.text}")
            # If user already exists, try to get admin token and delete first
            if "already registered" in response.text.lower():
                print_info("User already exists, will try to delete first...")
                # Get admin token
                admin_response = requests.post(
                    f"{API_URL}/auth/login",
                    json={
                        "email": ADMIN_EMAIL,
                        "passcode": ADMIN_PASSCODE
                    },
                    headers={"Content-Type": "application/json"}
                )
                if admin_response.status_code == 200:
                    admin_token = admin_response.json().get('token')
                    # Get user list to find the user ID
                    users_response = requests.get(
                        f"{API_URL}/admin/users",
                        headers={"Authorization": f"Bearer {admin_token}"}
                    )
                    if users_response.status_code == 200:
                        users = users_response.json().get('users', [])
                        for user in users:
                            if user.get('email') == TEST_EMAIL.lower():
                                test_user_id = user.get('id')
                                print_info(f"Found existing user ID: {test_user_id}")
                                # Delete the user
                                delete_response = requests.delete(
                                    f"{API_URL}/admin/users/{test_user_id}",
                                    headers={"Authorization": f"Bearer {admin_token}"}
                                )
                                print_info(f"Cleanup delete status: {delete_response.status_code}")
                                time.sleep(2)
                                # Try registration again
                                response = requests.post(
                                    f"{API_URL}/auth/register",
                                    json={
                                        "email": TEST_EMAIL,
                                        "passcode": TEST_PASSCODE
                                    },
                                    headers={"Content-Type": "application/json"}
                                )
                                if response.status_code == 200:
                                    data = response.json()
                                    test_token = data.get('token')
                                    test_user_id = data.get('userId')
                                    print_success(f"User created after cleanup - userId: {test_user_id}")
                                else:
                                    print_error(f"Still failed after cleanup: {response.text}")
                                    return False
                                break
        
        if not test_user_id or not test_token:
            print_error("Could not create test user")
            return False
        
        time.sleep(1)
        
        # ============================================================
        # STEP 2: Admin Login and Delete User
        # ============================================================
        print_test("Step 2: Admin Login and Delete User")
        
        # Login as admin
        admin_response = requests.post(
            f"{API_URL}/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "passcode": ADMIN_PASSCODE
            },
            headers={"Content-Type": "application/json"}
        )
        
        print_info(f"POST /api/auth/login (admin) - Status: {admin_response.status_code}")
        
        if admin_response.status_code == 200:
            admin_token = admin_response.json().get('token')
            print_success("Admin login successful")
        else:
            print_error(f"Admin login failed: {admin_response.text}")
            return False
        
        time.sleep(1)
        
        # Delete the test user
        delete_response = requests.delete(
            f"{API_URL}/admin/users/{test_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        print_info(f"DELETE /api/admin/users/{test_user_id} - Status: {delete_response.status_code}")
        
        if delete_response.status_code == 200:
            data = delete_response.json()
            if data.get('success'):
                print_success("User deleted successfully")
            else:
                print_error(f"Delete returned success=false: {data}")
                return False
        else:
            print_error(f"Delete failed: {delete_response.text}")
            return False
        
        time.sleep(2)
        
        # ============================================================
        # STEP 3: Verify Complete Deletion
        # ============================================================
        print_test("Step 3: Verify Complete Deletion")
        
        # Check via API - user should not be in admin users list
        users_response = requests.get(
            f"{API_URL}/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        print_info(f"GET /api/admin/users - Status: {users_response.status_code}")
        
        if users_response.status_code == 200:
            users = users_response.json().get('users', [])
            found = False
            for user in users:
                if user.get('email') == TEST_EMAIL.lower():
                    found = True
                    print_error(f"User still found in admin list: {user}")
                    break
            
            if not found:
                print_success("User not found in admin users list")
            else:
                print_error("User still exists in admin list")
                return False
        else:
            print_error(f"Failed to get users list: {users_response.text}")
        
        # Check MongoDB directly
        if MONGO_URL:
            mongodb_clean = check_mongodb_deletion(TEST_EMAIL)
            if mongodb_clean is False:
                print_error("MongoDB still contains user records")
                return False
        else:
            print_info("MONGO_URL not available, skipping direct MongoDB check")
        
        time.sleep(1)
        
        # ============================================================
        # STEP 4: Re-register with Same Email (THE CRITICAL TEST)
        # ============================================================
        print_test("Step 4: Re-register with Same Email")
        
        reregister_response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": TEST_EMAIL,
                "passcode": NEW_PASSCODE
            },
            headers={"Content-Type": "application/json"}
        )
        
        print_info(f"POST /api/auth/register (re-registration) - Status: {reregister_response.status_code}")
        print_info(f"Response: {reregister_response.text}")
        
        if reregister_response.status_code == 200:
            data = reregister_response.json()
            new_token = data.get('token')
            new_user_id = data.get('userId')
            print_success(f"✅ RE-REGISTRATION SUCCESSFUL! New userId: {new_user_id}")
            print_success("BUG IS FIXED: User can re-register with same email after deletion")
        else:
            print_error(f"❌ RE-REGISTRATION FAILED: {reregister_response.text}")
            if "already registered" in reregister_response.text.lower():
                print_error("BUG STILL EXISTS: Email still marked as registered after deletion")
                return False
            else:
                print_error(f"Unexpected error during re-registration")
                return False
        
        time.sleep(1)
        
        # ============================================================
        # STEP 5: Cleanup - Delete the re-registered user
        # ============================================================
        print_test("Step 5: Cleanup")
        
        if new_user_id:
            cleanup_response = requests.delete(
                f"{API_URL}/admin/users/{new_user_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            print_info(f"DELETE /api/admin/users/{new_user_id} (cleanup) - Status: {cleanup_response.status_code}")
            if cleanup_response.status_code == 200:
                print_success("Cleanup successful - test user deleted")
            else:
                print_info(f"Cleanup delete status: {cleanup_response.status_code}")
        
        return True
        
    except Exception as e:
        print_error(f"Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("\n" + "="*80)
    print("ADMIN DELETE USER FUNCTIONALITY TEST")
    print("Testing complete user deletion and re-registration with same email")
    print("="*80)
    
    success = test_admin_delete_user()
    
    print("\n" + "="*80)
    if success:
        print("✅ ALL TESTS PASSED")
        print("="*80)
        sys.exit(0)
    else:
        print("❌ TESTS FAILED")
        print("="*80)
        sys.exit(1)
