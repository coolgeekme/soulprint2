#!/usr/bin/env python3
"""
Test edit detection using existing conversation with image
"""

import requests
import json

# Configuration
BASE_URL = "https://veo-ux-polling.preview.emergentagent.com"
AUTH_EMAIL = "testchat@example.com"
AUTH_PASSCODE = "Test123456"
CONV_ID = "240f53a6-65ce-4ee0-b11e-09ceeb63b07a"  # From previous test

def get_auth_token():
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": AUTH_EMAIL, "passcode": AUTH_PASSCODE}
    )
    return response.json()["token"]

def test_edit_with_existing_conversation():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Check messages in conversation
    print("Checking existing conversation...")
    msg_response = requests.get(
        f"{BASE_URL}/api/messages?conversationId={CONV_ID}",
        headers=headers
    )
    messages = msg_response.json()
    print(f"Found {len(messages)} messages")
    
    # Find the image message
    image_found = False
    for i, msg in enumerate(messages):
        if msg.get('image_url'):
            print(f"✅ Found image in message {i+1}: {msg.get('image_url')}")
            image_found = True
            break
    
    if not image_found:
        print("❌ No image found in conversation")
        return
    
    # Now try to edit the image
    print("\nTesting edit request: 'make the cat wear sunglasses'")
    edit_response = requests.post(
        f"{BASE_URL}/api/chat/stream",
        json={"content": "make the cat wear sunglasses", "conversationId": CONV_ID},
        headers=headers,
        stream=True
    )
    
    # Check if edit was triggered
    edit_triggered = False
    events = []
    for line in edit_response.iter_lines(decode_unicode=True):
        if line and line.strip():
            try:
                event = json.loads(line)
                events.append(event)
                print(f"Event: {event.get('type')} - {event}")
                
                if event.get("type") == "generating_visual" and event.get("visualType") == "edit":
                    edit_triggered = True
                    print("✅ Edit detection triggered!")
                elif "Editing your image" in str(event.get("content", "")):
                    edit_triggered = True
                    print("✅ Edit message detected!")
                elif event.get("type") == "done":
                    break
            except json.JSONDecodeError:
                if "keepalive" not in line:
                    print(f"Non-JSON line: {line[:50]}")
                continue
    
    print(f"\nResult: Edit triggered = {edit_triggered}")
    if not edit_triggered:
        print("❌ Edit detection did not trigger")
        print("This suggests the edit detection logic is not working properly")
    
    return edit_triggered

if __name__ == "__main__":
    test_edit_with_existing_conversation()