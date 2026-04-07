#!/usr/bin/env python3
"""
Debug ticket data to see what's actually stored
"""

import requests
import json

BASE_URL = "https://soulprint-engine.preview.emergentagent.com"

def test_ticket_data():
    # Login as admin
    login_data = {
        "email": "test@soulprint.com",
        "passcode": "Admin123!"
    }
    
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        return
        
    admin_token = response.json()["token"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get all tickets
    response = requests.get(f"{BASE_URL}/api/support/tickets", headers=headers)
    if response.status_code != 200:
        print(f"Get tickets failed: {response.text}")
        return
        
    result = response.json()
    print(f"Raw response: {result}")
    
    # Handle different response formats
    if isinstance(result, list):
        tickets = result
    elif isinstance(result, dict) and "tickets" in result:
        tickets = result["tickets"]
    else:
        print(f"Unexpected response format: {result}")
        return
        
    if not tickets:
        print("No tickets found")
        return
        
    # Find the most recent ace_escalation ticket
    ace_ticket = None
    for ticket in tickets:
        if isinstance(ticket, dict) and ticket.get("source") == "ace_escalation":
            ace_ticket = ticket
            break
            
    if not ace_ticket:
        print("No ace_escalation ticket found")
        return
        
    print("=== ACE ESCALATION TICKET DATA ===")
    print(json.dumps(ace_ticket, indent=2, default=str))
    
    # Also get the specific ticket
    ticket_id = ace_ticket["id"]
    response = requests.get(f"{BASE_URL}/api/support/tickets/{ticket_id}", headers=headers)
    if response.status_code == 200:
        specific_ticket = response.json()
        print("\n=== SPECIFIC TICKET DATA ===")
        print(json.dumps(specific_ticket, indent=2, default=str))
    else:
        print(f"Get specific ticket failed: {response.text}")

if __name__ == "__main__":
    test_ticket_data()