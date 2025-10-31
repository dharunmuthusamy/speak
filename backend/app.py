from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO
from flask_cors import CORS
import json
import os
import base64
from datetime import datetime
import time
import logging
from advanced_eye_tracker import AdvancedEyeTracker
import google.generativeai as genai
from dotenv import load_dotenv
from speech_analyzer import process_audio_from_web, calculate_engagement_score
from models import db, init_db, User, Session, EyeTrackingData, SpeechAnalysisData, AIRecommendation, LeaderboardEntry, ProgressMetric
from database_manager import DatabaseManager
import bcrypt
from sockets import send_dashboard_update

from werkzeug.routing import BaseConverter

class RegexConverter(BaseConverter):
    def __init__(self, url_map, *items):
        super(RegexConverter, self).__init__(url_map)
        self.regex = items[0]

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
app.config['SECRET_KEY'] = 'speak-analysis-key'
db_path = os.path.join(os.getcwd(), 'instance', 'speak.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Register the regex converter
app.url_map.converters['regex'] = RegexConverter

CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:8081", "http://127.0.0.1:8081"])

# Database will be initialized in main block

# Initialize database manager
db_manager = DatabaseManager()

# Initialize the advanced eye tracker
eye_tracker = AdvancedEyeTracker()
active_sessions = {}

# Speech analysis state
speech_data = {}

# In-memory storage for data (in production, use database)
eye_tracking_data = {}
speech_analysis_data = {}
ai_recommendations = {}

# Gemini AI Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY or GEMINI_API_KEY == 'your_gemini_api_key_here':
    print("❌ GEMINI_API_KEY not found in environment variables")
    GEMINI_API_KEY = None

class GeminiFeedbackAnalyzer:
    def __init__(self, api_key):
        self.api_key = api_key
        self.model = None
        self.model_name = None
        self.quota_exceeded = False
        
        if not api_key:
            print("❌ No Gemini API key provided")
            return
            
        try:
            genai.configure(api_key=api_key)
            self._initialize_with_quota_handling()
                
        except Exception as e:
            print(f"❌ Gemini AI initialization failed: {e}")

    def _initialize_with_quota_handling(self):
        """Initialize with quota-aware model selection"""
        print("🔍 Checking available Gemini models...")
        
        try:
            available_models = genai.list_models()
            supported_models = []
            
            for model in available_models:
                if 'generateContent' in model.supported_generation_methods:
                    model_name = model.name.replace('models/', '')
                    supported_models.append(model_name)
            
            print(f"📋 Found {len(supported_models)} supported models")
            
            # Prioritize models that are likely to work
            preferred_models = [
                'gemini-2.0-flash',      # Fast and cost-effective
                'gemini-2.0-flash-001',
                'gemini-2.0-flash-lite',
                'gemini-2.5-flash',      # New Gemini 2.5
                'gemini-2.5-flash-lite',
                'gemini-pro-latest',     # Fallback
                'gemini-flash-latest'
            ]
            
            # Try each model
            for model_name in preferred_models:
                if model_name in supported_models:
                    if self._test_model_with_quota_handling(model_name):
                        print(f"✅ Model selected: {model_name}")
                        return
            
            # If we get here, set up for fallback but with model info
            if supported_models:
                self.model_name = supported_models[0]
                print(f"⚠️  Using fallback mode with available model: {self.model_name}")
            
        except Exception as e:
            print(f"❌ Error during model initialization: {e}")

    def _test_model_with_quota_handling(self, model_name):
        """Test model with comprehensive quota handling"""
        try:
            print(f"🧪 Testing: {model_name}")
            self.model = genai.GenerativeModel(model_name)
            
            # Minimal test to check connectivity
            test_response = self.model.generate_content(
                "Say 'OK'", 
                generation_config=genai.types.GenerationConfig(max_output_tokens=2)
            )
            
            if test_response.text:
                self.model_name = model_name
                self.quota_exceeded = False
                return True
                
        except Exception as e:
            error_str = str(e)
            if any(keyword in error_str.lower() for keyword in ['quota', 'rate limit', 'exceeded']):
                print(f"⚠️  Quota exceeded for {model_name}, but model is available")
                self.model_name = model_name
                self.quota_exceeded = True
                # Still return True because the model exists and will work when quota resets
                return True
            else:
                print(f"❌ Model {model_name} failed: {e}")
        
        return False

    def analyze_eye_tracking_data(self, session_data):
        """Analyze eye tracking data with quota awareness"""
        if not self.model or self.quota_exceeded:
            print("⚠️  Using fallback feedback (quota exceeded or no model)")
            return self._get_quota_fallback_feedback(session_data)
            
        try:
            prompt = self._create_analysis_prompt(session_data)
            print(f"🤖 Sending request to {self.model_name}...")
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=800,  # Increased for better JSON response
                    temperature=0.3  # Lower temperature for more consistent formatting
                )
            )
            
            if response.text:
                print("✅ Received AI response")
                print(f"📄 Raw response: {response.text[:200]}...")  # Debug logging
                feedback = self._parse_ai_response(response.text)
                return feedback
            else:
                print("❌ Empty response from Gemini AI")
                return self._get_quota_fallback_feedback(session_data)
                
        except Exception as e:
            error_str = str(e)
            if any(keyword in error_str.lower() for keyword in ['quota', 'rate limit', 'exceeded']):
                print("⚠️  Quota exceeded during analysis")
                self.quota_exceeded = True
                return self._get_quota_fallback_feedback(session_data)
            else:
                print(f"❌ Analysis error: {e}")
                return self._get_fallback_feedback(session_data)
    
    def _create_analysis_prompt(self, session_data):
        """
        Create a detailed prompt for Gemini AI analysis with strict JSON formatting
        """
        core_metrics = session_data.get('core_metrics', {})
        advanced_metrics = session_data.get('advanced_metrics', {})
        professional_insights = session_data.get('professional_insights', {})
        speech_metrics = session_data.get('speech_metrics', {})
        voice_metrics = session_data.get('voice_metrics', {})
        overall_engagement = session_data.get('overall_engagement', 'Unknown')

        prompt = f"""
        You are an expert public speaking coach and communication specialist.
        Analyze this comprehensive speaking session data including eye contact, speech analysis, and voice metrics.

        IMPORTANT: You MUST respond with ONLY valid JSON format. No additional text, no explanations, no markdown formatting.

        SESSION DATA:
        - Eye Contact Score: {core_metrics.get('eye_contact_score', 0)}%
        - Focus Consistency: {core_metrics.get('focus_consistency', 0)}%
        - Blink Rate: {core_metrics.get('blink_rate', 0)} blinks/sec
        - Total Eye Contact Time: {core_metrics.get('total_eye_contact_time', 0)} seconds
        - Engagement Level: {advanced_metrics.get('engagement_level', 'Unknown')}
        - Gaze Stability: {advanced_metrics.get('gaze_stability', 'Unknown')}
        - Communication Style: {professional_insights.get('communication_style', 'Unknown')}
        - Speech Accuracy: {speech_metrics.get('accuracy_score', 0)}%
        - Speaking Rate (WPM): {speech_metrics.get('wpm', 0)}
        - Grammar Errors: {speech_metrics.get('grammar_errors', 0)}
        - Spelling Errors: {speech_metrics.get('spelling_errors', 0)}
        - Voice Average Volume: {voice_metrics.get('average_volume', 0):.2f}
        - Voice Volume Variance: {voice_metrics.get('volume_variance', 0):.2f}
        - Voice Pitch Range: {voice_metrics.get('pitch_range', 0):.2f}
        - Voice Duration: {voice_metrics.get('voice_duration_seconds', 0):.1f} seconds
        - Overall Engagement Score: {overall_engagement}%

        CRITICAL: Your response must be ONLY this exact JSON structure, nothing else:

        {{
            "overall_assessment": "Brief overall assessment of speaking performance including eye contact, speech quality, and vocal delivery",
            "performance_rating": "Excellent/Good/Fair/Poor",
            "key_strengths": ["strength1", "strength2", "strength3"],
            "areas_for_improvement": ["area1", "area2", "area3"],
            "personalized_feedback": "Detailed personalized feedback paragraph explaining the analysis and specific observations about eye contact patterns, gaze behavior, speech quality including fluency and accuracy, and vocal delivery including volume consistency and pitch variation.",
            "actionable_strategies": [
                {{
                    "strategy": "Specific strategy name",
                    "description": "How to implement this strategy",
                    "benefit": "Expected benefit from implementing this strategy"
                }}
            ],
            "practice_exercises": [
                {{
                    "exercise": "Exercise name",
                    "instructions": "Step-by-step instructions for the exercise",
                    "duration": "Recommended duration and frequency"
                }}
            ],
            "confidence_boosters": ["tip1", "tip2", "tip3"],
            "next_session_goals": ["goal1", "goal2", "goal3"]
        }}

        RULES:
        1. Return ONLY the JSON object, no other text
        2. Use double quotes for all strings
        3. Ensure all arrays have at least 3 items
        4. Keep feedback constructive and actionable
        5. Base assessment on eye contact, speech metrics, and voice delivery
        """

        return prompt
    
    def _parse_ai_response(self, response_text):
        """
        Parse the AI response and extract structured feedback with robust JSON handling
        """
        try:
            print("🔄 Parsing AI response...")
            
            # Clean the response text more aggressively
            cleaned_text = response_text.strip()
            
            # Remove any markdown code blocks
            if '```json' in cleaned_text:
                cleaned_text = cleaned_text.split('```json')[1].split('```')[0].strip()
            elif '```' in cleaned_text:
                cleaned_text = cleaned_text.split('```')[1].strip()
            
            # Remove any introductory text before the first {
            if '{' in cleaned_text:
                cleaned_text = cleaned_text[cleaned_text.find('{'):]
            
            # Remove any trailing text after the last }
            if '}' in cleaned_text:
                cleaned_text = cleaned_text[:cleaned_text.rfind('}') + 1]
            
            print(f"🧹 Cleaned text: {cleaned_text[:100]}...")
            
            # Try to parse JSON
            feedback_data = json.loads(cleaned_text)
            
            # Validate the structure
            required_fields = [
                'overall_assessment', 'performance_rating', 'key_strengths',
                'areas_for_improvement', 'personalized_feedback', 'actionable_strategies',
                'practice_exercises', 'confidence_boosters', 'next_session_goals'
            ]
            
            for field in required_fields:
                if field not in feedback_data:
                    print(f"❌ Missing required field: {field}")
                    return self._structure_text_feedback(response_text)
            
            print("✅ Successfully parsed and validated JSON response")
            return feedback_data
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing failed: {e}")
            print(f"🔍 Problematic text: {cleaned_text[:200]}")
            return self._structure_text_feedback(response_text)
        except Exception as e:
            print(f"❌ Error parsing response: {e}")
            return self._structure_text_feedback(response_text)
    
    def _structure_text_feedback(self, text):
        """
        Structure text feedback when JSON parsing fails
        """
        print("🔄 Using structured fallback feedback")
        
        # Extract key information from text for better fallback
        lines = text.split('\n')
        short_feedback = ' '.join(lines[:3])[:300] + '...' if len(text) > 300 else text
        
        return {
            "overall_assessment": "AI analysis completed with formatting issues",
            "performance_rating": "Analyzed",
            "key_strengths": ["Data successfully analyzed", "Feedback generated", "System working"],
            "areas_for_improvement": ["Response formatting needs improvement", "JSON structure not followed"],
            "personalized_feedback": f"The AI provided this feedback but it wasn't properly formatted: {short_feedback}",
            "actionable_strategies": [
                {
                    "strategy": "Review Raw Feedback",
                    "description": "Read the AI's response despite formatting issues",
                    "benefit": "Still get valuable insights from the analysis"
                }
            ],
            "practice_exercises": [
                {
                    "exercise": "Formatting Improvement",
                    "instructions": "The system will automatically retry with better formatting",
                    "duration": "Next analysis session"
                }
            ],
            "confidence_boosters": ["Analysis completed successfully", "Technical issue being addressed"],
            "next_session_goals": ["Get properly formatted feedback", "Continue practicing eye contact"]
        }
    
    def _get_quota_fallback_feedback(self, session_data):
        """Special fallback for quota exceeded scenarios"""
        eye_contact = session_data.get('core_metrics', {}).get('eye_contact_score', 0)
        
        if eye_contact >= 80:
            rating = "Excellent"
        elif eye_contact >= 60:
            rating = "Good"
        elif eye_contact >= 40:
            rating = "Fair"
        else:
            rating = "Needs Improvement"
        
        model_info = f" (Model: {self.model_name})" if self.model_name else ""
        
        return {
            "overall_assessment": f"Analysis ready{model_info}. API quota exceeded - try again later.",
            "performance_rating": rating,
            "key_strengths": ["System is properly configured", "Eye tracking data collected successfully"],
            "areas_for_improvement": ["Wait for API quota reset for AI feedback"],
            "personalized_feedback": f"Your eye contact score is {eye_contact}%. The AI analysis system is configured correctly with access to Gemini models, but the free tier API quota has been exceeded. Please try again in 24 hours or upgrade your Google AI API plan.",
            "actionable_strategies": [
                {
                    "strategy": "Wait for Quota Reset",
                    "description": "Free tier quotas reset every 24 hours",
                    "benefit": "AI feedback will become available automatically"
                },
                {
                    "strategy": "Practice Eye Contact",
                    "description": "Maintain 50-70% eye contact with your camera",
                    "benefit": "Build better audience connection"
                }
            ],
            "practice_exercises": [
                {
                    "exercise": "Camera Connection Practice",
                    "instructions": "Practice speaking while looking directly at the camera lens",
                    "duration": "5-10 minutes daily"
                }
            ],
            "confidence_boosters": ["Good posture improves presence", "Smile naturally to appear more engaging"],
            "next_session_goals": ["Achieve consistent eye contact", "Try AI feedback after quota reset"]
        }
    
    def _get_fallback_feedback(self, session_data):
        """
        Provide fallback feedback when AI analysis fails
        """
        eye_contact = session_data.get('core_metrics', {}).get('eye_contact_score', 0)
        
        if eye_contact >= 80:
            rating = "Excellent"
        elif eye_contact >= 60:
            rating = "Good"
        elif eye_contact >= 40:
            rating = "Fair"
        else:
            rating = "Needs Improvement"
        
        return {
            "overall_assessment": "Basic analysis completed.",
            "performance_rating": rating,
            "key_strengths": ["Data collection successful"],
            "areas_for_improvement": ["Enable AI analysis for personalized feedback"],
            "personalized_feedback": f"Your eye contact score is {eye_contact}%. For AI-powered personalized feedback, ensure your Gemini API key is properly configured.",
            "actionable_strategies": [
                {
                    "strategy": "Check API Configuration",
                    "description": "Verify your Gemini API key is correctly set up",
                    "benefit": "Enable AI-powered personalized coaching"
                }
            ],
            "practice_exercises": [
                {
                    "exercise": "Camera Practice",
                    "instructions": "Practice speaking while maintaining eye contact with the camera",
                    "duration": "10 minutes daily"
                }
            ],
            "confidence_boosters": ["Regular practice builds confidence"],
            "next_session_goals": ["Configure AI analysis"]
        }

# Initialize Gemini AI analyzer
gemini_analyzer = GeminiFeedbackAnalyzer(GEMINI_API_KEY)

# Database-backed storage using DatabaseManager

@app.route('/')
def index():
    logging.info(f"Request: {request.method} {request.path}")
    return send_from_directory('frontend/dist', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    logging.info(f"Request: {request.method} {request.path}")
    # Don't interfere with SocketIO routes
    if path.startswith('socket.io'):
        return jsonify({'error': 'Socket.IO endpoint'}), 404
    try:
        return send_from_directory('frontend/dist', path)
    except:
        return send_from_directory('frontend/dist', 'index.html')

@app.route('/sessions', methods=['GET'])
def list_sessions():
    """API to get list of all saved sessions"""
    try:
        # Get sessions from database
        db_sessions = db_manager.get_all_sessions(limit=100)

        sessions_list = []
        for session in db_sessions:
            analysis = session.get('analysis', {})
            sessions_list.append({
                'id': session['id'],
                'start_time': session.get('start_time', 'Unknown'),
                'total_points': session.get('total_points', 0),
                'eye_contact': analysis.get('core_metrics', {}).get('eye_contact_score', 0),
                'analysis': {
                    'overall_engagement': analysis.get('overall_engagement', 0)
                }
            })



        def get_sort_key(session):
            start_time = session.get('start_time')
            if start_time and start_time != 'Unknown':
                try:
                    return datetime.fromisoformat(start_time)
                except ValueError:
                    pass
            timestamp = session.get('timestamp')
            if timestamp:
                try:
                    return datetime.fromisoformat(timestamp)
                except ValueError:
                    pass
            return datetime.min  # Default for sessions without time

        return jsonify({'sessions': sorted(sessions_list, key=get_sort_key, reverse=True)})
    except Exception as e:
        print(f"Error listing sessions: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/sessions', methods=['POST'])
def create_session():
    """API to create a new session"""
    try:
        session_data = request.get_json()
        session_id = session_data.get('session_id', f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        # For now, just return success - actual session creation happens via SocketIO
        return jsonify({'success': True, 'session_id': session_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    """API to get detailed session data"""
    try:
        # Get session from database
        db_session = db_manager.get_session(session_id)
        if db_session:
            # Get AI recommendations for this session
            recommendations = db_manager.get_session_recommendations(session_id)
            # Add recommendations to the session data
            db_session['ai_recommendations'] = recommendations
            return jsonify(db_session)
        else:
            return jsonify({'error': 'Session not found'}), 404
    except Exception as e:
        print(f"Error getting session {session_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/sessions/<session_id>', methods=['PUT'])
def update_session(session_id):
    """API to update a session"""
    try:
        session_data = request.get_json()
        if not session_data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        # Save the updated session
        save_session(session_id, session_data)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """API to delete a session"""
    try:
        session_path = f'../sessions/{session_id}.json'
        if os.path.exists(session_path):
            os.remove(session_path)
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Auth API endpoints
@app.route('/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        name = data.get('name')

        if not all([email, password, name]):
            return jsonify({'success': False, 'error': 'All fields required'}), 400

        # Check if user already exists
        existing_user = db_manager.get_user_by_email(email)
        if existing_user:
            return jsonify({'success': False, 'error': 'User already exists'}), 409

        # Hash the password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Create user in database
        user = db_manager.create_user(email, password_hash, name)

        return jsonify({'success': True, 'message': 'User registered successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/auth/login', methods=['POST'])
def login():
    """Login user"""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not all([email, password]):
            return jsonify({'success': False, 'error': 'Email and password required'}), 400

        # Get user directly from database (not through manager to access password_hash)
        from models import User
        user = User.query.filter_by(email=email).first()

        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 401

        if not user.password_hash:
            return jsonify({'success': False, 'error': 'No password hash stored'}), 401

        try:
            if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
                return jsonify({'success': False, 'error': 'Invalid password'}), 401
        except ValueError as e:
            # Handle invalid hash format (e.g., "invalid salt")
            print(f"Password hash validation error for user {email}: {e}")
            return jsonify({'success': False, 'error': 'Authentication system error. Please contact support.'}), 500

        # Simple token (in production, use JWT)
        token = f"token_{email}_{datetime.now().timestamp()}"

        return jsonify({
            'success': True,
            'token': token,
            'user': {
                'email': user.email,
                'name': user.name
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/auth/profile', methods=['GET'])
def get_profile():
    """Get user profile"""
    # Simple auth check (in production, verify JWT)
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'success': False, 'error': 'No token provided'}), 401

    # Find user by token (simplified)
    user_email = None
    for email_part in token.split('_'):
        if '@' in email_part:
            user_email = email_part
            break

    if not user_email:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    user = db_manager.get_user_by_email(user_email)
    if not user:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    return jsonify({
        'success': True,
        'user': {
            'email': user['email'],
            'name': user['name'],
            'created_at': user['created_at']
        }
    })

@app.route('/auth/profile', methods=['PUT'])
def update_profile():
    """Update user profile"""
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'success': False, 'error': 'No token provided'}), 401

    user_email = None
    for email_part in token.split('_'):
        if '@' in email_part:
            user_email = email_part
            break

    if not user_email:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    user = db_manager.get_user_by_email(user_email)
    if not user:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    try:
        data = request.get_json()
        user_id = user['id']

        update_data = {}
        if 'name' in data:
            update_data['name'] = data['name']
        if 'email' in data and data['email'] != user_email:
            # Check if new email exists
            existing_user = db_manager.get_user_by_email(data['email'])
            if existing_user:
                return jsonify({'success': False, 'error': 'Email already exists'}), 409
            update_data['email'] = data['email']

        if update_data:
            updated_user = db_manager.update_user(user_id, **update_data)
            if not updated_user:
                return jsonify({'success': False, 'error': 'User update failed'}), 500

        return jsonify({'success': True, 'user': {
            'email': updated_user['email'],
            'name': updated_user['name']
        }})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Eye Tracking API endpoints
@app.route('/eye-tracking/data', methods=['POST'])
def store_eye_tracking_data():
    """Store eye tracking data"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        if not session_id:
            return jsonify({'success': False, 'error': 'Session ID required'}), 400

        data_id = f"et_{session_id}_{datetime.now().timestamp()}"
        eye_tracking_data[data_id] = {
            'id': data_id,
            'session_id': session_id,
            **data,
            'created_at': datetime.now().isoformat()
        }

        return jsonify({'success': True, 'id': data_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/eye-tracking/data/<session_id>', methods=['GET'])
def get_eye_tracking_data(session_id):
    """Get eye tracking data for a session"""
    try:
        session_data = [data for data in eye_tracking_data.values() if data['session_id'] == session_id]
        return jsonify({'success': True, 'data': session_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/eye-tracking/data/<data_id>', methods=['PUT'])
def update_eye_tracking_data(data_id):
    """Update eye tracking data"""
    try:
        if data_id not in eye_tracking_data:
            return jsonify({'success': False, 'error': 'Data not found'}), 404

        data = request.get_json()
        eye_tracking_data[data_id].update(data)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/eye-tracking/data/<data_id>', methods=['DELETE'])
def delete_eye_tracking_data(data_id):
    """Delete eye tracking data"""
    try:
        if data_id not in eye_tracking_data:
            return jsonify({'success': False, 'error': 'Data not found'}), 404

        del eye_tracking_data[data_id]
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Speech Analysis API endpoints
@app.route('/speech-analysis/data', methods=['POST'])
def store_speech_analysis_data():
    """Store speech analysis data"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        if not session_id:
            return jsonify({'success': False, 'error': 'Session ID required'}), 400

        data_id = f"sa_{session_id}_{datetime.now().timestamp()}"
        speech_analysis_data[data_id] = {
            'id': data_id,
            'session_id': session_id,
            **data,
            'created_at': datetime.now().isoformat()
        }

        return jsonify({'success': True, 'id': data_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/speech-analysis/data/<session_id>', methods=['GET'])
def get_speech_analysis_data(session_id):
    """Get speech analysis data for a session"""
    try:
        session_data = [data for data in speech_analysis_data.values() if data['session_id'] == session_id]
        return jsonify({'success': True, 'data': session_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/speech-analysis/upload/<session_id>', methods=['POST'])
def upload_audio_file(session_id):
    """Upload audio file for speech analysis"""
    try:
        if 'audio' not in request.files:
            return jsonify({'success': False, 'error': 'No audio file provided'}), 400

        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'success': False, 'error': 'No selected file'}), 400

        # Save temporarily and process
        temp_path = f'temp_upload_{session_id}.wav'
        audio_file.save(temp_path)

        # Process audio (using existing speech analyzer)
        analysis = process_audio_from_web(temp_path)

        # Clean up
        os.remove(temp_path)

        # Store analysis data
        data_id = f"sa_{session_id}_{datetime.now().timestamp()}"
        speech_analysis_data[data_id] = {
            'id': data_id,
            'session_id': session_id,
            **analysis,
            'created_at': datetime.now().isoformat()
        }

        return jsonify({'success': True, 'id': data_id, 'analysis': analysis})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/speech-analysis/data/<data_id>', methods=['PUT'])
def update_speech_analysis_data(data_id):
    """Update speech analysis data"""
    try:
        if data_id not in speech_analysis_data:
            return jsonify({'success': False, 'error': 'Data not found'}), 404

        data = request.get_json()
        speech_analysis_data[data_id].update(data)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/speech-analysis/data/<data_id>', methods=['DELETE'])
def delete_speech_analysis_data(data_id):
    """Delete speech analysis data"""
    try:
        if data_id not in speech_analysis_data:
            return jsonify({'success': False, 'error': 'Data not found'}), 404

        del speech_analysis_data[data_id]
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# AI Recommendations API endpoints
@app.route('/ai/recommendations', methods=['GET'])
def get_ai_recommendations():
    """Get AI recommendations"""
    try:
        # Get user from token
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'success': False, 'error': 'No token provided'}), 401

        user_email = None
        for email_part in token.split('_'):
            if '@' in email_part:
                user_email = email_part
                break

        if not user_email:
            return jsonify({'success': False, 'error': 'Invalid token'}), 401

        user = db_manager.get_user_by_email(user_email)
        if not user:
            return jsonify({'success': False, 'error': 'Invalid token'}), 401

        user_id = user['id']
        status = request.args.get('status')
        limit = int(request.args.get('limit', 10))

        recommendations = db_manager.get_user_recommendations(user_id, status, limit)
        return jsonify({'success': True, 'recommendations': recommendations})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/ai/recommendations/latest', methods=['GET'])
def get_latest_ai_recommendations():
    """Get latest AI recommendations for the authenticated user"""
    try:
        # Get user from token
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'success': False, 'error': 'No token provided'}), 401

        user_email = None
        for email_part in token.split('_'):
            if '@' in email_part:
                user_email = email_part
                break

        if not user_email:
            return jsonify({'success': False, 'error': 'Invalid token'}), 401

        user = db_manager.get_user_by_email(user_email)
        if not user:
            return jsonify({'success': False, 'error': 'Invalid token'}), 401

        user_id = user['id']
        limit = int(request.args.get('limit', 3))

        # Get latest recommendations from database
        recommendations = db_manager.get_user_recent_recommendations(user_id, limit)

        return jsonify({'success': True, 'recommendations': recommendations})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/ai/recommendations', methods=['POST'])
def create_ai_recommendation():
    """Create AI recommendation"""
    try:
        data = request.get_json()
        rec_id = f"rec_{datetime.now().timestamp()}"

        ai_recommendations[rec_id] = {
            'id': rec_id,
            'status': 'pending',
            'created_at': datetime.now().isoformat(),
            **data
        }

        return jsonify({'success': True, 'id': rec_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/ai/recommendations/<rec_id>', methods=['PUT'])
def update_ai_recommendation(rec_id):
    """Update AI recommendation"""
    try:
        if rec_id not in ai_recommendations:
            return jsonify({'success': False, 'error': 'Recommendation not found'}), 404

        data = request.get_json()
        ai_recommendations[rec_id].update(data)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/ai/recommendations/<rec_id>', methods=['DELETE'])
def delete_ai_recommendation(rec_id):
    """Delete AI recommendation"""
    try:
        if rec_id not in ai_recommendations:
            return jsonify({'success': False, 'error': 'Recommendation not found'}), 404

        del ai_recommendations[rec_id]
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/ai/generate/<session_id>', methods=['POST'])
def generate_ai_recommendations(session_id):
    """Generate AI recommendations for a session"""
    try:
        # Get session data
        session_path = f'sessions/{session_id}.json'
        if not os.path.exists(session_path):
            return jsonify({'success': False, 'error': 'Session not found'}), 404

        with open(session_path, 'r') as f:
            session_data = json.load(f)

        # Generate recommendations based on session analysis
        analysis = session_data.get('analysis', {})
        eye_score = analysis.get('core_metrics', {}).get('eye_contact_score', 0)
        speech_score = analysis.get('speech_metrics', {}).get('accuracy_score', 0)

        recommendations = []

        if eye_score < 60:
            recommendations.append({
                'type': 'eye_contact',
                'title': 'Improve Eye Contact',
                'description': 'Practice maintaining eye contact for 50-70% of your speaking time',
                'priority': 'high',
                'session_id': session_id
            })

        if speech_score < 70:
            recommendations.append({
                'type': 'speech_clarity',
                'title': 'Enhance Speech Clarity',
                'description': 'Work on pronunciation and reduce filler words',
                'priority': 'medium',
                'session_id': session_id
            })

        # Store recommendations
        for rec_data in recommendations:
            rec_id = f"rec_{session_id}_{datetime.now().timestamp()}"
            ai_recommendations[rec_id] = {
                'id': rec_id,
                'status': 'pending',
                'created_at': datetime.now().isoformat(),
                **rec_data
            }

        return jsonify({'success': True, 'recommendations': recommendations})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Leaderboard API endpoints
@app.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    """Get leaderboard"""
    try:
        period = request.args.get('period', 'all')
        limit = int(request.args.get('limit', 10))

        # Get real leaderboard data from database
        leaderboard = db_manager.get_leaderboard(period, limit)

        return jsonify({'success': True, 'leaderboard': leaderboard})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/leaderboard/teams', methods=['GET'])
def get_team_leaderboard():
    """Get team leaderboard"""
    try:
        # Mock team leaderboard
        team_leaderboard = [
            {'rank': 1, 'team': 'Team Alpha', 'avg_score': 90, 'members': 5},
            {'rank': 2, 'team': 'Team Beta', 'avg_score': 87, 'members': 4},
            {'rank': 3, 'team': 'Team Gamma', 'avg_score': 84, 'members': 6}
        ]

        return jsonify({'success': True, 'leaderboard': team_leaderboard})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Progress API endpoints
@app.route('/progress/metrics', methods=['GET'])
def get_progress_metrics():
    """Get progress metrics"""
    try:
        days = int(request.args.get('days', 30))

        # Get user from token
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'success': False, 'error': 'No token provided'}), 401

        user_email = None
        for email_part in token.split('_'):
            if '@' in email_part:
                user_email = email_part
                break

        if not user_email:
            return jsonify({'success': False, 'error': 'Invalid token'}), 401

        user = db_manager.get_user_by_email(user_email)
        if not user:
            return jsonify({'success': False, 'error': 'Invalid token'}), 401

        user_id = user['id']

        # Get user sessions and calculate metrics from session analysis data
        user_sessions = db_manager.get_user_sessions(user_id, limit=100)

        # Calculate trends and averages from session data
        eye_contact_scores = []
        speech_accuracy_scores = []
        wpm_scores = []

        for session in user_sessions:
            analysis = session.get('analysis', {})
            if analysis:
                core_metrics = analysis.get('core_metrics', {})
                speech_metrics = analysis.get('speech_metrics', {})

                eye_contact = core_metrics.get('eye_contact_score', 0)
                if eye_contact > 0:
                    eye_contact_scores.append(eye_contact)

                speech_accuracy = speech_metrics.get('accuracy_score', 0)
                if speech_accuracy > 0:
                    speech_accuracy_scores.append(speech_accuracy)

                wpm = speech_metrics.get('wpm', 0)
                if wpm > 0:
                    wpm_scores.append(wpm)

        # Calculate averages
        avg_eye_contact = sum(eye_contact_scores) / len(eye_contact_scores) if eye_contact_scores else 0
        avg_speech_accuracy = sum(speech_accuracy_scores) / len(speech_accuracy_scores) if speech_accuracy_scores else 0
        avg_wpm = sum(wpm_scores) / len(wpm_scores) if wpm_scores else 0

        # Get user stats for additional metrics
        user_stats = db_manager.get_user_stats(user_id)

        metrics = {
            'eye_contact_trend': eye_contact_scores[-7:] if len(eye_contact_scores) >= 7 else eye_contact_scores,
            'speech_accuracy_trend': speech_accuracy_scores[-7:] if len(speech_accuracy_scores) >= 7 else speech_accuracy_scores,
            'wpm_trend': wpm_scores[-7:] if len(wpm_scores) >= 7 else wpm_scores,
            'overall_improvement': user_stats.get('average_engagement', 0),
            'sessions_completed': user_stats.get('total_sessions', 0),
            'average_score': round((avg_eye_contact + avg_speech_accuracy) / 2, 1) if avg_eye_contact and avg_speech_accuracy else 0,
            'average_eye_contact': round(avg_eye_contact, 1),
            'average_speech_accuracy': round(avg_speech_accuracy, 1),
            'average_wpm': round(avg_wpm, 1)
        }

        return jsonify({'success': True, 'metrics': metrics})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/progress/trends', methods=['GET'])
def get_progress_trends():
    """Get progress trends"""
    try:
        # Mock trend data
        trends = {
            'weekly_scores': [75, 78, 80, 82],
            'monthly_improvement': 8,
            'skill_breakdown': {
                'eye_contact': 85,
                'speech_clarity': 80,
                'voice_modulation': 75,
                'body_language': 82
            }
        }

        return jsonify({'success': True, 'trends': trends})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/welcome', methods=['GET'])
def welcome():
    """Welcome endpoint that logs requests and returns a welcome message"""
    logging.info(f"Request: {request.method} {request.path}")
    return jsonify({'message': 'Welcome to the SPEAK API!'})

@app.route('/analyze', methods=['POST'])
def analyze_session():
    """Analyze session and save all data to database"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        user_id = data.get('user_id')

        if not session_id or not user_id:
            print(f"❌ Missing required parameters: session_id={session_id}, user_id={user_id}")
            return jsonify({'status': 'error', 'message': 'session_id and user_id are required'}), 400

        print(f"🔄 Starting analysis for session {session_id}, user {user_id}")

        # Retrieve session data from active_sessions or database
        session_data = active_sessions.get(session_id)
        if not session_data:
            print(f"📋 Session {session_id} not in active_sessions, checking database")
            session_data = db_manager.get_session(session_id)
            if not session_data:
                print(f"❌ Session {session_id} not found in database")
                return jsonify({'status': 'error', 'message': 'Session not found'}), 404

        analysis_data = session_data.get('analysis', {})
        if not analysis_data:
            print(f"❌ No analysis data available for session {session_id}")
            return jsonify({'status': 'error', 'message': 'No analysis data available'}), 400

        print(f"📊 Analysis data found: {list(analysis_data.keys())}")

        # Extract analysis components
        core_metrics = analysis_data.get('core_metrics', {})
        speech_metrics = analysis_data.get('speech_metrics', {})
        voice_metrics = analysis_data.get('voice_metrics', {})

        print(f"📈 Core metrics: eye_contact={core_metrics.get('eye_contact_score', 0)}")
        print(f"📈 Speech metrics: accuracy={speech_metrics.get('accuracy_score', 0)}, wpm={speech_metrics.get('wpm', 0)}")
        print(f"📈 Voice metrics: {list(voice_metrics.keys()) if voice_metrics else 'None'}")

        # Store eye tracking data
        print(f"👁️ Storing eye tracking data for session {session_id}")
        eye_data = {
            'eye_contact': core_metrics.get('eye_contact_score', 0) > 50,
            'eye_contact_percentage': core_metrics.get('eye_contact_score', 0),
            'gaze_x': None,
            'gaze_y': None,
            'blink_rate': core_metrics.get('blink_rate', 0),
            'frame_data': {'core_metrics': core_metrics}
        }
        try:
            eye_result = db_manager.store_eye_tracking_data(session_id, eye_data)
            print(f"✅ Eye tracking data stored successfully: {eye_result}")
        except Exception as e:
            print(f"❌ Error saving eye tracking data: {e}")
            raise e

        # Store speech analysis data
        print(f"🎤 Storing speech analysis data for session {session_id}")
        speech_data = {
            'accuracy_score': speech_metrics.get('accuracy_score', 0),
            'wpm': speech_metrics.get('wpm', 0),
            'grammar_errors': speech_metrics.get('grammar_errors', 0),
            'spelling_errors': speech_metrics.get('spelling_errors', 0),
            'average_volume': voice_metrics.get('average_volume', 0),
            'volume_variance': voice_metrics.get('volume_variance', 0),
            'average_pitch': voice_metrics.get('average_pitch', 0),
            'pitch_range': voice_metrics.get('pitch_range', 0),
            'voice_duration_seconds': voice_metrics.get('voice_duration_seconds', 0),
            'analysis_details': speech_metrics
        }
        try:
            speech_result = db_manager.store_speech_analysis_data(session_id, speech_data)
            print(f"✅ Speech analysis data stored successfully: {speech_result}")
        except Exception as e:
            print(f"❌ Error saving speech analysis data: {e}")
            raise e

        # Store progress metrics
        print(f"📊 Storing progress metrics for user {user_id}")
        try:
            progress_result = db_manager.store_session_progress_metrics(user_id, analysis_data)
            print(f"✅ Progress metrics stored successfully: {progress_result}")
        except Exception as e:
            print(f"❌ Error saving progress metrics: {e}")
            raise e

        # Update leaderboard
        print(f"🏆 Updating leaderboard for user {user_id}")
        try:
            leaderboard_all = db_manager.update_leaderboard(user_id, 'all')
            leaderboard_weekly = db_manager.update_leaderboard(user_id, 'weekly')
            leaderboard_monthly = db_manager.update_leaderboard(user_id, 'monthly')
            print(f"✅ Leaderboard updated successfully: all={leaderboard_all}, weekly={leaderboard_weekly}, monthly={leaderboard_monthly}")
        except Exception as e:
            print(f"❌ Error updating leaderboard: {e}")
            raise e

        # Generate AI recommendations
        print(f"🤖 Generating AI recommendations for session {session_id}")
        ai_feedback = session_data.get('ai_feedback', {})
        try:
            ai_recommendations = db_manager.generate_ai_recommendations_from_analysis(session_id, user_id, analysis_data, ai_feedback)
            print(f"✅ AI recommendations generated successfully: {len(ai_recommendations)} recommendations")
        except Exception as e:
            print(f"❌ Error generating AI recommendations: {e}")
            raise e

        # Final commit to ensure all changes are saved
        print("💾 Performing final database commit")
        db.session.commit()
        print("✅ Database commit successful")

        print(f"🎉 Analysis completed successfully for user {user_id}, session {session_id}")
        return jsonify({'status': 'success', 'message': 'Analysis completed'})

    except Exception as e:
        print(f"❌ Critical error in analyze_session: {e}")
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


@socketio.on('connect')
def handle_connect():
    print('✅ Client connected')
    socketio.emit('connected', {'status': 'ready'})

@socketio.on('start_session')
def handle_start_session(data):
    session_id = data.get('session_id', f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    user_id = data.get('user_id')
    active_sessions[session_id] = {
        'start_time': datetime.now().isoformat(),
        'analysis': None,
        'is_active': True,
        'speech_analysis': None,
        'user_id': user_id
    }
    
    # Reset the eye tracker for new session
    eye_tracker.reset_session()
    
    # Initialize speech data for session
    speech_data[session_id] = {'audio_data': None, 'analysis': None}
    
    print(f'🎯 Advanced session started: {session_id}')
    print('💡 TIP: Look straight at the camera for automatic calibration')
    socketio.emit('session_started', {'session_id': session_id})

@socketio.on('process_frame')
def handle_process_frame(data):
    session_id = data.get('session_id')
    image_data = data.get('image_data')
    
    if session_id not in active_sessions or not active_sessions[session_id]['is_active']:
        return
    
    try:
        # Process frame with advanced eye tracker
        frame_analysis = eye_tracker.process_frame(image_data)
        
        # ADD DEBUG OUTPUT
        print(f"🔍 Frame Analysis: Eye Contact = {frame_analysis.get('eye_contact', False)}, "
              f"Percentage = {frame_analysis.get('eye_contact_percentage', 0)}%, "
              f"Frames = {eye_tracker.total_frames}, "
              f"Eye Contact Frames = {eye_tracker.eye_contact_frames}")
        
        if frame_analysis:
            # Send real-time analysis back to client
            socketio.emit('real_time_analysis', {
                'session_id': session_id,
                'analysis': frame_analysis
            })
            
    except Exception as e:
        print(f"❌ Error processing frame: {e}")
        socketio.emit('processing_error', {
            'session_id': session_id,
            'error': str(e)
        })

@socketio.on('start_speech')
def handle_start_speech(data):
    session_id = data.get('session_id')
    if session_id in active_sessions:
        print(f'🎤 Starting speech recording for session: {session_id}')
        # Start speech recording logic here (e.g., using pyaudio or wait for audio upload)
        socketio.emit('speech_started', {'session_id': session_id})

@socketio.on('stop_speech')
def handle_stop_speech(data):
    session_id = data.get('session_id')
    if session_id in active_sessions:
        print(f'⏹️ Stopping speech recording for session: {session_id}')
        # Stop speech recording and process
        socketio.emit('speech_stopped', {'session_id': session_id})

@socketio.on('upload_audio')
def handle_upload_audio(data):
    session_id = data.get('session_id')
    audio_data = data.get('audio_data')  # Base64 audio data
    
    if session_id in active_sessions and audio_data:
        try:
            # Decode and save audio temporarily
            audio_bytes = base64.b64decode(audio_data.split(',')[1])
            temp_file = f'temp_audio_{session_id}.wav'
            with open(temp_file, 'wb') as f:
                f.write(audio_bytes)
            
            # Process audio
            speech_analysis = process_audio_from_web(temp_file)
            speech_data[session_id]['analysis'] = speech_analysis
            
            # Clean up temp file
            os.remove(temp_file)
            
            print(f'🎤 Speech analysis complete for {session_id}: {speech_analysis.get("accuracy_score", 0)}%')
            socketio.emit('speech_analysis_complete', {
                'session_id': session_id,
                'analysis': speech_analysis
            })
        except Exception as e:
            print(f"❌ Speech upload error: {e}")
            socketio.emit('speech_error', {'session_id': session_id, 'error': str(e)})

@socketio.on('stop_session')
def handle_stop_session(data):
    session_id = data.get('session_id')
    if session_id in active_sessions:
        active_sessions[session_id]['is_active'] = False
        total_points = len(eye_tracker.session_data['gaze_points'])
        detection_rate = round((total_points / max(1, eye_tracker.total_frames)) * 100, 1)
        eye_contact_score = eye_tracker.eye_contact_percentage
        
        print(f'⏹️ Session stopped: {session_id}')
        print(f'📊 Results: {total_points} points, {detection_rate}% detection, {eye_contact_score}% eye contact')
        
        socketio.emit('session_stopped', {
            'session_id': session_id,
            'total_points': total_points,
            'detection_rate': detection_rate,
            'eye_contact_score': eye_contact_score
        })

@socketio.on('analyze_session')
def handle_analyze_session(data):
    session_id = data.get('session_id')
    if session_id in active_sessions:
        try:
            # Get comprehensive eye analysis
            eye_analysis = eye_tracker.get_comprehensive_analysis()

            # Get speech analysis if available
            speech_analysis = speech_data.get(session_id, {}).get('analysis', None)

            # Get voice data analysis if available
            voice_data = active_sessions[session_id].get('voice_data', [])
            voice_metrics = None

            if voice_data:
                # Calculate voice metrics from real-time data
                volumes = [point['volume'] for point in voice_data]
                pitches = [point['pitch'] for point in voice_data]

                if volumes and pitches:
                    voice_metrics = {
                        'average_volume': sum(volumes) / len(volumes),
                        'max_volume': max(volumes),
                        'min_volume': min(volumes),
                        'volume_variance': sum((v - sum(volumes)/len(volumes))**2 for v in volumes) / len(volumes),
                        'average_pitch': sum(pitches) / len(pitches),
                        'pitch_range': max(pitches) - min(pitches),
                        'voice_data_points': len(voice_data),
                        'voice_duration_seconds': (voice_data[-1]['timestamp'] - voice_data[0]['timestamp']) / 1000 if len(voice_data) > 1 else 0
                    }

            # Combine metrics
            combined_analysis = eye_analysis.copy()
            if speech_analysis:
                combined_analysis['speech_metrics'] = speech_analysis

            if voice_metrics:
                # Add time-series data for charts
                voice_data = active_sessions[session_id].get('voice_data', [])
                if voice_data:
                    # Sample every 10th point for chart efficiency
                    sampled_data = voice_data[::10]
                    voice_metrics['volume_levels'] = [point['volume'] for point in sampled_data]
                    voice_metrics['pitch_levels'] = [point['pitch'] for point in sampled_data]
                    voice_metrics['timestamps'] = [point['timestamp'] for point in sampled_data]

                combined_analysis['voice_metrics'] = voice_metrics

            # Calculate overall engagement including voice if available
            eye_ratio = eye_analysis['core_metrics']['eye_contact_score'] / 100
            speech_acc = speech_analysis.get('accuracy_score', 0) / 100 if speech_analysis else 0
            wpm = speech_analysis.get('wpm', 0) if speech_analysis else 0

            # Include voice factors in engagement calculation
            voice_factor = 0
            if voice_metrics:
                # Voice engagement based on volume consistency and pitch variation
                volume_consistency = 1 - min(voice_metrics['volume_variance'] / 1000, 1)  # Normalize variance
                pitch_variation = min(voice_metrics['pitch_range'] / 200, 1)  # Normalize pitch range
                voice_factor = (volume_consistency + pitch_variation) / 2

            combined_analysis['overall_engagement'] = calculate_engagement_score(eye_ratio, speech_acc, wpm, voice_factor)

            active_sessions[session_id]['analysis'] = combined_analysis

            # Save session with combined data
            save_session(session_id, active_sessions[session_id])

            # Store progress metrics and generate AI recommendations after session completion
            session_data = active_sessions[session_id]
            user_id = session_data.get('user_id')

            if user_id:
                # Store progress metrics
                db_manager.store_session_progress_metrics(user_id, combined_analysis)

                # Generate AI recommendations
                ai_feedback = session_data.get('ai_feedback', {})
                db_manager.generate_ai_recommendations_from_analysis(session_id, user_id, combined_analysis, ai_feedback)

                # Update leaderboard
                db_manager.update_leaderboard(user_id, 'all')
                db_manager.update_leaderboard(user_id, 'weekly')
                db_manager.update_leaderboard(user_id, 'monthly')

                # Send real-time dashboard update to all connected clients
                dashboard_metrics = {
                    'user_id': user_id,
                    'eye_contact': combined_analysis['core_metrics']['eye_contact_score'],
                    'speech_accuracy': combined_analysis.get('speech_metrics', {}).get('accuracy_score', 0),
                    'wpm': combined_analysis.get('speech_metrics', {}).get('wpm', 0),
                    'average_score': combined_analysis['overall_engagement'],
                    'recommendations': db_manager.get_user_recent_recommendations(user_id, limit=3),
                    'timestamp': datetime.now().isoformat()
                }
                send_dashboard_update(user_id, dashboard_metrics)

            print(f'📊 Combined analysis complete for {session_id} (Voice data: {len(voice_data)} points)')
            socketio.emit('analysis_complete', {
                'session_id': session_id,
                'analysis': combined_analysis
            })

            # Automatically get AI feedback after analysis
            socketio.start_background_task(get_ai_feedback_background, session_id)

        except Exception as e:
            print(f"❌ Error during analysis: {e}")
            socketio.emit('analysis_error', {
                'session_id': session_id,
                'error': str(e)
            })

def get_ai_feedback_background(session_id):
    """Get AI feedback in background"""
    print(f"🔄 Starting AI feedback generation for {session_id}")
    try:
        if session_id in active_sessions:
            session_data = active_sessions[session_id].get('analysis', {})
            print(f"📊 Session data available: {bool(session_data)}")
            if session_data:
                print(f"📈 Core metrics: {session_data.get('core_metrics', {})}")
            ai_feedback = gemini_analyzer.analyze_eye_tracking_data(session_data)
            active_sessions[session_id]['ai_feedback'] = ai_feedback

            print(f"🤖 AI feedback generated: {ai_feedback.get('performance_rating', 'Unknown') if ai_feedback else 'None'}")
            socketio.emit('ai_feedback_complete', {
                'session_id': session_id,
                'ai_feedback': ai_feedback
            })
            print(f'✅ AI feedback emitted for {session_id}')

            # Send dashboard update with latest AI recommendations
            user_id = session_data.get('user_id')
            if user_id:
                # Get the latest recommendations including the newly generated AI feedback
                latest_recommendations = db_manager.get_user_recent_recommendations(user_id, limit=3)

                # Prepare dashboard update payload with latest recommendations
                dashboard_metrics = {
                    'user_id': user_id,
                    'eye_contact': session_data.get('core_metrics', {}).get('eye_contact_score', 0),
                    'speech_accuracy': session_data.get('speech_metrics', {}).get('accuracy_score', 0),
                    'wpm': session_data.get('speech_metrics', {}).get('wpm', 0),
                    'average_score': session_data.get('overall_engagement', 0),
                    'recommendations': latest_recommendations,
                    'timestamp': datetime.now().isoformat()
                }
                send_dashboard_update(user_id, dashboard_metrics)
                print(f'📡 Dashboard updated with latest AI recommendations for user {user_id}')
        else:
            print(f"❌ Session {session_id} not found in active_sessions")
            # Emit fallback feedback even if session not found
            fallback_feedback = {
                "overall_assessment": "Session data unavailable for AI analysis",
                "performance_rating": "Unknown",
                "key_strengths": ["Session completed"],
                "areas_for_improvement": ["Ensure session data is properly stored"],
                "personalized_feedback": "Unable to generate AI feedback due to missing session data. Please try starting a new session.",
                "actionable_strategies": [
                    {
                        "strategy": "Restart Session",
                        "description": "Start a new practice session to enable AI feedback",
                        "benefit": "Full AI analysis will be available"
                    }
                ],
                "practice_exercises": [
                    {
                        "exercise": "Basic Practice",
                        "instructions": "Continue practicing without AI feedback for now",
                        "duration": "10 minutes"
                    }
                ],
                "confidence_boosters": ["Practice makes perfect"],
                "next_session_goals": ["Complete a full session with analysis"]
            }
            socketio.emit('ai_feedback_complete', {
                'session_id': session_id,
                'ai_feedback': fallback_feedback
            })
            print(f'⚠️ Fallback AI feedback emitted for missing session {session_id}')
    except Exception as e:
        print(f"❌ Background AI feedback error: {e}")
        import traceback
        traceback.print_exc()
        # Emit fallback feedback on error to ensure frontend receives something
        fallback_feedback = {
            "overall_assessment": "AI feedback generation encountered an error",
            "performance_rating": "Error",
            "key_strengths": ["System is running"],
            "areas_for_improvement": ["Technical issue with AI analysis"],
            "personalized_feedback": f"There was an error generating AI feedback: {str(e)}. Please try again or check the server logs.",
            "actionable_strategies": [
                {
                    "strategy": "Retry Analysis",
                    "description": "Try analyzing the session again",
                    "benefit": "May resolve temporary issues"
                }
            ],
            "practice_exercises": [
                {
                    "exercise": "Manual Review",
                    "instructions": "Review your session metrics manually",
                    "duration": "5 minutes"
                }
            ],
            "confidence_boosters": ["Technical issues happen", "Keep practicing"],
            "next_session_goals": ["Complete analysis successfully"]
        }
        socketio.emit('ai_feedback_complete', {
            'session_id': session_id,
            'ai_feedback': fallback_feedback
        })
        print(f'⚠️ Fallback AI feedback emitted due to error for {session_id}')

@socketio.on('get_ai_feedback')
def handle_get_ai_feedback(data):
    session_id = data.get('session_id')
    
    if session_id in active_sessions:
        try:
            session_data = active_sessions[session_id].get('analysis', {})
            
            # Get AI-powered feedback
            ai_feedback = gemini_analyzer.analyze_eye_tracking_data(session_data)
            
            # Store AI feedback with session
            active_sessions[session_id]['ai_feedback'] = ai_feedback
            
            print(f'🤖 AI feedback generated for {session_id}')
            socketio.emit('ai_feedback_complete', {
                'session_id': session_id,
                'ai_feedback': ai_feedback
            })
            
        except Exception as e:
            print(f"❌ AI feedback error: {e}")
            socketio.emit('ai_feedback_error', {
                'session_id': session_id,
                'error': str(e)
            })
    else:
        socketio.emit('ai_feedback_error', {
            'session_id': session_id,
            'error': 'Session not found'
        })

@socketio.on('calibrate_tracker')
def handle_calibrate_tracker():
    """Recalibrate the eye tracker"""
    eye_tracker.calibrate_head_pose()
    socketio.emit('calibration_complete', {
        'status': 'recalibrated',
        'message': 'Look straight at the camera for calibration'
    })

@socketio.on('voice_real_time')
def handle_voice_real_time(data):
    """Handle real-time voice data from client"""
    session_id = data.get('session_id')
    volume = data.get('volume', 0)
    pitch = data.get('pitch', 0)
    timestamp = data.get('timestamp', time.time() * 1000)

    if session_id in active_sessions and active_sessions[session_id]['is_active']:
        # Initialize voice data storage if not exists
        if 'voice_data' not in active_sessions[session_id]:
            active_sessions[session_id]['voice_data'] = []

        # Store voice data point
        voice_point = {
            'timestamp': timestamp,
            'volume': volume,
            'pitch': pitch
        }

        active_sessions[session_id]['voice_data'].append(voice_point)

        # Keep only last 1000 points to prevent memory issues
        if len(active_sessions[session_id]['voice_data']) > 1000:
            active_sessions[session_id]['voice_data'] = active_sessions[session_id]['voice_data'][-1000:]

        # Send voice data back to client for real-time UI updates
        socketio.emit('voice_update', {
            'session_id': session_id,
            'voice_volume': volume,
            'voice_pitch': pitch,
            'speaking_status': volume > 5,  # Lower threshold for better sensitivity
            'timestamp': timestamp
        })

@socketio.on('reset_tracker')
def handle_reset_tracker():
    """Reset the eye tracker"""
    eye_tracker.reset_session()
    socketio.emit('tracker_reset', {'status': 'reset'})

@socketio.on('get_debug_info')
def handle_get_debug_info():
    """Get debug information for troubleshooting"""
    debug_info = {
        'total_frames': eye_tracker.total_frames,
        'eye_contact_frames': eye_tracker.eye_contact_frames,
        'eye_contact_percentage': eye_tracker.eye_contact_percentage,
        'is_calibrated': eye_tracker.calibrated,
        'face_detected': eye_tracker.face_detected,
        'landmarks_detected': eye_tracker.landmarks_detected
    }
    socketio.emit('debug_info', debug_info)

@socketio.on('disconnect')
def handle_disconnect():
    print('❌ Client disconnected')

def save_session(session_id, session_data):
    """Save session data to database"""
    try:
        # Extract user_id if available (from active_sessions or session_data)
        user_id = session_data.get('user_id')

        # Check if session already exists

        existing_session = db_manager.get_session(session_id)

        if existing_session:
            # Update existing session
            analysis_data = session_data.get('analysis', {})
            ai_feedback_data = session_data.get('ai_feedback', {})
            db_manager.update_session_analysis(session_id, analysis_data, ai_feedback_data)

            # Update end_time and active status if session is ending
            if not session_data.get('is_active', True):
                db_manager.end_session(session_id)

            print(f'💾 Session updated in database: {session_id}')
        else:
            # Create new session
            db_session = db_manager.create_session(session_id, user_id)

            # Update with analysis data if available
            analysis_data = session_data.get('analysis', {})
            ai_feedback_data = session_data.get('ai_feedback', {})
            if analysis_data:
                db_manager.update_session_analysis(session_id, analysis_data, ai_feedback_data)

            print(f'💾 Session created in database: {session_id}')

    except Exception as e:
        print(f"❌ Error saving session to database: {e}")
        # Fallback to file-based saving if database fails
        try:
            sessions_dir = '../sessions'
            os.makedirs(sessions_dir, exist_ok=True)
            filename = f"{sessions_dir}/{session_id}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, indent=2, ensure_ascii=False)
            print(f'⚠️ Fallback: Session saved to file: {filename}')
        except Exception as file_error:
            print(f"❌ Fallback file save also failed: {file_error}")

if __name__ == '__main__':
    # Initialize database in main block
    init_db(app)

    print("🚀 Starting SPEAK - Advanced Professional Speech Analysis")
    print("📍 Server running at: http://localhost:5000")
    print("IMPROVED eye contact detection activated")
    
    if GEMINI_API_KEY:
        print("🤖 Gemini AI feedback system initializing...")
        if gemini_analyzer.model:
            if gemini_analyzer.quota_exceeded:
                print(f"Gemini AI configured with {gemini_analyzer.model_name} (quota exceeded - using fallback)")
            else:
                print(f"Gemini AI ready with model: {gemini_analyzer.model_name}")
        else:
            print("❌ Gemini AI not available")
    else:
        print("❌ No Gemini API key found - AI features disabled")
    
    print("💡 Auto-calibration enabled - just look straight at camera")
    print("🎤 Speech analysis integrated - record audio for combined feedback")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
