import os
import sys
sys.path.append('.')

from flask import Flask
from models import db, init_db, User, Session, EyeTrackingData, SpeechAnalysisData, AIRecommendation, LeaderboardEntry, ProgressMetric
import bcrypt
import random
import json
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'speak-analysis-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///instance/speak.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
init_db(app)

def random_date(start, end):
    return start + timedelta(days=random.randint(0, (end - start).days))

def create_users():
    users_data = [
        {'name': 'Dharun', 'email': 'dharun@gmail.com', 'password': 'dharun123'},
        {'name': 'Vasanth', 'email': 'vasanth@gmail.com', 'password': 'vasanth123'},
        {'name': 'Kavin', 'email': 'kavin@gmail.com', 'password': 'kavin123'}
    ]

    created_users = []
    for user_data in users_data:
        existing_user = User.query.filter_by(email=user_data['email']).first()
        if existing_user:
            print(f'User {user_data["email"]} already exists, skipping...')
            created_users.append(existing_user)
            continue

        password_hash = bcrypt.hashpw(user_data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user = User(
            email=user_data['email'],
            password_hash=password_hash,
            name=user_data['name']
        )
        db.session.add(user)
        db.session.commit()
        created_users.append(user)
        print(f'Created user: {user_data["name"]} - {user_data["email"]}')

    return created_users

def create_sessions_for_user(user, max_sessions=10):
    sessions = []
    start_date = datetime.utcnow() - timedelta(days=30)
    end_date = datetime.utcnow()

    num_sessions = random.randint(1, max_sessions)

    for i in range(num_sessions):
        session_id = f'{user.id}_session_{i+1}'

        # Random session data
        duration = random.randint(300, 1800)  # 5-30 minutes
        total_points = random.randint(50, 500)

        # Analysis data
        analysis = {
            'eye_contact_score': random.uniform(0.5, 1.0),
            'speech_accuracy': random.uniform(0.6, 1.0),
            'wpm': random.uniform(120, 200),
            'grammar_errors': random.randint(0, 5),
            'spelling_errors': random.randint(0, 3),
            'average_volume': random.uniform(0.3, 0.9),
            'pitch_range': random.uniform(50, 150)
        }

        # AI feedback
        ai_feedback = {
            'strengths': ['Good eye contact', 'Clear pronunciation', 'Confident delivery'][random.randint(0, 2)],
            'areas_for_improvement': ['Work on pacing', 'Reduce filler words', 'Improve volume control'][random.randint(0, 2)],
            'overall_score': random.uniform(0.7, 1.0)
        }

        session_start = random_date(start_date, end_date)
        session_end = session_start + timedelta(seconds=duration)

        session = Session(
            id=session_id,
            user_id=user.id,
            start_time=session_start,
            end_time=session_end,
            is_active=False,
            total_points=total_points,
            duration=duration
        )
        session.set_analysis(analysis)
        session.set_ai_feedback(ai_feedback)

        db.session.add(session)
        db.session.commit()

        # Create related data
        create_eye_tracking_data(session)
        create_speech_analysis_data(session)
        create_ai_recommendations(session, user)

        sessions.append(session)
        print(f'Created session: {session_id} for {user.name}')

    return sessions

def create_eye_tracking_data(session):
    num_entries = random.randint(5, 20)
    for i in range(num_entries):
        timestamp = session.start_time + timedelta(seconds=random.randint(0, session.duration))
        eye_data = EyeTrackingData(
            session_id=session.id,
            timestamp=timestamp,
            eye_contact=random.choice([True, False]),
            eye_contact_percentage=random.uniform(0, 1),
            gaze_x=random.uniform(0, 1),
            gaze_y=random.uniform(0, 1),
            blink_rate=random.uniform(0, 0.5)
        )
        db.session.add(eye_data)
    db.session.commit()

def create_speech_analysis_data(session):
    num_entries = random.randint(3, 10)
    analysis = session.get_analysis()
    for i in range(num_entries):
        timestamp = session.start_time + timedelta(seconds=random.randint(0, session.duration))
        speech_data = SpeechAnalysisData(
            session_id=session.id,
            timestamp=timestamp,
            accuracy_score=analysis.get('speech_accuracy', 0),
            wpm=analysis.get('wpm', 0),
            grammar_errors=analysis.get('grammar_errors', 0),
            spelling_errors=analysis.get('spelling_errors', 0),
            average_volume=analysis.get('average_volume', 0),
            volume_variance=random.uniform(0.1, 0.5),
            average_pitch=random.uniform(100, 300),
            pitch_range=analysis.get('pitch_range', 0),
            voice_duration_seconds=random.uniform(10, 60)
        )
        db.session.add(speech_data)
    db.session.commit()

def create_ai_recommendations(session, user):
    recommendations = [
        {'type': 'eye_contact', 'title': 'Improve Eye Contact', 'desc': 'Maintain eye contact for longer periods'},
        {'type': 'speech_clarity', 'title': 'Enhance Speech Clarity', 'desc': 'Work on pronunciation and articulation'},
        {'type': 'pacing', 'title': 'Adjust Speaking Pace', 'desc': 'Slow down to improve comprehension'},
        {'type': 'volume', 'title': 'Control Volume', 'desc': 'Maintain consistent volume throughout'},
        {'type': 'confidence', 'title': 'Build Confidence', 'desc': 'Practice more to build speaking confidence'}
    ]

    num_recs = random.randint(1, 3)
    selected_recs = random.sample(recommendations, num_recs)

    for rec in selected_recs:
        ai_rec = AIRecommendation(
            session_id=session.id,
            user_id=user.id,
            recommendation_type=rec['type'],
            title=rec['title'],
            description=rec['desc'],
            priority=random.choice(['high', 'medium', 'low']),
            status=random.choice(['pending', 'completed', 'dismissed'])
        )
        db.session.add(ai_rec)
    db.session.commit()

def create_progress_metrics(users):
    start_date = datetime.utcnow() - timedelta(days=30)
    end_date = datetime.utcnow()

    metric_types = ['eye_contact', 'speech_accuracy', 'wpm', 'volume_control']

    for user in users:
        for metric_type in metric_types:
            for i in range(30):  # Daily metrics for 30 days
                date = start_date + timedelta(days=i)
                value = random.uniform(0.5, 1.0)
                metric = ProgressMetric(
                    user_id=user.id,
                    metric_type=metric_type,
                    value=value,
                    date=date.date()
                )
                db.session.add(metric)
        db.session.commit()
        print(f'Created progress metrics for {user.name}')

def create_leaderboard_entries(users):
    for user in users:
        sessions = Session.query.filter_by(user_id=user.id).all()
        if sessions:
            total_score = sum(s.total_points for s in sessions)
            avg_score = total_score / len(sessions)

            leaderboard_entry = LeaderboardEntry(
                user_id=user.id,
                period='all',
                score=avg_score,
                sessions_count=len(sessions)
            )
            db.session.add(leaderboard_entry)
        db.session.commit()
        print(f'Created leaderboard entry for {user.name}')

with app.app_context():
    print('Starting database population...')

    # Create users
    users = create_users()

    # Create sessions and related data
    for user in users:
        create_sessions_for_user(user, max_sessions=10)

    # Create progress metrics
    create_progress_metrics(users)

    # Create leaderboard entries
    create_leaderboard_entries(users)

    print('\nDatabase population completed!')
    print(f'Total users: {len(users)}')
