// app/login.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, Dimensions, Platform } from 'react-native';
import { supabase } from '../../src/services/supabaseClient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

/* ======= ENHANCED THEME (Professional Minimal) ======= */
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

export default function LoginScreen() {
  const [username, setUsername] = useState(''); // ใช้ email กับ Supabase
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // ถ้ามี session อยู่แล้ว ไม่ต้องเห็นหน้า login
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/(tabs)/home');
    });
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password,
      });
      if (error) {
        Alert.alert('เข้าสู่ระบบไม่สำเร็จ', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      } else {
        router.replace('/(tabs)/home');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.loginCard}>
        <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
        
        <Text style={styles.title}>
          <Text style={styles.brandSafety}>SAFETY </Text>
          <Text style={styles.brandBus}>BUS</Text>
        </Text>
        
        <Text style={styles.subtitle}>
          แดชบอร์ดคนขับรถ{isTablet ? ' - ' : '\n'}เข้าสู่ระบบเพื่อเริ่มต้น
        </Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              emailFocused && styles.inputFocused
            ]}
            placeholder="อีเมล"
            placeholderTextColor={COLORS.textPlaceholder}
            value={username}
            onChangeText={setUsername}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              passwordFocused && styles.inputFocused
            ]}
            placeholder="รหัสผ่าน"
            placeholderTextColor={COLORS.textPlaceholder}
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            secureTextEntry
            editable={!loading}
          />
        </View>
        
        <TouchableOpacity 
          style={[
            styles.button,
            loading && styles.buttonDisabled
          ]} 
          onPress={handleLogin} 
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </Text>
        </TouchableOpacity>
       </View>
     </View>
   );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    paddingHorizontal: isTablet ? 48 : 24,
  },
  
  loginCard: {
    backgroundColor: COLORS.card,
    borderRadius: isTablet ? 20 : 16,
    padding: isTablet ? 48 : 32,
    width: '100%',
    maxWidth: isTablet ? 480 : 360,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  
  logo: {
    width: isTablet ? 140 : 120,
    height: isTablet ? 140 : 120,
    marginBottom: isTablet ? 32 : 24,
  },
  
  title: {
    fontSize: isTablet ? 32 : 28,
    marginBottom: isTablet ? 32 : 24,
    fontWeight: '700',
  },
  
  subtitle: {
    fontSize: isTablet ? 18 : 16,
    color: COLORS.textSecondary,
    marginBottom: isTablet ? 40 : 32,
    textAlign: 'center',
    fontWeight: '400',
  },
  
  inputContainer: {
    width: '100%',
    marginBottom: isTablet ? 20 : 16,
  },
  
  input: {
    width: '100%',
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
    width: '100%',
    alignItems: 'center',
    marginTop: isTablet ? 24 : 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  
  buttonPressed: {
    backgroundColor: COLORS.primaryHover,
    transform: [{ scale: 0.98 }],
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
  },
  
  brandSafety: {
    color: COLORS.text,
    fontWeight: '700',
  },
  
  brandBus: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
