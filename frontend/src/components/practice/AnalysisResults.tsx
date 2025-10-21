import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface AnalysisResultsProps {
  analysis: any;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysis }) => {
  if (!analysis) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2">Core Metrics</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Eye Contact Score:</span>
                <span>{analysis.core_metrics?.eye_contact_score}%</span>
              </div>
              <div className="flex justify-between">
                <span>Focus Consistency:</span>
                <span>{analysis.core_metrics?.focus_consistency}%</span>
              </div>
              <div className="flex justify-between">
                <span>Blink Rate:</span>
                <span>{analysis.core_metrics?.blink_rate} blinks/sec</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Advanced Metrics</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Engagement Level:</span>
                <span>{analysis.advanced_metrics?.engagement_level}</span>
              </div>
              <div className="flex justify-between">
                <span>Gaze Stability:</span>
                <span>{analysis.advanced_metrics?.gaze_stability}</span>
              </div>
            </div>
          </div>

          {analysis.speech_metrics && (
            <div className="md:col-span-2">
              <h3 className="font-semibold mb-2">Speech Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{analysis.speech_metrics.accuracy_score}%</div>
                  <p className="text-xs text-muted-foreground">Accuracy</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{analysis.speech_metrics.wpm}</div>
                  <p className="text-xs text-muted-foreground">Words/Min</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{analysis.speech_metrics.grammar_errors}</div>
                  <p className="text-xs text-muted-foreground">Grammar Errors</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{analysis.speech_metrics.spelling_errors}</div>
                  <p className="text-xs text-muted-foreground">Spelling Errors</p>
                </div>
              </div>
            </div>
          )}

          {analysis.voice_metrics && (
            <div className="md:col-span-2">
              <h3 className="font-semibold mb-2">Voice Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{analysis.voice_metrics.average_volume?.toFixed(1)}</div>
                  <p className="text-xs text-muted-foreground">Avg Volume</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{analysis.voice_metrics.volume_variance?.toFixed(1)}</div>
                  <p className="text-xs text-muted-foreground">Volume Variance</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{analysis.voice_metrics.average_pitch?.toFixed(1)}</div>
                  <p className="text-xs text-muted-foreground">Avg Pitch</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{analysis.voice_metrics.pitch_range?.toFixed(1)}</div>
                  <p className="text-xs text-muted-foreground">Pitch Range</p>
                </div>
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <h3 className="font-semibold mb-2">Overall Engagement</h3>
            <div className="text-3xl font-bold text-center">{analysis.overall_engagement}%</div>
            <Progress value={analysis.overall_engagement} className="mt-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalysisResults;
