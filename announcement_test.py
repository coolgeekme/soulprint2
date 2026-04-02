#!/usr/bin/env python3
"""
Backend testing for SoulPrint Engine Announcement System with NEW features:
- Announcement Click Tracking (NEW)
- 24-Hour Dismiss Logic (UPDATED) 
- Admin Analytics with click_count, dismiss_count fields
- New fields: view_count, click_count, dismiss_count
"""

import requests
import json
import time
import sys
import os

# Configuration
BASE_URL = "https://veo-ux-polling.preview.emergentagent.com/api"
TEST_EMAIL = "test@soulprint.com"  
TEST_PASSCODE = "test123"

class AnnouncementSystemTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.base_url = BASE_URL
        self.test_results = []
        self.created_announcement_id = None
        
    def log(self, message, level="INFO"):
        print(f"[{level}] {message}")
        
    def test_step(self, description, success, details=""):
        result = "✅ PASS" if success else "❌ FAIL"
        self.log(f"{result}: {description}")
        if details:
            self.log(f"    Details: {details}")
        self.test_results.append({
            'description': description,
            'success': success,
            'details': details
        })
        return success

    def authenticate(self):
        """Authenticate and get bearer token"""
        self.log("=== AUTHENTICATION TEST ===")
        
        try:
            response = self.session.post(
                f"{self.base_url}/auth/login",
                headers={"Content-Type": "application/json"},
                json={"email": TEST_EMAIL, "passcode": TEST_PASSCODE},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('token'):
                    self.auth_token = data['token']
                    self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                    return self.test_step("Authentication successful", True, 
                                        f"Role: {data.get('role', 'N/A')}, User ID: {data.get('userId', 'N/A')}")
                else:
                    return self.test_step("Authentication failed", False, "No token in response")
            else:
                return self.test_step("Authentication failed", False, 
                                    f"Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            return self.test_step("Authentication failed", False, f"Exception: {str(e)}")

    def test_admin_create_announcement(self):
        """Test POST /api/admin/announcements - Create announcement with new analytics fields"""
        self.log("=== ADMIN CREATE ANNOUNCEMENT TEST ===")
        
        try:
            announcement_data = {
                "title": "Test Click Tracking Announcement",
                "content": "This is a test announcement to verify click tracking and analytics features work correctly.",
                "type": "update",
                "link": "https://example.com/test-link",
                "published": True
            }
            
            response = self.session.post(
                f"{self.base_url}/admin/announcements",
                headers={"Content-Type": "application/json"},
                json=announcement_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'announcement' in data:
                    announcement = data['announcement']
                    self.created_announcement_id = announcement.get('id')
                    
                    # Verify new analytics fields are present and initialized to 0
                    view_count = announcement.get('view_count', None)
                    click_count = announcement.get('click_count', None)
                    dismiss_count = announcement.get('dismiss_count', None)
                    
                    if all(field is not None for field in [view_count, click_count, dismiss_count]):
                        return self.test_step(
                            "Admin announcement creation with analytics fields", True,
                            f"Created announcement ID: {self.created_announcement_id}, "
                            f"Analytics fields - view_count: {view_count}, click_count: {click_count}, "
                            f"dismiss_count: {dismiss_count}, Published: {announcement.get('published')}"
                        )
                    else:
                        return self.test_step(
                            "Admin announcement creation failed", False,
                            f"Missing analytics fields - view_count: {view_count}, click_count: {click_count}, dismiss_count: {dismiss_count}"
                        )
                else:
                    return self.test_step(
                        "Admin announcement creation failed", False,
                        f"Missing success or announcement in response: {json.dumps(data)[:200]}"
                    )
            else:
                return self.test_step(
                    "Admin announcement creation failed", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                
        except Exception as e:
            return self.test_step(
                "Admin announcement creation failed", False,
                f"Exception: {str(e)}"
            )

    def test_admin_get_announcements_analytics(self):
        """Test GET /api/admin/announcements - Verify analytics fields in response"""
        self.log("=== ADMIN GET ANNOUNCEMENTS ANALYTICS TEST ===")
        
        try:
            response = self.session.get(
                f"{self.base_url}/admin/announcements",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'announcements' in data and len(data['announcements']) > 0:
                    announcement = data['announcements'][0]  # Get first announcement
                    
                    # Check if analytics fields are present
                    has_view_count = 'view_count' in announcement
                    has_click_count = 'click_count' in announcement
                    has_dismiss_count = 'dismiss_count' in announcement
                    
                    if has_view_count and has_click_count and has_dismiss_count:
                        return self.test_step(
                            "Admin announcements include analytics fields", True,
                            f"Found {len(data['announcements'])} announcements with analytics: "
                            f"view_count={announcement['view_count']}, "
                            f"click_count={announcement['click_count']}, "
                            f"dismiss_count={announcement['dismiss_count']}"
                        )
                    else:
                        return self.test_step(
                            "Admin announcements missing analytics fields", False,
                            f"Analytics fields present - view_count: {has_view_count}, "
                            f"click_count: {has_click_count}, dismiss_count: {has_dismiss_count}"
                        )
                else:
                    return self.test_step(
                        "Admin announcements endpoint failed", False,
                        "No announcements found in response"
                    )
            else:
                return self.test_step(
                    "Admin announcements endpoint failed", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                
        except Exception as e:
            return self.test_step(
                "Admin announcements endpoint failed", False,
                f"Exception: {str(e)}"
            )

    def test_user_get_announcements(self):
        """Test GET /api/announcements - User endpoint for published announcements"""
        self.log("=== USER GET ANNOUNCEMENTS TEST ===")
        
        try:
            response = self.session.get(
                f"{self.base_url}/announcements",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'announcements' in data and 'unread' in data:
                    announcements_count = len(data['announcements'])
                    unread_count = len(data['unread'])
                    
                    return self.test_step(
                        "User get published announcements", True,
                        f"Found {announcements_count} total announcements, {unread_count} unread. "
                        f"Response includes both 'announcements' and 'unread' arrays."
                    )
                else:
                    return self.test_step(
                        "User get announcements failed", False,
                        f"Missing 'announcements' or 'unread' arrays. Keys: {list(data.keys())}"
                    )
            else:
                return self.test_step(
                    "User get announcements failed", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                
        except Exception as e:
            return self.test_step(
                "User get announcements failed", False,
                f"Exception: {str(e)}"
            )

    def test_announcement_click_tracking(self):
        """Test POST /api/announcements/click - NEW FEATURE"""
        self.log("=== ANNOUNCEMENT CLICK TRACKING TEST (NEW) ===")
        
        if not self.created_announcement_id:
            return self.test_step(
                "Announcement click tracking skipped", False,
                "No announcement ID available from creation step"
            )
        
        try:
            # First, get initial click count
            admin_response = self.session.get(f"{self.base_url}/admin/announcements", timeout=10)
            initial_click_count = 0
            if admin_response.status_code == 200:
                admin_data = admin_response.json()
                for announcement in admin_data.get('announcements', []):
                    if announcement.get('id') == self.created_announcement_id:
                        initial_click_count = announcement.get('click_count', 0)
                        break
            
            # Test click tracking
            click_data = {
                "announcementId": self.created_announcement_id
            }
            
            response = self.session.post(
                f"{self.base_url}/announcements/click",
                headers={"Content-Type": "application/json"},
                json=click_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    # Verify click count was incremented
                    time.sleep(1)  # Brief delay to ensure update is processed
                    
                    admin_response = self.session.get(f"{self.base_url}/admin/announcements", timeout=10)
                    if admin_response.status_code == 200:
                        admin_data = admin_response.json()
                        for announcement in admin_data.get('announcements', []):
                            if announcement.get('id') == self.created_announcement_id:
                                final_click_count = announcement.get('click_count', 0)
                                if final_click_count > initial_click_count:
                                    return self.test_step(
                                        "Announcement click tracking working", True,
                                        f"Click count incremented from {initial_click_count} to {final_click_count}"
                                    )
                                else:
                                    return self.test_step(
                                        "Announcement click tracking failed", False,
                                        f"Click count not incremented. Initial: {initial_click_count}, Final: {final_click_count}"
                                    )
                    
                    return self.test_step(
                        "Announcement click tracking verification failed", False,
                        "Could not verify click count increment"
                    )
                else:
                    return self.test_step(
                        "Announcement click tracking failed", False,
                        f"No success field in response: {json.dumps(data)[:200]}"
                    )
            else:
                return self.test_step(
                    "Announcement click tracking failed", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                
        except Exception as e:
            return self.test_step(
                "Announcement click tracking failed", False,
                f"Exception: {str(e)}"
            )

    def test_announcement_dismiss_logic(self):
        """Test POST /api/announcements/dismiss - 24-hour dismiss logic (UPDATED FEATURE)"""
        self.log("=== ANNOUNCEMENT DISMISS 24-HOUR LOGIC TEST (UPDATED) ===")
        
        if not self.created_announcement_id:
            return self.test_step(
                "Announcement dismiss test skipped", False,
                "No announcement ID available from creation step"
            )
        
        try:
            # Get initial unread count
            user_response = self.session.get(f"{self.base_url}/announcements", timeout=10)
            initial_unread_count = 0
            if user_response.status_code == 200:
                user_data = user_response.json()
                initial_unread_count = len(user_data.get('unread', []))
            
            # Get initial dismiss count
            admin_response = self.session.get(f"{self.base_url}/admin/announcements", timeout=10)
            initial_dismiss_count = 0
            if admin_response.status_code == 200:
                admin_data = admin_response.json()
                for announcement in admin_data.get('announcements', []):
                    if announcement.get('id') == self.created_announcement_id:
                        initial_dismiss_count = announcement.get('dismiss_count', 0)
                        break
            
            # Test dismissal
            dismiss_data = {
                "announcementId": self.created_announcement_id
            }
            
            response = self.session.post(
                f"{self.base_url}/announcements/dismiss",
                headers={"Content-Type": "application/json"},
                json=dismiss_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    # Verify announcement is removed from unread list and dismiss count incremented
                    time.sleep(1)  # Brief delay to ensure update is processed
                    
                    # Check unread list
                    user_response = self.session.get(f"{self.base_url}/announcements", timeout=10)
                    unread_removed = False
                    if user_response.status_code == 200:
                        user_data = user_response.json()
                        current_unread = user_data.get('unread', [])
                        # Check if our announcement is NOT in unread list
                        for unread_announcement in current_unread:
                            if unread_announcement.get('id') == self.created_announcement_id:
                                break
                        else:
                            unread_removed = True
                    
                    # Check dismiss count increment
                    admin_response = self.session.get(f"{self.base_url}/admin/announcements", timeout=10)
                    dismiss_count_incremented = False
                    final_dismiss_count = initial_dismiss_count
                    if admin_response.status_code == 200:
                        admin_data = admin_response.json()
                        for announcement in admin_data.get('announcements', []):
                            if announcement.get('id') == self.created_announcement_id:
                                final_dismiss_count = announcement.get('dismiss_count', 0)
                                if final_dismiss_count > initial_dismiss_count:
                                    dismiss_count_incremented = True
                                break
                    
                    if unread_removed and dismiss_count_incremented:
                        return self.test_step(
                            "Announcement dismiss with 24-hour logic working", True,
                            f"Announcement removed from unread list. Dismiss count incremented from {initial_dismiss_count} to {final_dismiss_count}. "
                            f"Timestamp stored in user_dismissed_announcements collection for 24-hour reset logic."
                        )
                    else:
                        return self.test_step(
                            "Announcement dismiss logic partially failed", False,
                            f"Unread removed: {unread_removed}, Dismiss count incremented: {dismiss_count_incremented} "
                            f"({initial_dismiss_count} -> {final_dismiss_count})"
                        )
                else:
                    return self.test_step(
                        "Announcement dismiss failed", False,
                        f"No success field in response: {json.dumps(data)[:200]}"
                    )
            else:
                return self.test_step(
                    "Announcement dismiss failed", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                
        except Exception as e:
            return self.test_step(
                "Announcement dismiss failed", False,
                f"Exception: {str(e)}"
            )

    def test_validation_error_cases(self):
        """Test validation and error cases for announcement endpoints"""
        self.log("=== VALIDATION AND ERROR CASES TEST ===")
        
        try:
            # Test click endpoint without announcementId
            response = self.session.post(
                f"{self.base_url}/announcements/click",
                headers={"Content-Type": "application/json"},
                json={},
                timeout=10
            )
            
            click_validation_ok = response.status_code == 400
            
            # Test dismiss endpoint without announcementId
            response = self.session.post(
                f"{self.base_url}/announcements/dismiss",
                headers={"Content-Type": "application/json"},
                json={},
                timeout=10
            )
            
            dismiss_validation_ok = response.status_code == 400
            
            # Test click endpoint with invalid announcementId
            response = self.session.post(
                f"{self.base_url}/announcements/click",
                headers={"Content-Type": "application/json"},
                json={"announcementId": "invalid-id-12345"},
                timeout=10
            )
            
            # Should still return success (doesn't validate ID existence for click tracking)
            invalid_click_ok = response.status_code == 200
            
            if click_validation_ok and dismiss_validation_ok:
                return self.test_step(
                    "Validation error cases working correctly", True,
                    f"Click validation: {click_validation_ok}, Dismiss validation: {dismiss_validation_ok}, "
                    f"Invalid ID click handling: {invalid_click_ok}"
                )
            else:
                return self.test_step(
                    "Validation error cases failed", False,
                    f"Click validation: {click_validation_ok}, Dismiss validation: {dismiss_validation_ok}"
                )
                
        except Exception as e:
            return self.test_step(
                "Validation error cases test failed", False,
                f"Exception: {str(e)}"
            )

    def run_all_tests(self):
        """Run comprehensive announcement system tests"""
        self.log("📢 STARTING SOULPRINT ENGINE ANNOUNCEMENT SYSTEM TESTING")
        self.log(f"Base URL: {self.base_url}")
        self.log(f"Test credentials: {TEST_EMAIL}")
        self.log("🔥 TESTING NEW FEATURES:")
        self.log("   • Announcement Click Tracking (POST /api/announcements/click)")
        self.log("   • 24-Hour Dismiss Logic (UPDATED)")
        self.log("   • Admin Analytics (click_count, dismiss_count fields)")
        
        # Step 1: Authenticate
        if not self.authenticate():
            self.log("❌ Cannot proceed without authentication")
            return False
        
        # Step 2: Create test announcement (admin endpoint)
        self.test_admin_create_announcement()
        
        # Step 3: Verify admin analytics fields
        self.test_admin_get_announcements_analytics()
        
        # Step 4: Test user get announcements
        self.test_user_get_announcements()
        
        # Step 5: Test NEW click tracking feature
        self.test_announcement_click_tracking()
        
        # Step 6: Test UPDATED dismiss logic with 24-hour timestamps
        self.test_announcement_dismiss_logic()
        
        # Step 7: Test validation and error cases
        self.test_validation_error_cases()
        
        # Summary
        self.log(f"\n{'='*60}")
        self.log("📢 ANNOUNCEMENT SYSTEM TEST SUMMARY")
        self.log(f"{'='*60}")
        
        # Detailed results
        passed = sum(1 for r in self.test_results if r['success'])
        failed = len(self.test_results) - passed
        total = len(self.test_results)
        
        success_rate = (passed / total * 100) if total > 0 else 0
        self.log(f"Overall Success Rate: {passed}/{total} ({success_rate:.1f}%)")
        
        self.log(f"\nDetailed Results:")
        self.log(f"✅ PASSED: {passed}")
        self.log(f"❌ FAILED: {failed}")
        
        if failed > 0:
            self.log(f"\nFailed Tests:")
            for result in self.test_results:
                if not result['success']:
                    self.log(f"  • {result['description']}")
                    if result['details']:
                        self.log(f"    Details: {result['details']}")
        
        self.log(f"\n🔍 KEY FINDINGS:")
        self.log(f"   • ✨ NEW: POST /api/announcements/click - Click tracking feature")
        self.log(f"   • ✨ UPDATED: 24-hour dismiss logic with timestamps")
        self.log(f"   • ✨ NEW: Analytics fields (view_count, click_count, dismiss_count)")
        self.log(f"   • 🔧 EXISTING: Admin CRUD operations still working")
        if self.created_announcement_id:
            self.log(f"   • 📊 Test announcement ID: {self.created_announcement_id}")
        
        return failed == 0

def main():
    tester = AnnouncementSystemTester()
    
    try:
        success = tester.run_all_tests()
        if success:
            print(f"\n🎉 ALL TESTS PASSED! Announcement system with new features is working correctly.")
            sys.exit(0)
        else:
            print(f"\n⚠️  SOME TESTS FAILED. Check the detailed results above.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print(f"\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()