#!/usr/bin/env python3
"""
Detailed test to check conversation follow-up detection
"""

import requests
import json
import time

BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"

REGULAR_USER = {
    "email": "testchat@example.com",
    "passcode": "Test123456"
}

def login():
    response = requests.post(
        f"{API_BASE}/auth/login",
        json=REGULAR_USER,
        timeout=10
    )
    return response.json().get('token')

def send_message(token, conversation_id, content):
    """Send a message and return the response"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{API_BASE}/chat/stream",
        json={
            "content": content,
            "conversation_id": conversation_id
        },
        headers=headers,
        timeout=60,
        stream=True
    )
    return response

def get_messages(token, conversation_id):
    """Get all messages in a conversation"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(
        f"{API_BASE}/messages?conversationId={conversation_id}",
        headers=headers,
        timeout=10
    )
    return response.json()

def main():
    print("="*80)
    print("DETAILED CONVERSATION FOLLOW-UP TEST")
    print("="*80)
    
    token = login()
    print(f"✅ Logged in successfully")
    
    conversation_id = f"test-detailed-{int(time.time())}"
    
    # Send first message
    print(f"\n1. Sending first message...")
    response1 = send_message(token, conversation_id, "Tell me about DealRoom.net and their competitors")
    print(f"   Status: {response1.status_code}")
    print(f"   Content-Type: {response1.headers.get('content-type')}")
    
    # Wait for response to complete
    time.sleep(3)
    
    # Check messages in conversation
    messages_response = get_messages(token, conversation_id)
    messages = messages_response if isinstance(messages_response, list) else []
    print(f"\n2. Messages in conversation after first message:")
    print(f"   Total messages: {len(messages)}")
    for i, msg in enumerate(messages):
        if isinstance(msg, dict):
            role = msg.get('role', 'unknown')
            content_preview = str(msg.get('content', ''))[:50]
            print(f"   [{i}] {role}: {content_preview}...")
        else:
            print(f"   [{i}] {type(msg)}: {str(msg)[:50]}...")
    
    # Send follow-up
    print(f"\n3. Sending follow-up message 'What is the average pricing?'...")
    response2 = send_message(token, conversation_id, "What is the average pricing?")
    print(f"   Status: {response2.status_code}")
    print(f"   Content-Type: {response2.headers.get('content-type')}")
    
    # Wait for response
    time.sleep(3)
    
    # Check messages again
    messages = get_messages(token, conversation_id)
    print(f"\n4. Messages in conversation after follow-up:")
    print(f"   Total messages: {len(messages)}")
    for i, msg in enumerate(messages):
        role = msg.get('role', 'unknown')
        content_preview = str(msg.get('content', ''))[:50]
        print(f"   [{i}] {role}: {content_preview}...")
    
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80)
    print("\nNow check the backend logs for '[Chat] Skipping proactive search' messages")
    print("If the follow-up detection is working, you should see:")
    print("  [Chat] Skipping proactive search — conversational follow-up detected: what is the average pricing?")

if __name__ == "__main__":
    main()
