import { useEffect } from 'react';
import AppLogger from '@/utils/AppLogger';

/**
 * Hook to initialize the AppLogger
 * Should be called once in RootStackNavigator
 */
export function useAppLogger() {
  useEffect(() => {
    AppLogger.getInstance().init();
    console.log('[AppLogger] Application logger initialized');
  }, []);
}
