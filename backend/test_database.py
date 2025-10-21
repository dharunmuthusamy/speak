#!/usr/bin/env python3
"""
Comprehensive Database Testing Script for SPEAK Application
Tests all database tables and operations to ensure proper connectivity and functionality.
"""

import sys
import os
import json
from datetime import datetime, timedelta
import traceback

# Add the current directory to Python path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models import db, init_db, User, Session, EyeTrackingData, SpeechAnalysisData, AIRecommendation, LeaderboardEntry, ProgressMetric
from database_manager import DatabaseManager
from flask import Flask

def create_test_app():
    """Create a test Flask app for database testing"""
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'test-key'
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///speak.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    return app

def test_database_connection(app):
    """Test basic database connection"""
    print("🔍 Testing database connection...")
    try:
        with app.app_context():
            db.create_all()
            print("✅ Database connection successful")
            print("✅ Tables created successfully")
            return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def test_user_operations(db_manager, app):
    """Test User table operations"""
    print("\n👤 Testing User operations...")
    try:
        with app.app_context():
            # Create user
            user_data = db_manager.create_user(
                email="test@example.com",
                password_hash="hashed_password",
                name="Test User"
            )
            print(f"✅ User created: {user_data}")

            # Get user by email
            retrieved_user = db_manager.get_user_by_email("test@example.com")
            print(f"✅ User retrieved by email: {retrieved_user}")

            # Get user by ID
            user_id = user_data['id']
            retrieved_user_by_id = db_manager.get_user_by_id(user_id)
            print(f"✅ User retrieved by ID: {retrieved_user_by_id}")

            # Update user
            updated_user = db_manager.update_user(user_id, name="Updated Test User")
            print(f"✅ User updated: {updated_user}")

            return True
    except Exception as e:
        print(f"❌ User operations failed: {e}")
        traceback.print_exc()
        return False

def test_session_operations(db_manager, app, user_id):
    """Test Session table operations"""
    print("\n🎯 Testing Session operations...")
    try:
        with app.app_context():
            # Create session
            session_data = db_manager.create_session("test_session_001", user_id)
            print(f"✅ Session created: {session_data}")

            # Get session
            retrieved_session = db_manager.get_session("test_session_001")
            print(f"✅ Session retrieved: {retrieved_session}")

            # Update session analysis
            analysis_data = {
                'core_metrics': {
                    'eye_contact_score': 85.0,
                    'focus_consistency': 80.0,
                    'blink_rate': 15.0,
                    'total_eye_contact_time': 45.0
                },
                'voice_metrics': {
                    'average_volume': 65.0,
                    'volume_variance': 10.0,
                    'average_pitch': 120.0,
                    'pitch_range': 50.0,
                    'voice_duration_seconds': 60.0
                }
            }
            ai_feedback = {
                'overall_assessment': 'Good performance',
                'performance_rating': 'Good',
                'key_strengths': ['Eye contact', 'Volume control'],
                'areas_for_improvement': ['Pacing', 'Clarity']
            }

            updated_session = db_manager.update_session_analysis(
                "test_session_001",
                analysis_data,
                ai_feedback
            )
            print(f"✅ Session analysis updated: {updated_session}")

            # End session
            ended_session = db_manager.end_session("test_session_001")
            print(f"✅ Session ended: {ended_session}")

            # Get user sessions
            user_sessions = db_manager.get_user_sessions(user_id, limit=10)
            print(f"✅ User sessions retrieved: {len(user_sessions)} sessions")

            return True
    except Exception as e:
        print(f"❌ Session operations failed: {e}")
        traceback.print_exc()
        return False

def test_eye_tracking_operations(db_manager, app):
    """Test EyeTrackingData table operations"""
    print("\n👁️ Testing Eye Tracking operations...")
    try:
        with app.app_context():
            eye_data = {
                'eye_contact': True,
                'eye_contact_percentage': 85.0,
                'gaze_x': 0.5,
                'gaze_y': 0.3,
                'blink_rate': 12.0,
                'frame_data': {'confidence': 0.95, 'landmarks': [1, 2, 3]}
            }

            # Store eye tracking data
            stored_data = db_manager.store_eye_tracking_data("test_session_001", eye_data)
            print(f"✅ Eye tracking data stored: {stored_data}")

            # Get eye tracking data
            retrieved_data = db_manager.get_eye_tracking_data("test_session_001")
            print(f"✅ Eye tracking data retrieved: {len(retrieved_data)} records")

            return True
    except Exception as e:
        print(f"❌ Eye tracking operations failed: {e}")
        traceback.print_exc()
        return False

def test_speech_analysis_operations(db_manager, app):
    """Test SpeechAnalysisData table operations"""
    print("\n🎤 Testing Speech Analysis operations...")
    try:
        with app.app_context():
            speech_data = {
                'accuracy_score': 78.5,
                'wpm': 145.0,
                'grammar_errors': 2,
                'spelling_errors': 1,
                'average_volume': 68.0,
                'volume_variance': 8.5,
                'average_pitch': 125.0,
                'pitch_range': 45.0,
                'voice_duration_seconds': 55.0,
                'analysis_details': {'fluency_score': 82.0, 'clarity_score': 75.0}
            }

            # Store speech analysis data
            stored_data = db_manager.store_speech_analysis_data("test_session_001", speech_data)
            print(f"✅ Speech analysis data stored: {stored_data}")

            # Get speech analysis data
            retrieved_data = db_manager.get_speech_analysis_data("test_session_001")
            print(f"✅ Speech analysis data retrieved: {len(retrieved_data)} records")

            return True
    except Exception as e:
        print(f"❌ Speech analysis operations failed: {e}")
        traceback.print_exc()
        return False

def test_ai_recommendation_operations(db_manager, app, user_id):
    """Test AIRecommendation table operations"""
    print("\n🤖 Testing AI Recommendation operations...")
    try:
        with app.app_context():
            recommendation_data = {
                'type': 'eye_contact',
                'title': 'Improve Eye Contact',
                'description': 'Maintain eye contact for 70% of speaking time',
                'priority': 'high'
            }

            # Create AI recommendation
            created_rec = db_manager.create_ai_recommendation(
                "test_session_001",
                user_id,
                recommendation_data
            )
            print(f"✅ AI recommendation created: {created_rec}")

            # Get user recommendations
            user_recs = db_manager.get_user_recommendations(user_id, limit=10)
            print(f"✅ User recommendations retrieved: {len(user_recs)} recommendations")

            # Update recommendation status
            if user_recs:
                rec_id = user_recs[0]['id']
                updated_rec = db_manager.update_recommendation_status(rec_id, 'completed')
                print(f"✅ Recommendation status updated: {updated_rec}")

            return True
    except Exception as e:
        print(f"❌ AI recommendation operations failed: {e}")
        traceback.print_exc()
        return False

def test_leaderboard_operations(db_manager, app, user_id):
    """Test LeaderboardEntry table operations"""
    print("\n🏆 Testing Leaderboard operations...")
    try:
        with app.app_context():
            # Update leaderboard
            leaderboard_entry = db_manager.update_leaderboard(user_id, 'all')
            print(f"✅ Leaderboard updated: {leaderboard_entry}")

            # Get leaderboard
            leaderboard = db_manager.get_leaderboard('all', limit=10)
            print(f"✅ Leaderboard retrieved: {len(leaderboard)} entries")

            return True
    except Exception as e:
        print(f"❌ Leaderboard operations failed: {e}")
        traceback.print_exc()
        return False

def test_progress_operations(db_manager, app, user_id):
    """Test ProgressMetric table operations"""
    print("\n📈 Testing Progress operations...")
    try:
        with app.app_context():
            # Store progress metric
            success = db_manager.store_progress_metric(
                user_id,
                'eye_contact',
                85.0,
                datetime.utcnow().date()
            )
            print(f"✅ Progress metric stored: {success}")

            # Get progress metrics
            metrics = db_manager.get_progress_metrics(user_id, 'eye_contact', days=30)
            print(f"✅ Progress metrics retrieved: {len(metrics)} records")

            return True
    except Exception as e:
        print(f"❌ Progress operations failed: {e}")
        traceback.print_exc()
        return False

def test_analytics_operations(db_manager, app, user_id):
    """Test analytics and reporting operations"""
    print("\n📊 Testing Analytics operations...")
    try:
        with app.app_context():
            # Get user stats
            user_stats = db_manager.get_user_stats(user_id)
            print(f"✅ User stats retrieved: {user_stats}")

            # Get system stats
            system_stats = db_manager.get_system_stats()
            print(f"✅ System stats retrieved: {system_stats}")

            return True
    except Exception as e:
        print(f"❌ Analytics operations failed: {e}")
        traceback.print_exc()
        return False

def test_relationships(app):
    """Test database relationships"""
    print("\n🔗 Testing Database Relationships...")
    try:
        with app.app_context():
            # Test Session -> User relationship
            session = Session.query.filter_by(user_id=1).first()
            if session:
                user = session.user
                print(f"✅ Session->User relationship: Session {session.id} belongs to {user.name}")

            # Test Session -> EyeTrackingData relationship
            eye_data = EyeTrackingData.query.filter_by(session_id="test_session_001").first()
            if eye_data:
                session = eye_data.session
                print(f"✅ EyeTrackingData->Session relationship: Data belongs to session {session.id}")

            # Test Session -> SpeechAnalysisData relationship
            speech_data = SpeechAnalysisData.query.filter_by(session_id="test_session_001").first()
            if speech_data:
                session = speech_data.session
                print(f"✅ SpeechAnalysisData->Session relationship: Data belongs to session {session.id}")

            # Test Session -> AIRecommendation relationship
            ai_rec = AIRecommendation.query.filter_by(session_id="test_session_001").first()
            if ai_rec:
                session = ai_rec.session
                print(f"✅ AIRecommendation->Session relationship: Recommendation belongs to session {session.id}")

            # Test User -> AIRecommendation relationship
            user_recs = AIRecommendation.query.filter_by(user_id=1).all()
            if user_recs:
                print(f"✅ User->AIRecommendation relationship: User has {len(user_recs)} recommendations")

            # Test User -> LeaderboardEntry relationship
            leaderboard_entries = LeaderboardEntry.query.filter_by(user_id=1).all()
            if leaderboard_entries:
                print(f"✅ User->LeaderboardEntry relationship: User has {len(leaderboard_entries)} entries")

            # Test User -> ProgressMetric relationship
            progress_metrics = ProgressMetric.query.filter_by(user_id=1).all()
            if progress_metrics:
                print(f"✅ User->ProgressMetric relationship: User has {len(progress_metrics)} metrics")

            return True
    except Exception as e:
        print(f"❌ Relationship testing failed: {e}")
        traceback.print_exc()
        return False

def cleanup_test_data(app):
    """Clean up test data"""
    print("\n🧹 Cleaning up test data...")
    try:
        with app.app_context():
            # Delete test data in reverse order to avoid foreign key constraints
            ProgressMetric.query.filter_by(user_id=1).delete()
            LeaderboardEntry.query.filter_by(user_id=1).delete()
            AIRecommendation.query.filter_by(user_id=1).delete()
            SpeechAnalysisData.query.filter_by(session_id="test_session_001").delete()
            EyeTrackingData.query.filter_by(session_id="test_session_001").delete()
            Session.query.filter_by(id="test_session_001").delete()
            User.query.filter_by(email="test@example.com").delete()

            db.session.commit()
            print("✅ Test data cleaned up successfully")
            return True
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")
        db.session.rollback()
        return False

def run_comprehensive_tests():
    """Run all database tests"""
    print("🚀 Starting Comprehensive Database Testing")
    print("=" * 50)

    app = create_test_app()
    db_manager = DatabaseManager()

    # Initialize database
    init_db(app)

    test_results = []

    # Test database connection
    test_results.append(("Database Connection", test_database_connection(app)))

    # Test User operations
    user_test_result = test_user_operations(db_manager, app)
    test_results.append(("User Operations", user_test_result))

    # Get user ID for subsequent tests
    user_id = None
    if user_test_result:
        with app.app_context():
            user = User.query.filter_by(email="test@example.com").first()
            if user:
                user_id = user.id

    if user_id:
        # Test all other operations
        test_results.append(("Session Operations", test_session_operations(db_manager, app, user_id)))
        test_results.append(("Eye Tracking Operations", test_eye_tracking_operations(db_manager, app)))
        test_results.append(("Speech Analysis Operations", test_speech_analysis_operations(db_manager, app)))
        test_results.append(("AI Recommendation Operations", test_ai_recommendation_operations(db_manager, app, user_id)))
        test_results.append(("Leaderboard Operations", test_leaderboard_operations(db_manager, app, user_id)))
        test_results.append(("Progress Operations", test_progress_operations(db_manager, app, user_id)))
        test_results.append(("Analytics Operations", test_analytics_operations(db_manager, app, user_id)))
        test_results.append(("Database Relationships", test_relationships(app)))

        # Cleanup
        test_results.append(("Data Cleanup", cleanup_test_data(app)))
    else:
        print("❌ Cannot proceed with tests - user creation failed")

    # Summary
    print("\n" + "=" * 50)
    print("📋 TEST SUMMARY")
    print("=" * 50)

    passed = 0
    total = len(test_results)

    for test_name, result in test_results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
        if result:
            passed += 1

    print(f"\n🎯 Overall Result: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All database tests passed successfully!")
        return True
    else:
        print("⚠️  Some tests failed. Please check the output above for details.")
        return False

if __name__ == "__main__":
    success = run_comprehensive_tests()
    sys.exit(0 if success else 1)
