// src/components/PassengerListPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Linking, Modal, Alert, Platform, Dimensions, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

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

type Mode = 'send' | 'stop';
type PDDEventType = 'pickup' | 'dropoff' | 'absent';
type TripPhase = 'go' | 'return';
type TripStep = 'idle' | 'boarding' | 'dropping';

type Student = {
  student_id: number;
  student_name: string;
  grade: string;
  status: 'active' | 'inactive' | null;
  primary_parent?: { parent_phone?: string | null } | null;
};

const STORAGE_KEYS = {
  phase: 'trip_phase',
  resetFlag: 'reset_today_flag',
  date: 'last_trip_date',
};

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

export default function PassengerListPage() {
  const [phase, setPhase] = useState<TripPhase>('go');
  const [step, setStep] = useState<TripStep>('idle');
  const [mode, setMode] = useState<Mode>('send');

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);

  // sets สำหรับวันนี้
  const [boardedGoSet, setBoardedGoSet] = useState<Set<number>>(new Set());
  const [boardedReturnSet, setBoardedReturnSet] = useState<Set<number>>(new Set());
  const [droppedGoSet, setDroppedGoSet] = useState<Set<number>>(new Set());
  const [droppedReturnSet, setDroppedReturnSet] = useState<Set<number>>(new Set());
  const [absentSet, setAbsentSet] = useState<Set<number>>(new Set());

  const [alertsVisible, setAlertsVisible] = useState(false);

  const [driverId, setDriverId] = useState<number | null>(null);
  const [driverReady, setDriverReady] = useState(false);

  // start-of-today (local -> toISOString เป็น UTC)
  const startOfTodayISO = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  /* ---------- phase จาก AsyncStorage + reset flag ---------- */
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const p = (await AsyncStorage.getItem(STORAGE_KEYS.phase)) as TripPhase | null;
        setPhase(p === 'return' ? 'return' : 'go');

        const flag = await AsyncStorage.getItem(STORAGE_KEYS.resetFlag);
        if (flag) {
          softResetSets();
          await AsyncStorage.removeItem(STORAGE_KEYS.resetFlag);
        }
      })();
    }, [])
  );

  /* ---------- driver_id ---------- */
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) throw new Error('ยังไม่พบผู้ใช้ที่ล็อกอิน');

        const { data, error } = await supabase
          .from('driver_bus')
          .select('driver_id')
          .eq('auth_user_id', uid)
          .maybeSingle();

        if (error) throw error;
        if (!data?.driver_id) throw new Error('ไม่พบ driver_id ของบัญชีนี้');

        setDriverId(data.driver_id);
      } catch (e: any) {
        Alert.alert('แจ้งเตือน', e?.message || 'ไม่สามารถค้นหา driver_id ได้');
      } finally {
        setDriverReady(true);
      }
    })();
  }, []);

  /* ---------- students ---------- */
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select(`
        student_id,
        student_name,
        grade,
        status,
        primary_parent:parents!students_parent_id_fkey ( parent_phone )
      `)
      .order('student_id', { ascending: true });

    if (error) {
      console.error('Error fetching students:', error);
      setStudents([]);
    } else {
      setStudents((data || []) as Student[]);
    }
    setLoading(false);
  }, []);

  /* ---------- events today (ของ driver นี้เท่านั้น) ---------- */
  const fetchTodayEvents = useCallback(async () => {
    if (!driverId) { softResetSets(); return; }

    const { data, error } = await supabase
      .from('pickup_dropoff')
      .select('student_id,event_type,event_time,pickup_source,location_type,driver_id')
      .gte('event_time', startOfTodayISO)
      .eq('driver_id', driverId)
      .order('event_time', { ascending: true });

    if (error) {
      console.error('Error fetching today events:', error);
      softResetSets();
      return;
    }

    const gPick = new Set<number>(), rPick = new Set<number>();
    const gDrop = new Set<number>(), rDrop = new Set<number>();
    const ab = new Set<number>();

    (data || []).forEach((row: any) => {
      const sid = row.student_id as number;
      const type = row.event_type as PDDEventType;
      const loc: string = row.location_type || 'go';

      if (type === 'pickup') {
        if (loc === 'return') rPick.add(sid); else gPick.add(sid);
      } else if (type === 'dropoff') {
        if (loc === 'return') rDrop.add(sid); else gDrop.add(sid);
      } else if (type === 'absent') {
        ab.add(sid);
      }
    });

    setBoardedGoSet(gPick);
    setBoardedReturnSet(rPick);
    setDroppedGoSet(gDrop);
    setDroppedReturnSet(rDrop);
    setAbsentSet(ab);
  }, [startOfTodayISO, driverId]);

  useEffect(() => {
    (async () => {
      await fetchStudents();
      await fetchTodayEvents();
    })();
  }, [fetchStudents, fetchTodayEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStudents();
    await fetchTodayEvents();
    setRefreshing(false);
  };

  /* ---------- helpers ---------- */
  const softResetSets = () => {
    setBoardedGoSet(new Set());
    setBoardedReturnSet(new Set());
    setDroppedGoSet(new Set());
    setDroppedReturnSet(new Set());
    setAbsentSet(new Set());
  };

  const alreadyToday = (student_id: number, event_type: PDDEventType, loc: 'go'|'return') => {
    if (event_type === 'pickup') {
      return loc === 'go' ? boardedGoSet.has(student_id) : boardedReturnSet.has(student_id);
    }
    if (event_type === 'dropoff') {
      return loc === 'go' ? droppedGoSet.has(student_id) : droppedReturnSet.has(student_id);
    }
    if (event_type === 'absent') return absentSet.has(student_id);
    return false;
  };

  /* ====== อัปเดตชุดข้อมูลแบบ incremental เมื่อมี Realtime ====== */
  const applyPDDEventToLocalSets = useCallback((row: any) => {
    if (!row) return;

    // สนใจเฉพาะเหตุการณ์ของ driver นี้ และเป็น "วันนี้"
    if (driverId && row.driver_id && row.driver_id !== driverId) return;

    const eventTime = new Date(row.event_time ?? row.created_at ?? Date.now());
    const start = new Date(startOfTodayISO);
    if (eventTime < start) return;

    const sid: number = row.student_id;
    const type: PDDEventType = row.event_type;
    const loc: 'go' | 'return' = (row.location_type === 'return') ? 'return' : 'go';

    if (loc === 'go') {
      if (type === 'pickup') {
        setBoardedGoSet(prev => new Set(prev).add(sid));
        setAbsentSet(prev => { const n = new Set(prev); n.delete(sid); return n; });
      } else if (type === 'dropoff') {
        setDroppedGoSet(prev => new Set(prev).add(sid));
      } else if (type === 'absent') {
        setAbsentSet(prev => new Set(prev).add(sid));
        setBoardedGoSet(prev => { const n = new Set(prev); n.delete(sid); return n; });
        setDroppedGoSet(prev => { const n = new Set(prev); n.delete(sid); return n; });
      }
    } else {
      if (type === 'pickup') {
        setBoardedReturnSet(prev => new Set(prev).add(sid));
        setAbsentSet(prev => { const n = new Set(prev); n.delete(sid); return n; });
      } else if (type === 'dropoff') {
        setDroppedReturnSet(prev => new Set(prev).add(sid));
      } else if (type === 'absent') {
        setAbsentSet(prev => new Set(prev).add(sid));
        setBoardedReturnSet(prev => { const n = new Set(prev); n.delete(sid); return n; });
        setDroppedReturnSet(prev => { const n = new Set(prev); n.delete(sid); return n; });
      }
    }
  }, [startOfTodayISO, driverId]);

  /* ---------- Realtime subscribe (เฉพาะตารางนี้) ---------- */
  useEffect(() => {
    if (!driverReady) return;

    const channel = supabase
      .channel('pickup_dropoff_realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pickup_dropoff' },
        (payload) => {
          const row = payload.new ?? payload.old;
          if (!row) return;
          applyPDDEventToLocalSets(row);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverReady, applyPDDEventToLocalSets]);

  /* ---------- คำนวณ step อัตโนมัติ ---------- */
  useEffect(() => {
    const activeCount = students.filter(s => s.status === 'active').length;
    const targetGo = Math.max(0, activeCount - absentSet.size);
    const targetReturn = boardedGoSet.size;

    let next: TripStep = 'idle';
    if (phase === 'go') {
      if (boardedGoSet.size < targetGo) next = 'boarding';
      else if (droppedGoSet.size < boardedGoSet.size) next = 'dropping';
      else next = 'idle';
    } else {
      if (boardedReturnSet.size < targetReturn) next = 'boarding';
      else if (droppedReturnSet.size < boardedReturnSet.size) next = 'dropping';
      else next = 'idle';
    }
    setStep(next);
  }, [phase, students, absentSet, boardedGoSet, droppedGoSet, boardedReturnSet, droppedReturnSet]);

  /* ---------- state ของแต่ละคน ---------- */
  const stateOf = useCallback(
    (s: Student): 'pending' | 'boarded' | 'onbus' | 'absent' => {
      const sid = s.student_id;
      if (absentSet.has(sid)) return 'absent';

      if (phase === 'go') {
        const boarded = boardedGoSet.has(sid);
        const dropped = droppedGoSet.has(sid);
        if (step === 'boarding') {
          if (dropped) return 'boarded';
          return boarded ? 'boarded' : 'pending';
        }
        if (boarded && !dropped) return 'onbus';
        if (boarded && dropped) return 'boarded';
        return 'pending';
      } else {
        const boarded = boardedReturnSet.has(sid);
        const dropped = droppedReturnSet.has(sid);
        if (step === 'boarding') {
          if (dropped) return 'boarded';
          return boarded ? 'boarded' : 'pending';
        }
        if (boarded && !dropped) return 'onbus';
        if (boarded && dropped) return 'boarded';
        return 'pending';
      }
    },
    [phase, step, absentSet, boardedGoSet, boardedReturnSet, droppedGoSet, droppedReturnSet]
  );

  /* ---------- ลิสต์สำหรับแสดง ---------- */
  const listForRender = useMemo(() => {
    if (mode === 'stop') {
      return [...students].filter((s) => stateOf(s) === 'absent');
    }
    const arr = [...students].filter((s) => s.status === 'active' && stateOf(s) !== 'absent');

    if (step === 'boarding') {
      const pending = arr.filter((s) => {
        const sid = s.student_id;
        return phase === 'go'
          ? !boardedGoSet.has(sid)
          : !boardedReturnSet.has(sid);
      });
      const boardedNotDropped = arr.filter((s) => {
        const sid = s.student_id;
        return phase === 'go'
          ? (boardedGoSet.has(sid) && !droppedGoSet.has(sid))
          : (boardedReturnSet.has(sid) && !droppedReturnSet.has(sid));
      });
      return [...pending, ...boardedNotDropped];
    }

    if (step === 'dropping') {
      return arr.filter((s) => stateOf(s) === 'onbus');
    }

    return arr.sort((a, b) => a.student_id - b.student_id);
  }, [students, mode, step, stateOf, phase, boardedGoSet, boardedReturnSet, droppedGoSet, droppedReturnSet]);

  /* ---------- โทร ---------- */
  const callNumber = (phone?: string | null) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  /* ---------- sheet ---------- */
  const openSheet = (item: Student) => {
    setSelected(item);
    setSheetVisible(true);
  };

  /* ---------- Insert Event ---------- */
  const insertPDDEvent = async (
    student_id: number,
    event_type: PDDEventType,
    byParent: boolean
  ) => {
    if (!driverId) throw new Error('ไม่พบ driver_id');
    const locType: 'go' | 'return' = phase === 'return' ? 'return' : 'go';

    if (alreadyToday(student_id, event_type, locType)) return;

    const payload: any = {
      student_id,
      driver_id: driverId,
      event_type,
      location_type: locType,
    };
    if (event_type === 'pickup') {
      payload.pickup_source = byParent ? 'parent' : 'driver';
    }

    try {
      const { error } = await supabase.from('pickup_dropoff').insert([payload]);
      if (error) throw error;
    } catch (e: any) {
      const code = e?.code || e?.details?.code;
      // 23505 = unique violation, 23P01 = exclusion violation (กันสแกนถี่)
      if (code !== '23505' && code !== '23P01') {
        throw e;
      }
      // ถ้าชน constraint ให้ถือว่า "มีรายการอยู่แล้ว" → ไม่ต้องเด้ง error
    }

    // sync local (idempotent)
    if (locType === 'go') {
      if (event_type === 'pickup') {
        setBoardedGoSet((prev) => new Set(prev).add(student_id));
        setAbsentSet((prev) => { const n = new Set(prev); n.delete(student_id); return n; });
      } else if (event_type === 'dropoff') {
        setDroppedGoSet((prev) => new Set(prev).add(student_id));
      } else if (event_type === 'absent') {
        setAbsentSet((prev) => new Set(prev).add(student_id));
        setBoardedGoSet((prev) => { const n = new Set(prev); n.delete(student_id); return n; });
        setDroppedGoSet((prev) => { const n = new Set(prev); n.delete(student_id); return n; });
      }
    } else {
      if (event_type === 'pickup') {
        setBoardedReturnSet((prev) => new Set(prev).add(student_id));
        setAbsentSet((prev) => { const n = new Set(prev); n.delete(student_id); return n; });
      } else if (event_type === 'dropoff') {
        setDroppedReturnSet((prev) => new Set(prev).add(student_id));
      } else if (event_type === 'absent') {
        setAbsentSet((prev) => new Set(prev).add(student_id));
        setBoardedReturnSet((prev) => { const n = new Set(prev); n.delete(student_id); return n; });
        setDroppedReturnSet((prev) => { const n = new Set(prev); n.delete(student_id); return n; });
      }
    }
  };

  const handleMarkBoarded = async (byParent = false) => {
    if (!selected || !driverReady) return;
    setSaving(true);
    try {
      await insertPDDEvent(selected.student_id, 'pickup', byParent);
      setSheetVisible(false);
    } catch (e: any) {
      Alert.alert('เกิดข้อผิดพลาด', e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkDropped = async () => {
    if (!selected || !driverReady) return;
    setSaving(true);
    try {
      await insertPDDEvent(selected.student_id, 'dropoff', false);
      setSheetVisible(false);
    } catch (e: any) {
      Alert.alert('เกิดข้อผิดพลาด', e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAbsent = async () => {
    if (!selected || !driverReady) return;
    setSaving(true);
    try {
      await insertPDDEvent(selected.student_id, 'absent', false);
      setSheetVisible(false);
    } catch (e: any) {
      Alert.alert('เกิดข้อผิดพลาด', e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- UI ของแต่ละรายการ ---------- */
  const renderItem = ({ item, index }: { item: Student; index: number }) => {
    const st = stateOf(item);

    const dotColor =
      st === 'pending' ? '#9CA3AF' :
      st === 'boarded' ? '#22C55E' :
      st === 'onbus' ? '#F59E0B' : '#EF4444';
    const chipBg =
      st === 'pending' ? '#F3F4F6' :
      st === 'boarded' ? '#E8FCEB' :
      st === 'onbus' ? '#FEF3C7' : '#FFECEC';

    let label = 'สถานะ';
    if (step === 'boarding') {
      if (st === 'pending') {
        label = phase === 'go' ? 'ยังไม่ขึ้นรถ' : 'รอขึ้นรถกลับ';
      } else {
        label = phase === 'go' ? 'ขึ้นรถแล้ว' : 'ลงรถ';
      }
    } else if (step === 'dropping') {
      label = st === 'onbus' ? 'ยังไม่ลงรถ' : 'ลงรถแล้ว';
    } else {
      label = st === 'absent' ? 'ลา/หยุด' : (phase === 'go' ? 'รอขึ้นรถ' : 'รอขึ้นรถกลับ');
    }

    const order = index + 1;

    return (
      <Pressable 
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed
        ]} 
        onPress={() => openSheet(item)} 
        accessibilityRole="button"
        accessibilityLabel={`นักเรียน ${item.student_name} ชั้น ${item.grade} สถานะ ${label}`}
        accessibilityHint="แตะเพื่อดูตัวเลือกการจัดการสถานะ"
        accessibilityState={{ selected: selected?.student_id === item.student_id }}
      >
        <View style={styles.orderBadge}>
          <Text style={styles.orderText}>{order}</Text>
        </View>

        <View style={[styles.avatar, { backgroundColor: chipBg }]}>
          <Text style={[styles.avatarText, { color: dotColor }]}>
            {item.student_name?.charAt(0) || '?'}
          </Text>
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.student_name}</Text>
            <Text style={styles.grade}>{item.grade}</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: chipBg }]}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={[styles.statusChipText, { color: dotColor }]}>{label}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => callNumber(item.primary_parent?.parent_phone)}
          style={styles.callBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={`โทรหาผู้ปกครองของ ${item.student_name}`}
          accessibilityHint="แตะเพื่อโทรหาผู้ปกครอง"
        >
          <Ionicons name="call" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </Pressable>
    );
  };

  if (loading || !driverReady) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: '#6B7280' }}>กำลังโหลดข้อมูล...</Text>
      </View>
    );
  }

  const total = students.length;
  const came = boardedGoSet.size;
  const back = boardedReturnSet.size;
  const absent = absentSet.size;

  return (
    <View style={styles.container}>
      {/* Enhanced Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <Ionicons name="people" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.brandText}>
              <Text style={styles.appTitle}>รายชื่อผู้โดยสาร</Text>
              <View style={styles.titleRow}>
                <Text style={styles.subtitle}>จัดการข้อมูลนักเรียน</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>ออนไลน์</Text>
                </View>
              </View>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => setAlertsVisible(true)} 
            style={styles.bellButton} 
            accessibilityLabel="การแจ้งเตือน"
          >
            <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Enhanced Summary Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: COLORS.card }]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.primarySoft }]}>
              <Ionicons name="people" size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.statValue}>{total}</Text>
            <Text style={styles.statLabel}>ทั้งหมด</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: COLORS.card }]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.successSoft }]}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            </View>
            <Text style={styles.statValue}>{came}</Text>
            <Text style={styles.statLabel}>มาแล้ว</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: COLORS.card }]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.infoSoft }]}>
              <Ionicons name="arrow-back-circle" size={16} color={COLORS.info} />
            </View>
            <Text style={styles.statValue}>{back}/{came}</Text>
            <Text style={styles.statLabel}>กลับบ้าน</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: COLORS.card }]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.dangerSoft }]}>
              <Ionicons name="close-circle" size={16} color={COLORS.danger} />
            </View>
            <Text style={styles.statValue}>{absent}</Text>
            <Text style={styles.statLabel}>ลา/หยุด</Text>
          </View>
        </View>
      </View>

      {/* Enhanced Toggle */}
      <View style={styles.toggleContainer}>
        <View style={styles.toggleWrapper}>
          <Pressable 
            style={({ pressed }) => [
              styles.toggleBtn, 
              mode === 'send' && styles.toggleActive,
              pressed && styles.togglePressed
            ]} 
            onPress={() => setMode('send')}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'send' }}
          >
            <View style={styles.toggleContent}>
              <Ionicons 
                name={phase === 'go' ? 'bus' : 'home'} 
                size={16} 
                color={mode === 'send' ? '#fff' : COLORS.textSecondary} 
              />
              <Text style={[styles.toggleText, mode === 'send' && styles.toggleTextActive]}>
                {phase === 'go'
                  ? (step === 'dropping' ? 'ลงรถ (เช้า)' : 'รับ–ส่ง (เช้า)')
                  : (step === 'dropping' ? 'ลงรถ (เย็น)' : 'รับกลับบ้าน')}
              </Text>
            </View>
          </Pressable>
          <Pressable 
            style={({ pressed }) => [
              styles.toggleBtn, 
              mode === 'stop' && styles.toggleActive,
              pressed && styles.togglePressed
            ]} 
            onPress={() => setMode('stop')}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'stop' }}
          >
            <View style={styles.toggleContent}>
              <Ionicons 
                name="close-circle" 
                size={16} 
                color={mode === 'stop' ? '#fff' : COLORS.textSecondary} 
              />
              <Text style={[styles.toggleText, mode === 'stop' && styles.toggleTextActive]}>ลา–หยุด</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={listForRender}
        keyExtractor={(item) => String(item.student_id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Ionicons name="people-outline" size={36} color="#9CA3AF" />
            <Text style={{ color: '#9CA3AF', marginTop: 8 }}>ไม่พบข้อมูลผู้โดยสาร</Text>
          </View>
        }
      />

      {/* Enhanced Action Sheet */}
      <Modal transparent visible={sheetVisible} animationType="slide" onRequestClose={() => setSheetVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSheetVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>สถานะนักเรียน</Text>
              <Text style={styles.sheetSub}>{selected?.student_name} · {selected?.grade}</Text>
            </View>

            {/* เช็คขึ้นรถ */}
            {step !== 'dropping' && (
              <Pressable
                style={({ pressed }) => [
                  styles.sheetItem,
                  pressed && styles.sheetItemPressed
                ]}
                onPress={() => handleMarkBoarded(false)}
                disabled={
                  saving ||
                  !selected ||
                  (phase === 'go'
                    ? boardedGoSet.has(selected.student_id)
                    : boardedReturnSet.has(selected.student_id))
                }
              >
                <View style={[styles.sheetIconContainer, { backgroundColor: COLORS.successSoft }]}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                </View>
                <Text style={styles.sheetText}>
                  {phase === 'go' ? 'เช็คขึ้นรถแล้ว (เช้า)' : 'เช็คขึ้นรถแล้ว (กลับ)'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </Pressable>
            )}

            {/* ผู้ปกครองมารับ */}
            {step !== 'dropping' && (
              <Pressable
                style={({ pressed }) => [
                  styles.sheetItem,
                  pressed && styles.sheetItemPressed
                ]}
                onPress={() => handleMarkBoarded(true)}
                disabled={
                  saving ||
                  !selected ||
                  (phase === 'go'
                    ? boardedGoSet.has(selected.student_id)
                    : boardedReturnSet.has(selected.student_id))
                }
              >
                <View style={[styles.sheetIconContainer, { backgroundColor: COLORS.infoSoft }]}>
                  <Ionicons name="person-circle" size={20} color={COLORS.info} />
                </View>
                <Text style={styles.sheetText}>
                  ผู้ปกครองมารับ {phase === 'return' ? '(นับเป็นกลับแล้ว)' : '(นับเป็นขึ้นรถ)'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </Pressable>
            )}

            {/* ลงรถ */}
            {(step === 'dropping' ||
              (phase === 'return' && selected && boardedReturnSet.has(selected.student_id))) && (
              <Pressable
                style={({ pressed }) => [
                  styles.sheetItem,
                  pressed && styles.sheetItemPressed
                ]}
                onPress={handleMarkDropped}
                disabled={
                  saving ||
                  !selected ||
                  (phase === 'go'
                    ? droppedGoSet.has(selected.student_id)
                    : droppedReturnSet.has(selected.student_id))
                }
              >
                <View style={[styles.sheetIconContainer, { backgroundColor: COLORS.warningSoft }]}>
                  <Ionicons name="log-out-outline" size={20} color={COLORS.warning} />
                </View>
                <Text style={styles.sheetText}>ลงรถแล้ว</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </Pressable>
            )}

            {/* ลา–หยุด */}
            <Pressable
              style={({ pressed }) => [
                styles.sheetItem,
                pressed && styles.sheetItemPressed
              ]}
              onPress={handleMarkAbsent}
              disabled={saving || !selected || absentSet.has(selected.student_id)}
            >
              <View style={[styles.sheetIconContainer, { backgroundColor: COLORS.dangerSoft }]}>
                <Ionicons name="close-circle" size={20} color={COLORS.danger} />
              </View>
              <Text style={styles.sheetText}>ลา–หยุด (วันนี้)</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </Pressable>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setSheetVisible(false)} disabled={saving}>
              {saving ? <ActivityIndicator /> : <Text style={styles.closeTxt}>ยกเลิก</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Alerts Drawer (placeholder) */}
      <Modal transparent visible={alertsVisible} animationType="fade" onRequestClose={() => setAlertsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.alertsSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>การแจ้งเตือน</Text>
              <Text style={styles.sheetSub}>สวิตช์ฉุกเฉิน / เซ็นเซอร์ (ยังไม่เชื่อม IoT)</Text>
            </View>

            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Ionicons name="notifications-off-outline" size={28} color="#9CA3AF" />
              <Text style={{ color: '#6B7280', marginTop: 8 }}>ยังไม่มีการแจ้งเตือน</Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setAlertsVisible(false)}>
              <Text style={styles.closeTxt}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ============================= Styles ============================= */

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.bg, 
    paddingHorizontal: isTablet ? 19.2 : 16,
    paddingTop: 16,
    maxWidth: isTablet ? 800 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  loadingWrap: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: COLORS.bg,
    gap: 12,
  },

  // Header Styles (matching HomePage)
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
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },

  // Stats Container (matching HomePage)
  statsContainer: {
    marginTop: 16,
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

  toggleContainer: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  toggleWrapper: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    ...shadow,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  toggleActive: {
    backgroundColor: COLORS.primary,
    ...shadowElevated,
  },
  togglePressed: {
    backgroundColor: COLORS.pressed,
    transform: [{ scale: 0.98 }],
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  toggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Card Styles
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: isTablet ? 16 : 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...shadow,
  },
  cardPressed: {
    backgroundColor: COLORS.pressed,
    transform: [{ scale: 0.98 }],
  },
  orderBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  orderText: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: COLORS.primary,
    letterSpacing: -0.2,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: COLORS.primary + '20',
  },
  avatarText: { 
    color: COLORS.primary, 
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: -0.3,
  },

  info: { flex: 1 },
  nameRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: 4,
  },
  name: { 
    flex: 1, 
    fontWeight: '800', 
    fontSize: 16, 
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  grade: { 
    fontSize: 12, 
    color: COLORS.textSecondary, 
    fontWeight: '600',
    backgroundColor: COLORS.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },

  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusChipText: { 
    fontSize: 12, 
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  dot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4 
  },

  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: COLORS.success + '30',
  },

  // Modal Styles
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.4)', 
    alignItems: 'center', 
    justifyContent: 'flex-end' 
  },
  modalSheet: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    ...shadowElevated,
  },
  sheetHeader: { 
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  sheetTitle: { 
    fontWeight: '800', 
    color: COLORS.text, 
    fontSize: 18,
    letterSpacing: -0.3,
  },
  sheetSub: { 
    color: COLORS.textSecondary, 
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
  },

  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetItemPressed: {
    backgroundColor: COLORS.pressed,
    transform: [{ scale: 0.98 }],
  },
  sheetIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sheetText: { 
    flex: 1,
    fontWeight: '600', 
    color: COLORS.text,
    fontSize: 15,
    letterSpacing: -0.1,
  },

  closeBtn: {
    marginTop: 16,
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgSecondary,
  },
  closeTxt: { 
    fontWeight: '700', 
    color: COLORS.textSecondary,
    fontSize: 16,
  },

  alertsSheet: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    ...shadowElevated,
  },
});