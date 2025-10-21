import axios, { AxiosInstance, AxiosResponse } from 'axios';

// API Base URL - adjust for your backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData: { email: string; password: string; name: string }) =>
    api.post('/auth/register', userData),

  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),

  getProfile: () => api.get('/auth/profile'),

  updateProfile: (userData: { name?: string; email?: string }) =>
    api.put('/auth/profile', userData),
};

// Sessions API
export const sessionsAPI = {
  getSessions: () => api.get('/sessions'),

  createSession: (sessionData: { title?: string; session_type?: string; session_id?: string }) =>
    api.post('/sessions', sessionData),

  getSession: (sessionId: number) => api.get(`/sessions/${sessionId}`),

  updateSession: (sessionId: number, sessionData: any) =>
    api.put(`/sessions/${sessionId}`, sessionData),

  deleteSession: (sessionId: number) => api.delete(`/sessions/${sessionId}`),
};

// Eye Tracking API
export const eyeTrackingAPI = {
  storeData: (data: {
    session_id: number;
    eye_contact_score?: number;
    focus_consistency?: number;
    blink_rate?: number;
    total_eye_contact_time?: number;
    gaze_points?: any;
    engagement_level?: string;
    gaze_stability?: number;
  }) => api.post('/eye-tracking/data', data),

  getData: (sessionId: number) => api.get(`/eye-tracking/data/${sessionId}`),

  updateData: (dataId: number, data: any) =>
    api.put(`/eye-tracking/data/${dataId}`, data),

  deleteData: (dataId: number) => api.delete(`/eye-tracking/data/${dataId}`),
};

// Speech Analysis API
export const speechAnalysisAPI = {
  storeData: (data: {
    session_id: number;
    accuracy_score?: number;
    wpm?: number;
    grammar_errors?: number;
    spelling_errors?: number;
    filler_words?: number;
    transcription?: string;
    average_volume?: number;
    volume_variance?: number;
    average_pitch?: number;
    pitch_range?: number;
    voice_duration?: number;
  }) => api.post('/speech-analysis/data', data),

  uploadAudio: (sessionId: number, audioFile: File) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    return api.post(`/speech-analysis/upload/${sessionId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getData: (sessionId: number) => api.get(`/speech-analysis/data/${sessionId}`),

  updateData: (dataId: number, data: any) =>
    api.put(`/speech-analysis/data/${dataId}`, data),

  deleteData: (dataId: number) => api.delete(`/speech-analysis/data/${dataId}`),
};

// Progress API
export const progressAPI = {
  getMetrics: (days?: number) => api.get('/progress/metrics', { params: { days } }),

  getTrends: () => api.get('/progress/trends'),
};

// AI Recommendations API
export const aiAPI = {
  getRecommendations: (status?: string, limit?: number) =>
    api.get('/ai/recommendations', { params: { status, limit } }),

  createRecommendation: (data: {
    type: string;
    title: string;
    description: string;
    priority?: string;
    session_id?: number;
  }) => api.post('/ai/recommendations', data),

  updateRecommendation: (recId: number, data: { status?: string; priority?: string }) =>
    api.put(`/ai/recommendations/${recId}`, data),

  deleteRecommendation: (recId: number) =>
    api.delete(`/ai/recommendations/${recId}`),

  generateRecommendations: (sessionId: number) =>
    api.post(`/ai/generate/${sessionId}`),
};

// Leaderboard API
export const leaderboardAPI = {
  getLeaderboard: (period?: string, limit?: number) =>
    api.get('/leaderboard', { params: { period, limit } }),

  getTeamLeaderboard: () => api.get('/leaderboard/teams'),
};

export default api;
