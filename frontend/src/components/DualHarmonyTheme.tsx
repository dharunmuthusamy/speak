import React, { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

// Enhanced Dual Harmony Theme — smoother gradients, subtle animations, improved contrast

const palette = {
  mauve: '#caa8f5',
  indigo: '#6e50c1',
  tekhelet: '#592e83',
  dark_purple: '#230c33',
  light_background: '#f7f1ff'
};

export default function DualHarmonyTheme({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(true);

  const theme = {
    bg: darkMode ? 'linear-gradient(180deg, #6e50c1, #230c33)' : 'linear-gradient(180deg, #f7f1ff, #caa8f5)',
    text: darkMode ? '#caa8f5' : '#230c33',
    headerBg: darkMode ? 'rgba(202, 168, 245, 0.9)' : 'rgba(89, 46, 131, 0.95)',
    headerText: darkMode ? '#230c33' : 'white',
    boxBg: darkMode ? 'rgba(155, 114, 207, 0.9)' : 'rgba(243, 230, 255, 0.95)',
    boxText: darkMode ? '#f8f5fc' : '#230c33',
    boxBorder: darkMode ? '#2f184b' : '#caa8f5',
    buttonBg: darkMode ? '#2f184b' : '#592e83',
    buttonText: darkMode ? '#f4effa' : 'white',
    footerBg: 'linear-gradient(90deg, #592e83, #caa8f5)',
    footerText: 'white',
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dual-harmony');
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Set CSS variables dynamically
    root.style.setProperty('--buttonBg', theme.buttonBg);
    root.style.setProperty('--buttonText', theme.buttonText);
    root.style.setProperty('--boxBg', theme.boxBg);
    root.style.setProperty('--boxText', theme.boxText);
    root.style.setProperty('--boxBorder', theme.boxBorder);
    root.style.setProperty('--headerBg', theme.headerBg);
    root.style.setProperty('--headerText', theme.headerText);
    root.style.setProperty('--footerBg', theme.footerBg);
    root.style.setProperty('--footerText', theme.footerText);
  }, [darkMode, theme]);

  return (
    <div className="min-h-screen font-sans transition-all duration-700 flex flex-col" style={{ background: theme.bg, color: theme.text, fontFamily: "'Inter', 'Poppins', 'Nunito', sans-serif" }}>
      {/* Theme Toggle Button - Positioned in top-right */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="dual-harmony-button px-3 py-3 rounded-full font-semibold flex items-center justify-center"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
      {children}
    </div>
  );
}
