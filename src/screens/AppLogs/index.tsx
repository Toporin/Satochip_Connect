import React, {useMemo, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Text} from '@reown/appkit-ui-react-native';

import {AppLog} from './components/AppLog';
import {LogFilter} from './components/LogFilter';
import {useTheme} from '@/hooks/useTheme';
import {useSnapshot} from 'valtio';
import SettingsStore from '@/store/SettingsStore';
import type {AppLogEntry, LogLevel} from '@/utils/AppLogger';

export function AppLogs() {
  const Theme = useTheme();
  const {appLogs} = useSnapshot(SettingsStore.state);

  // Initialize with all levels selected
  const [selectedLevels, setSelectedLevels] = useState<Set<LogLevel>>(
    new Set(['log', 'info', 'warn', 'error', 'debug']),
  );

  const handleToggleLevel = (level: LogLevel) => {
    setSelectedLevels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  };

  // Filter logs based on selected levels
  const filteredLogs = useMemo(() => {
    return appLogs.filter(logStr => {
      try {
        const log: AppLogEntry = JSON.parse(logStr);
        return selectedLevels.has(log.level);
      } catch {
        return false;
      }
    });
  }, [appLogs, selectedLevels]);

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: Theme['bg-100']}]}>
      <LogFilter
        selectedLevels={selectedLevels}
        onToggleLevel={handleToggleLevel}
      />
      {filteredLogs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="paragraph-400">No logs to display</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({item}) => <AppLog value={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
