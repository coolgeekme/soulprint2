#!/usr/bin/env python3
"""
Backend Test: Onboarding Flow
Tests that new users go through complete onboarding process before accessing chat
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
TEST_EMAIL = "test-onboard@example.com"
TEST_PASSCODE = "Test123!"

# Admin credentials for cleanup
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

def cleanup_test_user(email):
    """Delete test user via admin API"""
    try:
        # Login as admin
        admin_response = requests.post(
            f"{API_URL}/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "passcode": ADMIN_PASSCODE
            },
            headers={"Content-Type": "application/json"}
        )
        
        if admin_response.status_code != 200:
            print_info(f"Admin login failed: {admin_response.status_code}")
            return False
        
        admin_token = admin_response.json().get('token')
        
        # Get user list to find the user ID
        users_response = requests.get(
            f"{API_URL}/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if users_response.status_code != 200:
            print_info(f"Failed to get users list: {users_response.status_code}")
            return False
        
        users = users_response.json().get('users', [])
        user_id = None
        for user in users:
            if user.get('email') == email.lower():
                user_id = user.get('id')
                break
        
        if not user_id:
            print_info(f"User {email} not found in admin list")
            return True
        
        # Delete the user
        delete_response = requests.delete(
            f"{API_URL}/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if delete_response.status_code == 200:
            print_success(f"Cleanup: Deleted test user {email}")
            return True
        else:
            print_info(f"Cleanup delete status: {delete_response.status_code}")
            return False
            
    except Exception as e:
        print_info(f"Cleanup failed: {e}")
        return False

def test_onboarding_flow():
    """
    Test Flow:
    1. Register New User
    2. Check Profile Status (onboarding_completed should be false)
    3. Complete Onboarding
    4. Verify Onboarding Status After (should be true)
    5. Cleanup
    """
    
    test_token = None
    test_user_id = None
    
    try:
        # Cleanup any existing test user first
        print_info("Pre-test cleanup: Removing any existing test user...")
        cleanup_test_user(TEST_EMAIL)
        time.sleep(2)
        
        # ============================================================
        # STEP 1: Register New User
        # ============================================================
        print_test("Step 1: Register New User")
        
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSCODE
            },
            headers={"Content-Type": "application/json"}
        )
        
        print_info(f"POST /api/auth/register - Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            test_token = data.get('token')
            test_user_id = data.get('userId')
            onboarding_complete = data.get('onboarding_complete')
            
            print_success(f"User created successfully - userId: {test_user_id}")
            print_info(f"Token: {test_token[:20]}...")
            print_info(f"onboarding_complete in response: {onboarding_complete}")
            
            # Verify onboarding_complete is false in registration response
            if onboarding_complete == False:
                print_success("✅ Registration response correctly shows onboarding_complete: false")
            else:
                print_error(f"❌ Registration response has onboarding_complete: {onboarding_complete} (expected: false)")
                return False
        else:
            print_error(f"Failed to create user: {response.text}")
            return False
        
        if not test_user_id or not test_token:
            print_error("Could not create test user")
            return False
        
        time.sleep(1)
        
        # ============================================================
        # STEP 2: Check Profile Status
        # ============================================================
        print_test("Step 2: Check Profile Status")
        
        profile_response = requests.get(
            f"{API_URL}/auth/me",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        
        print_info(f"GET /api/auth/me - Status: {profile_response.status_code}")
        print_info(f"Response: {profile_response.text}")
        
        if profile_response.status_code == 200:
            profile_data = profile_response.json()
            profile = profile_data.get('profile', {})
            onboarding_complete = profile.get('onboarding_complete')
            
            print_success("Profile retrieved successfully")
            print_info(f"Profile data: {json.dumps(profile, indent=2)}")
            
            # Critical Check: onboarding_complete should be false for new users
            if onboarding_complete == False or onboarding_complete is None:
                print_success("✅ CRITICAL CHECK PASSED: New user has onboarding_complete=false (or not set)")
            else:
                print_error(f"❌ CRITICAL CHECK FAILED: New user has onboarding_complete={onboarding_complete} (expected: false)")
                return False
        else:
            print_error(f"Failed to get profile: {profile_response.text}")
            return False
        
        time.sleep(1)
        
        # ============================================================
        # STEP 3: Complete Onboarding
        # ============================================================
        print_test("Step 3: Complete Onboarding")
        
        onboarding_data = {
            "display_name": "Test User",
            "descriptors": ["Entrepreneur"],
            "field": "Tech",
            "help_with": ["Research & Analysis"],
            "discovery_source": "Friend / Referral",
            "onboarding_complete": True
        }
        
        update_response = requests.put(
            f"{API_URL}/profile",
            json=onboarding_data,
            headers={
                "Authorization": f"Bearer {test_token}",
                "Content-Type": "application/json"
            }
        )
        
        print_info(f"PUT /api/profile - Status: {update_response.status_code}")
        print_info(f"Request body: {json.dumps(onboarding_data, indent=2)}")
        print_info(f"Response: {update_response.text}")
        
        if update_response.status_code == 200:
            update_data = update_response.json()
            if update_data.get('success'):
                print_success("✅ Profile updated successfully")
            else:
                print_error(f"Profile update returned success=false: {update_data}")
                return False
        else:
            print_error(f"Failed to update profile: {update_response.text}")
            return False
        
        time.sleep(1)
        
        # ============================================================
        # STEP 4: Verify Onboarding Status After
        # ============================================================
        print_test("Step 4: Verify Onboarding Status After")
        
        verify_response = requests.get(
            f"{API_URL}/auth/me",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        
        print_info(f"GET /api/auth/me - Status: {verify_response.status_code}")
        print_info(f"Response: {verify_response.text}")
        
        if verify_response.status_code == 200:
            verify_data = verify_response.json()
            profile = verify_data.get('profile', {})
            onboarding_complete = profile.get('onboarding_complete')
            display_name = profile.get('display_name')
            descriptors = profile.get('descriptors')
            field = profile.get('field')
            help_with = profile.get('help_with')
            discovery_source = profile.get('discovery_source')
            
            print_success("Profile retrieved successfully")
            print_info(f"Profile data: {json.dumps(profile, indent=2)}")
            
            # Critical Check: onboarding_complete should NOW be true
            if onboarding_complete == True:
                print_success("✅ CRITICAL CHECK PASSED: onboarding_complete is NOW true")
            else:
                print_error(f"❌ CRITICAL CHECK FAILED: onboarding_complete={onboarding_complete} (expected: true)")
                return False
            
            # Verify all onboarding data was saved
            all_data_saved = True
            if display_name != "Test User":
                print_error(f"display_name mismatch: {display_name} (expected: Test User)")
                all_data_saved = False
            if descriptors != ["Entrepreneur"]:
                print_error(f"descriptors mismatch: {descriptors} (expected: ['Entrepreneur'])")
                all_data_saved = False
            if field != "Tech":
                print_error(f"field mismatch: {field} (expected: Tech)")
                all_data_saved = False
            if help_with != ["Research & Analysis"]:
                print_error(f"help_with mismatch: {help_with} (expected: ['Research & Analysis'])")
                all_data_saved = False
            if discovery_source != "Friend / Referral":
                print_error(f"discovery_source mismatch: {discovery_source} (expected: Friend / Referral)")
                all_data_saved = False
            
            if all_data_saved:
                print_success("✅ All onboarding data saved correctly")
            else:
                print_error("❌ Some onboarding data was not saved correctly")
                return False
        else:
            print_error(f"Failed to verify profile: {verify_response.text}")
            return False
        
        time.sleep(1)
        
        # ============================================================
        # STEP 5: Cleanup
        # ============================================================
        print_test("Step 5: Cleanup")
        
        cleanup_success = cleanup_test_user(TEST_EMAIL)
        if cleanup_success:
            print_success("Cleanup successful - test user deleted")
        else:
            print_info("Cleanup may have failed - manual cleanup may be needed")
        
        return True
        
    except Exception as e:
        print_error(f"Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        
        # Attempt cleanup even on failure
        if test_user_id:
            print_info("Attempting cleanup after failure...")
            cleanup_test_user(TEST_EMAIL)
        
        return False

if __name__ == "__main__":
    print("\n" + "="*80)
    print("ONBOARDING FLOW BACKEND TEST")
    print("Testing that new users go through complete onboarding process")
    print("="*80)
    
    success = test_onboarding_flow()
    
    print("\n" + "="*80)
    if success:
        print("✅ ALL TESTS PASSED")
        print("="*80)
        print("\nSUMMARY:")
        print("✅ New users are created with onboarding_complete=false")
        print("✅ Profile endpoint correctly returns onboarding status")
        print("✅ Onboarding data can be saved via PUT /api/profile")
        print("✅ onboarding_complete flag is properly set to true after completion")
        print("✅ Backend properly stores and returns the onboarding flag")
        sys.exit(0)
    else:
        print("❌ TESTS FAILED")
        print("="*80)
        sys.exit(1)
