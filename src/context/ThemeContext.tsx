import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

type ThemeColors = {
  background: string;
  textInputBackground: string;
  text: string;
  greenText: string;
  border: string;
  card: string;
};

type ThemeContextType = {
  isDarkMode: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
};

const lightColors: ThemeColors = {
  background: '#FFFFFF',
  textInputBackground: '#F5F5F5',
  text: '#000000',
  greenText: '#16A34A',
  border: '#E5E5E5',
  card: '#FFFFFF',
};

const darkColors: ThemeColors = {
  background: '#1A1A1A',
  textInputBackground: '#2D2D2D',
  text: '#FFFFFF',
  greenText: '#4ADE80',
  border: '#404040',
  card: '#2D2D2D',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

  useEffect(() => {
    // Update theme when system theme changes
    setIsDarkMode(systemColorScheme === 'dark');
  }, [systemColorScheme]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};