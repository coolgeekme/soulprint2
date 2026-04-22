#!/usr/bin/env python3
"""
Debug script to check import history details
"""

import requests
import json

# Configuration
BASE_URL = "https://perfil-soul.preview.emergentagent.com"
AUTH_EMAIL = "testchat@example.com"
AUTH_PASSWORD = "Test123456"

def authenticate():
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": AUTH_EMAIL, "passcode": AUTH_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("token")
        if token:
            session.headers.update({"Authorization": f"Bearer {token}"})
            return session
    return None

def check_import_history():
    session = authenticate()
    if not session:
        print("❌ Authentication failed")
        return
    
    print("🔍 Checking import history details...")
    
    response = session.get(f"{BASE_URL}/api/import/data")
    
    if response.status_code == 200:
        data = response.json()
        imports = data.get("imports", [])
        
        print(f"📋 Found {len(imports)} import records:")
        
        for i, imp in enumerate(imports):
            print(f"\nImport {i+1}:")
            print(f"  Type: {imp.get('type', 'unknown')}")
            print(f"  Message Count: {imp.get('messageCount', 0)}")
            print(f"  Conversation Count: {imp.get('conversationCount', 0)}")
            print(f"  Status: {imp.get('status', 'unknown')}")
            print(f"  Created: {imp.get('created_at', 'unknown')}")
            print(f"  Source: {imp.get('source', 'unknown')}")
            print(f"  All fields: {json.dumps(imp, indent=2, default=str)}")
    else:
        print(f"❌ Failed to get import history: {response.status_code} - {response.text}")

if __name__ == "__main__":
    check_import_history()