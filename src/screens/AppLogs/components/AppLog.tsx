import React from 'react';
import {View, StyleSheet, TouchableOpacity} from 'react-native';
import Toast from 'react-native-toast-message';
import {useTheme} from '@/hooks/useTheme';
import {Text} from '@reown/appkit-ui-react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import type {AppLogEntry, LogLevel} from '@/utils/AppLogger';

export interface AppLogProps {
  value: string;
}

/**
 * Get background color for log level
 */
const getLogBackgroundColor = (level: LogLevel, Theme: any): string => {
  switch (level) {
    case 'log':
      return Theme['bg-250'];
    case 'info':
      return Theme['accent-glass-015'];
    case 'warn':
      return 'rgba(255, 165, 0, 0.15)';
    case 'error':
      // Check if in light mode
      return Theme['bg-100'] === '#ffffff'
        ? 'rgba(240, 81, 66, 0.15)'
        : 'rgba(242, 90, 103, 0.2)';
    case 'debug':
      return Theme['bg-275'];
    default:
      return Theme['bg-300'];
  }
};

export function AppLog({value}: AppLogProps) {
  const Theme = useTheme();
  const log: AppLogEntry = JSON.parse(value);

  const backgroundColor = getLogBackgroundColor(log.level, Theme);

  const copyToClipboard = () => {
    Clipboard.setString(value);
    Toast.show({
      type: 'success',
      text1: 'Log copied to clipboard',
    });
  };

  const formatTime = (time: string) => {
    return new Date(time).toLocaleString();
  };

  return (
    <TouchableOpacity
      key={log.time}
      onPress={copyToClipboard}
      style={[styles.container, {backgroundColor}]}>
      <View style={styles.row}>
        <Text variant="small-600">[{log.level.toUpperCase()}]</Text>
      </View>
      <View style={styles.row}>
        <Text variant="small-600">
          time: <Text variant="small-400">{formatTime(log.time)}</Text>
        </Text>
      </View>
      <View style={styles.row}>
        <Text variant="small-600">
          context: <Text variant="small-400">{log.context}</Text>
        </Text>
      </View>
      <View style={styles.row}>
        <Text variant="small-600">
          message: <Text variant="small-400">{log.message}</Text>
        </Text>
      </View>
      {log.args && log.args.length > 0 && (
        <View style={styles.row}>
          <Text variant="small-600">
            args: <Text variant="small-400">{JSON.stringify(log.args)}</Text>
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    marginVertical: 2,
    marginHorizontal: 16,
    padding: 16,
  },
  row: {
    marginVertical: 2,
  },
});
