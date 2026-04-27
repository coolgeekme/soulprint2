#!/usr/bin/env python3
"""
Simple debug test for chat stream
"""

import requests
import json

BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Authenticate
auth_response = requests.post(
    f"{API_BASE}/auth/login",
    json={"email": "test@soulprint.com", "passcode": "test123"},
    headers={"Content-Type": "application/json"},
    timeout=30
)

if auth_response.status_code != 200:
    print(f"Auth failed: {auth_response.status_code} - {auth_response.text}")
    exit(1)

token = auth_response.json()['token']
print(f"✅ Authenticated successfully")

# Test chat stream
payload = {
    "content": "Hello, this is a test message",
    "model": "gpt-4o-mini"
}

print("📝 Sending chat message...")
response = requests.post(
    f"{API_BASE}/chat/stream",
    json=payload,
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    },
    timeout=60,
    stream=True
)

print(f"Response status: {response.status_code}")
print(f"Content-Type: {response.headers.get('content-type')}")

if response.status_code != 200:
    print(f"❌ Chat failed: {response.text}")
    exit(1)

print("📝 Reading stream...")
events = []
line_count = 0

for line in response.iter_lines(decode_unicode=True):
    line_count += 1
    print(f"Line {line_count}: {repr(line)}")
    
    if line.strip():
        try:
            if line.startswith('data: '):
                json_data = line[6:]  # Remove "data: " prefix
                if json_data.strip():
                    event = json.loads(json_data)
                    events.append(event)
                    print(f"  → Event: {event.get('type', 'unknown')} - {json.dumps(event, indent=2)}")
        except json.JSONDecodeError as e:
            print(f"  → JSON error: {e}")
    
    if line_count > 50:  # Prevent infinite loop
        break

print(f"\n📊 Total events captured: {len(events)}")
for i, event in enumerate(events):
    print(f"Event {i+1}: {event.get('type', 'unknown')}")