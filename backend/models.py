from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)  # In production, hash passwords!
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sessions = db.relationship('Session', backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Session(db.Model):
    __tablename__ = 'sessions'

    id = db.Column(db.String(50), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Optional for now
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    # Analysis data stored as JSON
    analysis_data = db.Column(db.Text, default='{}')  # JSON string
    ai_feedback_data = db.Column(db.Text, default='{}')  # JSON string

    # Metadata
    total_points = db.Column(db.Integer, default=0)
    duration = db.Column(db.Integer, default=0)  # in seconds
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    eye_tracking_data = db.relationship('EyeTrackingData', backref='session', lazy=True, cascade='all, delete-orphan')
    speech_analysis_data = db.relationship('SpeechAnalysisData', backref='session', lazy=True, cascade='all, delete-orphan')
    ai_recommendations = db.relationship('AIRecommendation', backref='session', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'is_active': self.is_active,
            'analysis': json.loads(self.analysis_data) if self.analysis_data else {},
            'ai_feedback': json.loads(self.ai_feedback_data) if self.ai_feedback_data else {},
            'total_points': self.total_points,
            'duration': self.duration,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def set_analysis(self, analysis_dict):
        self.analysis_data = json.dumps(analysis_dict)

    def get_analysis(self):
        return json.loads(self.analysis_data) if self.analysis_data else {}

    def set_ai_feedback(self, feedback_dict):
        self.ai_feedback_data = json.dumps(feedback_dict)

    def get_ai_feedback(self):
        return json.loads(self.ai_feedback_data) if self.ai_feedback_data else {}

class EyeTrackingData(db.Model):
    __tablename__ = 'eye_tracking_data'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(50), db.ForeignKey('sessions.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # Eye tracking metrics
    eye_contact = db.Column(db.Boolean, default=False)
    eye_contact_percentage = db.Column(db.Float, default=0.0)
    gaze_x = db.Column(db.Float, nullable=True)
    gaze_y = db.Column(db.Float, nullable=True)
    blink_rate = db.Column(db.Float, default=0.0)

    # Additional data as JSON
    frame_data = db.Column(db.Text, default='{}')  # JSON string for additional frame data

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'timestamp': self.timestamp.isoformat(),
            'eye_contact': self.eye_contact,
            'eye_contact_percentage': self.eye_contact_percentage,
            'gaze_x': self.gaze_x,
            'gaze_y': self.gaze_y,
            'blink_rate': self.blink_rate,
            'frame_data': json.loads(self.frame_data) if self.frame_data else {}
        }

class SpeechAnalysisData(db.Model):
    __tablename__ = 'speech_analysis_data'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(50), db.ForeignKey('sessions.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # Speech metrics
    accuracy_score = db.Column(db.Float, default=0.0)
    wpm = db.Column(db.Float, default=0.0)
    grammar_errors = db.Column(db.Integer, default=0)
    spelling_errors = db.Column(db.Integer, default=0)

    # Voice metrics
    average_volume = db.Column(db.Float, default=0.0)
    volume_variance = db.Column(db.Float, default=0.0)
    average_pitch = db.Column(db.Float, default=0.0)
    pitch_range = db.Column(db.Float, default=0.0)
    voice_duration_seconds = db.Column(db.Float, default=0.0)

    # Additional data as JSON
    analysis_details = db.Column(db.Text, default='{}')  # JSON string for detailed analysis

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'timestamp': self.timestamp.isoformat(),
            'accuracy_score': self.accuracy_score,
            'wpm': self.wpm,
            'grammar_errors': self.grammar_errors,
            'spelling_errors': self.spelling_errors,
            'average_volume': self.average_volume,
            'volume_variance': self.volume_variance,
            'average_pitch': self.average_pitch,
            'pitch_range': self.pitch_range,
            'voice_duration_seconds': self.voice_duration_seconds,
            'analysis_details': json.loads(self.analysis_details) if self.analysis_details else {}
        }

class AIRecommendation(db.Model):
    __tablename__ = 'ai_recommendations'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(50), db.ForeignKey('sessions.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Recommendation details
    recommendation_type = db.Column(db.String(50), nullable=False)  # 'eye_contact', 'speech_clarity', etc.
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    priority = db.Column(db.String(20), default='medium')  # 'high', 'medium', 'low'
    status = db.Column(db.String(20), default='pending')  # 'pending', 'completed', 'dismissed'

    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'user_id': self.user_id,
            'recommendation_type': self.recommendation_type,
            'title': self.title,
            'description': self.description,
            'priority': self.priority,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class LeaderboardEntry(db.Model):
    __tablename__ = 'leaderboard_entries'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    period = db.Column(db.String(20), default='all')  # 'daily', 'weekly', 'monthly', 'all'
    score = db.Column(db.Float, default=0.0)
    sessions_count = db.Column(db.Integer, default=0)
    rank = db.Column(db.Integer, nullable=True)

    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'period': self.period,
            'score': self.score,
            'sessions_count': self.sessions_count,
            'rank': self.rank,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class ProgressMetric(db.Model):
    __tablename__ = 'progress_metrics'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    metric_type = db.Column(db.String(50), nullable=False)  # 'eye_contact', 'speech_accuracy', etc.
    value = db.Column(db.Float, default=0.0)
    date = db.Column(db.Date, default=datetime.utcnow().date())

    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'metric_type': self.metric_type,
            'value': self.value,
            'date': self.date.isoformat(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

# Database initialization function
def init_db(app):
    """Initialize the database with the Flask app"""
    db.init_app(app)

    with app.app_context():
        db.create_all()
        print("✅ Database tables created successfully")

# Migration helper for existing data
def migrate_existing_data():
    """Migrate existing file-based data to database"""
    import os
    import json

    sessions_dir = 'sessions'
    if not os.path.exists(sessions_dir):
        print("ℹ️  No existing sessions directory found")
        return

    print("🔄 Migrating existing session data to database...")

    migrated_count = 0
    for filename in os.listdir(sessions_dir):
        if filename.endswith('.json'):
            session_path = os.path.join(sessions_dir, filename)
            try:
                with open(session_path, 'r', encoding='utf-8') as f:
                    session_data = json.load(f)

                # Create database session
                session_id = filename.replace('.json', '')
                db_session = Session(
                    id=session_id,
                    start_time=session_data.get('start_time'),
                    is_active=session_data.get('is_active', False),
                    analysis_data=json.dumps(session_data.get('analysis', {})),
                    ai_feedback_data=json.dumps(session_data.get('ai_feedback', {})),
                    total_points=session_data.get('total_points', 0)
                )

                db.session.add(db_session)
                db.session.commit()
                migrated_count += 1

                print(f"✅ Migrated session: {session_id}")

            except Exception as e:
                print(f"❌ Error migrating session {filename}: {e}")

    print(f"🎉 Migration complete! Migrated {migrated_count} sessions")
