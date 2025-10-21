import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Target, BookOpen, Trophy, Lightbulb, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AIFeedbackProps {
  aiFeedback: any;
  isLoading?: boolean;
  error?: string;
}

const AIFeedback: React.FC<AIFeedbackProps> = ({ aiFeedback, isLoading, error }) => {
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            AI Feedback Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 animate-pulse" />
            AI Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            </div>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            </div>
            <div className="animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-4/5 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!aiFeedback) return null;

  const getRatingVariant = (rating: string) => {
    switch (rating?.toLowerCase()) {
      case 'excellent':
        return 'default';
      case 'good':
        return 'secondary';
      case 'fair':
        return 'outline';
      case 'poor':
      case 'needs improvement':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          AI Feedback
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Overall Assessment */}
          <div>
            <h3 className="font-semibold mb-2">Overall Assessment</h3>
            <p className="text-sm text-gray-700">{aiFeedback.overall_assessment}</p>
          </div>

          {/* Performance Rating */}
          <div>
            <h3 className="font-semibold mb-2">Performance Rating</h3>
            <Badge variant={getRatingVariant(aiFeedback.performance_rating)}>
              {aiFeedback.performance_rating}
            </Badge>
          </div>

          {/* Key Strengths */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-green-600" />
              Key Strengths
            </h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {aiFeedback.key_strengths?.map((strength: string, index: number) => (
                <li key={index} className="text-green-700">{strength}</li>
              ))}
            </ul>
          </div>

          {/* Areas for Improvement */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-orange-600" />
              Areas for Improvement
            </h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {aiFeedback.areas_for_improvement?.map((area: string, index: number) => (
                <li key={index} className="text-orange-700">{area}</li>
              ))}
            </ul>
          </div>

          {/* Personalized Feedback */}
          <div>
            <h3 className="font-semibold mb-2">Personalized Feedback</h3>
            <p className="text-sm text-gray-700">{aiFeedback.personalized_feedback}</p>
          </div>

          {/* Actionable Strategies */}
          {aiFeedback.actionable_strategies && aiFeedback.actionable_strategies.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-blue-600" />
                Actionable Strategies
              </h3>
              <div className="space-y-3">
                {aiFeedback.actionable_strategies.map((strategy: any, index: number) => (
                  <div key={index} className="border-l-4 border-blue-200 pl-4 bg-blue-50 p-3 rounded">
                    <h4 className="font-medium text-blue-900 mb-1">{strategy.strategy}</h4>
                    <p className="text-sm text-blue-700 mb-1">{strategy.description}</p>
                    <p className="text-xs text-blue-600 font-medium">Benefit: {strategy.benefit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Practice Exercises */}
          {aiFeedback.practice_exercises && aiFeedback.practice_exercises.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-600" />
                Practice Exercises
              </h3>
              <div className="space-y-3">
                {aiFeedback.practice_exercises.map((exercise: any, index: number) => (
                  <div key={index} className="border-l-4 border-purple-200 pl-4 bg-purple-50 p-3 rounded">
                    <h4 className="font-medium text-purple-900 mb-1">{exercise.exercise}</h4>
                    <p className="text-sm text-purple-700 mb-1">{exercise.instructions}</p>
                    <p className="text-xs text-purple-600 font-medium">Duration: {exercise.duration}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence Boosters */}
          {aiFeedback.confidence_boosters && aiFeedback.confidence_boosters.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-600" />
                Confidence Boosters
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {aiFeedback.confidence_boosters.map((booster: string, index: number) => (
                  <li key={index} className="text-yellow-700">{booster}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Session Goals */}
          {aiFeedback.next_session_goals && aiFeedback.next_session_goals.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                Next Session Goals
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {aiFeedback.next_session_goals.map((goal: string, index: number) => (
                  <li key={index} className="text-indigo-700">{goal}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AIFeedback;
