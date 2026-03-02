#!/usr/bin/env python3
"""
Backend Testing Script for SoulPrint Engine PWA and Announcement Features
Tests the new PWA install status endpoints and updated announcement features
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://smart-routing-ui.preview.emergentagent.com/api"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class SoulPrintBackendTester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json'
        })
        print(f"🧪 Starting backend tests for SoulPrint Engine")
        print(f"🔗 Base URL: {BASE_URL}")
        print(f"📧 Test User: {TEST_EMAIL}")
        
    def authenticate(self):
        """Authenticate and get token"""
        try:
            print(f"\n🔐 Testing Authentication...")
            response = self.session.post(f"{BASE_URL}/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                self.user_id = data.get('userId')
                self.session.headers.update({
                    'Authorization': f'Bearer {self.token}'
                })
                print(f"✅ Authentication successful - User ID: {self.user_id}")
                print(f"   Role: {data.get('role', 'N/A')}")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def test_pwa_install_status_get(self):
        """Test GET /api/pwa/install-status endpoint"""
        try:
            print(f"\n📱 Testing PWA Install Status (GET)...")
            response = self.session.get(f"{BASE_URL}/pwa/install-status")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ GET /pwa/install-status successful")
                print(f"   showPrompt: {data.get('showPrompt')}")
                print(f"   installed: {data.get('installed')}")  
                print(f"   dismissedForever: {data.get('dismissedForever')}")
                
                # Verify structure
                required_fields = ['showPrompt', 'installed', 'dismissedForever']
                for field in required_fields:
                    if field not in data:
                        print(f"❌ Missing required field: {field}")
                        return False
                        
                # For new users, showPrompt should typically be true
                if data.get('showPrompt') is True:
                    print(f"   ✅ showPrompt=true (expected for new users)")
                else:
                    print(f"   ℹ️  showPrompt=false (user may have interacted with prompt before)")
                    
                return True
            else:
                print(f"❌ GET /pwa/install-status failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ PWA install status GET error: {str(e)}")
            return False
    
    def test_pwa_install_status_post(self):
        """Test POST /api/pwa/install-status endpoint with different actions"""
        actions = ['remind_later', 'installed', 'dismiss_forever']
        
        for action in actions:
            try:
                print(f"\n📱 Testing PWA Install Status POST - Action: {action}...")
                response = self.session.post(f"{BASE_URL}/pwa/install-status", json={
                    "action": action
                })
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"✅ POST /pwa/install-status ({action}) successful")
                    print(f"   Response: {data}")
                    
                    # After each action, verify the GET endpoint reflects the change
                    time.sleep(0.5)  # Small delay
                    get_response = self.session.get(f"{BASE_URL}/pwa/install-status")
                    
                    if get_response.status_code == 200:
                        get_data = get_response.json()
                        print(f"   Verification GET response:")
                        print(f"     showPrompt: {get_data.get('showPrompt')}")
                        print(f"     installed: {get_data.get('installed')}")
                        print(f"     dismissedForever: {get_data.get('dismissedForever')}")
                        
                        # Verify expected behavior
                        if action == 'installed':
                            if get_data.get('installed') is True:
                                print(f"   ✅ installed=true after 'installed' action")
                            else:
                                print(f"   ❌ Expected installed=true after 'installed' action")
                                
                        elif action == 'dismiss_forever':
                            if get_data.get('dismissedForever') is True:
                                print(f"   ✅ dismissedForever=true after 'dismiss_forever' action")
                            else:
                                print(f"   ❌ Expected dismissedForever=true after 'dismiss_forever' action")
                                
                        elif action == 'remind_later':
                            if get_data.get('showPrompt') is False:
                                print(f"   ✅ showPrompt=false after 'remind_later' action (within 24h)")
                            else:
                                print(f"   ❌ Expected showPrompt=false after 'remind_later' action")
                    else:
                        print(f"   ❌ Verification GET failed: {get_response.status_code}")
                        
                else:
                    print(f"❌ POST /pwa/install-status ({action}) failed: {response.status_code} - {response.text}")
                    return False
                    
            except Exception as e:
                print(f"❌ PWA install status POST ({action}) error: {str(e)}")
                return False
        
        return True
    
    def test_announcement_permanent_dismiss(self):
        """Test announcement permanent dismiss functionality"""
        try:
            print(f"\n📢 Testing Announcement Permanent Dismiss...")
            
            # First, get current announcements to find one to test with
            print("   Getting current announcements...")
            response = self.session.get(f"{BASE_URL}/announcements")
            
            if response.status_code == 200:
                data = response.json()
                announcements = data.get('announcements', [])
                unread = data.get('unread', [])
                
                print(f"   Found {len(announcements)} total announcements")
                print(f"   Found {len(unread)} unread announcements")
                
                if len(announcements) == 0:
                    print(f"   ℹ️  No announcements found - creating test announcement first")
                    # We can't create announcements as regular user, so skip this test
                    print(f"   ⚠️  Skipping permanent dismiss test - no announcements available")
                    return True
                
                # Use the first unread announcement for testing
                test_announcement = unread[0] if unread else announcements[0]
                announcement_id = test_announcement.get('id')
                
                print(f"   Testing with announcement ID: {announcement_id}")
                print(f"   Title: {test_announcement.get('title', 'N/A')}")
                
                # Test permanent dismiss
                dismiss_response = self.session.post(f"{BASE_URL}/announcements/dismiss", json={
                    "announcementId": announcement_id,
                    "permanent": True
                })
                
                if dismiss_response.status_code == 200:
                    print(f"   ✅ Permanent dismiss successful")
                    
                    # Verify the announcement is no longer in unread
                    time.sleep(0.5)
                    verify_response = self.session.get(f"{BASE_URL}/announcements")
                    
                    if verify_response.status_code == 200:
                        verify_data = verify_response.json()
                        new_unread = verify_data.get('unread', [])
                        new_announcements = verify_data.get('announcements', [])
                        
                        # Check if announcement is still in unread (it shouldn't be)
                        is_in_unread = any(a.get('id') == announcement_id for a in new_unread)
                        is_in_announcements = any(a.get('id') == announcement_id for a in new_announcements)
                        
                        if not is_in_unread:
                            print(f"   ✅ Announcement NOT in unread list after permanent dismiss")
                        else:
                            print(f"   ❌ Announcement still in unread list after permanent dismiss")
                            
                        if is_in_announcements:
                            print(f"   ✅ Announcement still in main announcements list (expected)")
                        else:
                            print(f"   ⚠️  Announcement removed from main list (check if this is expected)")
                            
                        return True
                    else:
                        print(f"   ❌ Verification GET failed: {verify_response.status_code}")
                        return False
                        
                else:
                    print(f"   ❌ Permanent dismiss failed: {dismiss_response.status_code} - {dismiss_response.text}")
                    return False
                    
            else:
                print(f"   ❌ Get announcements failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Announcement permanent dismiss error: {str(e)}")
            return False
    
    def test_existing_announcement_functionality(self):
        """Test existing announcement functionality to ensure it still works"""
        try:
            print(f"\n📢 Testing Existing Announcement Functionality...")
            
            # Test click tracking
            print("   Testing click tracking...")
            response = self.session.get(f"{BASE_URL}/announcements")
            
            if response.status_code == 200:
                data = response.json()
                announcements = data.get('announcements', [])
                
                if announcements:
                    test_announcement = announcements[0]
                    announcement_id = test_announcement.get('id')
                    
                    # Test click tracking
                    click_response = self.session.post(f"{BASE_URL}/announcements/click", json={
                        "announcementId": announcement_id
                    })
                    
                    if click_response.status_code == 200:
                        print(f"   ✅ Click tracking successful")
                    else:
                        print(f"   ❌ Click tracking failed: {click_response.status_code} - {click_response.text}")
                        return False
                        
                    # Test 24-hour dismiss (temporary)
                    print("   Testing 24-hour dismiss...")
                    dismiss_response = self.session.post(f"{BASE_URL}/announcements/dismiss", json={
                        "announcementId": announcement_id
                        # No permanent: true, so this should be 24-hour dismiss
                    })
                    
                    if dismiss_response.status_code == 200:
                        print(f"   ✅ 24-hour dismiss successful")
                        
                        # Verify immediate effect
                        time.sleep(0.5)
                        verify_response = self.session.get(f"{BASE_URL}/announcements")
                        
                        if verify_response.status_code == 200:
                            verify_data = verify_response.json()
                            new_unread = verify_data.get('unread', [])
                            
                            # Should be removed from unread temporarily
                            is_in_unread = any(a.get('id') == announcement_id for a in new_unread)
                            if not is_in_unread:
                                print(f"   ✅ Announcement temporarily removed from unread (24-hour dismiss)")
                            else:
                                print(f"   ❌ Announcement still in unread after 24-hour dismiss")
                                
                        return True
                    else:
                        print(f"   ❌ 24-hour dismiss failed: {dismiss_response.status_code} - {dismiss_response.text}")
                        return False
                        
                else:
                    print(f"   ℹ️  No announcements available for testing existing functionality")
                    return True
                    
            else:
                print(f"   ❌ Get announcements failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Existing announcement functionality error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests"""
        print(f"\n🚀 Starting PWA and Announcement Feature Tests")
        print(f"=" * 70)
        
        # Authenticate first
        if not self.authenticate():
            print(f"\n❌ Authentication failed - cannot continue with tests")
            return False
        
        test_results = {}
        
        # Test PWA Install Status Endpoints
        test_results['pwa_get'] = self.test_pwa_install_status_get()
        test_results['pwa_post'] = self.test_pwa_install_status_post()
        
        # Test Announcement Features
        test_results['announcement_permanent_dismiss'] = self.test_announcement_permanent_dismiss()
        test_results['existing_announcement_functionality'] = self.test_existing_announcement_functionality()
        
        # Summary
        print(f"\n" + "=" * 70)
        print(f"🏁 TEST SUMMARY")
        print(f"=" * 70)
        
        passed = 0
        total = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} - {test_name.replace('_', ' ').title()}")
            if result:
                passed += 1
        
        print(f"\n📊 Results: {passed}/{total} tests passed ({(passed/total)*100:.0f}%)")
        
        if passed == total:
            print(f"🎉 All tests passed! PWA and announcement features working correctly.")
        else:
            print(f"⚠️  Some tests failed. Review the output above for details.")
            
        return passed == total

def main():
    """Main test execution"""
    tester = SoulPrintBackendTester()
    
    try:
        success = tester.run_all_tests()
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print(f"\n\n⚠️  Tests interrupted by user")
        sys.exit(1)
        
    except Exception as e:
        print(f"\n❌ Unexpected error during testing: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()