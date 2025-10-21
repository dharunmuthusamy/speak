import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';

interface SessionData {
  id: string;
  timestamp: string;
  start_time?: string;
  analysis?: any;
  total_points: number;
  eye_contact: number;
  duration?: number;
  ai_feedback?: any;
}

interface SessionContextType {
  // Session state
  sessions: SessionData[];
  currentSessionId: string | null;
  isSessionActive: boolean;
  sessionCounter: number;

  // Operations
  createSession: (sessionData: Partial<SessionData>) => Promise<string>;
  addExistingSession: (sessionData: SessionData) => void;
  updateSessionWithAIFeedback: (sessionId: string, aiFeedback: SessionData['ai_feedback']) => Promise<void>;
  getSession: (sessionId: string) => SessionData | null;
  getAllSessions: () => SessionData[];
  deleteSession: (sessionId: string) => Promise<void>;
  clearAllSessions: () => Promise<void>;
  startSession: () => Promise<string>;
  stopSession: () => Promise<void>;
  getCurrentSessionId: () => string | null;
  updateSessions: (sessions: SessionData[]) => void;

  // Error handling
  error: string | null;
  clearError: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const STORAGE_KEY = 'speak_sessions';
const SESSION_COUNTER_KEY = 'speak_session_counter';

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
};

export const useSessionOperations = () => {
  const {
    createSession,
    updateSessionWithAIFeedback,
    getSession,
    getAllSessions,
    deleteSession,
    clearAllSessions,
    startSession,
    stopSession,
    getCurrentSessionId
  } = useSession();

  return {
    createSession,
    updateSessionWithAIFeedback,
    getSession,
    getAllSessions,
    deleteSession,
    clearAllSessions,
    startSession,
    stopSession,
    getCurrentSessionId
  };
};

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionCounter, setSessionCounter] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    try {
      const storedSessions = localStorage.getItem(STORAGE_KEY);
      const storedCounter = localStorage.getItem(SESSION_COUNTER_KEY);

      if (storedSessions) {
        const parsedSessions = JSON.parse(storedSessions);
        setSessions(parsedSessions);
      }

      if (storedCounter) {
        setSessionCounter(parseInt(storedCounter, 10));
      }
    } catch (err) {
      console.error('Failed to load sessions from localStorage:', err);
      setError('Failed to load session data. Using default state.');
    }
  }, []);

  // Save sessions to localStorage with debouncing
  const saveSessions = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (sessionsToSave: SessionData[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionsToSave));
            localStorage.setItem(SESSION_COUNTER_KEY, sessionCounter.toString());
            setError(null);
          } catch (err) {
            if (err instanceof Error && err.name === 'QuotaExceededError') {
              setError('Local storage quota exceeded. Please clear some data.');
            } else {
              setError('Failed to save session data.');
            }
            console.error('Failed to save sessions to localStorage:', err);
          }
        }, 500);
      };
    })(),
    [sessionCounter]
  );

  // Update sessions and save to localStorage
  const updateSessions = useCallback((newSessions: SessionData[]) => {
    setSessions(newSessions);
    saveSessions(newSessions);
  }, [saveSessions]);

  // Memoized sorted sessions
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [sessions]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const createSession = useCallback(async (sessionData: Partial<SessionData>): Promise<string> => {
    try {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      const newSession: SessionData = {
        id: newSessionId,
        timestamp: new Date().toISOString(),
        analysis: sessionData.analysis || {},
        total_points: sessionData.total_points || 0,
        eye_contact: sessionData.eye_contact || 0,
        duration: sessionData.duration || 0,
        ai_feedback: sessionData.ai_feedback || {}
      };

      const updatedSessions = [...sessions, newSession];
      updateSessions(updatedSessions);

      return newSessionId;
    } catch (err) {
      const errorMessage = 'Failed to create session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [sessions, updateSessions]);

  const updateSessionWithAIFeedback = useCallback(async (
    sessionId: string,
    aiFeedback: SessionData['ai_feedback']
  ): Promise<void> => {
    try {
      const updatedSessions = sessions.map(session =>
        session.id === sessionId
          ? { ...session, ai_feedback: aiFeedback }
          : session
      );

      if (updatedSessions.length === sessions.length) {
        throw new Error('Session not found');
      }

      updateSessions(updatedSessions);
    } catch (err) {
      const errorMessage = 'Failed to update session with AI feedback';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [sessions, updateSessions]);

  const getSession = useCallback((sessionId: string): SessionData | null => {
    return sessions.find(session => session.id === sessionId) || null;
  }, [sessions]);

  const getAllSessions = useCallback((): SessionData[] => {
    return sortedSessions;
  }, [sortedSessions]);

  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    try {
      const updatedSessions = sessions.filter(session => session.id !== sessionId);

      if (updatedSessions.length === sessions.length) {
        throw new Error('Session not found');
      }

      updateSessions(updatedSessions);

      // Clear current session if it was deleted
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setIsSessionActive(false);
      }
    } catch (err) {
      const errorMessage = 'Failed to delete session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [sessions, updateSessions, currentSessionId]);

  const clearAllSessions = useCallback(async (): Promise<void> => {
    try {
      updateSessions([]);
      setCurrentSessionId(null);
      setIsSessionActive(false);
      setSessionCounter(0);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SESSION_COUNTER_KEY);
    } catch (err) {
      const errorMessage = 'Failed to clear all sessions';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [updateSessions]);

  const startSession = useCallback(async (): Promise<string> => {
    try {
      if (isSessionActive) {
        throw new Error('A session is already active');
      }

      const newSessionId = await createSession({});
      setCurrentSessionId(newSessionId);
      setIsSessionActive(true);
      setSessionCounter(prev => prev + 1);

      return newSessionId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [isSessionActive, createSession]);

  const stopSession = useCallback(async (): Promise<void> => {
    try {
      if (!isSessionActive || !currentSessionId) {
        throw new Error('No active session to stop');
      }

      setIsSessionActive(false);
      setCurrentSessionId(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [isSessionActive, currentSessionId]);

  const getCurrentSessionId = useCallback((): string | null => {
    return currentSessionId;
  }, [currentSessionId]);

  const addExistingSession = useCallback((sessionData: SessionData) => {
    const updatedSessions = [...sessions];
    const existingIndex = updatedSessions.findIndex(s => s.id === sessionData.id);
    if (existingIndex >= 0) {
      updatedSessions[existingIndex] = sessionData;
    } else {
      updatedSessions.push(sessionData);
    }
    updateSessions(updatedSessions);
  }, [sessions, updateSessions]);

  const contextValue: SessionContextType = {
    sessions: sortedSessions,
    currentSessionId,
    isSessionActive,
    sessionCounter,
    createSession,
    addExistingSession,
    updateSessionWithAIFeedback,
    getSession,
    getAllSessions,
    deleteSession,
    clearAllSessions,
    startSession,
    stopSession,
    getCurrentSessionId,
    updateSessions,
    error,
    clearError
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};
