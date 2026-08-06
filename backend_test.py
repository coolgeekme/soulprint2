#!/usr/bin/env python3
"""
Backend API Testing Script for Onboarding Loop Fix
Tests the complete onboarding flow to verify field name consistency
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BASE_URL = "https://soulprint-engine.preview.emergentagent.com/api"

def print_test_header(test_name):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    return success

def test_onboarding_loop_fix():
    """
    Test the onboarding loop fix to ensure users can complete onboarding
    without getting stuck in a redirect loop.
    
    Issue: Onboarding page was setting onboarding_complete (no 'd')
           Chat page was checking for onboarding_completed (with 'd')
           Field name mismatch caused the loop
    
    Fix: Changed onboarding page to set onboarding_completed (with 'd')
    
    Test Flow:
    1. Create test user via POST /api/auth/register
    2. Check initial onboarding status via GET /api/user/profile
    3. Complete onboarding via PUT /api/user/profile with onboarding_completed=true
    4. Verify flag is saved via GET /api/user/profile again
    """
    
    print_test_header("Onboarding Loop Fix - Field Name Consistency Test")
    
    # Generate unique test email
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    test_email = f"test-onboarding-{timestamp}@example.com"
    test_passcode = "Test123456!"
    
    all_tests_passed = True
    token = None
    user_id = None
    
    try:
        # Step 1: Create Test User
        print_test_header("Step 1: Create Test User")
        print(f"Creating user: {test_email}")
        
        register_response = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": test_email,
                "passcode": test_passcode
            },
            timeout=30
        )
        
        print(f"Status Code: {register_response.status_code}")
        print(f"Response: {json.dumps(register_response.json(), indent=2)}")
        
        if register_response.status_code == 200:
            data = register_response.json()
            token = data.get('token')
            user_id = data.get('userId')
            
            # Check if response includes onboarding_complete field (backend uses this)
            has_onboarding_complete = 'onboarding_complete' in data
            # Check if response includes onboarding_completed field (frontend expects this)
            has_onboarding_completed = 'onboarding_completed' in data
            
            print(f"\n🔍 Field Name Analysis:")
            print(f"   - Response has 'onboarding_complete' (no 'd'): {has_onboarding_complete}")
            print(f"   - Response has 'onboarding_completed' (with 'd'): {has_onboarding_completed}")
            
            if has_onboarding_complete and not has_onboarding_completed:
                print(f"\n⚠️  MISMATCH DETECTED: Backend returns 'onboarding_complete' but frontend expects 'onboarding_completed'")
                all_tests_passed = False
            
            all_tests_passed &= print_result(
                token is not None and user_id is not None,
                f"User created successfully with token and userId"
            )
        else:
            all_tests_passed &= print_result(False, f"Failed to create user: {register_response.text}")
            return all_tests_passed
        
        # Step 2: Check Initial Onboarding Status
        print_test_header("Step 2: Check Initial Onboarding Status via GET /api/auth/me")
        
        me_response = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        print(f"Status Code: {me_response.status_code}")
        print(f"Response: {json.dumps(me_response.json(), indent=2)}")
        
        if me_response.status_code == 200:
            data = me_response.json()
            profile = data.get('profile', {})
            
            # Check which field name is used in the response
            has_onboarding_complete = 'onboarding_complete' in profile
            has_onboarding_completed = 'onboarding_completed' in profile
            
            print(f"\n🔍 Field Name Analysis in Profile:")
            print(f"   - Profile has 'onboarding_complete' (no 'd'): {has_onboarding_complete}")
            print(f"   - Profile has 'onboarding_completed' (with 'd'): {has_onboarding_completed}")
            
            if has_onboarding_complete:
                onboarding_status = profile.get('onboarding_complete')
                print(f"   - onboarding_complete value: {onboarding_status}")
            
            if has_onboarding_completed:
                onboarding_status = profile.get('onboarding_completed')
                print(f"   - onboarding_completed value: {onboarding_status}")
            
            if has_onboarding_complete and not has_onboarding_completed:
                print(f"\n⚠️  CRITICAL ISSUE: Backend returns 'onboarding_complete' but frontend checks for 'onboarding_completed'")
                print(f"   This will cause the onboarding loop because:")
                print(f"   1. Frontend sends 'onboarding_completed: true' (line 82 in onboarding/page.js)")
                print(f"   2. Backend doesn't recognize it (line 421 in auth-handlers.js looks for 'onboarding_complete')")
                print(f"   3. Chat page checks 'onboarding_completed' (line 569 in chat/page.js)")
                print(f"   4. Backend returns 'onboarding_complete', so frontend never sees the flag as true")
                all_tests_passed = False
            
            all_tests_passed &= print_result(
                me_response.status_code == 200,
                "Profile retrieved successfully"
            )
        else:
            all_tests_passed &= print_result(False, f"Failed to get profile: {me_response.text}")
            return all_tests_passed
        
        # Step 3: Complete Onboarding with onboarding_completed (with 'd')
        print_test_header("Step 3: Complete Onboarding via PUT /api/user/profile")
        print("Sending onboarding_completed: true (with 'd' at end)")
        
        profile_update_response = requests.put(
            f"{BASE_URL}/user/profile",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "display_name": "Test User",
                "descriptors": ["Entrepreneur"],
                "field": "Tech",
                "help_with": ["Research & Analysis"],
                "discovery_source": "Friend / Referral",
                "onboarding_completed": True  # Frontend sends this (with 'd')
            },
            timeout=30
        )
        
        print(f"Status Code: {profile_update_response.status_code}")
        print(f"Response: {json.dumps(profile_update_response.json(), indent=2)}")
        
        all_tests_passed &= print_result(
            profile_update_response.status_code == 200,
            "Profile update request completed"
        )
        
        # Step 4: Verify Onboarding Flag is Saved
        print_test_header("Step 4: Verify Onboarding Flag is Saved via GET /api/auth/me")
        
        verify_response = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        print(f"Status Code: {verify_response.status_code}")
        print(f"Response: {json.dumps(verify_response.json(), indent=2)}")
        
        if verify_response.status_code == 200:
            data = verify_response.json()
            profile = data.get('profile', {})
            
            # Check which field name is present and its value
            has_onboarding_complete = 'onboarding_complete' in profile
            has_onboarding_completed = 'onboarding_completed' in profile
            
            onboarding_complete_value = profile.get('onboarding_complete')
            onboarding_completed_value = profile.get('onboarding_completed')
            
            print(f"\n🔍 Critical Check - Field Name and Value After Update:")
            print(f"   - Profile has 'onboarding_complete' (no 'd'): {has_onboarding_complete}")
            if has_onboarding_complete:
                print(f"     Value: {onboarding_complete_value}")
            
            print(f"   - Profile has 'onboarding_completed' (with 'd'): {has_onboarding_completed}")
            if has_onboarding_completed:
                print(f"     Value: {onboarding_completed_value}")
            
            # The critical test: Did the flag get saved correctly?
            if has_onboarding_completed and onboarding_completed_value == True:
                print(f"\n✅ SUCCESS: onboarding_completed flag is TRUE - Loop fix is working!")
                all_tests_passed &= print_result(True, "Onboarding flag correctly saved and retrieved with 'd' at end")
            elif has_onboarding_complete and onboarding_complete_value == True:
                print(f"\n⚠️  PARTIAL: Backend saved to 'onboarding_complete' (no 'd') instead of 'onboarding_completed' (with 'd')")
                print(f"   This means:")
                print(f"   - Backend accepted the update but stored it in the wrong field")
                print(f"   - Frontend will still see onboarding_completed as undefined/false")
                print(f"   - User will be stuck in onboarding loop")
                all_tests_passed = False
            else:
                print(f"\n❌ FAILURE: Onboarding flag was NOT saved correctly")
                print(f"   - Frontend sent: onboarding_completed=true (with 'd')")
                print(f"   - Backend returned: onboarding_complete={onboarding_complete_value} (no 'd')")
                print(f"   - This confirms the field name mismatch bug")
                all_tests_passed = False
            
            # Verify other profile fields were saved
            if profile.get('display_name') == 'Test User':
                all_tests_passed &= print_result(True, "Display name saved correctly")
            else:
                all_tests_passed &= print_result(False, f"Display name not saved correctly: {profile.get('display_name')}")
        else:
            all_tests_passed &= print_result(False, f"Failed to verify profile: {verify_response.text}")
        
        # Step 5: Test with onboarding_complete (no 'd') to see if backend accepts it
        print_test_header("Step 5: Test Backend Field Name - Try onboarding_complete (no 'd')")
        print("Sending onboarding_complete: false (no 'd' at end) to test backend compatibility")
        
        profile_update_no_d_response = requests.put(
            f"{BASE_URL}/user/profile",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "onboarding_complete": False  # Backend expects this (no 'd')
            },
            timeout=30
        )
        
        print(f"Status Code: {profile_update_no_d_response.status_code}")
        
        # Verify if backend accepted it
        verify_no_d_response = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if verify_no_d_response.status_code == 200:
            data = verify_no_d_response.json()
            profile = data.get('profile', {})
            
            onboarding_complete_value = profile.get('onboarding_complete')
            
            print(f"\n🔍 Backend Field Name Test:")
            print(f"   - Sent: onboarding_complete=false (no 'd')")
            print(f"   - Backend returned: onboarding_complete={onboarding_complete_value}")
            
            if onboarding_complete_value == False:
                print(f"\n✅ CONFIRMED: Backend ONLY accepts 'onboarding_complete' (no 'd')")
                print(f"   This proves the field name mismatch:")
                print(f"   - Frontend sends: onboarding_completed (with 'd')")
                print(f"   - Backend expects: onboarding_complete (no 'd')")
                print(f"   - Result: Frontend updates are ignored, causing the loop")
            else:
                print(f"\n⚠️  Unexpected result: {onboarding_complete_value}")
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        all_tests_passed = False
    
    # Summary
    print_test_header("TEST SUMMARY")
    if all_tests_passed:
        print("✅ ALL TESTS PASSED - Onboarding loop fix is working correctly")
        print("   Field name consistency verified between frontend and backend")
    else:
        print("❌ TESTS FAILED - Onboarding loop bug still exists")
        print("\n🔧 ROOT CAUSE:")
        print("   Field name mismatch between frontend and backend:")
        print("   - Frontend (onboarding/page.js line 82): sends 'onboarding_completed' (with 'd')")
        print("   - Frontend (chat/page.js line 569): checks 'onboarding_completed' (with 'd')")
        print("   - Backend (auth-handlers.js line 421): expects 'onboarding_complete' (no 'd')")
        print("   - Backend (auth-handlers.js line 431): updates 'onboarding_complete' (no 'd')")
        print("\n🔧 FIX REQUIRED:")
        print("   Backend needs to be updated to use 'onboarding_completed' (with 'd') to match frontend")
        print("   Files to update:")
        print("   - /app/lib/handlers/auth-handlers.js (lines 115, 157, 201, 343, 367, 403, 421, 431)")
        print("   Change all instances of 'onboarding_complete' to 'onboarding_completed'")
    
    return all_tests_passed

if __name__ == "__main__":
    try:
        success = test_onboarding_loop_fix()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
