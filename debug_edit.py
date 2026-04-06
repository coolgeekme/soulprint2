#!/usr/bin/env python3
"""
Simple test to debug edit detection issue
"""

import requests
import json

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
AUTH_EMAIL = "testchat@example.com"
AUTH_PASSCODE = "Test123456"

def get_auth_token():
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": AUTH_EMAIL, "passcode": AUTH_PASSCODE}
    )
    return response.json()["token"]

def test_edit_detection():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Create a new conversation
    conv_response = requests.post(
        f"{BASE_URL}/api/conversations",
        json={"title": "Edit Detection Debug"},
        headers=headers
    )
    conv_id = conv_response.json()["id"]
    print(f"Created conversation: {conv_id}")
    
    # Generate an image
    print("Generating image...")
    img_response = requests.post(
        f"{BASE_URL}/api/chat/stream",
        json={"content": "create an image of a red sports car", "conversationId": conv_id},
        headers=headers,
        stream=True
    )
    
    # Parse the stream to get the image URL
    image_url = None
    for line in img_response.iter_lines(decode_unicode=True):
        if line and line.strip():
            try:
                event = json.loads(line)
                print(f"Event: {event.get('type')} - {event}")
                if event.get("type") == "image":
                    image_url = event.get("url")
                    print(f"Image generated: {image_url}")
                elif event.get("type") == "done":
                    break
            except json.JSONDecodeError:
                print(f"Non-JSON line: {line[:50]}")
                continue
    
    if not image_url:
        print("Failed to generate image")
        return
    
    # Check messages in conversation
    print("Checking messages...")
    msg_response = requests.get(
        f"{BASE_URL}/api/messages?conversationId={conv_id}",
        headers=headers
    )
    messages = msg_response.json()
    print(f"Found {len(messages)} messages")
    
    for i, msg in enumerate(messages):
        print(f"Message {i+1}: role={msg.get('role')}, content_type={msg.get('content_type')}, has_image_url={bool(msg.get('image_url'))}")
        if msg.get('image_url'):
            print(f"  Image URL: {msg.get('image_url')}")
    
    # Now try to edit the image
    print("\nTesting edit request...")
    edit_response = requests.post(
        f"{BASE_URL}/api/chat/stream",
        json={"content": "make the car blue", "conversationId": conv_id},
        headers=headers,
        stream=True
    )
    
    # Check if edit was triggered
    edit_triggered = False
    for line in edit_response.iter_lines(decode_unicode=True):
        if line and line.strip():
            try:
                event = json.loads(line)
                if event.get("type") == "generating_visual" and event.get("visualType") == "edit":
                    edit_triggered = True
                    print("✅ Edit detection triggered!")
                    break
                elif event.get("type") == "done":
                    break
            except:
                continue
    
    if not edit_triggered:
        print("❌ Edit detection did not trigger")

if __name__ == "__main__":
    test_edit_detection()