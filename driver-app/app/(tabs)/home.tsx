// src/components/HomePage.tsx
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, StyleSheet, Text, TouchableOpacity, View, Pressable,
  Modal, ActivityIndicator, Platform, AccessibilityInfo, Alert, Dimensions, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/services/supabaseClient';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

const PATHS = {
  manage: '/manage',
  login: '/login',
  busForm: '/bus-form',
  reports: '/manage/reports',
  issueCard: '/manage/cards/issue',
} as const;

type BusStatus = 'enroute' | 'arrived_school' | 'waiting_return' | 'finished';

const STATUS_LABEL: Record<BusStatus, string> = {
  enroute: 'เริ่มออกเดินทาง',
  arrived_school: 'ถึงโรงเรียน',
  waiting_return: 'รอรับกลับบ้าน',
  finished: 'จบการเดินทาง',
};

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
  textMuted: '#94A3B8',
  
  // Border & Divider
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#E2E8F0',
  
  // Primary Brand (Blue)
  primary: '#0a7ea4',        // ใช้สีจาก Colors.ts
  primaryDark: '#0369A1',
  primaryLight: '#0EA5E9',
  primarySoft: '#EFF6FF',
  primaryGradient: ['#0a7ea4', '#0369A1'],
  
  // Status Colors
  success: '#059669',
  successSoft: '#ECFDF5',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  info: '#2563EB',
  infoSoft: '#EFF6FF',
  
  // Interactive States
  hover: '#F8FAFC',
  pressed: '#F1F5F9',
  focus: '#0a7ea4',
  
  // Shadows
  shadow: 'rgba(15, 23, 42, 0.08)',
  shadowDark: 'rgba(15, 23, 42, 0.15)',
};

function MenuCard({
  icon, label, to, disabled,
}: { icon: keyof typeof Ionicons.glyphMap; label: string; to?: string; disabled?: boolean }) {
  const onPress = async () => {
    if (disabled || !to) return;
    await Haptics.selectionAsync();
    router.push(to as any);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={`แตะเพื่อเข้าสู่${label}`}
      accessibilityState={{ disabled: !!disabled }}
      android_ripple={{ color: '#E5E7EB', borderless: false }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuCard,
        pressed && styles.menuCardPressed,
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={styles.menuIconWrap}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <Text style={styles.menuText}>{label}</Text>
    </Pressable>
  );
}

/* --------- Today progress helpers (เดิม) --------- */
function todayRangeISO() {
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}
async function getTodayProgress() {
  const { startISO, endISO } = todayRangeISO();

  const { count: activeCount } = await supabase
    .from('students')
    .select('student_id', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: absentCount } = await supabase
    .from('pickup_dropoff')
    .select('record_id', { count: 'exact', head: true })
    .eq('event_type', 'absent')
    .gte('event_time', startISO).lt('event_time', endISO);

  const target = Math.max(0, (activeCount ?? 0) - (absentCount ?? 0));

  const { count: pickupGo } = await supabase
    .from('pickup_dropoff')
    .select('record_id', { count: 'exact', head: true })
    .eq('event_type', 'pickup')
    .eq('location_type', 'go')
    .gte('event_time', startISO).lt('event_time', endISO);

  const { count: dropGo } = await supabase
    .from('pickup_dropoff')
    .select('record_id', { count: 'exact', head: true })
    .eq('event_type', 'dropoff')
    .eq('location_type', 'go')
    .gte('event_time', startISO).lt('event_time', endISO);

  const { count: pickupRet } = await supabase
    .from('pickup_dropoff')
    .select('record_id', { count: 'exact', head: true })
    .eq('event_type', 'pickup')
    .eq('location_type', 'return')
    .gte('event_time', startISO).lt('event_time', endISO);

  const { count: dropRet } = await supabase
    .from('pickup_dropoff')
    .select('record_id', { count: 'exact', head: true })
    .eq('event_type', 'dropoff')
    .eq('location_type', 'return')
    .gte('event_time', startISO).lt('event_time', endISO);

  return {
    target,
    pickupGo: pickupGo ?? 0,
    dropGo: dropGo ?? 0,
    pickupRet: pickupRet ?? 0,
    dropRet: dropRet ?? 0,
  };
}

const HomePage = () => {
  const { signOut } = useAuth();
  const [status, setStatus] = useState<BusStatus>('enroute');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    (async () => {
      const phase = await AsyncStorage.getItem('trip_phase');
      setStatus(phase === 'return' ? 'waiting_return' : 'enroute');
    })();
  }, []);

  const handleSignOut = async () => {
    await Haptics.selectionAsync();
    await signOut();
    router.replace(PATHS.login);
  };

  const persistTripPhase = async (next: BusStatus) => {
    if (next === 'waiting_return') {
      await AsyncStorage.setItem('trip_phase', 'return');
    } else if (next === 'enroute') {
      await AsyncStorage.setItem('trip_phase', 'go');
    } else {
      await AsyncStorage.removeItem('trip_phase');
    }
  };

  async function markNewDayReset() {
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    await AsyncStorage.setItem('last_trip_date', ymd);
    await AsyncStorage.setItem('reset_today_flag', String(Date.now()));
  }

  const updateStatus = async (next: BusStatus) => {
    setPickerVisible(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUpdating(true);
    try {
      const p = await getTodayProgress();

      if (next === 'arrived_school') {
        if (p.pickupGo < p.target) {
          const remain = p.target - p.pickupGo;
          Alert.alert('ยังเช็กไม่ครบ', `ยังมีนักเรียนที่ยังไม่ขึ้นรถเช้าอีก ${remain} คน`);
          return;
        }
      }

      if (next === 'waiting_return') {
        if (p.dropGo < p.pickupGo) {
          const remain = p.pickupGo - p.dropGo;
          Alert.alert('ยังเช็กไม่ครบ', `ยังมีนักเรียนที่ยังไม่ลงรถที่โรงเรียนอีก ${remain} คน`);
          return;
        }
        await AsyncStorage.setItem('trip_phase', 'return');
      }

      if (next === 'finished') {
        if (p.dropRet < p.pickupRet) {
          const remain = p.pickupRet - p.dropRet;
          Alert.alert('ยังเช็กไม่ครบ', `ยังมีนักเรียนที่ยังไม่ลงรถถึงบ้านอีก ${remain} คน`);
          return;
        }
        await markNewDayReset();
      }

      if (next === 'enroute') {
        await markNewDayReset();
      }

      setStatus(next);
      await persistTripPhase(next);
      AccessibilityInfo.announceForAccessibility?.(`อัปเดตสถานะเป็น ${STATUS_LABEL[next]}`);
    } finally {
      setUpdating(false);
    }
  };

  const steps: BusStatus[] = ['enroute','arrived_school','waiting_return','finished'];
  const activeIndex = steps.findIndex(k => k === status);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* ENHANCED HEADER */}
        <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <Ionicons name="bus" size={28} color={COLORS.primary} />
            </View>
            <View style={styles.brandText}>
              <Text style={styles.appTitle}>SAFETY BUS</Text>
              <View style={styles.titleRow}>
                <Text style={styles.subtitle}>แดชบอร์ดคนขับ</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>ออนไลน์</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="ออกจากระบบ"
            accessibilityHint="แตะเพื่อออกจากระบบและกลับไปหน้าเข้าสู่ระบบ"
          >
            <Ionicons name="log-out-outline" size={16} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ENHANCED STATUS CARD */}
      <View style={styles.statusCard}>
        <View style={styles.heroSurface}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>สถานะปัจจุบัน</Text>
            <Text style={styles.statusLine}>{STATUS_LABEL[status]}</Text>
          </View>

          {/* Enhanced Stepper */}
          <View style={styles.stepperContainer}>
            <View accessible accessibilityRole="progressbar" style={styles.stepperWrap}>
              {steps.map((k, idx) => {
                const active = idx <= activeIndex;
                const isLast = idx === steps.length - 1;
                return (
                  <View key={k} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        active && styles.stepDotActive,
                      ]}
                    >
                      {active && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
                      {STATUS_LABEL[k]}
                    </Text>
                    {!isLast && (
                      <View style={[styles.stepBar, idx < activeIndex && styles.stepBarActive]} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.updateButton, updating && { opacity: 0.8 }]}
            activeOpacity={0.8}
            onPress={() => setPickerVisible(true)}
            disabled={updating}
            accessibilityRole="button"
            accessibilityLabel={updating ? 'กำลังอัปเดตสถานะ' : 'อัปเดตสถานะรถ'}
            accessibilityHint="แตะเพื่อเลือกสถานะใหม่สำหรับรถบัส"
            accessibilityState={{ disabled: updating }}
          >
            {updating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.updateText}>อัปเดตสถานะ</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* QUICK STATS - Compact Version */}
        <View style={styles.statsContainer}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <Ionicons name="time" size={14} color={COLORS.primary} />
              </View>
              <Text style={styles.statValue}>2.5 ชม.</Text>
              <Text style={styles.statLabel}>เวลาขับรถ</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <Ionicons name="speedometer" size={14} color={COLORS.success} />
              </View>
              <Text style={styles.statValue}>45 กม.</Text>
              <Text style={styles.statLabel}>ระยะทาง</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <Ionicons name="people" size={14} color={COLORS.warning} />
              </View>
              <Text style={styles.statValue}>24 คน</Text>
              <Text style={styles.statLabel}>นักเรียน</Text>
            </View>
          </View>
        </View>

      {/* MENUS */}
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>เมนูหลัก</Text>
          <View style={styles.menuGrid}>
            <MenuCard icon="person-outline"     label="ข้อมูลผู้ใช้"   to="/manage/students/profile" />
            <MenuCard icon="car-outline"        label="ข้อมูลคนขับ"   to="/driver-info" />
            <MenuCard icon="card-outline"       label="ออกบัตรใหม่"   to={PATHS.issueCard} />
            <MenuCard icon="document-text-outline" label="รายงาน"     to={PATHS.reports} />
          </View>
        </View>
      </ScrollView>

      {/* STATUS PICKER MODAL */}
      <Modal transparent visible={pickerVisible} animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>อัปเดตสถานะรถ</Text>
              <Text style={styles.sheetSubtitle}>เลือกสถานะที่ต้องการอัปเดต</Text>
            </View>

            <TouchableOpacity 
              style={[styles.sheetItem]} 
              activeOpacity={0.7}
              onPress={() => updateStatus('enroute')}
            >
              <View style={styles.sheetIconContainer}>
                <Ionicons name="play-circle" size={22} color={COLORS.success} />
              </View>
              <Text style={styles.sheetText}>เริ่มออกเดินทาง</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.sheetItem]} 
              activeOpacity={0.7}
              onPress={() => updateStatus('arrived_school')}
            >
              <View style={styles.sheetIconContainer}>
                <Ionicons name="school-outline" size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.sheetText}>ถึงโรงเรียน</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.sheetItem]} 
              activeOpacity={0.7}
              onPress={() => updateStatus('waiting_return')}
            >
              <View style={styles.sheetIconContainer}>
                <Ionicons name="time-outline" size={22} color={COLORS.warning} />
              </View>
              <Text style={styles.sheetText}>รอรับกลับบ้าน</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.sheetItem]} 
              activeOpacity={0.7}
              onPress={() => updateStatus('finished')}
            >
              <View style={styles.sheetIconContainer}>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              </View>
              <Text style={styles.sheetText}>จบการเดินทาง</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setPickerVisible(false)} activeOpacity={0.7}>
              <Text style={styles.closeTxt}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default HomePage;

/* ============================= Styles ============================= */
const shadow = Platform.select({
  ios: {
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  android: { elevation: 3 },
});

const shadowElevated = Platform.select({
  ios: {
    shadowColor: COLORS.shadowDark,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 6 },
});

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.bg, 
    paddingHorizontal: isTablet ? 24 : 16, 
    paddingTop: 16,
    maxWidth: isTablet ? 800 : '100%',
    alignSelf: 'center',
    width: '100%',
  },

  // Enhanced Header
  headerContainer: {
    backgroundColor: COLORS.card,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    ...shadow,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandText: {
    flex: 1,
  },
  appTitle: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: COLORS.text, 
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  titleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    columnGap: 12, 
    marginTop: 2 
  },
  subtitle: { 
    color: COLORS.textSecondary, 
    fontWeight: '600', 
    fontSize: 14,
    letterSpacing: 0.1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    backgroundColor: COLORS.successSoft,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.success + '20',
  },
  statusDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: COLORS.success 
  },
  statusText: { 
    color: COLORS.success, 
    fontSize: 11, 
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  signOutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.dangerSoft, 
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.danger + '20',
  },

  /* Compact Status Card */
  statusCard: {
    backgroundColor: COLORS.card, 
    borderRadius: 16, 
    marginTop: 16,
    borderWidth: 1, 
    borderColor: COLORS.border, 
    overflow: 'hidden',
    ...shadow,
  },
  heroSurface: {
    backgroundColor: COLORS.card, 
    paddingVertical: 16, 
    paddingHorizontal: 16,
  },
  statusHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: COLORS.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statusLine: { 
    color: COLORS.primary, 
    fontSize: 22, 
    fontWeight: '800', 
    marginTop: 4,
    letterSpacing: -0.3,
    textAlign: 'center',
  },

  stepperContainer: {
    marginTop: 12, 
    marginBottom: 12,
  },
  stepperWrap: {
    paddingVertical: 12, 
    paddingHorizontal: 12,
    backgroundColor: COLORS.bgSecondary, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: COLORS.borderLight,
  },
  stepItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 8,
    position: 'relative',
  },
  stepDot: {
    width: 20, 
    height: 20, 
    borderRadius: 10,
    borderWidth: 2, 
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center', 
    justifyContent: 'center',
    zIndex: 2,
  },
  stepDotActive: { 
    borderColor: COLORS.primary, 
    backgroundColor: COLORS.primary,
    transform: [{ scale: 1.05 }],
  },
  stepLabel: { 
    marginLeft: 10, 
    fontWeight: '600', 
    color: COLORS.textTertiary, 
    fontSize: 13, 
    flexShrink: 1,
    letterSpacing: 0.1,
  },
  stepLabelActive: { 
    color: COLORS.text, 
    fontWeight: '700' 
  },
  stepBar: { 
    position: 'absolute',
    left: 9,
    top: 20,
    width: 2, 
    height: 24,
    backgroundColor: COLORS.border,
    borderRadius: 1,
    zIndex: 1,
  },
  stepBarActive: { 
    backgroundColor: COLORS.primary 
  },

  updateButton: {
    alignSelf: 'stretch', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    columnGap: 8,
    backgroundColor: COLORS.primary, 
    paddingHorizontal: 20, 
    height: 48,
    borderRadius: 12, 
    marginTop: 12, 
    ...shadow,
  },
  updateText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 15,
    letterSpacing: 0.1,
  },

  /* Compact Menus */
  menuContainer: { 
    marginTop: 16,
    paddingBottom: 20,
  },
  menuTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: COLORS.text, 
    marginBottom: 12, 
    paddingHorizontal: 2,
    letterSpacing: -0.2,
  },
  menuGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: isTablet ? 12 : 8, 
    justifyContent: 'space-between' 
  },
  menuCard: {
    width: isTablet ? '23%' : '47%', 
    backgroundColor: COLORS.card, 
    borderRadius: 16,
    paddingVertical: isTablet ? 20 : 16, 
    paddingHorizontal: isTablet ? 16 : 12, 
    rowGap: 10,
    borderWidth: 1, 
    borderColor: COLORS.border, 
    minHeight: isTablet ? 120 : 100, 
    justifyContent: 'center',
    alignItems: 'flex-start',
    ...shadow,
  },
  menuCardPressed: { 
    transform: [{ scale: 0.96 }],
    backgroundColor: COLORS.hover,
    borderColor: COLORS.primary + '30',
  },
  menuIconWrap: {
    width: 40, 
    height: 40, 
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 8,
  },
  menuText: { 
    color: COLORS.text, 
    fontWeight: '600', 
    fontSize: 13,
    letterSpacing: 0.1,
    lineHeight: 16,
  },

  /* Enhanced Modal */
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.4)', 
    alignItems: 'center', 
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  modalSheet: {
    width: '100%', 
    backgroundColor: COLORS.card, 
    borderRadius: 24,
    padding: 24, 
    rowGap: 8, 
    maxHeight: '80%',
    ...shadowElevated,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginBottom: 16,
  },
  sheetTitle: { 
    fontWeight: '800', 
    color: COLORS.text, 
    fontSize: 18, 
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  sheetItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    columnGap: 14, 
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sheetItemPressed: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary + '30',
    transform: [{ scale: 0.98 }],
  },
  sheetIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetText: { 
    fontWeight: '600', 
    color: COLORS.text, 
    fontSize: 15,
    flex: 1,
    letterSpacing: 0.1,
  },
  closeBtn: {
    marginTop: 16, 
    alignSelf: 'stretch', 
    borderRadius: 16,
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1, 
    borderColor: COLORS.border, 
    height: 52, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  closeTxt: { 
    fontWeight: '600', 
    color: COLORS.textSecondary, 
    fontSize: 15,
    letterSpacing: 0.1,
  },

  /* Compact Stats Section */
  statsContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: isTablet ? 12 : 8,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: isTablet ? 100 : 80,
    ...shadow,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
});
