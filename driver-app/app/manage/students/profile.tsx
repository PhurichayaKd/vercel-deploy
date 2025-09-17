// app/profile.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../../src/services/supabaseClient';

type Row = {
  display_no: number;
  student_id: number;
  student_name: string;
  grade: string;
  rfid_tag: string;
  parent_name: string | null;
  parent_phone: string | null;
};

const COLORS = {
  // Background Colors
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
  primary: '#0a7ea4',
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
  
  // Legacy aliases for backward compatibility
  sub: '#64748B',
};

export default function ProfilePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchList = async (keyword?: string) => {
    setLoading(true);
    const query = supabase
      .from('v_students_list')
      .select('display_no, student_id, student_name, grade, rfid_tag, parent_name, parent_phone')
      .order('student_id', { ascending: true });

    if (keyword && keyword.trim()) {
      const k = keyword.trim();
      query.or(
        `student_name.ilike.%${k}%,grade.ilike.%${k}%,rfid_tag.ilike.%${k}%,parent_name.ilike.%${k}%,parent_phone.ilike.%${k}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      Alert.alert('โหลดข้อมูลไม่สำเร็จ', error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchList(); }, []);

  // debounce search
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchList(q), 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchList(q);
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Row }) => (
    <TouchableOpacity
      style={styles.cardRow}
      onPress={() => router.push({ pathname: '/manage/students/form', params: { id: String(item.student_id) } } as any)}
      activeOpacity={0.9}
    >
      {/* left: no. badge */}
      <View style={styles.noBadge}>
        <Text style={styles.noBadgeTxt}>{item.display_no}</Text>
      </View>

      {/* center: main content */}
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.student_name}</Text>

        <View style={styles.metaRow}>
          <View style={styles.pill}>
            <Ionicons name="school-outline" size={12} color={COLORS.text} />
            <Text style={styles.pillTxt}>{item.grade}</Text>
          </View>
          {item.rfid_tag && (
            <View style={styles.pill}>
              <Ionicons name="card-outline" size={12} color={COLORS.text} />
              <Text style={styles.pillTxt}>{item.rfid_tag}</Text>
            </View>
          )}
        </View>

        {item.parent_name && (
          <Text style={styles.parentLine} numberOfLines={1}>
            ผู้ปกครอง: {item.parent_name} {item.parent_phone && `(${item.parent_phone})`}
          </Text>
        )}
      </View>

      {/* right: arrow */}
      <Ionicons name="chevron-forward" size={18} color={COLORS.sub} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.screen}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>ข้อมูลนักเรียน</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/manage/students/form')}
        >
          <Ionicons name="person-add-outline" size={18} color="#fff" />
          <Text style={styles.addBtnTxt}>เพิ่มนักเรียน</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.sub} />
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder="ค้นหาชื่อ, ชั้น, บัตร, ผู้ปกครอง..."
          placeholderTextColor={COLORS.sub}
        />
      </View>

      {/* List */}
      {loading && !refreshing ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 8, color: COLORS.sub }}>กำลังโหลด...</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.student_id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="people-outline" size={48} color={COLORS.sub} />
              <Text style={{ marginTop: 12, color: COLORS.sub, fontSize: 16 }}>ไม่พบข้อมูล</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

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
  screen: { 
    flex: 1, 
    backgroundColor: COLORS.bg 
  },

  topBar: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: isTablet ? 24 : 16,
    paddingTop: Platform.select({ ios: 16, android: 14 }),
    paddingBottom: 14,
    borderBottomWidth: 1, 
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.card,
    ...shadow,
  },
  iconBtn: {
    width: 40, 
    height: 40, 
    borderRadius: 12,
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  addBtn: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    backgroundColor: COLORS.primary, 
    paddingHorizontal: 16, 
    height: 42, 
    borderRadius: 12,
    ...shadow,
  },
  addBtnTxt: { 
    color: '#fff', 
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  searchWrap: {
    marginTop: 12, 
    marginHorizontal: isTablet ? 24 : 16,
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
    borderWidth: 1, 
    borderColor: COLORS.border, 
    borderRadius: 16,
    paddingHorizontal: 16, 
    height: 48, 
    backgroundColor: COLORS.card,
    ...shadow,
  },
  searchInput: { 
    flex: 1, 
    paddingVertical: 0, 
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },

  cardRow: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1, 
    borderColor: COLORS.border,
    paddingHorizontal: 16, 
    paddingVertical: 16,
    marginTop: 12,
    ...shadow,
  },
  noBadge: {
    width: 32, 
    height: 32, 
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary + '20',
  },
  noBadgeTxt: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: COLORS.primary,
    letterSpacing: 0.1,
  },

  name: { 
    fontWeight: '800', 
    color: COLORS.text, 
    fontSize: 16,
    letterSpacing: -0.2,
    lineHeight: 20,
  },

  metaRow: { 
    flexDirection: 'row', 
    gap: 8, 
    marginTop: 8 
  },
  pill: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    borderWidth: 1, 
    borderColor: COLORS.borderLight, 
    borderRadius: 9999,
    paddingHorizontal: 10, 
    height: 28, 
    backgroundColor: COLORS.bgSecondary,
  },
  pillTxt: { 
    fontSize: 12, 
    color: COLORS.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  parentLine: { 
    color: COLORS.textTertiary, 
    fontSize: 13, 
    lineHeight: 18,
    marginTop: 4,
    fontWeight: '500',
  },
});