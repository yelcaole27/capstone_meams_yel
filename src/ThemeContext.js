// ThemeContext.js - Theme management system
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Initialize theme from localStorage or default to 'dark'
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'dark';
  });

  // Apply theme class to document root whenever theme changes
  useEffect(() => {
    // Remove all theme classes first
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    
    // Add the current theme class
    document.documentElement.classList.add(`theme-${theme}`);
    
    // Save to localStorage
    localStorage.setItem('theme', theme);
    
    console.log(`Theme changed to: ${theme}`);
  }, [theme]);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  // Set specific theme
  const setLightTheme = () => setTheme('light');
  const setDarkTheme = () => setTheme('dark');

  // Helper function to get theme-aware colors for charts
  const getChartColors = () => {
    if (theme === 'light') {
      return {
        grid: '#e0e0e0',
        axis: '#666666',
        text: '#333333',
        tooltipBg: '#ffffff',
        tooltipBorder: '#cccccc',
        tooltipText: '#000000',
      };
    }
    return {
      grid: '#333333',
      axis: '#888888',
      text: '#ffffff',
      tooltipBg: '#333333',
      tooltipBorder: '#555555',
      tooltipText: '#ffffff',
    };
  };

  const value = {
    theme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    isLight: theme === 'light',
    isDark: theme === 'dark',
    getChartColors,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};