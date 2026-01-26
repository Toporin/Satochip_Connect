import {createNativeStackNavigator} from '@react-navigation/native-stack';

import Settings from '@/screens/Settings';
import {useTheme} from '@/hooks/useTheme';
import SatochipSetupCard from '@/screens/Settings/SatochipSetupCard.tsx';
import SatochipResetSeed from '@/screens/Settings/SatochipResetSeed.tsx';
import SatochipImportSeed from '@/screens/Settings/SatochipImportSeed.tsx';

const Stack = createNativeStackNavigator();

export default function SettingsStack() {
  const Theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: {backgroundColor: Theme['bg-100']},
        headerStyle: {backgroundColor: Theme['bg-100']},
        headerTitleStyle: {
          color: Theme['fg-100'],
        },
      }}>
      <Stack.Screen
        name="Settings"
        options={{headerTitle: 'Settings', headerLargeTitle: true}}
        component={Settings}
      />

      <Stack.Screen
        name="SatochipSetupCard"
        options={{headerTitle: 'Setup Satochip', headerLargeTitle: true}}
        component={SatochipSetupCard}
      />

      <Stack.Screen
        name="SatochipResetSeed"
        options={{headerTitle: 'Reset Satochip seed', headerLargeTitle: true}}
        component={SatochipResetSeed}
      />

      <Stack.Screen
        name="SatochipImportSeed"
        options={{headerTitle: 'Import Satochip seed', headerLargeTitle: true}}
        component={SatochipImportSeed}
      />

    </Stack.Navigator>
  );
}
