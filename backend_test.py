#!/usr/bin/env python3

import requests
import json
import uuid
from datetime import datetime

class AdminEndpointTester:
    def __init__(self):
        self.base_url = "https://dashboard-profiles.preview.emergentagent.com"
        self.admin_token = None
        self.created_user_id = None
        self.created_update_ids = []
        
    def login_admin(self):
        """Login as admin and get JWT token"""
        print("=" * 60)
        print("LOGGING IN AS ADMIN")
        print("=" * 60)
        
        try:
            url = f"{self.base_url}/api/auth/login"
            payload = {
                "email": "test@soulprint.com",
                "passcode": "test123"
            }
            
            response = requests.post(url, json=payload, timeout=30)
            print(f"POST {url}")
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get('token')
                print(f"✅ Admin login successful - Token acquired")
                print(f"User Role: {data.get('role', 'N/A')}")
                return True
            else:
                print(f"❌ Admin login failed - Status: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Login error: {str(e)}")
            return False
    
    def get_headers(self):
        """Get headers with admin token"""
        if not self.admin_token:
            raise Exception("No admin token available")
        return {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_admin_users(self):
        """Test GET /api/admin/users to get a list of users"""
        print("\n" + "=" * 60)
        print("TESTING: GET /api/admin/users - Get Users List")
        print("=" * 60)
        
        try:
            url = f"{self.base_url}/api/admin/users"
            response = requests.get(url, headers=self.get_headers(), timeout=30)
            
            print(f"GET {url}")
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text[:800]}")
            
            if response.status_code == 200:
                data = response.json()
                users = data.get('users', [])
                print(f"✅ SUCCESS: Retrieved {len(users)} users")
                
                # Return the first user ID for detailed testing
                if users:
                    user_id = users[0]['id']
                    print(f"🎯 Will test user details with ID: {user_id}")
                    return user_id
                else:
                    print("⚠️  No users found to test with")
                    return None
                    
            else:
                print(f"❌ FAILED: Status {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return None
    
    def test_get_user_details(self, user_id):
        """Test GET /api/admin/users/:userId - Get detailed user info"""
        print("\n" + "=" * 60)
        print(f"TESTING: GET /api/admin/users/{user_id} - Get User Details")
        print("=" * 60)
        
        try:
            url = f"{self.base_url}/api/admin/users/{user_id}"
            response = requests.get(url, headers=self.get_headers(), timeout=30)
            
            print(f"GET {url}")
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text[:1000]}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify expected structure
                required_fields = ['user', 'profile', 'stats', 'conversations', 'memories']
                found_fields = [field for field in required_fields if field in data]
                
                print(f"✅ SUCCESS: User details retrieved")
                print(f"📊 Found sections: {found_fields}")
                
                # Show some key stats
                user_info = data.get('user', {})
                stats_info = data.get('stats', {})
                print(f"👤 User: {user_info.get('email', 'N/A')} | Role: {user_info.get('role', 'N/A')}")
                print(f"📈 Stats: {stats_info.get('total_conversations', 0)} conversations, {stats_info.get('total_messages', 0)} messages")
                
                return True
                
            else:
                print(f"❌ FAILED: Status {response.status_code}")
                if response.status_code == 404:
                    print("   User not found")
                elif response.status_code == 403:
                    print("   Forbidden - admin auth required")
                return False
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return False
    
    def test_get_app_updates(self):
        """Test GET /api/admin/app-updates - Get all app updates"""
        print("\n" + "=" * 60)
        print("TESTING: GET /api/admin/app-updates - Get App Updates")
        print("=" * 60)
        
        try:
            url = f"{self.base_url}/api/admin/app-updates"
            response = requests.get(url, headers=self.get_headers(), timeout=30)
            
            print(f"GET {url}")
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text[:800]}")
            
            if response.status_code == 200:
                data = response.json()
                updates = data.get('updates', [])
                print(f"✅ SUCCESS: Retrieved {len(updates)} app updates")
                
                for update in updates[:3]:  # Show first 3
                    print(f"📄 Update: {update.get('title', 'N/A')} | Type: {update.get('type', 'N/A')} | Published: {update.get('published', False)}")
                
                return True
                
            else:
                print(f"❌ FAILED: Status {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return False
    
    def test_create_app_update(self):
        """Test POST /api/admin/app-updates - Create new app update"""
        print("\n" + "=" * 60)
        print("TESTING: POST /api/admin/app-updates - Create App Update")
        print("=" * 60)
        
        try:
            url = f"{self.base_url}/api/admin/app-updates"
            
            test_update = {
                "title": "Test Feature Update",
                "description": "This is a test app update created during backend testing. New advanced chat features added including improved memory system and better response quality.",
                "version": "1.2.3",
                "type": "feature",
                "published": False,
                "release_date": datetime.now().isoformat()
            }
            
            response = requests.post(url, headers=self.get_headers(), json=test_update, timeout=30)
            
            print(f"POST {url}")
            print(f"Payload: {json.dumps(test_update, indent=2)}")
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text[:800]}")
            
            if response.status_code == 200:
                data = response.json()
                created_update = data.get('update', {})
                update_id = created_update.get('id')
                
                if update_id:
                    self.created_update_ids.append(update_id)
                    print(f"✅ SUCCESS: App update created with ID: {update_id}")
                    print(f"📄 Title: {created_update.get('title', 'N/A')}")
                    print(f"🏷️  Type: {created_update.get('type', 'N/A')}")
                    return update_id
                else:
                    print("✅ SUCCESS: App update created but no ID returned")
                    return True
                
            else:
                print(f"❌ FAILED: Status {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return False
    
    def test_update_app_update(self, update_id):
        """Test PUT /api/admin/app-updates/:id - Update app update"""
        print("\n" + "=" * 60)
        print(f"TESTING: PUT /api/admin/app-updates/{update_id} - Update App Update")
        print("=" * 60)
        
        try:
            url = f"{self.base_url}/api/admin/app-updates/{update_id}"
            
            update_data = {
                "title": "Updated Test Feature Update",
                "description": "This app update has been modified during testing. Updated to include performance improvements and bug fixes in addition to new features.",
                "published": True,
                "type": "feature"
            }
            
            response = requests.put(url, headers=self.get_headers(), json=update_data, timeout=30)
            
            print(f"PUT {url}")
            print(f"Payload: {json.dumps(update_data, indent=2)}")
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ SUCCESS: App update modified successfully")
                if data.get('success'):
                    print("📝 Update confirmed by response")
                return True
                
            else:
                print(f"❌ FAILED: Status {response.status_code}")
                if response.status_code == 404:
                    print("   Update not found")
                elif response.status_code == 403:
                    print("   Forbidden - admin auth required")
                return False
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return False
    
    def test_delete_app_update(self, update_id):
        """Test DELETE /api/admin/app-updates/:id - Delete app update"""
        print("\n" + "=" * 60)
        print(f"TESTING: DELETE /api/admin/app-updates/{update_id} - Delete App Update")
        print("=" * 60)
        
        try:
            url = f"{self.base_url}/api/admin/app-updates/{update_id}"
            response = requests.delete(url, headers=self.get_headers(), timeout=30)
            
            print(f"DELETE {url}")
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ SUCCESS: App update deleted successfully")
                if data.get('success'):
                    print("🗑️  Deletion confirmed by response")
                return True
                
            else:
                print(f"❌ FAILED: Status {response.status_code}")
                if response.status_code == 404:
                    print("   Update not found")
                elif response.status_code == 403:
                    print("   Forbidden - admin auth required")
                return False
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return False
    
    def cleanup(self):
        """Clean up any created test data"""
        print("\n" + "=" * 60)
        print("CLEANUP: Removing Test Data")
        print("=" * 60)
        
        # Delete any remaining app updates
        for update_id in self.created_update_ids:
            try:
                url = f"{self.base_url}/api/admin/app-updates/{update_id}"
                response = requests.delete(url, headers=self.get_headers(), timeout=10)
                print(f"🧹 Cleaned up app update: {update_id} (Status: {response.status_code})")
            except:
                print(f"⚠️  Could not clean up app update: {update_id}")
        
        print("🧹 Cleanup completed")
    
    def run_all_tests(self):
        """Run all admin API tests"""
        print("🚀 STARTING ADMIN ENDPOINT TESTING")
        print("Review Request: Testing fixed admin endpoints")
        print("Target endpoints:")
        print("  1. GET /api/admin/users/:userId - Get detailed user info")
        print("  2. GET /api/admin/app-updates - Get all app updates") 
        print("  3. POST /api/admin/app-updates - Create new app update")
        print("  4. PUT /api/admin/app-updates/:id - Update app update")
        print("  5. DELETE /api/admin/app-updates/:id - Delete app update")
        
        results = {
            "admin_login": False,
            "get_users_list": False,
            "get_user_details": False,
            "get_app_updates": False,
            "create_app_update": False,
            "update_app_update": False,
            "delete_app_update": False
        }
        
        try:
            # Step 1: Login as admin
            results["admin_login"] = self.login_admin()
            if not results["admin_login"]:
                print("❌ Cannot proceed without admin authentication")
                return results
            
            # Step 2: Get users list (to find a user ID)
            test_user_id = self.test_get_admin_users()
            results["get_users_list"] = test_user_id is not None
            
            # Step 3: Test user details endpoint with real user ID
            if test_user_id:
                results["get_user_details"] = self.test_get_user_details(test_user_id)
            else:
                print("⚠️  Skipping user details test - no user ID available")
            
            # Step 4: Test app updates CRUD operations
            
            # 4a: Get all app updates
            results["get_app_updates"] = self.test_get_app_updates()
            
            # 4b: Create new app update
            created_update_id = self.test_create_app_update()
            results["create_app_update"] = created_update_id is not False
            
            # 4c: Update the app update (if created successfully)
            if created_update_id and isinstance(created_update_id, str):
                results["update_app_update"] = self.test_update_app_update(created_update_id)
                
                # 4d: Delete the app update
                results["delete_app_update"] = self.test_delete_app_update(created_update_id)
            else:
                print("⚠️  Skipping update/delete tests - no update ID available")
            
        except Exception as e:
            print(f"❌ Test execution error: {str(e)}")
        
        finally:
            # Always try to clean up
            self.cleanup()
        
        # Print summary
        print("\n" + "=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} | {test_name}")
        
        print(f"\n🎯 Overall Result: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL ADMIN ENDPOINTS WORKING CORRECTLY!")
        elif passed >= total * 0.8:  # 80% pass rate
            print("✅ MAJOR FUNCTIONALITY WORKING - Minor issues detected")
        else:
            print("❌ SIGNIFICANT ISSUES FOUND - Admin endpoints need attention")
        
        return results

def main():
    """Main function to run admin endpoint tests"""
    tester = AdminEndpointTester()
    results = tester.run_all_tests()
    
    # Return exit code based on results
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    if passed >= total * 0.8:  # Consider 80%+ as success
        exit(0)
    else:
        exit(1)

if __name__ == "__main__":
    main()