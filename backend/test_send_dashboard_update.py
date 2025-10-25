#!/usr/bin/env python3
"""
Test script for send_dashboard_update function
"""

from sockets import send_dashboard_update

def test_send_dashboard_update():
    """Test the send_dashboard_update function with mock data"""
    # Mock user_id and metrics
    user_id = "test_user_123"
    metrics = {
        "eye_contact": 85.5,
        "speech_accuracy": 92.3,
        "wpm": 150,
        "average_score": 88.9,
        "recommendations": ["Practice more eye contact", "Work on pacing"],
        "timestamp": "2025-10-22T21:12:00Z"
    }

    print("Testing send_dashboard_update function...")
    print(f"User ID: {user_id}")
    print(f"Metrics: {metrics}")

    try:
        # Call the function
        send_dashboard_update(user_id, metrics)
        print("✅ Function executed successfully")
    except Exception as e:
        print(f"❌ Function failed with error: {e}")

if __name__ == "__main__":
    test_send_dashboard_update()
