import React, { useState } from 'react';
import MainPage from '@/components/practice/MainPage';
import RecordsPage from '@/components/practice/RecordsPage';
import { PracticeSessionProvider } from '@/contexts/PracticeSessionContext';

const Practice: React.FC = () => {
  const [currentView, setCurrentView] = useState<'main' | 'records'>('main');

  const handleViewRecords = () => {
    setCurrentView('records');
  };

  const handleBackToMain = () => {
    setCurrentView('main');
  };

  return (
    <PracticeSessionProvider>
      {currentView === 'main' && <MainPage onViewRecords={handleViewRecords} />}
      {currentView === 'records' && <RecordsPage onBack={handleBackToMain} />}
    </PracticeSessionProvider>
  );
};

export default Practice;
