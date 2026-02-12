import React from 'react';
import {View, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';
import {Text} from '@reown/appkit-ui-react-native';
import {useTheme} from '@/hooks/useTheme';
import type {LogLevel} from '@/utils/AppLogger';

export interface LogFilterProps {
  selectedLevels: Set<LogLevel>;
  onToggleLevel: (level: LogLevel) => void;
}

const LOG_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'log', 'debug'];

export function LogFilter({selectedLevels, onToggleLevel}: LogFilterProps) {
  const Theme = useTheme();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {LOG_LEVELS.map(level => {
          const isSelected = selectedLevels.has(level);
          const backgroundColor = isSelected
            ? Theme['accent-glass-020']
            : Theme['bg-200'];

          return (
            <TouchableOpacity
              key={level}
              style={[styles.chip, {backgroundColor}]}
              onPress={() => onToggleLevel(level)}>
              <Text variant="small-600" style={styles.chipText}>
                {level.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  scrollContent: {
    paddingHorizontal: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  chipText: {
    textAlign: 'center',
  },
});
