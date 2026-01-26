import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '@/hooks/useTheme';
import { AccountsStackParamList } from '@/utils/TypesUtil';
import AccountsScreen from '@/screens/Accounts';
import AddSatochipAccountScreen from '@/screens/Accounts/AddSatochipAccount';
import SatochipSetupScreen from '@/screens/Accounts/SatochipSetup';
import SetupSoftwareAccountScreen from '@/screens/Accounts/SetupSoftwareAccount.tsx';
import AccountDetailsScreen from '@/screens/Accounts/AccountDetail';
import SendTransactionScreen from '@/screens/Accounts/SendTransaction';

const Stack = createStackNavigator<AccountsStackParamList>();

export default function AccountsStack() {
  const Theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Theme['bg-100'],
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: Theme['fg-100'],
          fontWeight: '600',
        },
        // headerBackTitleVisible: false,
        headerTintColor: Theme['fg-100'],
      }}>
      <Stack.Screen
        name="Accounts"
        component={AccountsScreen}
        options={{
          title: 'Accounts',
        }}
      />

      {/* Satochip flow screens */}
      <Stack.Screen
        name="AddSatochipAccount"
        component={AddSatochipAccountScreen}
        options={{
          title: 'Add Satochip Account',
        }}
      />
      <Stack.Screen
        name="SatochipSetup"
        component={SatochipSetupScreen}
        options={{
          title: 'Setup Satochip',
        }}
      />

      {/* Software wallet flow screens */}
      <Stack.Screen
        name="SetupSoftwareAccount"
        component={SetupSoftwareAccountScreen}
        options={{
          title: 'Setup Software Account',
        }}
      />

      {/* Account details screen */}
      <Stack.Screen
        name="AccountDetails"
        component={AccountDetailsScreen}
        options={{
          title: 'Account Details',
        }}
      />

      {/* Send transaction screen */}
      <Stack.Screen
        name="SendTransaction"
        component={SendTransactionScreen}
        options={{
          title: 'Send Transaction',
        }}
      />

    </Stack.Navigator>
  );
}