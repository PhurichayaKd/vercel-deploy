// app/manage/index.tsx
import { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

export default function ManageIndex() {
  useEffect(() => {
    router.replace('/manage/students' as any); // ถ้า typed routes พร้อมแล้วเอา `as any` ออกได้
  }, []);
  return <View />; // กันหน้าดำช่วงเปลี่ยนหน้า
}
