"""
Database Manager for SPEAK Application
Handles all database operations including CRUD operations for sessions, users, and analytics data.
"""

from models import db, User, Session, EyeTrackingData, SpeechAnalysisData, AIRecommendation, LeaderboardEntry, ProgressMetric
from datetime import datetime, timedelta
import json
import time
from sqlalchemy import func, desc, and_
from functools import wraps

class DatabaseManager:
    def __init__(self):
        pass

    # User Management
    def create_user(self, email, password_hash, name):
        """Create a new user"""
        try:
            user = User(
                email=email,
                password_hash=password_hash,
                name=name
            )
            db.session.add(user)
            db.session.commit()
            print(f"✅ User created successfully: {user.id}")
            return user.to_dict()
        except Exception as e:
            db.session.rollback()
            print(f"❌ Failed to create user: {e}")
            raise e

    def get_user_by_email(self, email):
        """Get user by email"""
        user = User.query.filter_by(email=email).first()
        return user.to_dict() if user else None

    def get_user_by_id(self, user_id):
        """Get user by ID"""
        user = User.query.get(user_id)
        return user.to_dict() if user else None

    def update_user(self, user_id, **kwargs):
        """Update user information"""
        try:
            user = User.query.get(user_id)
            if not user:
                return None

            for key, value in kwargs.items():
                if hasattr(user, key):
                    setattr(user, key, value)

            db.session.commit()
            return user.to_dict()
        except Exception as e:
            db.session.rollback()
            raise e

    # Session Management
    def create_session(self, session_id, user_id=None):
        """Create a new session"""
        try:
            session = Session(
                id=session_id,
                user_id=user_id,
                start_time=datetime.utcnow(),
                is_active=True
            )
            db.session.add(session)
            db.session.commit()
            print(f"✅ Session created successfully: {session_id}")
            return session.to_dict()
        except Exception as e:
            db.session.rollback()
            print(f"❌ Failed to create session {session_id}: {e}")
            raise e

    def get_session(self, session_id):
        """Get session by ID"""
        session = Session.query.get(session_id)
        return session.to_dict() if session else None

    def update_session_analysis(self, session_id, analysis_data, ai_feedback_data=None):
        """Update session with analysis data"""
        try:
            session = Session.query.get(session_id)
            if not session:
                return None

            session.set_analysis(analysis_data)
            if ai_feedback_data:
                session.set_ai_feedback(ai_feedback_data)

            # Calculate and update metrics
            core_metrics = analysis_data.get('core_metrics', {})
            session.total_points = core_metrics.get('total_eye_contact_time', 0)
            session.duration = analysis_data.get('voice_metrics', {}).get('voice_duration_seconds', 0)

            db.session.commit()
            return session.to_dict()
        except Exception as e:
            db.session.rollback()
            raise e

    def end_session(self, session_id):
        """End a session"""
        try:
            session = Session.query.get(session_id)
            if not session:
                return None

            session.end_time = datetime.utcnow()
            session.is_active = False
            session.duration = (session.end_time - session.start_time).total_seconds()

            db.session.commit()
            return session.to_dict()
        except Exception as e:
            db.session.rollback()
            raise e

    def get_user_sessions(self, user_id, limit=50):
        """Get sessions for a user"""
        sessions = Session.query.filter_by(user_id=user_id)\
            .order_by(desc(Session.start_time))\
            .limit(limit)\
            .all()
        return [session.to_dict() for session in sessions]

    def get_all_sessions(self, limit=100):
        """Get all sessions (for admin purposes)"""
        sessions = Session.query.order_by(desc(Session.start_time)).limit(limit).all()
        return [session.to_dict() for session in sessions]

    # Eye Tracking Data
    def store_eye_tracking_data(self, session_id, eye_data):
        """Store eye tracking data point"""
        try:
            data_point = EyeTrackingData(
                session_id=session_id,
                eye_contact=eye_data.get('eye_contact', False),
                eye_contact_percentage=eye_data.get('eye_contact_percentage', 0.0),
                gaze_x=eye_data.get('gaze_x'),
                gaze_y=eye_data.get('gaze_y'),
                blink_rate=eye_data.get('blink_rate', 0.0),
                frame_data=json.dumps(eye_data.get('frame_data', {}))
            )
            db.session.add(data_point)
            db.session.commit()
            print(f"✅ Eye tracking data stored for session {session_id}")
            return data_point.to_dict()
        except Exception as e:
            db.session.rollback()
            print(f"❌ Failed to store eye tracking data for session {session_id}: {e}")
            raise e

    def get_eye_tracking_data(self, session_id):
        """Get eye tracking data for a session"""
        data_points = EyeTrackingData.query.filter_by(session_id=session_id)\
            .order_by(EyeTrackingData.timestamp)\
            .all()
        return [point.to_dict() for point in data_points]

    # Speech Analysis Data
    def store_speech_analysis_data(self, session_id, speech_data):
        """Store speech analysis data"""
        try:
            analysis = SpeechAnalysisData(
                session_id=session_id,
                accuracy_score=speech_data.get('accuracy_score', 0.0),
                wpm=speech_data.get('wpm', 0.0),
                grammar_errors=speech_data.get('grammar_errors', 0),
                spelling_errors=speech_data.get('spelling_errors', 0),
                average_volume=speech_data.get('average_volume', 0.0),
                volume_variance=speech_data.get('volume_variance', 0.0),
                average_pitch=speech_data.get('average_pitch', 0.0),
                pitch_range=speech_data.get('pitch_range', 0.0),
                voice_duration_seconds=speech_data.get('voice_duration_seconds', 0.0),
                analysis_details=json.dumps(speech_data.get('analysis_details', {}))
            )
            db.session.add(analysis)
            db.session.commit()
            print(f"✅ Speech analysis data stored for session {session_id}")
            return analysis.to_dict()
        except Exception as e:
            db.session.rollback()
            print(f"❌ Failed to store speech analysis data for session {session_id}: {e}")
            raise e

    def get_speech_analysis_data(self, session_id):
        """Get speech analysis data for a session"""
        analyses = SpeechAnalysisData.query.filter_by(session_id=session_id)\
            .order_by(desc(SpeechAnalysisData.timestamp))\
            .all()
        return [analysis.to_dict() for analysis in analyses]

    # AI Recommendations
    def create_ai_recommendation(self, session_id, user_id, recommendation_data):
        """Create AI recommendation"""
        try:
            recommendation = AIRecommendation(
                session_id=session_id,
                user_id=user_id,
                recommendation_type=recommendation_data.get('type', 'general'),
                title=recommendation_data.get('title', ''),
                description=recommendation_data.get('description', ''),
                priority=recommendation_data.get('priority', 'medium'),
                status='pending'
            )
            db.session.add(recommendation)
            db.session.commit()
            return recommendation.to_dict()
        except Exception as e:
            db.session.rollback()
            raise e

    def clear_user_recommendations(self, user_id):
        """Clear all AI recommendations for a user"""
        try:
            AIRecommendation.query.filter_by(user_id=user_id).delete()
            db.session.commit()
            print(f"✅ Cleared all recommendations for user {user_id}")
        except Exception as e:
            db.session.rollback()
            raise e

    def get_user_avg_metrics(self, user_id):
        """Get user's average metrics across all sessions"""
        user_sessions = self.get_user_sessions(user_id, limit=100)
        speech_accuracy_scores = []
        wpm_scores = []
        eye_contact_scores = []

        for session in user_sessions:
            analysis = session.get('analysis', {})
            if analysis:
                speech_metrics = analysis.get('speech_metrics', {})
                core_metrics = analysis.get('core_metrics', {})

                acc = speech_metrics.get('accuracy_score', 0)
                if acc > 0:
                    speech_accuracy_scores.append(acc)

                w = speech_metrics.get('wpm', 0)
                if w > 0:
                    wpm_scores.append(w)

                ec = core_metrics.get('eye_contact_score', 0)
                if ec > 0:
                    eye_contact_scores.append(ec)

        avg_speech_accuracy = sum(speech_accuracy_scores) / len(speech_accuracy_scores) if speech_accuracy_scores else 0
        avg_wpm = sum(wpm_scores) / len(wpm_scores) if wpm_scores else 0
        avg_eye_contact = sum(eye_contact_scores) / len(eye_contact_scores) if eye_contact_scores else 0
        avg_score = (avg_eye_contact + avg_speech_accuracy) / 2 if avg_eye_contact and avg_speech_accuracy else avg_eye_contact or avg_speech_accuracy or 0

        return {
            'avg_speech_accuracy': round(avg_speech_accuracy, 1),
            'avg_wpm': round(avg_wpm, 1),
            'avg_eye_contact': round(avg_eye_contact, 1),
            'avg_score': round(avg_score, 1)
        }

    def generate_ai_recommendations_from_analysis(self, session_id, user_id, session_analysis, ai_feedback):
        """Generate AI recommendations based on session analysis and AI feedback"""
        try:
            # Clear old recommendations before generating new ones
            self.clear_user_recommendations(user_id)
            recommendations = []

            # Extract key metrics
            core_metrics = session_analysis.get('core_metrics', {})
            speech_metrics = session_analysis.get('speech_metrics', {})
            voice_metrics = session_analysis.get('voice_metrics', {})

            eye_contact_score = core_metrics.get('eye_contact_score', 0)
            speech_accuracy = speech_metrics.get('accuracy_score', 0)
            wpm = speech_metrics.get('wpm', 0)
            overall_engagement = session_analysis.get('overall_engagement', 0)

            # Generate recommendations based on performance

            # Eye contact recommendations
            if eye_contact_score < 60:
                recommendations.append({
                    'type': 'eye_contact',
                    'title': 'Improve Eye Contact',
                    'description': f'Your eye contact score was {eye_contact_score}%. Practice maintaining eye contact for 50-70% of your speaking time. Try looking directly at the camera lens and imagine speaking to a friend.',
                    'priority': 'high' if eye_contact_score < 40 else 'medium'
                })
            elif eye_contact_score < 80:
                recommendations.append({
                    'type': 'eye_contact',
                    'title': 'Enhance Eye Contact Consistency',
                    'description': f'Your eye contact score was {eye_contact_score}%. Focus on maintaining consistent eye contact throughout your presentation. Avoid looking away too frequently.',
                    'priority': 'medium'
                })

            # Speech accuracy recommendations
            if speech_accuracy < 70:
                recommendations.append({
                    'type': 'speech_clarity',
                    'title': 'Improve Speech Clarity',
                    'description': f'Your speech accuracy was {speech_accuracy}%. Practice pronunciation and reduce filler words. Record yourself speaking and listen for areas to improve.',
                    'priority': 'high' if speech_accuracy < 50 else 'medium'
                })

            # WPM recommendations
            if wpm < 120:
                recommendations.append({
                    'type': 'speaking_pace',
                    'title': 'Adjust Speaking Pace',
                    'description': f'Your speaking rate was {wpm} WPM. Aim for 120-150 WPM for optimal comprehension. Practice reading aloud at different speeds.',
                    'priority': 'medium'
                })
            elif wpm > 180:
                recommendations.append({
                    'type': 'speaking_pace',
                    'title': 'Slow Down Speaking Pace',
                    'description': f'Your speaking rate was {wpm} WPM. Speaking too quickly can reduce clarity. Practice pausing between key points.',
                    'priority': 'medium'
                })

            # Voice recommendations
            if voice_metrics:
                volume_variance = voice_metrics.get('volume_variance', 0)
                if volume_variance > 1000:  # High variance indicates inconsistent volume
                    recommendations.append({
                        'type': 'voice_volume',
                        'title': 'Stabilize Voice Volume',
                        'description': 'Your voice volume varied significantly. Practice maintaining consistent volume throughout your presentation.',
                        'priority': 'medium'
                    })

                pitch_range = voice_metrics.get('pitch_range', 0)
                if pitch_range < 50:  # Low pitch variation
                    recommendations.append({
                        'type': 'voice_modulation',
                        'title': 'Increase Voice Modulation',
                        'description': 'Your voice pitch varied little. Practice varying your pitch to emphasize important points and maintain audience interest.',
                        'priority': 'medium'
                    })

            # Overall engagement recommendations
            if overall_engagement < 60:
                recommendations.append({
                    'type': 'overall_engagement',
                    'title': 'Boost Overall Engagement',
                    'description': f'Your overall engagement score was {overall_engagement}%. Focus on combining strong eye contact, clear speech, and confident delivery.',
                    'priority': 'high'
                })

            # Add AI feedback-based recommendations if available
            if ai_feedback and 'actionable_strategies' in ai_feedback:
                for strategy in ai_feedback['actionable_strategies'][:2]:  # Limit to 2 AI strategies
                    recommendations.append({
                        'type': 'ai_generated',
                        'title': strategy.get('strategy', 'AI Recommendation'),
                        'description': strategy.get('description', ''),
                        'priority': 'medium'
                    })

            # Store recommendations in database
            stored_recommendations = []
            for rec_data in recommendations:
                stored_rec = self.create_ai_recommendation(session_id, user_id, rec_data)
                if stored_rec:
                    stored_recommendations.append(stored_rec)

            print(f"✅ Generated and stored {len(stored_recommendations)} AI recommendations for session {session_id}")
            return stored_recommendations

        except Exception as e:
            print(f"❌ Error generating AI recommendations: {e}")
            return []

    def get_user_recommendations(self, user_id, status=None, limit=20):
        """Get recommendations for a user"""
        query = AIRecommendation.query.filter_by(user_id=user_id)
        if status:
            query = query.filter_by(status=status)
        recommendations = query.order_by(desc(AIRecommendation.created_at)).limit(limit).all()
        return [rec.to_dict() for rec in recommendations]

    def get_user_recent_recommendations(self, user_id, limit=3):
        """Get most recent AI recommendations for a user (for dashboard)"""
        try:
            recommendations = AIRecommendation.query.filter_by(user_id=user_id)\
                .order_by(desc(AIRecommendation.created_at))\
                .limit(limit)\
                .all()

            return [{
                'id': rec.id,
                'type': rec.recommendation_type,
                'title': rec.title,
                'description': rec.description,
                'priority': rec.priority,
                'status': rec.status,
                'created_at': rec.created_at.isoformat() if rec.created_at else None
            } for rec in recommendations]
        except Exception as e:
            print(f"Error getting recent recommendations: {e}")
            return []

    def get_session_recommendations(self, session_id):
        """Get AI recommendations for a specific session"""
        try:
            recommendations = AIRecommendation.query.filter_by(session_id=session_id)\
                .order_by(desc(AIRecommendation.created_at))\
                .all()

            return [rec.to_dict() for rec in recommendations]
        except Exception as e:
            print(f"Error getting session recommendations: {e}")
            return []

    def update_recommendation_status(self, rec_id, status):
        """Update recommendation status"""
        try:
            recommendation = AIRecommendation.query.get(rec_id)
            if not recommendation:
                return None

            recommendation.status = status
            db.session.commit()
            return recommendation.to_dict()
        except Exception as e:
            db.session.rollback()
            raise e

    # Leaderboard
    def update_leaderboard(self, user_id, period='all'):
        """Update leaderboard entry for user"""
        try:
            # Calculate user's score based on recent sessions
            sessions_query = Session.query.filter_by(user_id=user_id)

            if period == 'daily':
                start_date = datetime.utcnow().date()
                sessions_query = sessions_query.filter(func.date(Session.start_time) == start_date)
            elif period == 'weekly':
                start_date = datetime.utcnow() - timedelta(days=7)
                sessions_query = sessions_query.filter(Session.start_time >= start_date)
            elif period == 'monthly':
                start_date = datetime.utcnow() - timedelta(days=30)
                sessions_query = sessions_query.filter(Session.start_time >= start_date)

            sessions = sessions_query.all()
            sessions_count = len(sessions)

            if sessions_count == 0:
                return None

            # Calculate average score from sessions
            total_score = 0
            valid_sessions = 0
            for session in sessions:
                analysis = session.get_analysis()
                engagement = analysis.get('overall_engagement', 0)
                if engagement > 0:
                    total_score += engagement
                    valid_sessions += 1

            average_score = total_score / valid_sessions if valid_sessions > 0 else 0

            # Update or create leaderboard entry
            entry = LeaderboardEntry.query.filter_by(user_id=user_id, period=period).first()
            if entry:
                entry.score = average_score
                entry.sessions_count = sessions_count
            else:
                entry = LeaderboardEntry(
                    user_id=user_id,
                    period=period,
                    score=average_score,
                    sessions_count=sessions_count
                )
                db.session.add(entry)

            db.session.commit()

            # Update ranks
            self._update_leaderboard_ranks(period)

            return entry.to_dict()
        except Exception as e:
            db.session.rollback()
            raise e

    def _update_leaderboard_ranks(self, period):
        """Update ranks for a leaderboard period"""
        try:
            entries = LeaderboardEntry.query.filter_by(period=period)\
                .order_by(desc(LeaderboardEntry.score))\
                .all()

            for rank, entry in enumerate(entries, 1):
                entry.rank = rank

            db.session.commit()
        except Exception as e:
            db.session.rollback()
            raise e

    def get_leaderboard(self, period='all', limit=10):
        """Get leaderboard for a period"""
        entries = LeaderboardEntry.query.filter_by(period=period)\
            .order_by(LeaderboardEntry.rank)\
            .limit(limit)\
            .all()

        result = []
        for entry in entries:
            user = User.query.get(entry.user_id)
            if user:
                result.append({
                    'rank': entry.rank,
                    'user_id': entry.user_id,
                    'name': user.name,
                    'score': entry.score,
                    'sessions_count': entry.sessions_count
                })

        return result

    # Progress Metrics
    def store_progress_metric(self, user_id, metric_type, value, date=None):
        """Store progress metric"""
        try:
            metric_date = date or datetime.utcnow().date()

            # Check if metric already exists for this date
            existing = ProgressMetric.query.filter_by(
                user_id=user_id,
                metric_type=metric_type,
                date=metric_date
            ).first()

            if existing:
                existing.value = value
            else:
                metric = ProgressMetric(
                    user_id=user_id,
                    metric_type=metric_type,
                    value=value,
                    date=metric_date
                )
                db.session.add(metric)

            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise e

    def get_progress_metrics(self, user_id, metric_type=None, days=30):
        """Get progress metrics for user"""
        query = ProgressMetric.query.filter_by(user_id=user_id)

        if metric_type:
            query = query.filter_by(metric_type=metric_type)

        start_date = datetime.utcnow().date() - timedelta(days=days)
        query = query.filter(ProgressMetric.date >= start_date)

        metrics = query.order_by(ProgressMetric.date).all()
        return [metric.to_dict() for metric in metrics]

    def store_session_progress_metrics(self, user_id, session_analysis):
        """Store progress metrics after session completion"""
        try:
            today = datetime.utcnow().date()

            # Extract metrics from session analysis
            core_metrics = session_analysis.get('core_metrics', {})
            speech_metrics = session_analysis.get('speech_metrics', {})
            voice_metrics = session_analysis.get('voice_metrics', {})

            metrics_to_store = []

            # Eye contact score
            eye_contact_score = core_metrics.get('eye_contact_score', 0)
            if eye_contact_score > 0:
                metrics_to_store.append({
                    'metric_type': 'eye_contact',
                    'value': eye_contact_score,
                    'date': today
                })

            # Speech accuracy
            speech_accuracy = speech_metrics.get('accuracy_score', 0)
            if speech_accuracy > 0:
                metrics_to_store.append({
                    'metric_type': 'speech_accuracy',
                    'value': speech_accuracy,
                    'date': today
                })

            # WPM
            wpm = speech_metrics.get('wpm', 0)
            if wpm > 0:
                metrics_to_store.append({
                    'metric_type': 'wpm',
                    'value': wpm,
                    'date': today
                })

            # Voice metrics
            if voice_metrics:
                avg_volume = voice_metrics.get('average_volume', 0)
                if avg_volume > 0:
                    metrics_to_store.append({
                        'metric_type': 'voice_volume',
                        'value': avg_volume,
                        'date': today
                    })

                pitch_range = voice_metrics.get('pitch_range', 0)
                if pitch_range > 0:
                    metrics_to_store.append({
                        'metric_type': 'voice_pitch_range',
                        'value': pitch_range,
                        'date': today
                    })

            # Overall engagement
            overall_engagement = session_analysis.get('overall_engagement', 0)
            if overall_engagement > 0:
                metrics_to_store.append({
                    'metric_type': 'overall_engagement',
                    'value': overall_engagement,
                    'date': today
                })

            # Store each metric (update if exists for today)
            for metric_data in metrics_to_store:
                existing = ProgressMetric.query.filter_by(
                    user_id=user_id,
                    metric_type=metric_data['metric_type'],
                    date=metric_data['date']
                ).first()

                if existing:
                    existing.value = metric_data['value']
                else:
                    metric = ProgressMetric(
                        user_id=user_id,
                        metric_type=metric_data['metric_type'],
                        value=metric_data['value'],
                        date=metric_data['date']
                    )
                    db.session.add(metric)

            db.session.commit()
            print(f"✅ Stored {len(metrics_to_store)} progress metrics for user {user_id}")
            return True

        except Exception as e:
            db.session.rollback()
            print(f"❌ Error storing progress metrics: {e}")
            return False

    # Analytics and Reporting
    def get_user_stats(self, user_id):
        """Get comprehensive user statistics"""
        try:
            # Total sessions
            total_sessions = Session.query.filter_by(user_id=user_id).count()

            # Active sessions
            active_sessions = Session.query.filter_by(user_id=user_id, is_active=True).count()

            # Average scores
            sessions = Session.query.filter_by(user_id=user_id).all()
            total_engagement = 0
            valid_sessions = 0

            for session in sessions:
                analysis = session.get_analysis()
                engagement = analysis.get('overall_engagement', 0)
                if engagement > 0:
                    total_engagement += engagement
                    valid_sessions += 1

            avg_engagement = total_engagement / valid_sessions if valid_sessions > 0 else 0

            # Recent progress (last 7 days)
            week_ago = datetime.utcnow() - timedelta(days=7)
            recent_sessions = Session.query.filter(
                and_(Session.user_id == user_id, Session.start_time >= week_ago)
            ).all()

            recent_engagement = 0
            recent_count = 0
            for session in recent_sessions:
                analysis = session.get_analysis()
                engagement = analysis.get('overall_engagement', 0)
                if engagement > 0:
                    recent_engagement += engagement
                    recent_count += 1

            recent_avg = recent_engagement / recent_count if recent_count > 0 else 0

            return {
                'total_sessions': total_sessions,
                'active_sessions': active_sessions,
                'average_engagement': avg_engagement,
                'recent_average_engagement': recent_avg,
                'sessions_this_week': recent_count
            }
        except Exception as e:
            print(f"Error getting user stats: {e}")
            return {}

    def get_system_stats(self):
        """Get system-wide statistics"""
        try:
            total_users = User.query.count()
            total_sessions = Session.query.count()
            active_sessions = Session.query.filter_by(is_active=True).count()

            # Average engagement across all sessions
            sessions = Session.query.all()
            total_engagement = 0
            valid_sessions = 0

            for session in sessions:
                analysis = session.get_analysis()
                engagement = analysis.get('overall_engagement', 0)
                if engagement > 0:
                    total_engagement += engagement
                    valid_sessions += 1

            avg_engagement = total_engagement / valid_sessions if valid_sessions > 0 else 0

            return {
                'total_users': total_users,
                'total_sessions': total_sessions,
                'active_sessions': active_sessions,
                'average_engagement': avg_engagement
            }
        except Exception as e:
            print(f"Error getting system stats: {e}")
            return {}

    # Migration and Maintenance
    def migrate_existing_data(self):
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

    def cleanup_old_data(self, days=90):
        """Clean up old data (for maintenance)"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)

            # Delete old eye tracking data
            old_eye_data = EyeTrackingData.query.filter(EyeTrackingData.timestamp < cutoff_date).delete()

            # Delete old speech analysis data
            old_speech_data = SpeechAnalysisData.query.filter(SpeechAnalysisData.timestamp < cutoff_date).delete()

            # Delete old progress metrics (keep last 6 months)
            old_metrics = ProgressMetric.query.filter(ProgressMetric.date < cutoff_date.date()).delete()

            db.session.commit()

            print(f"🧹 Cleaned up {old_eye_data} eye tracking records, {old_speech_data} speech records, {old_metrics} progress metrics")
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error during cleanup: {e}")
