from flask_socketio import emit
from database_manager import DatabaseManager

db_manager = DatabaseManager()

def send_dashboard_update(user_id, metrics):
    """
    Emit dashboard update to all connected clients for a specific user
    """
    from app import socketio  # Import inside function to avoid circular import

    # Get user's average metrics across all sessions for accurate dashboard display
    avg_metrics = db_manager.get_user_avg_metrics(user_id)

    payload = {
        "user_id": str(user_id),  # Ensure user_id is string for consistent comparison
        "metrics": {
            "eye_contact": avg_metrics.get("avg_eye_contact", 0),
            "speech_accuracy": avg_metrics.get("avg_speech_accuracy", 0),
            "wpm": avg_metrics.get("avg_wpm", 0),
            "average_score": avg_metrics.get("avg_score", 0)
        },
        "recommendations": metrics.get("recommendations", []),
        "timestamp": metrics.get("timestamp")
    }
    socketio.emit("dashboard_update", payload)
    print(f"📡 Emitted dashboard update for user {user_id}: {payload}")
