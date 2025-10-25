import { useEffect, useState, useCallback } from 'react';
import { websocketService } from '@/services/websocket';

interface DashboardMetrics {
  eye_contact: number;
  speech_accuracy: number;
  wpm: number;
  average_score: number;
  recommendations: any[];
  timestamp: string;
}

interface DashboardUpdateData {
  user_id: string;
  metrics: {
    eye_contact: number;
    speech_accuracy: number;
    wpm: number;
    average_score: number;
  };
  recommendations: any[];
  timestamp: string;
}

export const useDashboardSocket = (userId?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<DashboardMetrics | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Handle dashboard updates from WebSocket
  const handleDashboardUpdate = useCallback((data: DashboardUpdateData) => {
    console.log('📡 Received dashboard update:', data);

    // Only update if this update is for the current user
    if (userId && data.user_id !== userId) {
      console.log(`📡 Ignoring dashboard update for user ${data.user_id} (current user: ${userId})`);
      return;
    }

    const metrics: DashboardMetrics = {
      eye_contact: data.metrics.eye_contact,
      speech_accuracy: data.metrics.speech_accuracy,
      wpm: data.metrics.wpm,
      average_score: data.metrics.average_score,
      recommendations: data.recommendations || [],
      timestamp: data.timestamp
    };

    setLastUpdate(metrics);
    console.log('✅ Dashboard updated with real-time data for user:', userId);
  }, [userId]);

  // Connect to WebSocket and set up listeners
  const connect = useCallback(async () => {
    try {
      setConnectionError(null);

      // Connect to WebSocket
      await websocketService.connect('http://localhost:5000');

      // Set up dashboard update listener
      websocketService.on('dashboard_update', handleDashboardUpdate);

      setIsConnected(true);
      console.log('🔌 Dashboard WebSocket connected');

    } catch (error) {
      console.error('❌ Dashboard WebSocket connection failed:', error);
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      setIsConnected(false);
    }
  }, [handleDashboardUpdate]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    websocketService.off('dashboard_update', handleDashboardUpdate);
    websocketService.disconnect();
    setIsConnected(false);
    setLastUpdate(null);
    console.log('🔌 Dashboard WebSocket disconnected');
  }, [handleDashboardUpdate]);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle reconnection on connection loss
  useEffect(() => {
    if (!isConnected && !connectionError) {
      const reconnectTimer = setTimeout(() => {
        console.log('🔄 Attempting to reconnect dashboard WebSocket...');
        connect();
      }, 5000);

      return () => clearTimeout(reconnectTimer);
    }
  }, [isConnected, connectionError, connect]);

  return {
    isConnected,
    lastUpdate,
    connectionError,
    connect,
    disconnect
  };
};

export default useDashboardSocket;
