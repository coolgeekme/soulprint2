'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: true,
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark');
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('soulprint-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  // Apply theme to HTML element
  const applyTheme = (newTheme) => {
    const html = document.documentElement;
    html.classList.remove('light', 'dark');
    html.classList.add(newTheme);
    
    // Update body background for immediate visual change
    if (newTheme === 'light') {
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#0f172a';
    } else {
      document.body.style.backgroundColor = '#0a0a0a';
      document.body.style.color = '#ffffff';
    }
  };

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('soulprint-theme', newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  // Note: don't gate rendering on `mounted` here — the inline theme script in app/layout.js
  // already sets the correct html class/body colors before React hydrates, so blocking the
  // whole tree just produces a blank flash and inconsistent layout on first paint (the header
  // "sometimes" looking misaligned depending on how long hydration takes).

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      toggleTheme, 
      isDark: theme === 'dark' 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeProvider;
