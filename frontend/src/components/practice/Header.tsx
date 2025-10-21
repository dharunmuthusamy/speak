import React from 'react';
import { Eye, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Header: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="text-center mb-6">
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Home
        </Button>
        <div className="flex items-center gap-2">
          <Eye className="w-8 h-8 text-blue-500" />
          <h1 className="text-3xl font-bold">SPEAK</h1>
        </div>
        <div className="w-16"></div> {/* Spacer for centering */}
      </div>
      <p className="text-muted-foreground">
        Professional speech analysis with AI-powered feedback
      </p>
    </div>
  );
};

export default Header;
