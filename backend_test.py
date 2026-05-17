#!/usr/bin/env python3
"""
Backend Test for Composio Integration (Telegram Bot Infrastructure)
Tests the underlying Composio REST API that the Telegram bot uses.
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Base URLs
APP_BASE_URL = "http://localhost:3000"
COMPOSIO_API_BASE = "https://backend.composio.dev"

# Composio API credentials (from review request)
COMPOSIO_API_KEY = "ak_ZADt5Z_GI92E4tc0lY38"
COMPOSIO_USER_ID = "sp_test"

# Auth credentials for app API
AUTH_EMAIL = "testchat@example.com"
AUTH_PASSCODE = "Test123456"

def print_test(name):
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_success(msg):
    print(f"✅ {msg}")

def print_error(msg):
    print(f"❌ {msg}")

def print_info(msg):
    print(f"ℹ️  {msg}")

# ============================================================================
# TEST 1: Composio Active Accounts REST API
# ============================================================================
def test_composio_active_accounts():
    print_test("Test 1: Composio Active Accounts REST API")
    
    try:
        url = f"{COMPOSIO_API_BASE}/api/v1/connectedAccounts?user_id={COMPOSIO_USER_ID}"
        headers = {"x-api-key": COMPOSIO_API_KEY}
        
        print_info(f"GET {url}")
        response = requests.get(url, headers=headers, timeout=30)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        print_info(f"Response keys: {list(data.keys())}")
        
        # Check for items array
        if 'items' not in data:
            print_error("Response missing 'items' array")
            print_error(f"Response: {json.dumps(data, indent=2)[:500]}")
            return False
        
        items = data['items']
        print_success(f"Found {len(items)} connected accounts")
        
        # Filter for active accounts
        active_accounts = [acc for acc in items if acc.get('status', '').lower() == 'active']
        print_success(f"Found {len(active_accounts)} active accounts")
        
        # Check for Gmail and GoogleCalendar
        gmail_accounts = []
        calendar_accounts = []
        
        for acc in active_accounts:
            # Extract app identifier
            app_id = None
            if isinstance(acc.get('appUniqueId'), str):
                app_id = acc['appUniqueId'].upper()
            
            if not app_id:
                continue
            
            print_info(f"Account: {acc.get('id')} - App: {app_id} - Status: {acc.get('status')}")
            
            if 'GMAIL' in app_id:
                gmail_accounts.append(acc)
            if 'GOOGLECALENDAR' in app_id or 'CALENDAR' in app_id:
                calendar_accounts.append(acc)
        
        print_success(f"Gmail accounts: {len(gmail_accounts)}")
        print_success(f"Calendar accounts: {len(calendar_accounts)}")
        
        # Verify structure
        if len(active_accounts) > 0:
            sample = active_accounts[0]
            required_fields = ['id', 'appUniqueId', 'status']
            for field in required_fields:
                if field not in sample:
                    print_error(f"Missing required field: {field}")
                    return False
            print_success("All required fields present in account structure")
        
        # Store account IDs for next tests
        global GMAIL_ACCOUNT_ID, CALENDAR_ACCOUNT_ID
        GMAIL_ACCOUNT_ID = gmail_accounts[0]['id'] if gmail_accounts else None
        CALENDAR_ACCOUNT_ID = calendar_accounts[0]['id'] if calendar_accounts else None
        
        if GMAIL_ACCOUNT_ID:
            print_success(f"Gmail account ID: {GMAIL_ACCOUNT_ID}")
        else:
            print_error("No Gmail account found - Test 2 will be skipped")
        
        if CALENDAR_ACCOUNT_ID:
            print_success(f"Calendar account ID: {CALENDAR_ACCOUNT_ID}")
        else:
            print_error("No Calendar account found - Test 3 will be skipped")
        
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# TEST 2: Composio Gmail Execution
# ============================================================================
def test_composio_gmail_execution():
    print_test("Test 2: Composio Gmail Execution")
    
    if not GMAIL_ACCOUNT_ID:
        print_error("Skipping - No Gmail account ID from Test 1")
        return False
    
    try:
        url = f"{COMPOSIO_API_BASE}/api/v2/actions/GMAIL_FETCH_EMAILS/execute"
        headers = {
            "x-api-key": COMPOSIO_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "connectedAccountId": GMAIL_ACCOUNT_ID,
            "input": {
                "max_results": 2
            }
        }
        
        print_info(f"POST {url}")
        print_info(f"Account ID: {GMAIL_ACCOUNT_ID}")
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        print_info(f"Response keys: {list(data.keys())}")
        
        # Check for data.messages array
        if 'data' not in data:
            print_error("Response missing 'data' field")
            print_error(f"Response: {json.dumps(data, indent=2)[:500]}")
            return False
        
        messages = data['data'].get('messages', [])
        print_success(f"Found {len(messages)} messages")
        
        # Verify message structure
        if len(messages) > 0:
            sample = messages[0]
            print_info(f"Sample message keys: {list(sample.keys())}")
            
            # Check for messageId and messageText fields
            has_message_id = 'messageId' in sample or 'id' in sample
            has_message_text = 'messageText' in sample or 'snippet' in sample or 'subject' in sample
            
            if has_message_id:
                print_success("Messages have ID field")
            else:
                print_error("Messages missing ID field")
                return False
            
            if has_message_text:
                print_success("Messages have text/content field")
            else:
                print_error("Messages missing text/content field")
                return False
        
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# TEST 3: Composio Calendar Execution
# ============================================================================
def test_composio_calendar_execution():
    print_test("Test 3: Composio Calendar Execution")
    
    if not CALENDAR_ACCOUNT_ID:
        print_error("Skipping - No Calendar account ID from Test 1")
        return False
    
    try:
        url = f"{COMPOSIO_API_BASE}/api/v2/actions/GOOGLECALENDAR_FIND_EVENT/execute"
        headers = {
            "x-api-key": COMPOSIO_API_KEY,
            "Content-Type": "application/json"
        }
        
        # Calculate time range (now to 7 days from now)
        now = datetime.utcnow()
        time_max = now + timedelta(days=7)
        
        payload = {
            "connectedAccountId": CALENDAR_ACCOUNT_ID,
            "input": {
                "calendar_id": "primary",
                "time_min": now.isoformat() + "Z",
                "time_max": time_max.isoformat() + "Z"
            }
        }
        
        print_info(f"POST {url}")
        print_info(f"Account ID: {CALENDAR_ACCOUNT_ID}")
        print_info(f"Time range: {now.isoformat()} to {time_max.isoformat()}")
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        print_info(f"Response keys: {list(data.keys())}")
        
        # Check for events data
        if 'data' not in data:
            print_error("Response missing 'data' field")
            print_error(f"Response: {json.dumps(data, indent=2)[:500]}")
            return False
        
        print_success("Calendar execution successful - returns 200 with data")
        
        # Try to extract events (structure may vary)
        events_data = data['data']
        events = []
        
        if isinstance(events_data, dict):
            events = events_data.get('events', events_data.get('event_data', []))
        elif isinstance(events_data, list):
            events = events_data
        
        print_success(f"Found {len(events)} events in response")
        
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# TEST 4: Composio API endpoints via app API
# ============================================================================
def test_app_composio_endpoints():
    print_test("Test 4: Composio API endpoints via app API")
    
    # First, login to get auth token
    try:
        print_info("Logging in to get auth token...")
        login_url = f"{APP_BASE_URL}/api/auth/login"
        login_payload = {
            "email": AUTH_EMAIL,
            "passcode": AUTH_PASSCODE
        }
        
        response = requests.post(login_url, json=login_payload, timeout=10)
        
        if response.status_code != 200:
            print_error(f"Login failed: {response.status_code}")
            print_error(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        token = data.get('token')
        
        if not token:
            print_error("No token in login response")
            return False
        
        print_success("Login successful")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test 4a: GET /api/composio/toolkits
        print_info("\nTest 4a: GET /api/composio/toolkits")
        url = f"{APP_BASE_URL}/api/composio/toolkits"
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        toolkits = data.get('toolkits', [])
        print_success(f"Returns {len(toolkits)} toolkits")
        
        if len(toolkits) != 8:
            print_error(f"Expected 8 toolkits, got {len(toolkits)}")
            return False
        
        print_success("✅ GET /api/composio/toolkits returns 8 toolkits")
        
        # Test 4b: GET /api/composio/connections?supported=true
        print_info("\nTest 4b: GET /api/composio/connections?supported=true")
        url = f"{APP_BASE_URL}/api/composio/connections?supported=true"
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        connections = data.get('connections', [])
        print_success(f"Returns {len(connections)} filtered connections")
        
        # Verify all connections are supported
        supported_toolkits = ['GMAIL', 'GOOGLECALENDAR', 'GITHUB', 'SLACK', 'GOOGLEDRIVE', 'NOTION', 'TRELLO', 'ZOOM']
        unsupported_found = []
        
        for conn in connections:
            toolkit = conn.get('toolkit', '').upper()
            if toolkit not in supported_toolkits:
                unsupported_found.append(toolkit)
        
        if unsupported_found:
            print_error(f"Found unsupported toolkits: {unsupported_found}")
            return False
        
        print_success("✅ GET /api/composio/connections?supported=true returns filtered connections")
        
        # Test 4c: GET /api/composio/status
        print_info("\nTest 4c: GET /api/composio/status")
        url = f"{APP_BASE_URL}/api/composio/status"
        response = requests.get(url, timeout=10)  # No auth required
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if 'connected' not in data:
            print_error("Response missing 'connected' field")
            return False
        
        if data['connected'] != True:
            print_error(f"Expected connected: true, got {data['connected']}")
            return False
        
        print_success("✅ GET /api/composio/status returns connected: true")
        
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# TEST 5: Composio Disconnect
# ============================================================================
def test_composio_disconnect():
    print_test("Test 5: Composio Disconnect")
    
    # First, login to get auth token
    try:
        print_info("Logging in to get auth token...")
        login_url = f"{APP_BASE_URL}/api/auth/login"
        login_payload = {
            "email": AUTH_EMAIL,
            "passcode": AUTH_PASSCODE
        }
        
        response = requests.post(login_url, json=login_payload, timeout=10)
        
        if response.status_code != 200:
            print_error(f"Login failed: {response.status_code}")
            return False
        
        data = response.json()
        token = data.get('token')
        
        if not token:
            print_error("No token in login response")
            return False
        
        print_success("Login successful")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get connections to find one to disconnect
        print_info("Getting connections list...")
        url = f"{APP_BASE_URL}/api/composio/connections"
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print_error(f"Failed to get connections: {response.status_code}")
            return False
        
        data = response.json()
        connections = data.get('connections', [])
        
        if len(connections) == 0:
            print_error("No connections to test disconnect with")
            return False
        
        # Pick the first connection
        test_connection = connections[0]
        connection_id = test_connection.get('id')
        toolkit = test_connection.get('toolkit')
        
        print_info(f"Testing disconnect with connection: {connection_id} ({toolkit})")
        
        # Test disconnect
        url = f"{APP_BASE_URL}/api/composio/disconnect"
        payload = {"connectionId": connection_id}
        
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        
        if response.status_code != 200:
            print_error(f"Disconnect failed: {response.status_code}")
            print_error(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        if not data.get('success'):
            print_error(f"Disconnect returned success: false")
            print_error(f"Response: {json.dumps(data, indent=2)}")
            return False
        
        print_success(f"✅ Successfully disconnected {toolkit} connection")
        
        # Verify connection is removed
        print_info("Verifying connection is removed...")
        url = f"{APP_BASE_URL}/api/composio/connections"
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print_error(f"Failed to verify: {response.status_code}")
            return False
        
        data = response.json()
        new_connections = data.get('connections', [])
        
        # Check if the connection is still in the list
        still_exists = any(conn.get('id') == connection_id for conn in new_connections)
        
        if still_exists:
            print_error("Connection still exists after disconnect")
            return False
        
        print_success("✅ Connection successfully removed from list")
        
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# MAIN
# ============================================================================
def main():
    print("\n" + "="*80)
    print("COMPOSIO INTEGRATION TESTING FOR TELEGRAM BOT")
    print("Testing the underlying Composio infrastructure")
    print("="*80)
    
    # Initialize global variables
    global GMAIL_ACCOUNT_ID, CALENDAR_ACCOUNT_ID
    GMAIL_ACCOUNT_ID = None
    CALENDAR_ACCOUNT_ID = None
    
    results = {}
    
    # Run tests
    results['Test 1: Composio Active Accounts REST API'] = test_composio_active_accounts()
    results['Test 2: Composio Gmail Execution'] = test_composio_gmail_execution()
    results['Test 3: Composio Calendar Execution'] = test_composio_calendar_execution()
    results['Test 4: Composio API endpoints via app API'] = test_app_composio_endpoints()
    results['Test 5: Composio Disconnect'] = test_composio_disconnect()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} tests passed ({int(passed/total*100)}%)")
    print("="*80)
    
    # Exit with appropriate code
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
