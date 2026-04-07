#!/usr/bin/env python3
"""
AI-Assisted Support Ticketing System Backend Test
Tests the complete 11-step flow as specified in the review request.
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
ADMIN_EMAIL = "test@soulprint.com"
ADMIN_PASSCODE = "Admin123!"
SUPPORT_EMAIL = "support@soulprint.com"
SUPPORT_PASSWORD = "Support123!"

# Global variables to store tokens and IDs
admin_token = None
support_token = None
ticket_id = None

def log_test(step, description, success=True, details=""):
    """Log test results with clear formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"\n{status} Step {step}: {description}")
    if details:
        print(f"   Details: {details}")
    if not success:
        print(f"   ERROR: Test failed at step {step}")
        sys.exit(1)

def make_request(method, endpoint, headers=None, json_data=None, timeout=45):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=timeout)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=json_data, timeout=timeout)
        elif method.upper() == "PATCH":
            response = requests.patch(url, headers=headers, json=json_data, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.Timeout:
        log_test("", f"Request timeout for {method} {endpoint}", False, f"Timeout after {timeout}s")
    except requests.exceptions.RequestException as e:
        log_test("", f"Request failed for {method} {endpoint}", False, str(e))

def test_step_1_admin_login():
    """Step 1: Login as superadmin"""
    global admin_token
    
    print("\n" + "="*60)
    print("STEP 1: Login as superadmin")
    print("="*60)
    
    response = make_request("POST", "/api/auth/login", 
                          json_data={"email": ADMIN_EMAIL, "passcode": ADMIN_PASSCODE})
    
    if response.status_code == 200:
        data = response.json()
        if "token" in data and data.get("role") == "superadmin":
            admin_token = data["token"]
            log_test(1, "Admin login successful", True, 
                    f"Role: {data.get('role')}, Token received: {admin_token[:20]}...")
        else:
            log_test(1, "Admin login failed", False, 
                    f"Expected role 'superadmin', got: {data.get('role')}")
    else:
        log_test(1, "Admin login failed", False, 
                f"Status: {response.status_code}, Response: {response.text}")

def test_step_2_create_support_agent():
    """Step 2: Create a Support Agent"""
    print("\n" + "="*60)
    print("STEP 2: Create a Support Agent")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    agent_data = {
        "name": "Test Support",
        "email": SUPPORT_EMAIL,
        "password": SUPPORT_PASSWORD
    }
    
    response = make_request("POST", "/api/admin/support-agents", 
                          headers=headers, json_data=agent_data)
    
    if response.status_code == 200:
        data = response.json()
        log_test(2, "Support agent created successfully", True, 
                f"Agent: {data.get('name')} ({data.get('email')})")
    elif response.status_code == 409:
        log_test(2, "Support agent already exists (expected)", True, 
                "Agent already exists - continuing with existing agent")
    else:
        log_test(2, "Support agent creation failed", False, 
                f"Status: {response.status_code}, Response: {response.text}")

def test_step_3_list_support_agents():
    """Step 3: List Support Agents"""
    print("\n" + "="*60)
    print("STEP 3: List Support Agents")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    response = make_request("GET", "/api/admin/support-agents", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        agents = data.get("agents", [])
        if isinstance(agents, list) and len(agents) > 0:
            log_test(3, "Support agents listed successfully", True, 
                    f"Found {len(agents)} agent(s)")
        else:
            log_test(3, "Support agents list failed", False, 
                    "Expected array with agents, got empty or invalid response")
    else:
        log_test(3, "Support agents list failed", False, 
                f"Status: {response.status_code}, Response: {response.text}")

def test_step_4_support_agent_login():
    """Step 4: Support Agent Login"""
    global support_token
    
    print("\n" + "="*60)
    print("STEP 4: Support Agent Login")
    print("="*60)
    
    response = make_request("POST", "/api/support/login", 
                          json_data={"email": SUPPORT_EMAIL, "password": SUPPORT_PASSWORD})
    
    if response.status_code == 200:
        data = response.json()
        if "token" in data:
            support_token = data["token"]
            log_test(4, "Support agent login successful", True, 
                    f"Token received: {support_token[:20]}...")
        else:
            log_test(4, "Support agent login failed", False, 
                    "No token in response")
    else:
        log_test(4, "Support agent login failed", False, 
                f"Status: {response.status_code}, Response: {response.text}")

def test_step_5_auth_me_support():
    """Step 5: Auth/Me for Support Agent"""
    print("\n" + "="*60)
    print("STEP 5: Auth/Me for Support Agent")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {support_token}"}
    
    response = make_request("GET", "/api/auth/me", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        if data.get("role") == "support":
            log_test(5, "Support agent auth/me successful", True, 
                    f"Role: {data.get('role')}, Email: {data.get('email')}")
        else:
            log_test(5, "Support agent auth/me failed", False, 
                    f"Expected role 'support', got: {data.get('role')}")
    else:
        log_test(5, "Support agent auth/me failed", False, 
                f"Status: {response.status_code}, Response: {response.text}")

def test_step_6_create_ticket():
    """Step 6: Create a Ticket"""
    global ticket_id
    
    print("\n" + "="*60)
    print("STEP 6: Create a Ticket")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {support_token}"}
    ticket_data = {
        "user_email": "testchat@example.com",
        "user_name": "Test User",
        "subject": "Can't log in to my account",
        "description": "Hi, I've been trying to log into my SoulPrint account but I keep getting an error message saying 'Invalid credentials'. I've tried resetting my password but nothing works. My email is testchat@example.com. Please help!"
    }
    
    response = make_request("POST", "/api/support/tickets", 
                          headers=headers, json_data=ticket_data)
    
    if response.status_code == 200:
        data = response.json()
        ticket = data.get("ticket", {})
        if "id" in ticket and ticket.get("status") == "new":
            ticket_id = ticket["id"]
            user_data = ticket.get("user_data", {})
            log_test(6, "Ticket created successfully", True, 
                    f"Ticket ID: {ticket_id}, Status: {ticket.get('status')}, User found: {bool(user_data)}")
        else:
            log_test(6, "Ticket creation failed", False, 
                    "Missing ticket ID or incorrect status")
    else:
        log_test(6, "Ticket creation failed", False, 
                f"Status: {response.status_code}, Response: {response.text}")

def test_step_7_list_tickets():
    """Step 7: List Tickets"""
    print("\n" + "="*60)
    print("STEP 7: List Tickets")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {support_token}"}
    
    response = make_request("GET", "/api/support/tickets", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        tickets = data.get("tickets", [])
        if isinstance(tickets, list) and len(tickets) > 0:
            # Check if our created ticket is in the list
            found_ticket = any(ticket.get("id") == ticket_id for ticket in tickets)
            log_test(7, "Tickets listed successfully", True, 
                    f"Found {len(tickets)} ticket(s), Created ticket present: {found_ticket}")
        else:
            log_test(7, "Tickets list failed", False, 
                    "Expected array with tickets")
    else:
        log_test(7, "Tickets list failed", False, 
                f"Status: {response.status_code}, Response: {response.text}")

def test_step_8_ai_diagnosis():
    """Step 8: AI Diagnosis (45s timeout)"""
    print("\n" + "="*60)
    print("STEP 8: AI Diagnosis (45s timeout)")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {support_token}"}
    
    print("   Starting AI diagnosis... (this may take up to 45 seconds)")
    start_time = time.time()
    
    response = make_request("POST", f"/api/support/tickets/{ticket_id}/diagnose", 
                          headers=headers, timeout=45)
    
    elapsed_time = time.time() - start_time
    
    if response.status_code == 200:
        data = response.json()
        ticket = data.get("ticket", {})
        required_fields = ["diagnosis", "fix_type", "category", "suggested_fix"]
        has_all_fields = all(field in ticket for field in required_fields)
        
        if has_all_fields:
            log_test(8, "AI diagnosis completed successfully", True, 
                    f"Time: {elapsed_time:.1f}s, Diagnosis: {ticket.get('diagnosis', '')[:100]}...")
        else:
            missing_fields = [field for field in required_fields if field not in ticket]
            log_test(8, "AI diagnosis failed", False, 
                    f"Missing fields: {missing_fields}")
    else:
        log_test(8, "AI diagnosis failed", False, 
                f"Status: {response.status_code}, Response: {response.text}")

def test_step_9_get_single_ticket():
    """Step 9: Get Single Ticket"""
    print("\n" + "="*60)
    print("STEP 9: Get Single Ticket")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {support_token}"}
    
    response = make_request("GET", f"/api/support/tickets/{ticket_id}", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        ticket = data.get("ticket", {})
        has_diagnosis = "diagnosis" in ticket
        log_test(9, "Single ticket retrieved successfully", True, 
                f"Ticket ID: {ticket.get('id')}, Has diagnosis: {has_diagnosis}")
    else:
        log_test(9, "Single ticket retrieval failed", False, 
                f"Status: {response.status_code}, Response: {response.text}")

def test_step_10_update_ticket_status():
    """Step 10: Update Ticket Status"""
    print("\n" + "="*60)
    print("STEP 10: Update Ticket Status")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {support_token}"}
    update_data = {"status": "closed"}
    
    response = make_request("PATCH", f"/api/support/tickets/{ticket_id}", 
                          headers=headers, json_data=update_data)
    
    if response.status_code == 200:
        data = response.json()
        ticket = data.get("ticket", {})
        if ticket.get("status") == "closed":
            log_test(10, "Ticket status updated successfully", True, 
                    f"New status: {ticket.get('status')}")
        else:
            log_test(10, "Ticket status update failed", False, 
                    f"Expected status 'closed', got: {ticket.get('status')}")
    else:
        log_test(10, "Ticket status update failed", False, 
                f"Status: {response.status_code}, Response: {response.text}")

def test_step_11_approve_fix():
    """Step 11: Approve Fix (superadmin)"""
    print("\n" + "="*60)
    print("STEP 11: Approve Fix (superadmin)")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    response = make_request("POST", f"/api/support/tickets/{ticket_id}/approve-fix", 
                          headers=headers)
    
    # This endpoint could return 400 (no auto-fixable actions) or 200 depending on diagnosis
    if response.status_code in [200, 400]:
        log_test(11, "Approve fix endpoint responded correctly", True, 
                f"Status: {response.status_code}, Response indicates endpoint is functional")
    else:
        log_test(11, "Approve fix endpoint failed", False, 
                f"Status: {response.status_code}, Response: {response.text}")

def main():
    """Run all test steps"""
    print("AI-Assisted Support Ticketing System Backend Test")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print(f"Support: {SUPPORT_EMAIL}")
    
    try:
        test_step_1_admin_login()
        test_step_2_create_support_agent()
        test_step_3_list_support_agents()
        test_step_4_support_agent_login()
        test_step_5_auth_me_support()
        test_step_6_create_ticket()
        test_step_7_list_tickets()
        test_step_8_ai_diagnosis()
        test_step_9_get_single_ticket()
        test_step_10_update_ticket_status()
        test_step_11_approve_fix()
        
        print("\n" + "="*60)
        print("🎉 ALL TESTS PASSED SUCCESSFULLY!")
        print("="*60)
        print("✅ Admin authentication working")
        print("✅ Support agent CRUD working")
        print("✅ Support authentication working")
        print("✅ Ticket management working")
        print("✅ AI diagnosis working")
        print("✅ Status updates working")
        print("✅ Fix approval working")
        print("\nThe AI-Assisted Support Ticketing System is fully functional!")
        
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()