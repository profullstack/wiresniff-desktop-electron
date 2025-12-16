import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

/**
 * ThemeProvider Component
 * Manages application theme state and syncs with system preferences
 */
export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  // Get system theme preference
  const getSystemTheme = (): 'dark' | 'light' => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  };

  // Resolve the actual theme based on setting
  const resolveTheme = (themeSetting: Theme): 'dark' | 'light' => {
    if (themeSetting === 'system') {
      return getSystemTheme();
    }
    return themeSetting;
  };

  // Set theme and persist to storage
  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    setResolvedTheme(resolveTheme(newTheme));

    // Persist to local storage
    localStorage.setItem('wiresniff-theme', newTheme);

    // Sync with Electron if available
    if (window.electronAPI?.theme) {
      await window.electronAPI.theme.set(newTheme);
    }
  };

  // Initialize theme on mount
  useEffect(() => {
    const initTheme = async () => {
      // Try to get saved theme from localStorage
      const savedTheme = localStorage.getItem('wiresniff-theme') as Theme | null;

      if (savedTheme) {
        setThemeState(savedTheme);
        setResolvedTheme(resolveTheme(savedTheme));
      } else {
        // Default to system theme
        setResolvedTheme(resolveTheme('system'));
      }
    };

    initTheme();
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;

    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeProvider;