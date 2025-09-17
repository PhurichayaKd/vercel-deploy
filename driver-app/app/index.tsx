// app/index.tsx
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';

export default function Index() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // รอให้เช็คสถานะล็อกอินเสร็จก่อน
    router.replace(session ? '/(tabs)/home' : '/login');
  }, [session, loading]);

  // โชว์ตัวโหลดระหว่างรอ ไม่ปล่อยจอขาว
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
