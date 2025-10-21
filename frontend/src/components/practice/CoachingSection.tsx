import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

interface CoachingSectionProps {
  coachingTip: string;
}

const CoachingSection: React.FC<CoachingSectionProps> = ({ coachingTip }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Coaching Tip
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p id="coachingTip" className="text-lg">{coachingTip || "Maintain eye contact with your audience."}</p>
      </CardContent>
    </Card>
  );
};

export default CoachingSection;
