import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Eye, Calendar } from 'lucide-react';
import { sessionsAPI } from '@/services/api';
import SessionUtils from '@/utils/sessionUtils';
import { useSession } from '@/contexts/SessionContext';

const SessionRecords: React.FC = () => {
  const navigate = useNavigate();
  const { sessions, deleteSession: deleteSessionFromContext, updateSessions } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchSessionsFromBackend = async () => {
      try {
        const response = await sessionsAPI.getSessions();
        // Transform backend data to match context interface
        const transformedSessions = response.data.sessions.map((session: any) => ({
          id: session.id,
          timestamp: session.start_time || new Date().toISOString(),
          start_time: session.start_time,
          analysis: session.analysis || {},
          total_points: session.analysis?.overall_engagement || 0,
          eye_contact: session.analysis?.core_metrics?.eye_contact_score || 0,
          duration: session.duration || 0,
          ai_feedback: session.ai_feedback || {}
        }));

        // Update context with backend sessions
        updateSessions(transformedSessions);
      } catch (error) {
        console.error('Failed to fetch sessions from backend:', error);
        setError('Failed to load sessions from server');
      } finally {
        setLoading(false);
      }
    };

    fetchSessionsFromBackend();
  }, []);

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      await deleteSessionFromContext(sessionId);
    } catch (err: any) {
      setError('Failed to delete session: ' + err.message);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading sessions...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="text-center flex-1">
          <h1 className="text-3xl font-bold mb-2">Session Records</h1>
          <p className="text-muted-foreground">
            View and analyze your past practice sessions
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          Home
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Past Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No sessions recorded yet. Start practicing to see your progress!
            </p>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/session-details/${session.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">Session {SessionUtils.getDisplayName(session.id)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {session.timestamp ? formatDate(session.timestamp) : 'Unknown'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/session-details/${session.id}`);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Eye Contact:</span>
                      <span className={`ml-2 font-semibold ${getPerformanceColor(session.eye_contact || 0)}`}>
                        {session.eye_contact || 0}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="ml-2 font-semibold">{session.duration || 0}s</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SessionRecords;
