// app/manage/students/form.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams, Href } from 'expo-router';
import { supabase } from '../../../src/services/supabaseClient';

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
};

/* ---------------------- in-file lightweight draft store --------------------- */
type GuardianDraft = {
  parent_id?: number | null;   // undefined/null = รายการใหม่
  name: string;
  phone: string;
  line?: string;
  relationship?: string;
  is_primary?: boolean;
};
type Draft = {
  studentName: string;
  grade: string;
  studentPhone: string;
  studentLine: string;
  rfidCardId: number | null;
  rfidCode: string;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD
  lat: number | null;
  lng: number | null;
  guardians: GuardianDraft[];
};
let __draft: Draft | null = null;
const getDraft = () => __draft;
const setDraft = (patch: Partial<Draft>) => {
  __draft = {
    ...(__draft ?? {
      studentName: '', grade: '', studentPhone: '', studentLine: '',
      rfidCardId: null, rfidCode: '',
      startDate: null, endDate: null, lat: null, lng: null,
      guardians: [{ name: '', phone: '', line: '', relationship: '', is_primary: true }],
    }),
    ...patch
  };
};
const clearDraft = () => { __draft = null; };
/* --------------------------------------------------------------------------- */

type StudentRow = {
  student_id: number;
  student_name: string;
  grade: string;
  student_phone?: string | null;
  // student_line_id ถูกย้ายไปยัง student_line_links table แล้ว
  rfid_tag?: string | null; // legacy
  parent_id: number | null;
  start_date: string | null;
  end_date: string | null;
  home_latitude: number | string | null;
  home_longitude: number | string | null;
  status: 'active' | 'inactive' | null;
};

type RfidCard = { card_id: number; rfid_code: string };

const formatLocalDate = (d: Date | null) => {
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const toNumberOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

export default function StudentFormScreen() {
  const { id, lat: qLat, lng: qLng, field } =
    useLocalSearchParams<{ id?: string; lat?: string | string[]; lng?: string | string[]; field?: string }>();
  const isEdit = !!id;
  const didPreload = useRef(false);

  // นักเรียน
  const [studentName, setStudentName] = useState('');
  const [grade, setGrade] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentLine, setStudentLine] = useState('');

  // RFID
  const [rfidCardId, setRfidCardId] = useState<number | null>(null);
  const [rfidCode, setRfidCode] = useState('');

  // ผู้ปกครอง
  const [guardians, setGuardians] = useState<GuardianDraft[]>(
    [{ name: '', phone: '', line: '', relationship: '', is_primary: true }],
  );

  // วันที่
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // พิกัด
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // สถานะ
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // บัตรว่าง
  const [availableCards, setAvailableCards] = useState<RfidCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  /* -------------- helpers for readonly TextInput on Android -------------- */
  const ro = (enabled: boolean) =>
    Platform.select<any>({
      android: { editable: enabled, focusable: enabled, selectTextOnFocus: enabled },
      default: { editable: enabled, selectTextOnFocus: enabled },
    });
  const readOnlyBg = { backgroundColor: '#F3F4F6' };
  const readOnlyBorder = { borderColor: '#E5E7EB' };
  /* ----------------------------------------------------------------------- */

  /* ---------------- preload draft ---------------- */
  useEffect(() => {
    if (didPreload.current) return;
    const d = getDraft();
    if (d) {
      setStudentName(d.studentName);
      setGrade(d.grade);
      setStudentPhone(d.studentPhone);
      setStudentLine(d.studentLine);
      setRfidCardId(d.rfidCardId ?? null);
      setRfidCode(d.rfidCode ?? '');
      setStartDate(d.startDate ? new Date(d.startDate) : null);
      setEndDate(d.endDate ? new Date(d.endDate) : null);
      setLat(d.lat);
      setLng(d.lng);
      setGuardians(d.guardians?.length ? d.guardians : [{ name: '', phone: '', line: '', relationship: '', is_primary: true }]);
    }
    didPreload.current = true;
  }, []);
  /* ------------------------------------------------- */

  // studentLine variable removed - no longer stored in database

  // พิกัดกลับจากแผนที่
  useEffect(() => {
    const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
    const latStr = one(qLat); const lngStr = one(qLng);
    if (latStr && lngStr) {
      const nLat = Number(latStr); const nLng = Number(lngStr);
      if (!Number.isNaN(nLat) && !Number.isNaN(nLng)) {
        setLat(nLat); setLng(nLng); setDraft({ lat: nLat, lng: nLng });
      }
    }
  }, [qLat, qLng, field]);

  // บัตรว่าง (เฉพาะโหมดเพิ่ม)
  useEffect(() => {
    if (isEdit) return;
    let alive = true;
    (async () => {
      setLoadingCards(true);
      const { data, error } = await supabase.from('v_available_rfid_cards').select('card_id, rfid_code');
      if (!error && data) {
        if (alive) setAvailableCards(data as any);
      } else {
        const { data: cards } = await supabase
          .from('rfid_cards').select('card_id, rfid_code, status, is_active');
        const { data: opens } = await supabase
          .from('rfid_card_assignments').select('card_id').is('valid_to', null);
        const busy = new Set((opens || []).map((r: any) => r.card_id));
        const free = (cards || [])
          .filter((c: any) => c.is_active && c.status === 'available' && !busy.has(c.card_id))
          .map((c: any) => ({ card_id: c.card_id, rfid_code: c.rfid_code }));
        if (alive) setAvailableCards(free);
      }
      setLoadingCards(false);
    })();
    return () => { alive = false; };
  }, [isEdit]);

  // โหลดข้อมูล (โหมดแก้ไข)
  useEffect(() => {
    if (!isEdit) return;
    let alive = true;
    (async () => {
      try {
        // นักเรียน
        const { data: stu, error: stuErr } = await supabase
          .from('students')
          .select(`
            *,
            student_line_links!inner(line_user_id, active)
          `)
          .eq('student_id', Number(id))
          .eq('student_line_links.active', true)
          .maybeSingle();
        if (stuErr) throw stuErr;
        if (!alive || !stu) return;
        const s = stu as StudentRow;

        setStudentName(s.student_name ?? '');
        setGrade(s.grade ?? '');
        setStudentPhone(s.student_phone ?? '');
        const lineLinks = (s as any).student_line_links;
        const lineUserId = Array.isArray(lineLinks) ? lineLinks[0]?.line_user_id : lineLinks?.line_user_id;
        setStudentLine(lineUserId ?? '');
        setStartDate(s.start_date ? new Date(s.start_date) : null);
        setEndDate(s.end_date ? new Date(s.end_date) : null);
        setLat(toNumberOrNull(s.home_latitude));
        setLng(toNumberOrNull(s.home_longitude));

        // RFID ปัจจุบัน
        const { data: asg } = await supabase
          .from('rfid_card_assignments')
          .select('card_id, valid_to, rfid_cards:card_id(rfid_code)')
          .eq('student_id', Number(id))
          .is('valid_to', null)
          .maybeSingle();
        let resolvedRfidCardId: number | null = null;
        let resolvedRfidCode = '';
        if (asg) {
          resolvedRfidCardId = (asg as any).card_id ?? null;
          const nest: any = (asg as any).rfid_cards;
          resolvedRfidCode = (Array.isArray(nest) ? nest?.[0]?.rfid_code : nest?.rfid_code) ?? '';
        } else {
          resolvedRfidCode = (s as any).rfid_tag ?? '';
        }
        setRfidCardId(resolvedRfidCardId);
        setRfidCode(resolvedRfidCode);

        // ผู้ปกครองทั้งหมด
        const { data: guardianRows, error: guardianErr } = await supabase
          .from('student_guardians')
          .select(`
            parent_id,
            relationship,
            is_primary,
            parents:parent_id(
              parent_name, 
              parent_phone,
              parent_line_links(line_user_id, active)
            )
          `)
          .eq('student_id', Number(id));

        let gList: GuardianDraft[] = [];
        if (guardianRows?.length) {
          gList = guardianRows.map((row: any) => {
            const p = Array.isArray(row.parents) ? row.parents[0] : row.parents; // เคส array/object
            const parentLinks = p?.parent_line_links;
            const activeLink = Array.isArray(parentLinks) 
              ? parentLinks.find((link: any) => link.active)
              : parentLinks?.active ? parentLinks : null;
            return {
              parent_id: row.parent_id,
              name: p?.parent_name ?? '',
              phone: p?.parent_phone ?? '',
              line: activeLink?.line_user_id ?? '',
              relationship: row.relationship ?? '',
              is_primary: !!row.is_primary,
            };
          });

          // fallback: ถ้ายังไม่มีข้อมูล parent จาก join (อาจโดน RLS)
          const missingIds = gList.filter(g => !g.name && g.parent_id).map(g => g.parent_id!) as number[];
          if (missingIds.length) {
            const { data: parentsRows } = await supabase
              .from('parents')
              .select(`
                parent_id,
                parent_name,
                parent_phone,
                parent_line_links!inner(
                  line_user_id
                )
              `)
              .eq('parent_line_links.active', true)
              .in('parent_id', missingIds);
            if (parentsRows?.length) {
              const map = new Map<number, any>(parentsRows.map((r: any) => [r.parent_id, r]));
              gList = gList.map(g => {
                if (!g.name && g.parent_id && map.has(g.parent_id)) {
                  const p = map.get(g.parent_id);
                  const lineId = p.parent_line_links?.[0]?.line_user_id ?? '';
                  return { ...g, name: p.parent_name ?? '', phone: p.parent_phone ?? '', line: lineId };
                }
                return g;
              });
            }
          }

          // ให้ primary ขึ้นก่อน
          gList.sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
        } else 
          {
          gList = [{ name: '', phone: '', line: '', relationship: '', is_primary: true }];
        }
        setGuardians(gList);

        // เซ็ต draft ด้วย
        setDraft({
          studentName: s.student_name ?? '',
          grade: s.grade ?? '',
          studentPhone: s.student_phone ?? '',
          rfidCardId: resolvedRfidCardId,
          rfidCode: resolvedRfidCode,
          startDate: s.start_date ?? null,
          endDate: s.end_date ?? null,
          lat: toNumberOrNull(s.home_latitude),
          lng: toNumberOrNull(s.home_longitude),
          guardians: gList,
        });
      } catch (e: any) {
        Alert.alert('ดึงข้อมูลไม่สำเร็จ', e?.message ?? 'เกิดข้อผิดพลาด');
      }
    })();
    return () => { alive = false; };
  }, [id, isEdit]);

  /* ----------------------- guardians: handlers ------------------------ */
  const setGuardianAt = (idx: number, patch: Partial<GuardianDraft>) => {
    setGuardians(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      setDraft({ guardians: next });
      return next;
    });
  };

  const addGuardian = () => {
    setGuardians(prev => {
      const next = [
        ...prev,
        { name: '', phone: '', line: '', relationship: '', is_primary: prev.length === 0 },
      ];
      setDraft({ guardians: next });
      return next;
    });
  };

  const markPrimary = (idx: number) => {
    setGuardians(prev => {
      const next = prev.map((g, i) => ({ ...g, is_primary: i === idx }));
      setDraft({ guardians: next });
      return next;
    });
  };
  /* -------------------------------------------------------------------- */

  // สร้าง parent สำหรับ guardian ใหม่เท่านั้น
  const createParentsForNewGuardians = async (items: GuardianDraft[]): Promise<number[]> => {
    const newIds: number[] = [];
    for (const g of items) {
      const name = g.name?.trim();
      const phone = g.phone?.trim();
      const line = g.line?.trim();
      if (!phone || !line) { throw new Error('กรอกเบอร์และ LINE ของผู้ปกครองให้ครบ'); }
      const { data, error } = await supabase
        .from('parents')
        .insert({
          parent_name: name || 'ไม่ระบุชื่อ',
          parent_phone: phone,
        })
        .select('parent_id')
        .single();
      if (error) throw error;
      
      // Insert LINE ID into parent_line_links
      if (line) {
        const { error: linkError } = await supabase
          .from('parent_line_links')
          .insert({
            parent_id: data.parent_id,
            line_user_id: line,
            active: true
          });
        if (linkError) throw linkError;
      }
      
      newIds.push(data.parent_id as number);
    }
    return newIds;
  };

  // โหมดเพิ่ม: สร้าง/อัปเดต parent และลิงก์
  const upsertParentsForGuardians = async (items: GuardianDraft[]): Promise<number[]> => {
    const ids: number[] = [];
    for (const g of items) {
      const name = g.name?.trim();
      const phone = g.phone?.trim();
      const line = g.line?.trim();
      if (g.parent_id) {
        const { error } = await supabase
          .from('parents')
          .update({
            parent_name: name || 'ไม่ระบุชื่อ',
            parent_phone: phone || null,
          })
          .eq('parent_id', g.parent_id);
        if (error) throw error;
        
        // Manage LINE ID in parent_line_links
        if (line) {
          // Deactivate old links
          await supabase
            .from('parent_line_links')
            .update({ active: false })
            .eq('parent_id', g.parent_id);
          
          // Insert/update new link
          const { error: linkError } = await supabase
            .from('parent_line_links')
            .upsert({
              parent_id: g.parent_id,
              line_user_id: line,
              active: true
            });
          if (linkError) throw linkError;
        } else {
          // Deactivate all links if no LINE ID
          await supabase
            .from('parent_line_links')
            .update({ active: false })
            .eq('parent_id', g.parent_id);
        }
        
        ids.push(g.parent_id);
      } else {
        if (!phone || !line) { throw new Error('กรอกเบอร์และ LINE ของผู้ปกครองให้ครบ'); }
        const { data, error } = await supabase
          .from('parents')
          .insert({
            parent_name: name || 'ไม่ระบุชื่อ',
            parent_phone: phone,
          })
          .select('parent_id')
          .single();
        if (error) throw error;
        
        // Insert LINE ID into parent_line_links
        if (line) {
          const { error: linkError } = await supabase
            .from('parent_line_links')
            .insert({
              parent_id: data.parent_id,
              line_user_id: line,
              active: true
            });
          if (linkError) throw linkError;
        }
        
        ids.push(data.parent_id as number);
      }
    }
    return ids;
  };

  // อัปเดตเฉพาะโทรของ parent เดิม + อัปเดต primary ในตาราง link
  const updateExistingGuardians = async (studentId: number, items: GuardianDraft[]) => {
    for (const g of items.filter(x => !!x.parent_id)) {
      const phone = g.phone?.trim();
      if (!phone) throw new Error('กรอกเบอร์ผู้ปกครองให้ครบ');
      const { error: pErr } = await supabase
        .from('parents')
        .update({ parent_phone: phone })
        .eq('parent_id', g.parent_id!);
      if (pErr) throw pErr;

      const { error: linkErr } = await supabase
        .from('student_guardians')
        .update({ is_primary: !!g.is_primary })
        .eq('student_id', studentId)
        .eq('parent_id', g.parent_id!);
      if (linkErr) throw linkErr;
    }
  };

  // แทรกผู้ปกครองใหม่ + ลิงก์
  const insertNewGuardianLinks = async (studentId: number, items: GuardianDraft[]) => {
    const news = items.filter(x => !x.parent_id && (x.phone?.trim() && x.line?.trim()));
    if (!news.length) return;
    const newIds = await createParentsForNewGuardians(news);
    const rows = news.map((g, i) => ({
      student_id: studentId,
      parent_id: newIds[i],
      relationship: g.relationship?.trim() || null,
      is_primary: !!g.is_primary,
    }));
    if (rows.length) {
      const { error } = await supabase.from('student_guardians').insert(rows);
      if (error) throw error;
    }
  };

  const ensureExactlyOnePrimary = (items: GuardianDraft[]) =>
    items.filter(g => !!g.is_primary).length === 1;

  const validateRequired = () => {
    // ชื่อ/ชั้น บังคับ (เฉพาะหน้าเพิ่ม — หน้าแก้ไขล็อกไว้)
    if (!isEdit && (!studentName.trim() || !grade.trim())) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรอกชื่อ-นามสกุล และชั้นของนักเรียน');
      return false;
    }

    // เบอร์นักเรียน (เพิ่ม/แก้ไข) — บังคับ
    if (!studentPhone.trim()) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรอกเบอร์โทรของนักเรียน');
      return false;
    }
    
    // LINE ID ของนักเรียน (เพิ่ม/แก้ไข) — บังคับ
    if (!studentLine.trim()) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรอก LINE ID ของนักเรียน');
      return false;
    }

    if (!startDate || !endDate) {
      Alert.alert('กรอกวันที่ไม่ครบ', 'กรุณาเลือก วันเริ่ม และ วันสิ้นสุด');
      return false;
    }
    if (startDate && endDate && endDate < startDate) {
      Alert.alert('ช่วงวันที่ไม่ถูกต้อง', 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
      return false;
    }
    if (!isEdit && !rfidCardId) {
      Alert.alert('ยังไม่ได้เลือกบัตร', 'กรุณาเลือก RFID ที่ยังไม่ถูกผูก');
      return false;
    }

    // ผู้ปกครอง: ถ้ามีรายการใหม่ ให้บังคับเบอร์+LINE
    const newGs = guardians.filter(g => !g.parent_id);
    for (const g of newGs) {
      if ((g.name?.trim() || g.relationship?.trim() || g.phone?.trim() || g.line?.trim())) {
        if (!g.phone?.trim() || !g.line?.trim()) {
          Alert.alert('ข้อมูลผู้ปกครองไม่ครบ', 'กรอกเบอร์และ LINE ของผู้ปกครองใหม่ให้ครบ');
          return false;
        }
      }
    }

    const active = guardians.filter(g => (g.name?.trim() || g.phone?.trim() || g.parent_id));
    if (active.length && !ensureExactlyOnePrimary(guardians)) {
      Alert.alert('ต้องเลือกผู้ปกครองหลัก 1 คน', 'กรุณาเลือกผู้ปกครองหลักเพียงคนเดียว');
      return false;
    }
    return true;
  };

  const getMyDriverId = async (): Promise<number | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from('driver_bus').select('driver_id').eq('auth_user_id', user.id).single();
    return data?.driver_id ?? null;
  };

  const callAssignRfid = async (studentId: number, cardId: number) => {
    try {
      const driverId = await getMyDriverId();
      const { error } = await supabase.rpc('assign_rfid_card', {
        p_student_id: studentId,
        p_card_id: cardId,
        p_assigned_by: driverId,
      } as any);
      if (!error) return;
    } catch {}
    await supabase.from('rfid_card_assignments')
      .update({ valid_to: new Date().toISOString() })
      .eq('student_id', studentId)
      .is('valid_to', null);
    await supabase.from('rfid_card_assignments').insert({
      card_id: cardId, student_id: studentId, valid_from: new Date().toISOString()
    });
    await supabase.from('rfid_cards').update({ status: 'assigned' }).eq('card_id', cardId);
  };

  const save = async () => {
    if (!validateRequired()) return;

    setSaving(true);
    try {


      let studentId: number;

      if (isEdit) {
        // อัปเดตเฉพาะฟิลด์ที่อนุญาต (นักเรียน)
        const payloadEdit: any = {
          student_phone: studentPhone?.trim(),
          start_date: formatLocalDate(startDate),
          end_date: formatLocalDate(endDate),
          home_latitude: lat,
          home_longitude: lng,
        };
        const { error: stuErr } = await supabase
          .from('students').update(payloadEdit).eq('student_id', Number(id));
        if (stuErr) throw stuErr;
        studentId = Number(id);

        // จัดการ LINE ID ของนักเรียนแยกต่างหาก
        if (studentLine?.trim()) {
          // ลบ link เก่า
          await supabase
            .from('student_line_links')
            .update({ active: false })
            .eq('student_id', studentId);
          
          // เพิ่ม link ใหม่
          await supabase
            .from('student_line_links')
            .insert({
              student_id: studentId,
              line_user_id: studentLine.trim(),
              active: true
            });
        } else {
          // ถ้าไม่มี LINE ID ให้ลบ link เก่าทั้งหมด
          await supabase
            .from('student_line_links')
            .update({ active: false })
            .eq('student_id', studentId);
        }

        // ผู้ปกครองเดิม: อัปเดตเฉพาะเบอร์ + is_primary
        await updateExistingGuardians(studentId, guardians);

        // ผู้ปกครองใหม่: insert parent + link
        await insertNewGuardianLinks(studentId, guardians);

        // อัปเดต students.parent_id ให้ตรง primary
        let primary = guardians.find(g => g.is_primary);
        if (primary && !primary.parent_id) {
          // เป็นรายการใหม่ เพิ่ง insert ไป — หา parent_id ล่าสุดด้วยเบอร์
          const { data: p } = await supabase
            .from('parents')
            .select('parent_id')
            .eq('parent_phone', primary.phone?.trim() || '')
            .order('parent_id', { ascending: false })
            .limit(1)
            .maybeSingle();
          await supabase.from('students').update({ parent_id: p?.parent_id ?? null }).eq('student_id', studentId);
        } else {
          await supabase.from('students').update({ parent_id: primary?.parent_id ?? null }).eq('student_id', studentId);
        }
      } else {
        // เพิ่มใหม่
        const payloadCreate: any = {
          student_name: studentName.trim(),
          grade: grade.trim(),
          student_phone: studentPhone.trim(),
          start_date: formatLocalDate(startDate),
          end_date: formatLocalDate(endDate),
          home_latitude: lat,
          home_longitude: lng,
        };
        const { data: ins, error: insErr } = await supabase
          .from('students').insert(payloadCreate).select('student_id').single();
        if (insErr) throw insErr;
        studentId = ins.student_id as number;
        
        // จัดการ LINE ID ของนักเรียนแยกต่างหาก
        if (studentLine?.trim()) {
          await supabase
            .from('student_line_links')
            .insert({
              student_id: studentId,
              line_user_id: studentLine.trim(),
              active: true
            });
        }
        
        // ผูก RFID
        if (rfidCardId) await callAssignRfid(studentId, rfidCardId);

        const parentIds = await upsertParentsForGuardians(guardians);
        const linkRows = guardians
          .map((g, i) => ({
            student_id: studentId,
            parent_id: parentIds[i],
            relationship: g.relationship?.trim() || null,
            is_primary: !!g.is_primary,
          }))
          .filter(r => r.parent_id && r.parent_id > 0);
        if (linkRows.length) {
          const { error } = await supabase.from('student_guardians')
            .upsert(linkRows, { onConflict: 'student_id,parent_id' });
          if (error) throw error;
        }
        const primaryIdx = guardians.findIndex(g => g.is_primary);
        const primaryParentId = primaryIdx >= 0 ? parentIds[primaryIdx] : null;
        await supabase.from('students').update({ parent_id: primaryParentId }).eq('student_id', studentId);
      }

      Alert.alert('สำเร็จ', isEdit ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มนักเรียนแล้ว', [
        { text: 'ตกลง', onPress: () => { clearDraft(); router.back(); } },
      ]);
    } catch (e: any) {
      Alert.alert('บันทึกไม่สำเร็จ', e?.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!isEdit) return;
    Alert.alert('ยืนยันการลบ', 'ต้องการลบนักเรียนคนนี้ใช่ไหม?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            const sid = Number(id);
            await supabase.from('student_guardians').delete().eq('student_id', sid);
            const { error } = await supabase.from('students').delete().eq('student_id', sid);
            if (error) {
              if ((error as any).code === '23503') {
                const { error: e2 } = await supabase
                  .from('students').update({ status: 'inactive' }).eq('student_id', sid);
                if (e2) throw e2;
                Alert.alert('เปลี่ยนสถานะแล้ว', 'มีประวัติการใช้งาน จึงเปลี่ยนเป็นไม่ใช้งานแทน', [
                  { text: 'ตกลง', onPress: () => { clearDraft(); router.back(); } },
                ]);
              } else {
                throw error;
              }
            } else {

              Alert.alert('สำเร็จ', 'ลบข้อมูลแล้ว', [
                { text: 'ตกลง', onPress: () => { clearDraft(); router.back(); } },
              ]);
            }
          } catch (e: any) {
            Alert.alert('ลบไม่สำเร็จ', e?.message ?? 'เกิดข้อผิดพลาด');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const pickLocation = () => {
    // เก็บ draft ปัจจุบันก่อน
    setDraft({
      studentName, grade, studentPhone, studentLine,
      rfidCardId, rfidCode,
      startDate: formatLocalDate(startDate),
      endDate: formatLocalDate(endDate),
      lat, lng, guardians,
    });
    const base = '/pick/map';
    const q = new URLSearchParams({
      returnTo: '/manage/students/form',
      field: 'home',
      ...(lat != null && lng != null ? { lat: String(lat), lng: String(lng) } : {}),
      ...(isEdit ? { id: String(id) } : {}),
    }).toString();
    router.push(`${base}?${q}` as Href);
  };

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => { clearDraft(); router.back(); }} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{isEdit ? 'แก้ไขนักเรียน' : 'เพิ่มนักเรียน'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* การ์ด: ข้อมูลนักเรียน */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ข้อมูลนักเรียน</Text>

          <View style={styles.row}>
            <View style={[styles.col, { flex: 2 }]}>
              <Text style={styles.label}>ชื่อ-นามสกุล</Text>
              <TextInput
                style={[styles.input, isEdit && { ...readOnlyBg, ...readOnlyBorder }]}
                value={studentName}
                onChangeText={(t) => { if (!isEdit) { setStudentName(t); setDraft({ studentName: t }); } }}
                placeholder="เช่น ด.ช. สมชาย ใจดี"
                placeholderTextColor="#9CA3AF"
                {...ro(!isEdit)}
              />
            </View>
            <View style={[styles.col, { flex: 1 }]}>
              <Text style={styles.label}>ชั้น</Text>
              <TextInput
                style={[styles.input, isEdit && { ...readOnlyBg, ...readOnlyBorder }]}
                value={grade}
                onChangeText={(t) => { if (!isEdit) { setGrade(t); setDraft({ grade: t }); } }}
                placeholder="ป.5/2"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                {...ro(!isEdit)}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.col, { flex: 1.2 }]}>
              <Text style={styles.label}>เบอร์โทรนักเรียน</Text>
              <TextInput
                style={styles.input}
                value={studentPhone}
                onChangeText={(t) => { setStudentPhone(t); setDraft({ studentPhone: t }); }}
                placeholder="เช่น 0812345678"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>LINE ID นักเรียน</Text>
              <TextInput
                style={styles.input}
                value={studentLine}
                onChangeText={(t) => { setStudentLine(t); setDraft({ studentLine: t }); }}
                placeholder="เช่น @student123"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* RFID (ให้กว้างและไม่ห่อคำ) */}
          <View style={styles.row}>
            <View style={[styles.col, { flex: 1 }]}>
              <Text style={styles.label}>RFID Tag</Text>
              {isEdit ? (
                <View style={[styles.input, { justifyContent: 'center', ...readOnlyBg, ...readOnlyBorder }]}>
                  <Text style={{ color: '#111827' }}>{rfidCode || '—'}</Text>
                </View>
              ) : (
                <View style={[styles.input, { paddingVertical: 8 }]}>
                  <Text style={{ color: '#6B7280', marginBottom: 4, fontSize: 12 }} numberOfLines={1}>
                    {loadingCards ? 'กำลังโหลดบัตรที่ว่าง…' : 'เลือกบัตรว่าง'}
                  </Text>
                  <View style={styles.selectWrap}>
                    {availableCards.length === 0 ? (
                      <Text style={{ color: '#EF4444', fontSize: 12 }}>ไม่พบบัตรว่าง</Text>
                    ) : (
                      <ScrollView style={{ maxHeight: 160 }}>
                        {availableCards.map((c) => (
                          <TouchableOpacity
                            key={c.card_id}
                            style={[
                              styles.optionRow,
                              rfidCardId === c.card_id && { backgroundColor: '#EEF2FF' }
                            ]}
                            onPress={() => { setRfidCardId(c.card_id); setRfidCode(c.rfid_code); setDraft({ rfidCardId: c.card_id, rfidCode: c.rfid_code }); }}
                          >
                            <Text style={{ color: '#111827', fontWeight: rfidCardId === c.card_id ? '800' : '600' }}>
                              {c.rfid_code}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* การ์ด: ข้อมูลผู้ปกครอง */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ข้อมูลผู้ปกครอง</Text>

          {guardians.map((g, idx) => {
            const isExisting = !!g.parent_id;       // เดิม: edit ได้เฉพาะเบอร์
            const nameEditable = !isExisting;
            const lineEditable = !isExisting;
            const relEditable  = !isExisting;
            return (
              <View key={idx} style={[styles.guardCard, { marginBottom: 12 }]}>
                <View style={styles.guardHeader}>
                  <TouchableOpacity onPress={() => markPrimary(idx)} style={styles.primaryToggle}>
                    <Ionicons name={g.is_primary ? 'radio-button-on' : 'radio-button-off'} size={18} color="#2563EB" />
                    <Text style={styles.primaryTxt}>{g.is_primary ? 'ผู้ปกครองหลัก' : 'ตั้งเป็นผู้ปกครองหลัก'}</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                </View>

                <View style={styles.row}>
                  <View style={[styles.col, { flex: 1 }]}>
                    <Text style={styles.label}>ชื่อผู้ปกครอง</Text>
                    <TextInput
                      style={[styles.input, !nameEditable && { ...readOnlyBg, ...readOnlyBorder }]}
                      value={g.name}
                      onChangeText={(t) => nameEditable && setGuardianAt(idx, { name: t })}
                      placeholder="ชื่อ-นามสกุล"
                      placeholderTextColor="#9CA3AF"
                      {...ro(nameEditable)}
                    />
                  </View>
                  <View style={[styles.col, { flex: 1.7 }]}>
                    <Text style={styles.label}>เบอร์โทร</Text>
                    <TextInput
                      style={styles.input}
                      value={g.phone}
                      onChangeText={(t) => setGuardianAt(idx, { phone: t })}
                      placeholder="เช่น 0812345678"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={10}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.col, { flex: 1 }]}>
                    <Text style={styles.label}>LINE ID</Text>
                    <TextInput
                      style={[styles.input, !lineEditable && { ...readOnlyBg, ...readOnlyBorder }]}
                      value={g.line ?? ''}
                      onChangeText={(t) => lineEditable && setGuardianAt(idx, { line: t })}
                      placeholder="เช่น line_parent"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                      {...ro(lineEditable)}
                    />
                  </View>
                  <View style={[styles.col, { flex: 1 }]}>
                    <Text style={styles.label}>ความสัมพันธ์</Text>
                    <TextInput
                      style={[styles.input, !relEditable && { ...readOnlyBg, ...readOnlyBorder }]}
                      value={g.relationship ?? ''}
                      onChangeText={(t) => relEditable && setGuardianAt(idx, { relationship: t })}
                      placeholder="เช่น บิดา/มารดา/ญาติ"
                      placeholderTextColor="#9CA3AF"
                      {...ro(relEditable)}
                    />
                  </View>
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addBtn} onPress={addGuardian}>
            <Ionicons name="person-add-outline" size={18} color="#ffffff" />
            <Text style={styles.addBtnTxt}>เพิ่มผู้ปกครอง</Text>
          </TouchableOpacity>
        </View>

        {/* การ์ด: ช่วงวันที่ใช้บริการ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ช่วงวันที่ใช้บริการ</Text>
          <View style={styles.row}>
            <View style={[styles.col, { flex: 1 }]}>
              <Text style={styles.label}>วันเริ่ม</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.dateTxt}>
                  {startDate ? formatLocalDate(startDate) : 'เลือกวันเริ่ม'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.col, { flex: 1 }]}>
              <Text style={styles.label}>วันสิ้นสุด</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.dateTxt}>
                  {endDate ? formatLocalDate(endDate) : 'เลือกวันสิ้นสุด'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={startDate ?? new Date()}
              mode="date"
              onChange={(_, d) => {
                setShowStartPicker(false);
                if (d) { setStartDate(d); setDraft({ startDate: formatLocalDate(d) }); }
              }}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={endDate ?? new Date()}
              mode="date"
              onChange={(_, d) => {
                setShowEndPicker(false);
                if (d) { setEndDate(d); setDraft({ endDate: formatLocalDate(d) }); }
              }}
            />
          )}
        </View>

        {/* การ์ด: พิกัด */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>พิกัดรับ-ส่ง</Text>
          <View style={[styles.row, { alignItems: 'center' }]}>
            <Text style={[styles.label, { flex: 1 }]}>
              {lat != null && lng != null
                ? `เลือกแล้ว: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
                : 'ยังไม่ได้ปักหมุด'}
            </Text>
            <TouchableOpacity style={styles.mapBtn} onPress={pickLocation}>
              <Ionicons name="location-outline" size={18} color="#fff" />
              <Text style={styles.mapBtnTxt}>{lat != null && lng != null ? 'แก้ไขตำแหน่ง' : 'ปักหมุดแผนที่'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ปุ่มล่าง */}
        <View style={styles.formActions}>
          {isEdit ? (
            <>
              <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={remove} disabled={deleting}>
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={styles.btnTxt}>ลบ</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={save} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.btnTxt}>บันทึก</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[styles.btn, styles.btnPrimaryFull]} onPress={save} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={20} color="#fff" />
                  <Text style={styles.btnTxt}>เพิ่มนักเรียน</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
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
    paddingTop: Platform.select({ ios: 12, android: 10 }), 
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, 
    borderColor: COLORS.borderLight, 
    backgroundColor: COLORS.card,
    ...shadow,
  },
  iconBtn: { 
    width: 40, 
    height: 40, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: COLORS.text,
    letterSpacing: -0.3,
  },

  scroll: { 
    padding: isTablet ? 24 : 16,
    maxWidth: isTablet ? 800 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: isTablet ? 24 : 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...shadow,
  },
  cardTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    marginBottom: 20, 
    color: COLORS.text,
    letterSpacing: -0.3,
  },

  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },

  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: COLORS.textSecondary, 
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  input: {
    borderWidth: 1, 
    borderColor: COLORS.border, 
    borderRadius: 12,
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    color: COLORS.text, 
    fontSize: 16, 
    backgroundColor: COLORS.card,
    fontWeight: '500',
    letterSpacing: 0.1,
  },

  dateBtn: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    borderWidth: 1, 
    borderColor: COLORS.border, 
    borderRadius: 12,
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    backgroundColor: COLORS.card,
  },
  dateTxt: { 
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },

  mapBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    paddingHorizontal: 16, 
    height: 44, 
    borderRadius: 12,
    ...shadow,
  },
  mapBtnTxt: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 14,
    letterSpacing: 0.1,
  },

  formActions: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 16 
  },
  btn: {
    flex: 1, 
    height: 52, 
    borderRadius: 16,
    alignItems: 'center', 
    justifyContent: 'center',
    flexDirection: 'row', 
    gap: 8,
    ...shadow,
  },
  btnPrimary: { backgroundColor: COLORS.text },
  btnPrimaryFull: { backgroundColor: COLORS.primary },
  btnDanger: { backgroundColor: COLORS.danger },
  btnTxt: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 16,
    letterSpacing: 0.1,
  },

  /* guardian UI */
  guardCard: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 12,
  },
  guardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  primaryToggle: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  primaryTxt: { 
    fontWeight: '700', 
    color: COLORS.primary,
    fontSize: 14,
    letterSpacing: 0.1,
  },

  addBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginTop: 8,
    backgroundColor: COLORS.success,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    ...shadow,
  },
  addBtnTxt: { 
    color: '#ffffff', 
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.1,
  },

  selectWrap: { 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    borderRadius: 12, 
    backgroundColor: COLORS.card 
  },
  optionRow: { 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderBottomWidth: StyleSheet.hairlineWidth, 
    borderColor: COLORS.borderLight 
  },
});
