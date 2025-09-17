// app/_layout.tsx

import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useColorScheme } from '../hooks/useColorScheme';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';

// กันไม่ให้ Splash หายก่อนโหลดฟอนต์เสร็จ
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // โหลดฟอนต์ (รวม Ionicons)
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,                                // << สำคัญ: โหลดฟอนต์ไอคอน
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    // ซ่อน splash เมื่อทั้งฟอนต์โหลดแล้ว และเช็ค session เสร็จ
    if (fontsLoaded && !loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, loading]);

  useEffect(() => {
    if (loading) return;

    const first = segments[0] as string | undefined;

    // ❗ ไม่มี session → ไป login
    if (!session) {
      if (first !== 'auth') router.replace('/auth/login');
      return;
    }

    // ✅ มี session แล้ว → ถ้าอยู่หน้า login หรือราก ส่งไปแท็บหลัก
    if (session && (first === 'auth' || first === undefined)) {
      router.replace('/(tabs)/home');
    }
  }, [session, loading, segments]);

  const colorScheme = useColorScheme();

  // รอจนกว่าจะโหลดฟอนต์ + เช็ค session เสร็จ
  if (!fontsLoaded || loading) return null;

  return (
    <>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
