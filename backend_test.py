#!/usr/bin/env python3
"""
Backend API Testing Script for SoulPrint Engine
Tests the onboarding loop fix after backend field name correction
"""

import requests
import json
import sys
import time
import random
import string

# Base URL from environment
BASE_URL = "https://soulprint-engine.preview.emergentagent.com/api"

def generate_random_email():
    """Generate a random email for testing"""
    random_string = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"onboarding_test_{random_string}@test.com"

def test_onboarding_loop_fix():
    """
    Test the complete onboarding flow to verify users can complete onboarding without getting stuck in a loop.
    
    Test Flow:
    1. Create Test User - POST /api/auth/register
    2. Verify user created with onboarding_completed: false
    3. Complete Onboarding - PUT /api/user/profile
    4. Verify Flag Persists - GET /api/auth/me
    5. Verify Login Preserves Flag - POST /api/auth/login then GET /api/auth/me
    """
    
    print("\n" + "="*80)
    print("ONBOARDING LOOP FIX TEST - Backend Field Name Correction Verification")
    print("="*80)
    
    # Generate unique test credentials
    test_email = generate_random_email()
    test_passcode = "TestPass123!"
    test_token = None
    
    print(f"\n[TEST SETUP] Using test credentials:")
    print(f"  Email: {test_email}")
    print(f"  Passcode: {test_passcode}")
    
    # ========================================================================
    # STEP 1: Create Test User
    # ========================================================================
    print("\n" + "-"*80)
    print("STEP 1: Create Test User - POST /api/auth/register")
    print("-"*80)
    
    try:
        register_payload = {
            "email": test_email,
            "passcode": test_passcode
        }
        
        print(f"[REQUEST] POST {BASE_URL}/auth/register")
        print(f"[PAYLOAD] {json.dumps(register_payload, indent=2)}")
        
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json=register_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"[RESPONSE] Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[RESPONSE] Body: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            if 'token' in data and 'userId' in data:
                test_token = data['token']
                print(f"✅ STEP 1 PASSED: User created successfully")
                print(f"   - Token received: {test_token[:20]}...")
                print(f"   - User ID: {data['userId']}")
                
                # CRITICAL: Verify onboarding_completed is false
                if 'onboarding_completed' in data:
                    if data['onboarding_completed'] == False:
                        print(f"   ✅ onboarding_completed: false (CORRECT)")
                    else:
                        print(f"   ❌ onboarding_completed: {data['onboarding_completed']} (EXPECTED: false)")
                        return False
                else:
                    print(f"   ⚠️  onboarding_completed field missing in response")
            else:
                print(f"❌ STEP 1 FAILED: Missing token or userId in response")
                return False
        else:
            print(f"❌ STEP 1 FAILED: Registration failed with status {response.status_code}")
            print(f"[RESPONSE] {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ STEP 1 FAILED: Exception during registration: {str(e)}")
        return False
    
    # ========================================================================
    # STEP 2: Verify Initial Profile State
    # ========================================================================
    print("\n" + "-"*80)
    print("STEP 2: Verify Initial Profile State - GET /api/auth/me")
    print("-"*80)
    
    try:
        print(f"[REQUEST] GET {BASE_URL}/auth/me")
        print(f"[HEADERS] Authorization: Bearer {test_token[:20]}...")
        
        response = requests.get(
            f"{BASE_URL}/auth/me",
            headers={
                "Authorization": f"Bearer {test_token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        print(f"[RESPONSE] Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[RESPONSE] Body: {json.dumps(data, indent=2)}")
            
            # Verify profile exists and onboarding_completed is false
            if 'profile' in data and data['profile']:
                profile = data['profile']
                if 'onboarding_completed' in profile:
                    if profile['onboarding_completed'] == False:
                        print(f"✅ STEP 2 PASSED: Initial profile state correct")
                        print(f"   ✅ profile.onboarding_completed: false (CORRECT)")
                    else:
                        print(f"❌ STEP 2 FAILED: profile.onboarding_completed: {profile['onboarding_completed']} (EXPECTED: false)")
                        return False
                else:
                    print(f"❌ STEP 2 FAILED: onboarding_completed field missing in profile")
                    return False
            else:
                print(f"❌ STEP 2 FAILED: Profile missing in response")
                return False
        else:
            print(f"❌ STEP 2 FAILED: Auth/me failed with status {response.status_code}")
            print(f"[RESPONSE] {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ STEP 2 FAILED: Exception during auth/me: {str(e)}")
        return False
    
    # ========================================================================
    # STEP 3: Complete Onboarding
    # ========================================================================
    print("\n" + "-"*80)
    print("STEP 3: Complete Onboarding - PUT /api/user/profile")
    print("-"*80)
    
    try:
        profile_payload = {
            "display_name": "Loop Test User",
            "descriptors": ["Entrepreneur"],
            "field": "Tech",
            "help_with": ["Research"],
            "discovery_source": "Friend",
            "onboarding_completed": True
        }
        
        print(f"[REQUEST] PUT {BASE_URL}/user/profile")
        print(f"[HEADERS] Authorization: Bearer {test_token[:20]}...")
        print(f"[PAYLOAD] {json.dumps(profile_payload, indent=2)}")
        
        response = requests.put(
            f"{BASE_URL}/user/profile",
            json=profile_payload,
            headers={
                "Authorization": f"Bearer {test_token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        print(f"[RESPONSE] Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[RESPONSE] Body: {json.dumps(data, indent=2)}")
            
            if data.get('success') == True:
                print(f"✅ STEP 3 PASSED: Profile update successful")
                print(f"   - Onboarding marked as completed")
            else:
                print(f"❌ STEP 3 FAILED: Profile update did not return success")
                return False
        else:
            print(f"❌ STEP 3 FAILED: Profile update failed with status {response.status_code}")
            print(f"[RESPONSE] {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ STEP 3 FAILED: Exception during profile update: {str(e)}")
        return False
    
    # ========================================================================
    # STEP 4: Verify Flag Persists (CRITICAL)
    # ========================================================================
    print("\n" + "-"*80)
    print("STEP 4: Verify Flag Persists - GET /api/auth/me (CRITICAL TEST)")
    print("-"*80)
    
    try:
        print(f"[REQUEST] GET {BASE_URL}/auth/me")
        print(f"[HEADERS] Authorization: Bearer {test_token[:20]}...")
        
        # Add a small delay to ensure database write completes
        time.sleep(1)
        
        response = requests.get(
            f"{BASE_URL}/auth/me",
            headers={
                "Authorization": f"Bearer {test_token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        print(f"[RESPONSE] Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[RESPONSE] Body: {json.dumps(data, indent=2)}")
            
            # CRITICAL: Verify onboarding_completed is now true
            if 'profile' in data and data['profile']:
                profile = data['profile']
                if 'onboarding_completed' in profile:
                    if profile['onboarding_completed'] == True:
                        print(f"✅ STEP 4 PASSED: Onboarding flag persisted correctly")
                        print(f"   ✅ profile.onboarding_completed: true (CORRECT)")
                        print(f"   ✅ Field name matches and flag is saved")
                    else:
                        print(f"❌ STEP 4 FAILED: profile.onboarding_completed: {profile['onboarding_completed']} (EXPECTED: true)")
                        print(f"   ❌ CRITICAL BUG: Onboarding flag did not persist!")
                        return False
                else:
                    print(f"❌ STEP 4 FAILED: onboarding_completed field missing in profile")
                    return False
            else:
                print(f"❌ STEP 4 FAILED: Profile missing in response")
                return False
        else:
            print(f"❌ STEP 4 FAILED: Auth/me failed with status {response.status_code}")
            print(f"[RESPONSE] {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ STEP 4 FAILED: Exception during auth/me: {str(e)}")
        return False
    
    # ========================================================================
    # STEP 5: Verify Login Preserves Flag
    # ========================================================================
    print("\n" + "-"*80)
    print("STEP 5: Verify Login Preserves Flag - POST /api/auth/login")
    print("-"*80)
    
    try:
        login_payload = {
            "email": test_email,
            "passcode": test_passcode
        }
        
        print(f"[REQUEST] POST {BASE_URL}/auth/login")
        print(f"[PAYLOAD] {json.dumps(login_payload, indent=2)}")
        
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json=login_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"[RESPONSE] Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[RESPONSE] Body: {json.dumps(data, indent=2)}")
            
            if 'token' in data:
                new_token = data['token']
                print(f"✅ Login successful")
                print(f"   - New token received: {new_token[:20]}...")
                
                # Verify onboarding_completed in login response
                if 'onboarding_completed' in data:
                    if data['onboarding_completed'] == True:
                        print(f"   ✅ onboarding_completed: true in login response (CORRECT)")
                    else:
                        print(f"   ❌ onboarding_completed: {data['onboarding_completed']} in login response (EXPECTED: true)")
                        return False
                else:
                    print(f"   ⚠️  onboarding_completed field missing in login response")
                
                # Now verify with auth/me using new token
                print(f"\n[REQUEST] GET {BASE_URL}/auth/me (with new token)")
                print(f"[HEADERS] Authorization: Bearer {new_token[:20]}...")
                
                me_response = requests.get(
                    f"{BASE_URL}/auth/me",
                    headers={
                        "Authorization": f"Bearer {new_token}",
                        "Content-Type": "application/json"
                    },
                    timeout=30
                )
                
                print(f"[RESPONSE] Status: {me_response.status_code}")
                
                if me_response.status_code == 200:
                    me_data = me_response.json()
                    print(f"[RESPONSE] Body: {json.dumps(me_data, indent=2)}")
                    
                    if 'profile' in me_data and me_data['profile']:
                        profile = me_data['profile']
                        if 'onboarding_completed' in profile:
                            if profile['onboarding_completed'] == True:
                                print(f"✅ STEP 5 PASSED: Login preserves onboarding flag")
                                print(f"   ✅ profile.onboarding_completed: true after login (CORRECT)")
                            else:
                                print(f"❌ STEP 5 FAILED: profile.onboarding_completed: {profile['onboarding_completed']} after login (EXPECTED: true)")
                                return False
                        else:
                            print(f"❌ STEP 5 FAILED: onboarding_completed field missing in profile after login")
                            return False
                    else:
                        print(f"❌ STEP 5 FAILED: Profile missing in auth/me response after login")
                        return False
                else:
                    print(f"❌ STEP 5 FAILED: Auth/me failed with status {me_response.status_code}")
                    print(f"[RESPONSE] {me_response.text}")
                    return False
            else:
                print(f"❌ STEP 5 FAILED: Missing token in login response")
                return False
        else:
            print(f"❌ STEP 5 FAILED: Login failed with status {response.status_code}")
            print(f"[RESPONSE] {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ STEP 5 FAILED: Exception during login: {str(e)}")
        return False
    
    # ========================================================================
    # ALL TESTS PASSED
    # ========================================================================
    print("\n" + "="*80)
    print("✅ ALL ONBOARDING LOOP FIX TESTS PASSED")
    print("="*80)
    print("\n[SUCCESS SUMMARY]")
    print("  ✅ User registration shows onboarding_completed: false")
    print("  ✅ Profile update with onboarding_completed: true succeeds")
    print("  ✅ Profile GET returns onboarding_completed: true after update")
    print("  ✅ Login preserves onboarding_completed: true")
    print("  ✅ Field name is consistent throughout (always 'onboarding_completed' with 'd')")
    print("\n[CONCLUSION]")
    print("  The onboarding loop fix is working correctly. Users can complete")
    print("  onboarding without getting stuck in a loop. The field name mismatch")
    print("  has been resolved - all instances use 'onboarding_completed' (with 'd').")
    print("\n" + "="*80)
    
    return True

if __name__ == "__main__":
    try:
        success = test_onboarding_loop_fix()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
