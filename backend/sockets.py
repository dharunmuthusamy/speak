from flask_socketio import emit

def send_dashboard_update(user_id, metrics):
    """
    Emit dashboard update to all connected clients for a specific user
    """
    from app import socketio  # Import inside function to avoid circular import
    payload = {
        "user_id": str(user_id),  # Ensure user_id is string for consistent comparison
        "metrics": {
            "eye_contact": metrics.get("eye_contact", 0),
            "speech_accuracy": metrics.get("speech_accuracy", 0),
            "wpm": metrics.get("wpm", 0),
            "average_score": metrics.get("average_score", 0)
        },
        "recommendations": metrics.get("recommendations", []),
        "timestamp": metrics.get("timestamp")
    }
    socketio.emit("dashboard_update", payload)
    print(f"📡 Emitted dashboard update for user {user_id}: {payload}")
