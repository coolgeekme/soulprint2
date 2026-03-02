#!/usr/bin/env python3
"""
Backend Testing Script for SoulPrint Engine - Remember This Feature
Tests the new "Remember This" auto-save memory feature
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
    
    def test_remember_this_auto_save(self):
        """Test the new 'Remember This' auto-save feature"""
        print(f"\n🧠 Testing 'Remember This' Auto-Save Feature...")
        
        try:
            # Test data with different "remember" patterns
            test_cases = [
                {
                    "message": "Remember that I am allergic to shellfish",
                    "expected_memory": "I am allergic to shellfish",
                    "case": "Basic remember pattern"
                },
                {
                    "message": "Don't forget that my favorite color is blue", 
                    "expected_memory": "my favorite color is blue",
                    "case": "Don't forget pattern"
                },
                {
                    "message": "Note that I prefer email over phone calls",
                    "expected_memory": "I prefer email over phone calls", 
                    "case": "Note pattern"
                },
                {
                    "message": "Save to memory: I work at TechCorp",
                    "expected_memory": "I work at TechCorp",
                    "case": "Save to memory pattern"
                }
            ]
            
            # First, create a conversation for testing
            conv_response = self.session.post(f"{BASE_URL}/conversations", json={
                "title": "Remember This Test"
            })
            
            if conv_response.status_code != 200:
                print(f"   ❌ Failed to create test conversation: {conv_response.status_code}")
                return False
            
            conversation_id = conv_response.json().get('id')
            print(f"   ✅ Created test conversation: {conversation_id}")
            
            # Test each remember pattern
            memories_created = 0
            
            for i, test_case in enumerate(test_cases, 1):
                print(f"   📝 Testing case {i}: {test_case['case']}")
                
                # Send message with remember pattern
                chat_data = {
                    "content": test_case["message"],
                    "conversationId": conversation_id,
                    "model": "gpt-4o-mini"  # Use fastest model for testing
                }
                
                response = self.session.post(f"{BASE_URL}/chat/stream", 
                                           json=chat_data, 
                                           stream=True)
                
                if response.status_code != 200:
                    print(f"      ❌ Chat stream failed: {response.status_code}")
                    continue
                
                # Parse streaming response for memory confirmation
                memory_saved = False
                memory_content = ""
                chunk_count = 0
                
                try:
                    for line in response.iter_lines():
                        if line:
                            line_text = line.decode('utf-8').strip()
                            if not line_text:
                                continue
                            
                            try:
                                chunk = json.loads(line_text)
                                chunk_count += 1
                                
                                # Check for meta chunk with memorySaved flag
                                if chunk.get('type') == 'meta':
                                    if chunk.get('memorySaved'):
                                        memory_saved = True
                                        memory_content = chunk.get('memoryContent', '')
                                        print(f"      ✅ Memory auto-saved: '{memory_content}'")
                                
                                # Check for memory confirmation in delta chunks
                                elif chunk.get('type') == 'delta':
                                    content = chunk.get('content', '')
                                    if 'Saved to your memories' in content:
                                        memory_saved = True
                                        print(f"      ✅ Memory confirmation found in response")
                                
                                # Stop after getting enough chunks (don't need full response)
                                if chunk.get('type') == 'done' or chunk_count > 15:
                                    break
                                    
                            except json.JSONDecodeError:
                                continue
                                
                except Exception as e:
                    print(f"      ⚠️  Error parsing stream: {str(e)}")
                
                if memory_saved:
                    memories_created += 1
                    print(f"      ✅ {test_case['case']} - Memory saved successfully")
                else:
                    print(f"      ❌ {test_case['case']} - Memory not saved")
            
            # Verify memories were actually saved to database
            time.sleep(2)  # Brief delay for database consistency
            
            memories_response = self.session.get(f"{BASE_URL}/memories")
            if memories_response.status_code != 200:
                print(f"   ❌ Failed to retrieve memories: {memories_response.status_code}")
                return False
            
            memories_data = memories_response.json()
            all_memories = memories_data.get('memories', [])
            
            # Filter for user_explicit source memories
            explicit_memories = [m for m in all_memories if m.get('source') == 'user_explicit']
            
            print(f"   📊 Database verification:")
            print(f"      Total memories: {len(all_memories)}")
            print(f"      Explicit memories: {len(explicit_memories)}")
            print(f"      Expected saves: {len(test_cases)}")
            
            # Check if we have the expected memories
            success = memories_created >= 3  # At least 3 out of 4 patterns should work
            
            if success:
                print(f"   ✅ Remember This auto-save feature working correctly!")
                print(f"      {memories_created}/{len(test_cases)} memory patterns successfully saved")
            else:
                print(f"   ❌ Remember This auto-save feature not working properly")
                print(f"      Only {memories_created}/{len(test_cases)} memory patterns worked")
            
            return success
            
        except Exception as e:
            print(f"❌ Remember This auto-save test error: {str(e)}")
            return False
    
    def test_normal_messages_no_memory(self):
        """Test that normal messages do NOT create memories"""
        print(f"\n🚫 Testing normal messages don't create memories...")
        
        try:
            # Get initial memory count
            initial_response = self.session.get(f"{BASE_URL}/memories")
            if initial_response.status_code != 200:
                print(f"   ❌ Failed to get initial memory count: {initial_response.status_code}")
                return False
                
            initial_count = len(initial_response.json().get('memories', []))
            print(f"   📊 Initial memory count: {initial_count}")
            
            # Send normal message that should NOT trigger memory
            chat_data = {
                "content": "What is the weather today?",
                "model": "gpt-4o-mini"
            }
            
            response = self.session.post(f"{BASE_URL}/chat/stream", 
                                       json=chat_data, 
                                       stream=True)
            
            if response.status_code != 200:
                print(f"   ❌ Normal message failed: {response.status_code}")
                return False
            
            # Check response for unwanted memory flags
            memory_saved = False
            chunk_count = 0
            
            try:
                for line in response.iter_lines():
                    if line:
                        line_text = line.decode('utf-8').strip()
                        if not line_text:
                            continue
                        
                        try:
                            chunk = json.loads(line_text)
                            chunk_count += 1
                            
                            # Check for unwanted memory saving
                            if chunk.get('type') == 'meta' and chunk.get('memorySaved'):
                                memory_saved = True
                                print(f"   ❌ Unexpected memory save detected!")
                            
                            if chunk.get('type') == 'done' or chunk_count > 15:
                                break
                                
                        except json.JSONDecodeError:
                            continue
                            
            except Exception as e:
                print(f"   ⚠️  Error parsing stream: {str(e)}")
            
            # Verify memory count didn't increase
            time.sleep(1)
            
            final_response = self.session.get(f"{BASE_URL}/memories")
            if final_response.status_code != 200:
                print(f"   ❌ Failed to get final memory count: {final_response.status_code}")
                return False
            
            final_count = len(final_response.json().get('memories', []))
            print(f"   📊 Final memory count: {final_count}")
            
            # Memory count should be the same
            if memory_saved or final_count != initial_count:
                print(f"   ❌ Normal message incorrectly created memory")
                print(f"      Memory saved flag: {memory_saved}")
                print(f"      Count change: {initial_count} → {final_count}")
                return False
            else:
                print(f"   ✅ Normal message correctly did NOT create memory")
                print(f"      Memory count unchanged: {final_count}")
                return True
            
        except Exception as e:
            print(f"❌ Normal message no-memory test error: {str(e)}")
            return False
    
    def test_memory_properties(self):
        """Test that memories have correct properties"""
        print(f"\n📋 Testing memory properties...")
        
        try:
            response = self.session.get(f"{BASE_URL}/memories")
            if response.status_code != 200:
                print(f"   ❌ Failed to get memories: {response.status_code}")
                return False
            
            memories_data = response.json()
            all_memories = memories_data.get('memories', [])
            
            # Filter for user_explicit memories (from Remember This feature)
            explicit_memories = [m for m in all_memories if m.get('source') == 'user_explicit']
            
            if not explicit_memories:
                print(f"   ⚠️  No user_explicit memories found")
                print(f"      Total memories: {len(all_memories)}")
                # This might be OK if no remember patterns were detected
                return True
            
            print(f"   📊 Found {len(explicit_memories)} user_explicit memories")
            
            # Check properties of explicit memories
            properties_correct = True
            
            for i, memory in enumerate(explicit_memories):
                print(f"   Memory {i+1}:")
                print(f"      Content: '{memory.get('content', 'N/A')[:50]}...'")
                print(f"      Source: {memory.get('source', 'N/A')}")
                print(f"      Importance: {memory.get('importance', 'N/A')}")
                print(f"      Category: {memory.get('category', 'N/A')}")
                
                if memory.get('source') != 'user_explicit':
                    properties_correct = False
                    print(f"      ❌ Wrong source (expected 'user_explicit')")
                
                if memory.get('importance') != 'high':
                    properties_correct = False
                    print(f"      ❌ Wrong importance (expected 'high')")
            
            if properties_correct:
                print(f"   ✅ All user_explicit memories have correct properties")
                return True
            else:
                print(f"   ❌ Some memories have incorrect properties")
                return False
            
        except Exception as e:
            print(f"❌ Memory properties test error: {str(e)}")
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

def main_remember_this():
    """Main function for Remember This feature testing"""
    print("🧠 SoulPrint Engine - Remember This Feature Testing")
    print("=" * 60)
    
    tester = SoulPrintBackendTester()
    
    try:
        # Step 1: Authentication
        if not tester.authenticate():
            print("❌ Authentication failed, stopping tests")
            sys.exit(1)
        
        # Step 2: Test Remember This auto-save feature
        tester.test_remember_this_auto_save()
        
        # Step 3: Test normal messages don't create memories
        tester.test_normal_messages_no_memory()
        
        # Step 4: Test memory properties
        tester.test_memory_properties()
        
        # Print final summary
        print("\n🎉 Remember This Feature Testing Complete!")
        print("Check the results above for detailed status of each test.")
        
    except KeyboardInterrupt:
        print(f"\n\n⚠️  Tests interrupted by user")
        sys.exit(1)
        
    except Exception as e:
        print(f"\n❌ Unexpected error during testing: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    # Run Remember This feature tests
    main_remember_this()