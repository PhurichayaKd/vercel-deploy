import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/services/supabaseClient';

type StudentLite = {
  student_id: number;
  student_name: string;
  grade: string;
  rfid_tag: string | null; // ถ้าคุณลบคอลัมน์นี้ออกแล้ว ไม่เป็นไร ใช้แค่โชว์ใน picker
};

type CurrentAssign = {
  card_id: number;
  rfid_code: string;
  is_active: boolean;
  valid_from: string;
  valid_to: string | null;
};

type AvailableCard = {
  card_id: number;
  rfid_code: string;
};

type Reason = 'lost' | 'damaged' | 'returned';

export default function IssueCardScreen() {
  const router = useRouter();

  const [driverId, setDriverId] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [keyword, setKeyword] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [selected, setSelected] = useState<StudentLite | null>(null);
  const [current, setCurrent] = useState<CurrentAssign | null>(null);

  const [cards, setCards] = useState<AvailableCard[]>([]);
  const [cardKeyword, setCardKeyword] = useState('');
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [newCard, setNewCard] = useState<AvailableCard | null>(null);

  const [reason, setReason] = useState<Reason>('lost');

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [confirmOpen, setConfirmOpen] = useState(false);

  /* -------- auth → driver_id -------- */
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) throw new Error('ยังไม่ได้ล็อกอิน');

        const { data, error } = await supabase
          .from('driver_bus')
          .select('driver_id')
          .eq('auth_user_id', uid)
          .maybeSingle();

        if (error) throw error;
        if (!data?.driver_id) throw new Error('ไม่พบ driver_id ของผู้ใช้นี้ (ยังไม่ได้ผูกกับ driver_bus)');
        setDriverId(data.driver_id);
      } catch (e: any) {
        Alert.alert('แจ้งเตือน', e?.message || 'ดึง driver_id ไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* -------- โหลดรายชื่อนักเรียน -------- */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('students')
        .select('student_id, student_name, grade, rfid_tag')
        .order('student_id', { ascending: true });

      if (error) {
        Alert.alert('โหลดรายชื่อไม่สำเร็จ', error.message);
        return;
      }
      setStudents((data || []) as StudentLite[]);
    })();
  }, []);

  /* -------- โหลดบัตรว่าง -------- */
  const loadAvailableCards = async () => {
    // 1) พยายามใช้ view v_available_cards ถ้ามี
    const tryView = await supabase
      .from('v_available_cards')
      .select('card_id, rfid_code')
      .order('rfid_code', { ascending: true });

    if (!tryView.error && tryView.data) {
      setCards(tryView.data as AvailableCard[]);
      return;
    }

    // 2) fallback: query จากตาราง (กรณีไม่มี view)
    // ดึง card_ids ที่ถูก assign แบบ active อยู่
    const activeRes = await supabase
      .from('rfid_card_assignments')
      .select('card_id')
      .is('valid_to', null);

    if (activeRes.error) {
      // ถ้าดึงไม่ได้ ให้ปิดลิสต์ (อาจยังไม่ได้สร้างตาราง/นโยบาย)
      setCards([]);
      return;
    }
    const assignedIds = (activeRes.data || []).map((r: any) => r.card_id) as number[];

    // ดึง rfid_cards ที่ไม่อยู่ใน assignedIds + is_active=true + (status='available' หรือไม่มีคอลัมน์นี้)
    let query = supabase
      .from('rfid_cards')
      .select('card_id, rfid_code, is_active, status')
      .eq('is_active', true)
      .order('rfid_code', { ascending: true }) as any;

    if (assignedIds.length > 0) {
      query = query.not('card_id', 'in', `(${assignedIds.join(',')})`);
    }

    const res = await query;
    if (res.error) {
      setCards([]);
      return;
    }
    const rows = (res.data || []) as any[];
    // กรอง status ถ้ามีคอลัมน์
    const filtered = rows.filter((r) => !r.status || r.status === 'available');
    setCards(filtered.map((r) => ({ card_id: r.card_id, rfid_code: r.rfid_code })));
  };

  useEffect(() => {
    loadAvailableCards();
  }, []);

  /* -------- เมื่อเลือกนักเรียน: โหลดบัตรล่าสุด -------- */
  const fetchCurrentCard = async (sid: number) => {
    const { data, error } = await supabase
      .from('rfid_card_assignments')
      .select(`
        card_id,
        valid_from,
        valid_to,
        rfid:rfid_cards!inner ( card_id, rfid_code, is_active )
      `)
      .eq('student_id', sid)
      .order('valid_from', { ascending: false })
      .limit(1);

    if (error) {
      Alert.alert('โหลดบัตรไม่สำเร็จ', error.message);
      setCurrent(null);
      return;
    }

    if (data && data.length > 0) {
      const row: any = data[0];
      setCurrent({
        card_id: row.rfid.card_id,
        rfid_code: row.rfid.rfid_code,
        is_active: row.rfid.is_active,
        valid_from: row.valid_from,
        valid_to: row.valid_to,
      });
    } else {
      setCurrent(null);
    }
  };

  const onPickStudent = (s: StudentLite) => {
    setSelected(s);
    setPickerOpen(false);
    setNewCard(null);
    fetchCurrentCard(s.student_id);
  };

  /* -------- ยืนยัน & ออกบัตร -------- */
  const askConfirm = () => {
    if (!selected) {
      Alert.alert('กรอกข้อมูลไม่ครบ', 'กรุณาเลือกนักเรียน');
      return;
    }
    if (!newCard) {
      Alert.alert('กรอกข้อมูลไม่ครบ', 'กรุณาเลือกบัตรใหม่');
      return;
    }
    setConfirmOpen(true);
  };

  const issueNewCard = async () => {
    if (!selected || !newCard || !driverId) return;
    setSaving(true);
    try {
      // เรียก RPC ที่ทำธุรกรรมฝั่ง DB (ปลอดภัยกว่าทำหลายคำสั่งจาก client)
      const { data, error } = await supabase.rpc('fn_issue_card', {
        p_student_id: selected.student_id,
        p_new_rfid_code: newCard.rfid_code,
        p_assigned_by: driverId,
        p_old_card_action: reason, // 'lost' | 'damaged' | 'returned'
      });

      if (error) throw error;
      if (data !== 'ISSUED_OK') {
        // คืนค่าข้อความอื่น ๆ จากฟังก์ชัน เช่น NEW_CARD_ALREADY_ASSIGNED
        throw new Error(String(data || 'เกิดข้อผิดพลาด'));
      }

      await fetchCurrentCard(selected.student_id);
      await loadAvailableCards();
      setNewCard(null);
      setConfirmOpen(false);
      Alert.alert('สำเร็จ', 'ออกบัตรใหม่เรียบร้อย');
    } catch (e: any) {
      Alert.alert('เกิดข้อผิดพลาด', e?.message || 'ออกบัตรไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  /* -------- filter รายชื่อนักเรียน / บัตร -------- */
  const filteredStudents = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return students;
    return students.filter(
      (s) =>
        s.student_name.toLowerCase().includes(k) ||
        String(s.student_id).includes(k) ||
        (s.grade || '').toLowerCase().includes(k)
    );
  }, [students, keyword]);

  const filteredCards = useMemo(() => {
    const k = cardKeyword.trim().toLowerCase();
    if (!k) return cards;
    return cards.filter((c) => c.rfid_code.toLowerCase().includes(k));
  }, [cards, cardKeyword]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: '#6B7280' }}>กำลังโหลด...</Text>
      </View>
    );
  }

  const canSubmit = !!selected && !!newCard && !saving;

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>ออกบัตร RFID</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.body}>
        {/* เลือกนักเรียน */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>เลือกนักเรียน</Text>
          <Text style={styles.label}>นักเรียน</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setPickerOpen(true)}>
            <Ionicons name="person-circle-outline" size={18} color="#111827" />
            <Text style={styles.selectorTxt}>
              {selected ? `${selected.student_name} · ${selected.grade}` : 'แตะเพื่อเลือกนักเรียน'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* บัตรปัจจุบัน */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.cardTitle}>บัตรปัจจุบัน</Text>
          {selected ? (
            current ? (
              <View style={{ gap: 6 }}>
                <Text style={styles.rowTxt}>
                  รหัส: <Text style={styles.mono}>{current.rfid_code}</Text>
                </Text>
                <Text style={styles.rowTxt}>สถานะ: {current.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}</Text>
                <Text style={styles.hint}>เมื่อออกบัตรใหม่ ระบบจะยุติการใช้งานบัตรเดิมโดยอัตโนมัติ</Text>
              </View>
            ) : (
              <Text style={styles.hint}>ยังไม่มีบัตรที่ผูกกับนักเรียนคนนี้</Text>
            )
          ) : (
            <Text style={styles.hint}>กรุณาเลือกนักเรียนก่อน</Text>
          )}
        </View>

        {/* เลือกบัตรใหม่ */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.cardTitle}>เลือกบัตรใหม่</Text>
          <Text style={styles.label}>RFID Code (ยังไม่มีเจ้าของ)</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setCardPickerOpen(true)}
            disabled={!selected}
          >
            <Ionicons name="card-outline" size={18} color="#111827" />
            <Text style={styles.selectorTxt}>
              {newCard ? newCard.rfid_code : selected ? 'แตะเพื่อเลือกบัตร' : 'เลือกนักเรียนก่อน'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            ถ้าไม่มีรายการ แสดงว่ายังไม่มีบัตรว่างในระบบ (รอ IoT สแกน/เพิ่มบัตรเข้าคลัง)
          </Text>
        </View>

        {/* สาเหตุการออกบัตรใหม่ */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.cardTitle}>สาเหตุ</Text>
          <View style={styles.reasonRow}>
            {(['lost', 'damaged', 'returned'] as Reason[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.reasonPill, reason === r && styles.reasonPillActive]}
                onPress={() => setReason(r)}
              >
                <Text style={[styles.reasonTxt, reason === r && styles.reasonTxtActive]}>
                  {r === 'lost' ? 'สูญหาย' : r === 'damaged' ? 'ชำรุด' : 'คืนบัตรเดิม'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ปุ่มบันทึก */}
        <TouchableOpacity
          style={[styles.actionBtn, !canSubmit && { opacity: 0.5 }]}
          disabled={!canSubmit}
          onPress={askConfirm}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.actionTxt}>บันทึก</Text>
            </>
          )}
        </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Student picker */}
      <Modal transparent visible={pickerOpen} animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.pickerSheet}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="search" size={18} color="#111827" />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 8 }]}
                placeholder="ค้นหา ชื่อ/ชั้น/รหัส"
                placeholderTextColor="#9CA3AF"
                value={keyword || ''}
                onChangeText={setKeyword}
              />
            </View>

            <FlatList
              data={filteredStudents}
              keyExtractor={(it) => String(it.student_id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickItem} onPress={() => onPickStudent(item)}>
                  <View style={styles.badge}><Text style={styles.badgeTxt}>{item.student_id}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: '#0F172A' }} numberOfLines={1}>
                      {item.student_name}
                    </Text>
                    <Text style={{ color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                      {item.grade}  {item.rfid_tag ? `• RFID ปัจจุบัน: ${item.rfid_tag}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', padding: 20 }}>
                  <Ionicons name="people-outline" size={28} color="#9CA3AF" />
                  <Text style={{ color: '#6B7280', marginTop: 8 }}>ไม่พบนักเรียน</Text>
                </View>
              }
            />

            <TouchableOpacity style={styles.closeBtn} onPress={() => setPickerOpen(false)}>
              <Text style={styles.closeTxt}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Card picker */}
      <Modal transparent visible={cardPickerOpen} animationType="fade" onRequestClose={() => setCardPickerOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.pickerSheet}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="search" size={18} color="#111827" />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 8 }]}
                placeholder="ค้นหาจากรหัสบัตร"
                placeholderTextColor="#9CA3AF"
                value={cardKeyword || ''}
                onChangeText={setCardKeyword}
              />
            </View>

            <FlatList
              data={filteredCards}
              keyExtractor={(it) => String(it.card_id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickItem}
                  onPress={() => {
                    setNewCard(item);
                    setCardPickerOpen(false);
                  }}
                >
                  <Ionicons name="card-outline" size={18} color="#0F172A" />
                  <Text style={{ fontWeight: '800', color: '#0F172A', marginLeft: 8 }}>{item.rfid_code}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', padding: 20 }}>
                  <Ionicons name="alert-circle-outline" size={28} color="#9CA3AF" />
                  <Text style={{ color: '#6B7280', marginTop: 8 }}>ยังไม่มีบัตรว่างในระบบ</Text>
                </View>
              }
            />

            <TouchableOpacity style={styles.closeBtn} onPress={() => setCardPickerOpen(false)}>
              <Text style={styles.closeTxt}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm dialog */}
      <Modal transparent visible={confirmOpen} animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.backdropCenter}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>ยืนยันการออกบัตรใหม่</Text>
            <View style={{ gap: 6, marginTop: 6 }}>
              <Text style={styles.rowTxt}>
                นักเรียน: <Text style={{ fontWeight: '800' }}>{selected?.student_name || '-'}</Text>
              </Text>
              <Text style={styles.rowTxt}>
                บัตรเดิม: <Text style={styles.mono}>{current?.rfid_code || '-'}</Text>
              </Text>
              <Text style={styles.rowTxt}>
                บัตรใหม่: <Text style={styles.mono}>{newCard?.rfid_code || '-'}</Text>
              </Text>
              <Text style={styles.rowTxt}>
                สาเหตุ: {reason === 'lost' ? 'สูญหาย' : reason === 'damaged' ? 'ชำรุด' : 'คืนบัตรเดิม'}
              </Text>
              <Text style={styles.hint}>เมื่อยืนยัน ระบบจะยุติการใช้งานบัตรเดิมและผูกบัตรใหม่ให้อัตโนมัติ</Text>
            </View>

            <View style={styles.confirmRow}>
              <TouchableOpacity style={[styles.cancelBtn]} onPress={() => setConfirmOpen(false)}>
                <Text style={[styles.cancelTxt]}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn]} onPress={issueNewCard} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmTxt}>ยืนยัน</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ============================== Styles ============================== */
// ใช้ธีมเดียวกับหน้า Home
const COLORS = {
  // Background colors
  bg: '#F8FAFC',
  bgSecondary: '#F1F5F9',
  card: '#FFFFFF',
  
  // Text colors
  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  
  // Border colors
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  
  // Primary colors
  primary: '#3B82F6',
  primarySoft: '#EFF6FF',
  
  // Status colors
  success: '#10B981',
  successSoft: '#ECFDF5',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  
  // Interactive colors
  hover: '#F8FAFC',
  
  // Legacy colors for compatibility
  sub: '#64748B',
  dark: '#1E293B',
  red: '#EF4444',
  green: '#10B981',
};

// Shadow styles ตามหน้า Home
const shadow = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 3,
  elevation: 1,
};

const shadowElevated = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 12,
  elevation: 4,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },

  topBar: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16, 
    paddingTop: Platform.select({ ios: 12, android: 10 }), 
    paddingBottom: 16,
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.borderLight, 
    backgroundColor: COLORS.card,
    ...shadow,
  },
  iconBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 12,
    backgroundColor: COLORS.bgSecondary,
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  topTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: COLORS.text,
    letterSpacing: -0.3,
  },

  body: { padding: 16 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...shadow,
  },
  cardTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 12, 
    color: COLORS.text,
    letterSpacing: -0.2,
  },

  label: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: COLORS.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 8, 
    marginBottom: 8 
  },

  selector: {
    height: 48, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    backgroundColor: COLORS.card, 
    paddingHorizontal: 16, 
    alignItems: 'center', 
    flexDirection: 'row', 
    gap: 12,
    ...shadow,
  },
  selectorTxt: { 
    color: COLORS.text, 
    fontWeight: '600',
    fontSize: 15,
    flex: 1,
  },

  rowTxt: { color: COLORS.text },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), letterSpacing: 0.5 },
  hint: { color: COLORS.sub },

  input: {
    height: 48, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    backgroundColor: COLORS.card, 
    paddingHorizontal: 16, 
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
    ...shadow,
  },

  actionBtn: {
    marginTop: 20, 
    height: 52, 
    borderRadius: 16, 
    backgroundColor: COLORS.primary,
    alignItems: 'center', 
    justifyContent: 'center', 
    flexDirection: 'row', 
    gap: 8,
    ...shadowElevated,
  },
  actionTxt: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.1,
  },

  /* picker common */
  backdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.4)', 
    alignItems: 'center', 
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  pickerSheet: {
    width: '100%', 
    maxHeight: '80%', 
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24, 
    gap: 8,
    ...shadowElevated,
  },
  pickItem: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 14, 
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  badge: {
    width: 32, 
    height: 32, 
    borderRadius: 10, 
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  badgeTxt: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: COLORS.primary 
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

  /* confirm dialog */
  backdropCenter: { 
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.4)', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  confirmCard: {
    width: '100%', 
    backgroundColor: COLORS.card, 
    borderRadius: 20, 
    padding: 24,
    borderWidth: 1, 
    borderColor: COLORS.border,
    ...shadowElevated,
  },
  confirmTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: COLORS.text,
    letterSpacing: -0.2,
    marginBottom: 16,
  },
  confirmRow: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: 12, 
    marginTop: 20 
  },
  cancelBtn: { 
    height: 48, 
    paddingHorizontal: 20, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    backgroundColor: COLORS.bgSecondary,
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  cancelTxt: { 
    fontWeight: '600', 
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  confirmBtn: { 
    height: 48, 
    paddingHorizontal: 20, 
    borderRadius: 12, 
    backgroundColor: COLORS.primary, 
    alignItems: 'center', 
    justifyContent: 'center',
    ...shadow,
  },
  confirmTxt: { 
    fontWeight: '700', 
    color: '#fff',
    fontSize: 15,
    letterSpacing: 0.1,
  },

  /* reason */
  reasonRow: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 12, 
    flexWrap: 'wrap' 
  },
  reasonPill: {
    paddingHorizontal: 16, 
    height: 40, 
    borderRadius: 20,
    borderWidth: 1, 
    borderColor: COLORS.border, 
    backgroundColor: COLORS.bgSecondary,
    alignItems: 'center', 
    justifyContent: 'center',
    ...shadow,
  },
  reasonPillActive: { 
    backgroundColor: COLORS.primary, 
    borderColor: COLORS.primary,
    transform: [{ scale: 1.02 }],
  },
  reasonTxt: { 
    color: COLORS.text, 
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.1,
  },
  reasonTxtActive: { 
    color: '#fff',
    fontWeight: '700',
  },
});
