import { useTheme } from '@/hooks/useTheme.ts';
import { Text, TouchableOpacity, View } from 'react-native';
import styles from '@/screens/Settings/styles.ts';
import { hp, wp } from '@/constants/responsive.tsx';
import ErrorIcon from '@/assets/images/error.svg';
import React from 'react';

interface SatochipStatusModalProps {
  onClose: () => void;
  satochipSetupDone: boolean | null;
  satochipIsSeeded: boolean | null;
  satochipIsAuthentic: boolean | null;
  satochipStatusCode: string | null;
}

// Define the component outside, before the Settings component
export function SatochipStatusModal({
    onClose,
    satochipSetupDone,
    satochipIsSeeded,
    satochipIsAuthentic,
    satochipStatusCode
  }: SatochipStatusModalProps) {
  const Theme = useTheme();
  return (
    <View style={[styles.container, {backgroundColor: Theme['bg-125']}]}>
      <View
        style={{
          width: '100%',
          marginVertical: 8,
          paddingHorizontal: 16,
          // rowGap: 8,

          padding: hp(20),
          borderRadius: 8,
          backgroundColor: Theme['bg-100'],
          flexDirection: 'row',
        }}
      >
        <View style={{ marginLeft: wp(12) }}>
          <Text style={{ color: Theme['fg-100'], fontSize: 15 }}>
            SATOCHIP Status:
          </Text>
          <Text style={{ color: Theme['fg-100'], fontSize: 13 }}>
            {`${
              satochipSetupDone
                ? satochipIsSeeded
                  ? "PIN set and seed imported"
                  : "PIN set but no seed imported"
                : "Uninitialized"
            }`}
          </Text>
        </View>
      </View>

      <View style={{
        // marginTop: hp(10),
        // marginBottom: hp(20) ,
        marginVertical: 8,
        width: '100%',
        // marginVertical: 8,
        // paddingHorizontal: 16,
        // rowGap: 8,

        // padding: hp(20),
        borderRadius: 8,
        // backgroundColor: Theme['bg-100'],
        flexDirection: 'row',
      }}
      >
        {satochipIsAuthentic === true ? (
          <View
            style={[
              styles.warningContainer,
              {
                backgroundColor: Theme['success-100'],
                borderColor: Theme['success-100'],
              }
            ]}
          >
            <Text style={styles.statusText}>
              {"This SATOCHIP is authentic!"}
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.warningContainer,
              {
                backgroundColor: Theme['error-100'],
                borderColor: Theme['error-100'],
              }
            ]}
          >
            <View style={styles.warningIcon}>
              {<ErrorIcon />}
            </View>

            {satochipIsAuthentic === false ? (
              <Text style={styles.warningText}>
                {`SATOCHIP is not authentic.\n${
                  satochipStatusCode ? satochipStatusCode + '.\n' : ''
                }Proceed only if trusted`}
              </Text>
            ) : (
              <Text style={styles.warningText}>
                {`Could not authenticate SATOCHIP.\n${satochipStatusCode}`}
              </Text>
            )}
          </View>
        )}
      </View>


      <TouchableOpacity
        style={{
          width: '100%',
          paddingVertical: hp(15),
          backgroundColor: '#007AFF',
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onPress={onClose}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
          {"OK"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}