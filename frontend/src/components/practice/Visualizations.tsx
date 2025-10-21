import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie, Line, Bar } from 'react-chartjs-2';
import { BarChart3, Mic, Eye } from 'lucide-react';
import { usePracticeSession } from '@/contexts/PracticeSessionContext';

ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, BarElement);

interface VisualizationsProps {
  analysis: any;
}

const Visualizations: React.FC<VisualizationsProps> = ({ analysis }) => {
  const { realTimeAnalysis, voiceMetrics } = usePracticeSession();

  // State for real-time data
  const [volumeHistory, setVolumeHistory] = useState<number[]>([]);
  const [pitchHistory, setPitchHistory] = useState<number[]>([]);
  const [timeLabels, setTimeLabels] = useState<string[]>([]);

  // Update real-time data from analysis results
  useEffect(() => {
    if (analysis?.voice_metrics) {
      const voiceData = analysis.voice_metrics;
      if (voiceData.volume_levels && voiceData.pitch_levels && voiceData.timestamps) {
        setVolumeHistory(voiceData.volume_levels.slice(-10));
        setPitchHistory(voiceData.pitch_levels.slice(-10));
        setTimeLabels(voiceData.timestamps.slice(-10).map((t: number) => new Date(t).toLocaleTimeString()));
      }
    }
  }, [analysis]);

  if (!analysis) return null;

  const eyeContactData = {
    labels: ['Eye Contact', 'No Eye Contact'],
    datasets: [{
      data: [analysis.core_metrics?.eye_contact_score || 0, 100 - (analysis.core_metrics?.eye_contact_score || 0)],
      backgroundColor: ['#3b82f6', '#e5e7eb'],
    }],
  };

  const gazePatternData = {
    labels: ['0s', '10s', '20s', '30s', '40s', '50s'],
    datasets: [{
      label: 'Eye Contact %',
      data: analysis.core_metrics?.eye_contact_score ? [analysis.core_metrics.eye_contact_score, analysis.core_metrics.eye_contact_score + 5, analysis.core_metrics.eye_contact_score - 2, analysis.core_metrics.eye_contact_score + 7, analysis.core_metrics.eye_contact_score - 3, analysis.core_metrics.eye_contact_score + 4] : [85, 90, 88, 92, 87, 91],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      tension: 0.4,
    }],
  };

  const volumeData = {
    labels: timeLabels.length > 0 ? timeLabels : ['0s', '10s', '20s', '30s', '40s', '50s'],
    datasets: [{
      label: 'Volume (dB)',
      data: volumeHistory.length > 0 ? volumeHistory : [65, 70, 68, 72, 69, 71],
      backgroundColor: '#8b5cf6',
    }],
  };

  const pitchData = {
    labels: timeLabels.length > 0 ? timeLabels : ['0s', '10s', '20s', '30s', '40s', '50s'],
    datasets: [{
      label: 'Pitch (Hz)',
      data: pitchHistory.length > 0 ? pitchHistory : [120, 125, 118, 130, 122, 128],
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      tension: 0.4,
    }],
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Visualizations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Eye Contact Distribution
            </h3>
            <Pie data={eyeContactData} />
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Eye Contact Over Time
            </h3>
            <Line data={gazePatternData} />
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Volume Waveform
            </h3>
            <Bar data={volumeData} />
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Voice Tone Changes
            </h3>
            <Line data={pitchData} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Visualizations;
