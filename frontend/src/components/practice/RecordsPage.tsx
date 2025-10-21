import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SessionUtils from '@/utils/sessionUtils';
import { sessionsAPI } from '@/services/api';

interface SessionRecord {
  id: string;
  timestamp: number;
  duration: number;
  eye_contact_score: number;
  overall_engagement: number;
  // Add other fields as needed
}

interface RecordsPageProps {
  onBack: () => void;
}

const RecordsPage: React.FC<RecordsPageProps> = ({ onBack }) => {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      // Fetch records from backend API
      const response = await sessionsAPI.getSessions();
      const sessionsData = response.data.sessions;

      // Transform backend session data to match component interface
      const transformedRecords: SessionRecord[] = sessionsData.map((session: any) => ({
        id: session.id,
        timestamp: session.start_time ? new Date(session.start_time).getTime() : Date.now(),
        duration: session.total_points || 0, // Using total_points as duration for now
        eye_contact_score: session.eye_contact || 0,
        overall_engagement: session.analysis?.overall_engagement || 0
      }));

      setRecords(transformedRecords);
    } catch (error) {
      console.error('Failed to fetch records:', error);
      // Fallback to empty array on error
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const clearAllRecords = async () => {
    if (!confirm('Are you sure you want to clear all session records? This action cannot be undone.')) {
      return;
    }

    try {
      // Clear all sessions from backend
      for (const record of records) {
        await sessionsAPI.deleteSession(record.id);
      }
      setRecords([]);
    } catch (error) {
      console.error('Failed to clear records:', error);
      // Refresh records to show current state
      fetchRecords();
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return <div className="text-center">Loading records...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Session Records</h1>
        </div>
        <Button onClick={clearAllRecords} variant="destructive" size="sm">
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All
        </Button>
      </div>

      <div id="recordsList" className="space-y-4">
        {records.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">No session records found.</p>
            </CardContent>
          </Card>
        ) : (
          records.map((record) => (
            <Card key={record.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/session-details/${record.id}`)}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Session {SessionUtils.getDisplayName(record.id)}</h3>
                      <Badge variant="outline">{formatDate(record.timestamp)}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="ml-2 font-medium">{record.duration}s</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Eye Contact:</span>
                        <span className="ml-2 font-medium">{record.eye_contact_score}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Engagement:</span>
                        <span className="ml-2 font-medium">{record.overall_engagement}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Score:</span>
                        <Badge variant={record.overall_engagement > 80 ? 'default' : 'secondary'}>
                          {record.overall_engagement > 80 ? 'Excellent' : 'Good'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default RecordsPage;
