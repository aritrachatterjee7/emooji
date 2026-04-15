// app/_layout.jsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Prevent native splash from auto-hiding — we control this ourselves
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          Syne_400Regular:    require('../assets/fonts/Syne-Regular.ttf'),
          Syne_500Medium:     require('../assets/fonts/Syne-Medium.ttf'),
          Syne_700Bold:       require('../assets/fonts/Syne-Bold.ttf'),
          Syne_800ExtraBold:  require('../assets/fonts/Syne-ExtraBold.ttf'),
          DMMono_400Regular:  require('../assets/fonts/DMMono-Regular.ttf'),
          DMMono_500Medium:   require('../assets/fonts/DMMono-Medium.ttf'),
        });
      } catch (e) {
        console.warn('Font load error:', e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#080c10" translucent />
        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
          <Stack.Screen name="index" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
