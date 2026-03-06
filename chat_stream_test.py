#!/usr/bin/env python3
"""
SoulPrint Chat Stream Test
Tests the streaming chat functionality
"""
import requests
import json
import time

BASE_URL = "https://theme-feature-test.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

TEST_EMAIL = "test@soulprint.com"
TEST_PASSCODE = "Test1234!"

def test_chat_stream():
    """Test the streaming chat endpoint"""
    print("💬 Testing Chat Stream Functionality\n")
    
    # Get authentication token
    login_response = requests.post(f"{API_BASE}/auth/login", json={
        "email": TEST_EMAIL,
        "passcode": TEST_PASSCODE
    })
    
    if login_response.status_code != 200:
        print("❌ Failed to authenticate for chat stream test")
        return False
    
    token = login_response.json()["token"]
    
    # Test streaming chat
    print("=== Testing Chat Stream ===")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    chat_data = {
        "content": "Hello! Can you tell me about yourself?",
        "model": "gpt-4o-mini",
        "provider": "hosted"
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json=chat_data,
            headers=headers,
            stream=True,
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"❌ FAIL | Chat Stream - Status: {response.status_code}")
            try:
                error_data = response.json()
                print(f"    Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"    Response: {response.text[:200]}")
            return False
        
        # Check if it's actually streaming
        content_type = response.headers.get('content-type', '')
        if 'text/event-stream' not in content_type:
            print(f"❌ FAIL | Chat Stream - Expected streaming response, got: {content_type}")
            return False
        
        # Read stream chunks
        chunks_received = 0
        conversation_id = None
        message_id = None
        total_content = ""
        
        try:
            for line in response.iter_lines(decode_unicode=True):
                if line.strip():
                    try:
                        chunk = json.loads(line.strip())
                        chunks_received += 1
                        
                        if chunk.get('type') == 'meta':
                            conversation_id = chunk.get('conversationId')
                            message_id = chunk.get('messageId')
                            print(f"    Meta chunk received - Conversation: {conversation_id[:8] if conversation_id else 'None'}...")
                        
                        elif chunk.get('type') == 'delta':
                            content = chunk.get('content', '')
                            total_content += content
                            if chunks_received <= 5:  # Only print first few chunks
                                print(f"    Delta chunk {chunks_received}: '{content}'")
                        
                        elif chunk.get('type') == 'done':
                            print(f"    Stream completed - Total chunks: {chunks_received}")
                            break
                        
                        elif chunk.get('type') == 'error':
                            print(f"❌ Stream error: {chunk.get('error')}")
                            return False
                        
                        # Safety limit
                        if chunks_received > 100:
                            print("    Stream limit reached (100 chunks)")
                            break
                            
                    except json.JSONDecodeError:
                        print(f"    Invalid JSON chunk: {line[:50]}...")
                        continue
            
            if chunks_received == 0:
                print("❌ FAIL | Chat Stream - No chunks received")
                return False
            
            if not conversation_id:
                print("❌ FAIL | Chat Stream - No conversation ID received")
                return False
            
            if len(total_content) == 0:
                print("❌ FAIL | Chat Stream - No content received")
                return False
            
            print(f"✅ PASS | Chat Stream")
            print(f"    Chunks received: {chunks_received}")
            print(f"    Content length: {len(total_content)} characters")
            print(f"    Content preview: {total_content[:100]}...")
            
            return True
            
        except Exception as e:
            print(f"❌ FAIL | Chat Stream - Stream processing error: {str(e)}")
            return False
        
    except requests.exceptions.Timeout:
        print("❌ FAIL | Chat Stream - Request timeout")
        return False
    except Exception as e:
        print(f"❌ FAIL | Chat Stream - Request error: {str(e)}")
        return False

if __name__ == "__main__":
    test_chat_stream()