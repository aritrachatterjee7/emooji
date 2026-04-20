// app/_layout.jsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import {
  JetBrainsMono_400Regular, JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import LoginScreen from '../src/screens/LoginScreen';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();

  const [fontsLoaded] = useFonts({
    Outfit_400Regular, Outfit_500Medium, Outfit_700Bold,
    JetBrainsMono_400Regular, JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded && !loading) SplashScreen.hideAsync();
  }, [fontsLoaded, loading]);

  if (!fontsLoaded || loading) return null;

  // Not logged in → show login screen
  if (!user) return <LoginScreen />;

  // Logged in → show the app
  return (
    <>
      {/* StatusBar style flips with theme */}
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor={isDark ? '#07090e' : '#f4f6f8'}
        translucent
      />
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* ThemeProvider wraps everything so any component can call useTheme() */}
        <ThemeProvider>
          {/* AuthProvider inside Theme so LoginScreen can also use theme colors */}
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}