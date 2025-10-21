import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sliders, List } from 'lucide-react';

interface SessionControlsProps {
  onCalibrate: () => void;
  onViewRecords: () => void;
}

const SessionControls: React.FC<SessionControlsProps> = ({ onCalibrate, onViewRecords }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 justify-center">
          <Button onClick={onCalibrate} variant="outline" size="lg" className="flex items-center gap-2">
            <Sliders className="w-5 h-5" />
            Calibrate
          </Button>
          <Button onClick={onViewRecords} variant="outline" size="lg" className="flex items-center gap-2">
            <List className="w-5 h-5" />
            View Records
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SessionControls;
