import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { progressAPI, sessionsAPI, aiAPI, leaderboardAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { LogOut, User as UserIcon, Video, TrendingUp, Award, Users, Eye, Gauge, Volume2, Zap, Star, BarChart3, Wifi, WifiOff } from "lucide-react";
import { useDashboardSocket } from "@/hooks/useDashboardSocket";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, isLoading } = useAuth();
  const { isConnected, lastUpdate } = useDashboardSocket(user?.id?.toString());
  const [dashboardData, setDashboardData] = useState({
    metrics: null,
    sessions: [],
    recommendations: [],
    leaderboard: []
  });
  const [loadingData, setLoadingData] = useState(true);
  const [animatedMetrics, setAnimatedMetrics] = useState({
    sessionsCompleted: 0,
    averageScore: 0,
    eyeContact: 0,
    speechAccuracy: 0,
    wpm: 0
  });

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    } else if (!isLoading && user) {
      // User is logged in, stay on dashboard
    }
  }, [user, isLoading, navigate]);

  // Animate metrics when they change
  useEffect(() => {
    if (dashboardData.metrics) {
      const targetMetrics = {
        sessionsCompleted: dashboardData.metrics.sessions_completed || 0,
        averageScore: dashboardData.metrics.average_score || 0,
        eyeContact: dashboardData.metrics.average_eye_contact || 0,
        speechAccuracy: dashboardData.metrics.average_speech_accuracy || 0,
        wpm: dashboardData.metrics.average_wpm || 0
      };

      // Animate from current to target values
      const duration = 1000; // 1 second animation
      const steps = 60;
      const stepDuration = duration / steps;

      let step = 0;
      const animate = () => {
        step++;
        const progress = step / steps;

        setAnimatedMetrics(prev => ({
          sessionsCompleted: prev.sessionsCompleted + (targetMetrics.sessionsCompleted - prev.sessionsCompleted) * progress,
          averageScore: prev.averageScore + (targetMetrics.averageScore - prev.averageScore) * progress,
          eyeContact: prev.eyeContact + (targetMetrics.eyeContact - prev.eyeContact) * progress,
          speechAccuracy: prev.speechAccuracy + (targetMetrics.speechAccuracy - prev.speechAccuracy) * progress,
          wpm: prev.wpm + (targetMetrics.wpm - prev.wpm) * progress
        }));

        if (step < steps) {
          setTimeout(animate, stepDuration);
        }
      };

      animate();
    }
  }, [dashboardData.metrics]);

  // Update dashboard data when real-time update is received
  useEffect(() => {
    if (lastUpdate) {
      setDashboardData(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          average_eye_contact: lastUpdate.eye_contact,
          average_speech_accuracy: lastUpdate.speech_accuracy,
          average_wpm: lastUpdate.wpm,
          average_score: lastUpdate.average_score
        },
        recommendations: lastUpdate.recommendations || prev.recommendations
      }));

      toast.success("Dashboard updated with latest session data!");
    }
  }, [lastUpdate]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        const [metricsRes, sessionsRes, recsRes, leaderboardRes] = await Promise.all([
          progressAPI.getMetrics(),
          sessionsAPI.getSessions(),
          aiAPI.getRecommendations(),
          leaderboardAPI.getLeaderboard()
        ]);

        setDashboardData({
          metrics: metricsRes.data.metrics,
          sessions: Array.isArray(sessionsRes.data.sessions) ? sessionsRes.data.sessions : [],
          recommendations: Array.isArray(recsRes.data.recommendations) ? recsRes.data.recommendations : [],
          leaderboard: Array.isArray(leaderboardRes.data.leaderboard) ? leaderboardRes.data.leaderboard : []
        });
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoadingData(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  if (isLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-[var(--shadow-glow)]">
              <span className="text-lg font-bold text-primary-foreground">S</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                S.P.E.A.K.
              </h1>
              <p className="text-xs text-muted-foreground">Speech Performance Evaluation & Analysis Kit</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>Home</Button>
            <Button variant="ghost" size="sm" className="bg-primary/10">Dashboard</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/practice')}>Practice</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/session-records')}>Session Records</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome & Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="md:col-span-2 shadow-[var(--shadow-elegant)] border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl">
                Welcome back, {user?.name || "User"}!
              </CardTitle>
              <CardDescription className="text-base">
                Ready to improve your speaking skills? Start a practice session below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-5xl font-bold text-primary">
                      {Math.round(animatedMetrics.sessionsCompleted)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Sessions Completed</p>
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Average Score</span>
                    <span className="font-bold">{Math.round(animatedMetrics.averageScore)}%</span>
                    </div>
                    <Progress value={Math.round(animatedMetrics.averageScore)} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>This Week</span>
                      <span className="font-bold">
                        {(dashboardData.sessions?.filter(s => new Date(s.start_time) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))?.length || 0)} sessions
                      </span>
                    </div>
                    <Progress value={Math.min((dashboardData.sessions?.filter(s => new Date(s.start_time) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))?.length || 0) * 10, 100)} className="h-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-elegant)]">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Progress Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Week</span>
                  <span className="text-2xl font-bold">
                    {Math.round((animatedMetrics.eyeContact) - 7)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">This Week</span>
                  <span className="text-2xl font-bold text-primary">
                    {Math.round(animatedMetrics.eyeContact )}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-500">+7 points improvement</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Results & AI Feedback */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-[var(--shadow-elegant)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Recent Results
              </CardTitle>
              <CardDescription>Your last session analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Eye Contact</span>
                  </div>
                  <span className="text-lg font-bold text-primary">
                    {Math.round(animatedMetrics.eyeContact)}%
                  </span>
                </div>
                <Progress value={Math.round(animatedMetrics.eyeContact)} className="h-3" />
                <p className="text-xs text-muted-foreground mt-1">Grade: A-</p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium">Speech Accuracy</span>
                  </div>
                  <span className="text-lg font-bold text-accent">
                    {Math.round(animatedMetrics.speechAccuracy)}%
                  </span>
                </div>
                <Progress value={Math.round(animatedMetrics.speechAccuracy)} className="h-3" />
                <p className="text-xs text-muted-foreground mt-1">Grade: B+</p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">WPM</span>
                  </div>
                  <span className="text-lg font-bold text-primary">
                    {Math.round(animatedMetrics.wpm)}
                  </span>
                </div>
                <Progress value={Math.min(Math.round(animatedMetrics.wpm), 100)} className="h-3" />
                <p className="text-xs text-muted-foreground mt-1">Grade: B</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-elegant)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                AI Coach Recommendations
              </CardTitle>
              <CardDescription>Personalized feedback to improve</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {dashboardData.recommendations?.length > 0 ? dashboardData.recommendations.map((rec, index) => (
                  <li key={index} className="flex gap-3 items-start">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      rec.priority === 'high' ? 'bg-red-100' : rec.priority === 'medium' ? 'bg-yellow-100' : 'bg-green-100'
                    }`}>
                      <Zap className={`h-3 w-3 ${
                        rec.priority === 'high' ? 'text-red-600' : rec.priority === 'medium' ? 'text-yellow-600' : 'text-green-600'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                    </div>
                  </li>
                )) : (
                  <li className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap className="h-3 w-3 text-primary" />
                    </div>
                    <p className="text-sm">No recommendations available yet. Complete more sessions for personalized feedback!</p>
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Gamification & Social */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="shadow-[var(--shadow-elegant)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                My Achievements
              </CardTitle>
              <CardDescription>You haven't earned any of these badges</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/20">
                  <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center">
                    <Gauge className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground text-center">Pacing Pro</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/20">
                  <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center">
                    <Eye className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground text-center">Eye Contact Champion</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/20">
                  <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center">
                    <Volume2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground text-center">Clarity Master</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/20">
                  <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center">
                    <Zap className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground text-center">10 Day Streak</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/20">
                  <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center">
                    <Star className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground text-center">Perfect Score</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/20">
                  <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground text-center">Rising Star</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-elegant)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Leaderboard
              </CardTitle>
              <CardDescription>Top performers in your department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.leaderboard?.length > 0 ? dashboardData.leaderboard.map((entry) => (
                  <div
                    key={entry.rank}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      entry.name === user?.name ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={entry.rank === 1 ? "default" : "secondary"} className="w-6 h-6 rounded-full p-0 flex items-center justify-center">
                        {entry.rank}
                      </Badge>
                      <span className={`text-sm ${entry.name === user?.name ? 'font-bold' : 'font-medium'}`}>
                        {entry.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{entry.score || 0}</span>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                )) : (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">
                        1
                      </Badge>
                      <span className="text-sm font-medium">{user?.name || "You"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">0</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <Card className="shadow-[var(--shadow-elegant)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
              <CardDescription>Get started with your practice sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Button
                  onClick={() => navigate('/practice')}
                  className="h-24 flex flex-col gap-2 bg-gradient-to-r from-primary to-accent hover:shadow-[var(--shadow-glow)]"
                >
                  <Video className="h-8 w-8" />
                  <span className="font-semibold">Start Practice</span>
                </Button>
                <Button
                  onClick={() => navigate('/session-records')}
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                >
                  <BarChart3 className="h-8 w-8" />
                  <span className="font-semibold">View Records</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                >
                  <TrendingUp className="h-8 w-8" />
                  <span className="font-semibold">Progress Report</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
