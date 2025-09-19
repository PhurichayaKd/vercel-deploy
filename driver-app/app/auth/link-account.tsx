// app/auth/link-account.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../src/services/supabaseClient';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

const COLORS = {
  // Background & Surface
  bg: '#FAFBFC',
  bgSecondary: '#F8FAFC',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  
  // Text Colors
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textPlaceholder: '#94A3B8',
  
  // Brand Colors
  primary: '#0EA5E9',
  primaryHover: '#0284C7',
  primaryLight: '#E0F2FE',
  brand: '#0EA5E9',
  
  // Status Colors
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  
  // Interactive Colors
  border: '#E2E8F0',
  borderHover: '#CBD5E1',
  borderFocus: '#0EA5E9',
  
  // Shadow Colors
  shadow: 'rgba(15, 23, 42, 0.08)',
  shadowMedium: 'rgba(15, 23, 42, 0.12)',
  shadowStrong: 'rgba(15, 23, 42, 0.16)',
};

export default function LinkAccountScreen() {
  const [driverName, setDriverName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'name' | 'student_id'>('name');
  const [driverNameFocused, setDriverNameFocused] = useState(false);
  const [studentIdFocused, setStudentIdFocused] = useState(false);

  const handleDriverNameSubmit = () => {
    if (driverName.trim().length < 2) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่อคนขับให้ถูกต้อง\n\nตัวอย่าง: สมชาย ใจดี');
      return;
    }
    setStep('student_id');
  };

  const handleStudentIdSubmit = async () => {
    if (!/^[a-zA-Z0-9]{8,20}$/.test(studentId.trim())) {
      Alert.alert('ข้อผิดพลาด', 'รูปแบบรหัสนักเรียนไม่ถูกต้อง\n\nกรุณาใส่รหัสนักเรียน 8-20 ตัวอักษร');
      return;
    }

    try {
      setLoading(true);
      
      // ตรวจสอบว่ามีนักเรียนคนนี้หรือไม่
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('student_name')
        .eq('student_id', studentId.trim())
        .single();

      if (studentError || !student) {
        Alert.alert('ไม่พบข้อมูล', 'ไม่พบข้อมูลนักเรียนที่ระบุ\n\nกรุณาตรวจสอบรหัสนักเรียนอีกครั้ง');
        return;
      }

      // ตรวจสอบว่าคนขับคนนี้เชื่อมโยงแล้วหรือไม่
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) {
        Alert.alert('ข้อผิดพลาด', 'กรุณาเข้าสู่ระบบก่อน');
        return;
      }

      const userId = session.session.user.id;
      
      const { data: existingLink } = await supabase
        .from('driver_line_links')
        .select('*')
        .eq('line_user_id', userId)
        .single();

      if (existingLink) {
        // อัปเดตข้อมูลที่มีอยู่
        const { error: updateError } = await supabase
          .from('driver_line_links')
          .update({
            driver_name: driverName.trim(),
            student_id: studentId.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('line_user_id', userId);

        if (updateError) throw updateError;
      } else {
        // สร้างข้อมูลใหม่
        const { error: insertError } = await supabase
          .from('driver_line_links')
          .insert({
            line_user_id: userId,
            driver_name: driverName.trim(),
            student_id: studentId.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) throw insertError;
      }

      Alert.alert(
        'เชื่อมโยงสำเร็จ!',
        `เชื่อมโยงบัญชีคนขับสำเร็จ\n\nคนขับ: ${driverName.trim()}\nนักเรียน: ${student.student_name}\nรหัส: ${studentId.trim()}`,
        [
          {
            text: 'ตกลง',
            onPress: () => {
              // Navigate back to home page after successful linking
              router.push('/(tabs)/home');
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error linking account:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมโยงบัญชีได้\n\nกรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'student_id') {
      setStep('name');
    } else {
      router.back();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>เชื่อมโยงบัญชีคนขับ</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.card}>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step === 'name' && styles.stepDotActive]} />
          <View style={[styles.stepLine, step === 'student_id' && styles.stepLineActive]} />
          <View style={[styles.stepDot, step === 'student_id' && styles.stepDotActive]} />
        </View>

        <Text style={styles.stepText}>
          ขั้นตอนที่ {step === 'name' ? '1' : '2'} จาก 2
        </Text>

        {step === 'name' ? (
          <>
            <Text style={styles.title}>กรอกชื่อคนขับ</Text>
            <Text style={styles.subtitle}>
              กรุณากรอกชื่อ-นามสกุลของคุณ{isTablet ? ' ' : '\n'}เพื่อใช้ในการแสดงผลในระบบ
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>ชื่อ-นามสกุล</Text>
              <TextInput
                style={[
                  styles.input,
                  driverNameFocused && styles.inputFocused
                ]}
                value={driverName}
                onChangeText={setDriverName}
                placeholder="เช่น สมชาย ใจดี"
                placeholderTextColor={COLORS.textPlaceholder}
                onFocus={() => setDriverNameFocused(true)}
                onBlur={() => setDriverNameFocused(false)}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={handleDriverNameSubmit}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                driverName.trim().length < 2 && styles.buttonDisabled
              ]}
              onPress={handleDriverNameSubmit}
              disabled={driverName.trim().length < 2}
            >
              <Text style={styles.buttonText}>ถัดไป</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.card} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>กรอกรหัสนักเรียน</Text>
            <Text style={styles.subtitle}>
              กรุณากรอกรหัสนักเรียนที่คุณรับผิดชอบ{isTablet ? ' ' : '\n'}เพื่อเชื่อมโยงบัญชี
            </Text>

            <View style={styles.driverInfo}>
              <Ionicons name="person" size={20} color={COLORS.primary} />
              <Text style={styles.driverInfoText}>คนขับ: {driverName}</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>รหัสนักเรียน</Text>
              <TextInput
                style={[
                  styles.input,
                  studentIdFocused && styles.inputFocused
                ]}
                value={studentId}
                onChangeText={setStudentId}
                placeholder="เช่น 12345678"
                placeholderTextColor={COLORS.textPlaceholder}
                onFocus={() => setStudentIdFocused(true)}
                onBlur={() => setStudentIdFocused(false)}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleStudentIdSubmit}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                (!/^[a-zA-Z0-9]{8,20}$/.test(studentId.trim()) || loading) && styles.buttonDisabled
              ]}
              onPress={handleStudentIdSubmit}
              disabled={!/^[a-zA-Z0-9]{8,20}$/.test(studentId.trim()) || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.card} />
              ) : (
                <>
                  <Text style={styles.buttonText}>เชื่อมโยงบัญชี</Text>
                  <Ionicons name="link" size={20} color={COLORS.card} />
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.helpSection}>
        <Ionicons name="information-circle" size={20} color={COLORS.primary} />
        <Text style={styles.helpText}>
          หากไม่ทราบรหัสนักเรียน กรุณาติดต่อเจ้าหน้าที่ของโรงเรียน
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  contentContainer: {
    paddingHorizontal: isTablet ? 48 : 24,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.select({ ios: 60, android: 40 }),
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: isTablet ? 20 : 16,
    padding: isTablet ? 32 : 24,
    marginBottom: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.border,
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: COLORS.primary,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: isTablet ? 28 : 24,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: isTablet ? 16 : 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  driverInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    height: isTablet ? 56 : 48,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: isTablet ? 16 : 12,
    paddingHorizontal: isTablet ? 24 : 20,
    fontSize: isTablet ? 18 : 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputFocused: {
    borderColor: COLORS.borderFocus,
    backgroundColor: COLORS.card,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: isTablet ? 16 : 12,
    paddingVertical: isTablet ? 18 : 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: COLORS.textTertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: COLORS.card,
    fontWeight: '600',
    fontSize: isTablet ? 18 : 16,
    marginRight: 8,
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  helpText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
});