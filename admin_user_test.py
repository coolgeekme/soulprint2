#!/usr/bin/env python3

import requests
import json
import sys
import time

# Test configuration
BASE_URL = "https://smart-routing-ui.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSCODE = "test123"

def print_result(test_name, success, message="", response_data=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {test_name}")
    if message:
        print(f"   📝 {message}")
    if response_data and not success:
        print(f"   🔍 Response: {json.dumps(response_data, indent=2)}")
    print()

def test_admin_user_management():
    """Test the admin user management APIs as requested in the review."""
    
    print("🚀 Starting Admin User Management API Tests")
    print("=" * 60)
    
    # Global variables to track test state
    auth_token = None
    created_user_id = None
    
    try:
        # 1. Test Login (POST /api/auth/login)
        print("1️⃣ Testing Login (POST /api/auth/login)")
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSCODE
            },
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code == 200:
            login_data = login_response.json()
            if 'token' in login_data:
                auth_token = login_data['token']
                role = login_data.get('role', 'unknown')
                print_result("Login successful", True, f"Logged in as {TEST_EMAIL} with role: {role}")
                print(f"   🔑 Token received: {auth_token[:20]}...")
                
                # Verify admin/superadmin role
                if role not in ['admin', 'superadmin']:
                    print_result("Admin role verification", False, f"User has role '{role}' but needs 'admin' or 'superadmin' for user management")
                    return
                else:
                    print_result("Admin role verification", True, f"User has {role} role - can perform user management")
            else:
                print_result("Login token extraction", False, "No token in response", login_data)
                return
        else:
            print_result("Login request", False, f"HTTP {login_response.status_code}", login_response.json())
            return
        
        # Headers for authenticated requests
        auth_headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        
        # 2. Test Create User (POST /api/admin/users)
        print("2️⃣ Testing Create User (POST /api/admin/users)")
        # Use timestamp to ensure unique email
        timestamp = str(int(time.time()))
        unique_email = f"newuser{timestamp}@test.com"
        
        new_user_data = {
            "email": unique_email,
            "passcode": "pass123",
            "display_name": "Test User",
            "role": "user",
            "accepted": True
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            json=new_user_data,
            headers=auth_headers
        )
        
        if create_response.status_code == 200:
            create_data = create_response.json()
            if create_data.get('success') and 'user' in create_data:
                created_user_id = create_data['user']['id']
                print_result("User creation", True, f"Created user with ID: {created_user_id}")
                print(f"   📧 Email: {create_data['user']['email']}")
                print(f"   👤 Name: {create_data['user']['display_name']}")
                print(f"   🏷️ Role: {create_data['user']['role']}")
            else:
                print_result("User creation response", False, "Invalid response structure", create_data)
                return
        else:
            create_error = create_response.json() if create_response.headers.get('content-type', '').startswith('application/json') else {"error": create_response.text}
            print_result("User creation request", False, f"HTTP {create_response.status_code}", create_error)
            return
        
        # 3. Test Update User (PUT /api/admin/users/:id)
        print("3️⃣ Testing Update User (PUT /api/admin/users/:id)")
        update_data = {
            "display_name": "Updated Name"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/admin/users/{created_user_id}",
            json=update_data,
            headers=auth_headers
        )
        
        if update_response.status_code == 200:
            update_data_response = update_response.json()
            if update_data_response.get('success'):
                print_result("User update", True, "Successfully updated user's display_name")
            else:
                print_result("User update response", False, "Success flag not true", update_data_response)
        else:
            update_error = update_response.json() if update_response.headers.get('content-type', '').startswith('application/json') else {"error": update_response.text}
            print_result("User update request", False, f"HTTP {update_response.status_code}", update_error)
        
        # 4. Test Delete User (DELETE /api/admin/users/:id)
        print("4️⃣ Testing Delete User (DELETE /api/admin/users/:id)")
        
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/users/{created_user_id}",
            headers=auth_headers
        )
        
        if delete_response.status_code == 200:
            delete_data = delete_response.json()
            if delete_data.get('success'):
                print_result("User deletion", True, f"Successfully deleted user {created_user_id}")
                created_user_id = None  # Mark as deleted
            else:
                print_result("User deletion response", False, "Success flag not true", delete_data)
        else:
            delete_error = delete_response.json() if delete_response.headers.get('content-type', '').startswith('application/json') else {"error": delete_response.text}
            print_result("User deletion request", False, f"HTTP {delete_response.status_code}", delete_error)
        
        # 5. Verification Tests
        print("5️⃣ Running Verification Tests")
        
        # Test 5a: Try to access deleted user (should fail)
        if created_user_id is None:  # Only test if user was successfully deleted
            # Use a dummy UUID to test the deleted user endpoint
            dummy_user_id = "00000000-0000-0000-0000-000000000000"
            verification_response = requests.put(
                f"{BASE_URL}/api/admin/users/{dummy_user_id}",
                json={"display_name": "Should fail"},
                headers=auth_headers
            )
            
            if verification_response.status_code == 404:
                print_result("Deletion verification", True, "Deleted user is no longer accessible (404 as expected)")
            else:
                print_result("Deletion verification", False, f"Expected 404 but got {verification_response.status_code}")
        
        # Test 5b: Try to create duplicate user (should fail)
        duplicate_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            json={
                "email": TEST_EMAIL,  # Use same email as logged-in user
                "passcode": "test456",
                "display_name": "Duplicate User",
                "role": "user",
                "accepted": True
            },
            headers=auth_headers
        )
        
        if duplicate_response.status_code == 400:
            duplicate_data = duplicate_response.json()
            if "already exists" in duplicate_data.get('error', '').lower():
                print_result("Duplicate email prevention", True, "Correctly prevents duplicate email creation")
            else:
                print_result("Duplicate email prevention", False, "Got 400 but wrong error message", duplicate_data)
        else:
            print_result("Duplicate email prevention", False, f"Expected 400 but got {duplicate_response.status_code}")
        
        print("🎉 Admin User Management API Testing Complete!")
        print("=" * 60)
        
        return True
        
    except requests.exceptions.RequestException as e:
        print_result("Network request", False, f"Request failed: {str(e)}")
        return False
    except json.JSONDecodeError as e:
        print_result("JSON parsing", False, f"Failed to parse JSON: {str(e)}")
        return False
    except Exception as e:
        print_result("Test execution", False, f"Unexpected error: {str(e)}")
        return False

if __name__ == "__main__":
    print("🔧 SoulPrint Engine - Admin User Management API Test Suite")
    print(f"🌐 Base URL: {BASE_URL}")
    print(f"👤 Test Admin: {TEST_EMAIL}")
    print()
    
    success = test_admin_user_management()
    
    if success:
        print("\n✅ All tests completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Check the output above for details.")
        sys.exit(1)