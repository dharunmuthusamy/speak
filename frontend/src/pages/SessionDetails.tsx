import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, TrendingUp } from 'lucide-react';
import AnalysisResults from '@/components/practice/AnalysisResults';
import Visualizations from '@/components/practice/Visualizations';
import SessionUtils from '@/utils/sessionUtils';

interface SessionDetails {
  id?: string;
  start_time?: string;
  is_active?: boolean;
  analysis?: any;
  ai_feedback?: any;
  // Add other fields as needed
}

const SessionDetails: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [sessionData, setSessionData] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (sessionId) {
      fetchSessionDetails(sessionId);
    }
  }, [sessionId]);

  const fetchSessionDetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/sessions/${id}`);
      if (!response.ok) {
        throw new Error(`Request failed with status code ${response.status}`);
      }
      const sessionData = await response.json();
      setSessionData(sessionData);
    } catch (err: any) {
      setError('Failed to load session details: ' + err.message);
      console.error('Error fetching session details:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading session details...</div>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">
          {error || 'Session not found'}
        </div>
        <div className="text-center mt-4">
          <Button onClick={() => navigate('/practice')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Practice
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate('/practice')} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Session Details</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            Home
          </Button>
          <Badge variant="outline" className="text-sm">
            Session {SessionUtils.getDisplayName(sessionData.id || sessionId || 'Unknown')}
          </Badge>
        </div>
      </div>

      {/* Session Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Session Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Date & Time</p>
                <p className="font-medium">{sessionData.start_time ? formatDate(new Date(sessionData.start_time).getTime()) : 'Unknown'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium">{sessionData.is_active ? 'Active' : 'Completed'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Overall Score</p>
                <p className="font-medium">{sessionData.analysis?.overall_engagement ? `${sessionData.analysis.overall_engagement}%` : 'N/A'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      <AnalysisResults analysis={sessionData.analysis} />

      {/* Visualizations */}
      <Visualizations analysis={sessionData.analysis} />
    </div>
  );
};

export default SessionDetails;
