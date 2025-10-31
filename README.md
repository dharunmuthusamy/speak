# SPEAK - Advanced Professional Speech Analysis Platform

A comprehensive web application for analyzing and improving public speaking skills through real-time eye contact tracking, speech analysis, voice modulation assessment, and AI-powered personalized feedback.

## 🚀 Features

### Core Analysis Capabilities
- **Real-time Eye Contact Tracking**: Advanced computer vision using MediaPipe for precise eye contact detection and gaze analysis
- **Speech Analysis**: Automatic speech-to-text processing with accuracy scoring, WPM calculation, and grammar analysis
- **Voice Modulation Analysis**: Real-time voice volume and pitch tracking with consistency metrics
- **AI-Powered Feedback**: Integration with Google Gemini AI for personalized coaching recommendations

### User Experience
- **Live Dashboard**: Real-time metrics and progress tracking
- **Session Recording**: Complete practice session management with detailed analytics
- **Progress Tracking**: Historical performance trends and improvement metrics
- **Leaderboard**: Competitive ranking system for motivation
- **Responsive Design**: Modern UI built with React and Tailwind CSS

### Technical Features
- **WebSocket Integration**: Real-time communication for live analysis
- **Database Storage**: SQLite with SQLAlchemy for session and user data persistence
- **Authentication System**: Secure user registration and login
- **RESTful API**: Comprehensive backend API for all operations
- **Cross-Platform**: Works on desktop and mobile browsers

## 🛠️ Technology Stack

### Backend
- **Python Flask**: Web framework with REST API
- **Flask-SocketIO**: Real-time WebSocket communication
- **SQLAlchemy**: Database ORM
- **OpenCV + MediaPipe**: Computer vision for eye tracking
- **Whisper AI**: Speech-to-text processing
- **Librosa**: Audio analysis
- **Google Gemini AI**: AI-powered feedback generation

### Frontend
- **React 18**: Modern JavaScript framework
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Modern UI components
- **Socket.io-client**: Real-time frontend communication
- **Chart.js**: Data visualization

### Development Tools
- **Docker**: Containerization (optional)
- **ESLint**: Code linting
- **Prettier**: Code formatting

## 📋 Prerequisites

- **Python 3.8+**
- **Node.js 18+** and **npm**
- **Git**
- **Google Gemini API Key** (for AI features)

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/dharunmuthusamy/speak
cd speak
```

### 2. Backend Setup

#### Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Environment Configuration
Create a `.env` file in the backend directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
FLASK_ENV=development
SECRET_KEY=your_secret_key_here
```

#### Initialize Database
```bash
python init_db.py
```

#### Start Backend Server
```bash
python app.py
```
The backend will run on `http://localhost:5000`

### 3. Frontend Setup

#### Install Dependencies
```bash
cd frontend
npm install
```

#### Start Development Server
```bash
npm run dev
```
The frontend will run on `http://localhost:8080`

### 4. Speak-Tagger Setup (Optional)
```bash
cd speak-tagger
npm install
npm run build
```

## 🎯 Usage

### Starting a Practice Session
1. Open the application in your browser
2. Register/Login to your account
3. Navigate to the Practice page
4. Click "Start Session" and allow camera/microphone access
5. Speak naturally while looking at the camera
6. View real-time analysis and feedback

### Viewing Analytics
- **Dashboard**: Overview of your progress and recent sessions
- **Session Records**: Detailed analysis of past practice sessions
- **Progress Metrics**: Long-term improvement tracking
- **Leaderboard**: Compare your performance with others

## 📚 API Documentation

### Authentication Endpoints
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update user profile

### Session Management
- `GET /sessions` - List all sessions
- `POST /sessions` - Create new session
- `GET /sessions/<session_id>` - Get session details
- `PUT /sessions/<session_id>` - Update session
- `DELETE /sessions/<session_id>` - Delete session

### Analysis Endpoints
- `POST /analyze` - Analyze session data
- `GET /eye-tracking/data/<session_id>` - Get eye tracking data
- `POST /speech-analysis/upload/<session_id>` - Upload audio for analysis
- `GET /ai/recommendations` - Get AI recommendations

### Real-time Features (WebSocket)
- `start_session` - Initialize practice session
- `process_frame` - Real-time eye tracking analysis
- `upload_audio` - Speech analysis processing
- `analyze_session` - Complete session analysis

## 🏗️ Project Structure

```
speak/
├── backend/                 # Flask backend application
│   ├── app.py              # Main Flask application
│   ├── models.py           # Database models
│   ├── database_manager.py # Database operations
│   ├── sockets.py          # WebSocket handlers
│   ├── advanced_eye_tracker.py # Eye tracking logic
│   ├── speech_analyzer.py  # Speech analysis
│   ├── requirements.txt    # Python dependencies
│   └── init_db.py         # Database initialization
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── hooks/         # Custom React hooks
│   │   └── types/         # TypeScript definitions
│   ├── package.json       # Node dependencies
│   └── vite.config.ts     # Vite configuration
├── speak-tagger/          # Component tagging utility
└── README.md             # This file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow PEP 8 for Python code
- Use TypeScript for all frontend code
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 🙏 Acknowledgments

- **MediaPipe** for computer vision capabilities
- **OpenAI Whisper** for speech recognition
- **Google Gemini AI** for intelligent feedback
- **shadcn/ui** for beautiful UI components

## 📞 Support

For support, please open an issue on GitHub or contact the development team.

---

**Happy Speaking! 🎤**
