#!/usr/bin/env python3
"""
Debug test to check message count and context_info triggering
"""

import requests
import json

BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Authenticate
auth_response = requests.post(
    f"{API_BASE}/auth/login",
    json={"email": "testchat@example.com", "passcode": "Test123456"},
    headers={"Content-Type": "application/json"},
    timeout=30
)

if auth_response.status_code != 200:
    print(f"Auth failed: {auth_response.status_code} - {auth_response.text}")
    exit(1)

token = auth_response.json()['token']
print(f"✅ Authenticated successfully")

conversation_id = None
messages_sent = 0

# Send messages and check for context_info
for i in range(25):  # Send 25 messages to be sure we exceed 20
    message = f"Message {i+1}: Testing context awareness with a longer message to build up the conversation history."
    
    payload = {
        "content": message,
        "model": "gpt-4o-mini"
    }
    
    if conversation_id:
        payload["conversationId"] = conversation_id
    
    print(f"📝 Sending message {i+1}...")
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
    
    if response.status_code != 200:
        print(f"❌ Message {i+1} failed: {response.status_code} - {response.text}")
        break
    
    # Parse events
    events = []
    context_info_found = False
    
    for line in response.iter_lines(decode_unicode=True):
        if line.strip():
            try:
                event = json.loads(line)
                events.append(event)
                
                if event.get('type') == 'context_info':
                    context_info_found = True
                    print(f"🎉 FOUND context_info after {i+1} messages!")
                    print(f"   total_messages: {event.get('total_messages')}")
                    print(f"   context_messages: {event.get('context_messages')}")
                    print(f"   trimmed: {event.get('trimmed')}")
                    exit(0)  # Success!
                
                if event.get('type') == 'meta' and not conversation_id:
                    conversation_id = event.get('conversationId')
                    print(f"✅ Started conversation: {conversation_id}")
                    
            except json.JSONDecodeError as e:
                print(f"JSON error: {e}")
    
    messages_sent += 1
    
    if i % 5 == 4:  # Every 5 messages
        print(f"📊 Sent {messages_sent} messages, no context_info yet...")

print(f"❌ No context_info found after {messages_sent} messages")
print(f"Conversation ID: {conversation_id}")