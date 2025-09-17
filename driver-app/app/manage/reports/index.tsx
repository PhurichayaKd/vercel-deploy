import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../../src/services/supabaseClient';

const COLORS = {
  background: '#FFFFFF',
  backgroundSoft: '#F8FAFC',
  text: '#1E293B',
  textSoft: '#475569',
  textMuted: '#64748B',
  border: '#E2E8F0',
  primary: '#0a7ea4',
  success: '#10B981',
  successSoft: '#D1FAE5',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  error: '#EF4444',
  errorSoft: '#FEE2E2',
  shadow: 'rgba(15, 23, 42, 0.08)',
};

const { width: screenWidth } = Dimensions.get('window');

type ReportData = {
  totalStudents: number;
  todayPickups: number;
  todayDropoffs: number;
  weeklyPickups: number;
  monthlyPickups: number;
};

const shadow = Platform.select({
  ios: { shadowColor: COLORS.shadow, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
});

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState<ReportData>({
    totalStudents: 0,
    todayPickups: 0,
    todayDropoffs: 0,
    weeklyPickups: 0,
    monthlyPickups: 0,
  });

  const fetchReportData = async () => {
    try {
      // ดึงข้อมูลนักเรียนทั้งหมด
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('status', 'active');

      if (studentsError) throw studentsError;

      // ดึงข้อมูลการขึ้น-ลงรถวันนี้
      const today = new Date().toISOString().split('T')[0];
      const { data: todayData, error: todayError } = await supabase
        .from('pickup_dropoff')
        .select('*')
        .gte('event_time', `${today}T00:00:00`)
        .lt('event_time', `${today}T23:59:59`);

      if (todayError) throw todayError;

      // ดึงข้อมูลสัปดาห์นี้
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: weekData, error: weekError } = await supabase
        .from('pickup_dropoff')
        .select('*')
        .gte('event_time', weekAgo.toISOString());

      if (weekError) throw weekError;

      // ดึงข้อมูลเดือนนี้
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const { data: monthData, error: monthError } = await supabase
        .from('pickup_dropoff')
        .select('*')
        .gte('event_time', monthAgo.toISOString());

      if (monthError) throw monthError;

      setReportData({
        totalStudents: students?.length || 0,
        todayPickups: todayData?.filter(d => d.event_type === 'pickup').length || 0,
        todayDropoffs: todayData?.filter(d => d.event_type === 'dropoff').length || 0,
        weeklyPickups: weekData?.filter(d => d.event_type === 'pickup').length || 0,
        monthlyPickups: monthData?.filter(d => d.event_type === 'pickup').length || 0,
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReportData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>รายงานสรุป</Text>
          <Text style={styles.headerSubtitle}>ข้อมูลการใช้งานระบบ</Text>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>สรุปข้อมูลนักเรียน</Text>
          <View style={styles.cardGrid}>
            <View style={[styles.summaryCard, { backgroundColor: COLORS.successSoft }]}>
              <Ionicons name="people" size={24} color={COLORS.success} />
              <Text style={styles.cardValue}>{reportData.totalStudents}</Text>
              <Text style={styles.cardLabel}>นักเรียนทั้งหมด</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: COLORS.warningSoft }]}>
              <Ionicons name="arrow-up" size={24} color={COLORS.warning} />
              <Text style={styles.cardValue}>{reportData.todayPickups}</Text>
              <Text style={styles.cardLabel}>ขึ้นรถวันนี้</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: COLORS.errorSoft }]}>
              <Ionicons name="arrow-down" size={24} color={COLORS.error} />
              <Text style={styles.cardValue}>{reportData.todayDropoffs}</Text>
              <Text style={styles.cardLabel}>ลงรถวันนี้</Text>
            </View>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>สถิติรายสัปดาห์/เดือน</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>สัปดาห์นี้</Text>
              <Text style={[styles.statValue, { color: COLORS.primary }]}>{reportData.weeklyPickups} ครั้ง</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>เดือนนี้</Text>
              <Text style={[styles.statValue, { color: COLORS.primary }]}>{reportData.monthlyPickups} ครั้ง</Text>
            </View>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>รายงานเพิ่มเติม</Text>
          <View style={styles.reportButtonsContainer}>
            <TouchableOpacity 
              style={[styles.reportButton, { backgroundColor: COLORS.errorSoft }]}
              onPress={() => router.push('/manage/reports/emergency')}
            >
              <Ionicons name="warning" size={24} color={COLORS.error} />
              <Text style={styles.reportButtonTitle}>เหตุการณ์ฉุกเฉิน</Text>
              <Text style={styles.reportButtonSubtitle}>รายงานการแจ้งเตือน</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.reportButton, { backgroundColor: COLORS.successSoft }]}
              onPress={() => router.push('/manage/reports/student-status')}
            >
              <Ionicons name="bus" size={24} color={COLORS.success} />
              <Text style={styles.reportButtonTitle}>สถานะนักเรียน</Text>
              <Text style={styles.reportButtonSubtitle}>การขึ้น-ลงรถ</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.reportButton, { backgroundColor: COLORS.warningSoft }]}
              onPress={() => router.push('/manage/reports/individual-view')}
            >
              <Ionicons name="person" size={24} color={COLORS.warning} />
              <Text style={styles.reportButtonTitle}>ดูรายบุคคล</Text>
              <Text style={styles.reportButtonSubtitle}>ประวัติรายละเอียด</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSoft,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: COLORS.backgroundSoft,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSoft,
  },
  summarySection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  summaryCard: {
    width: (screenWidth - 52) / 3,
    marginHorizontal: 6,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    ...shadow,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 12,
    color: COLORS.textSoft,
    textAlign: 'center',
  },
  statsContainer: {
    backgroundColor: COLORS.backgroundSoft,
    borderRadius: 12,
    padding: 16,
    ...shadow,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 20,
  },
  reportButtonsContainer: {
    gap: 12,
  },
  reportButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    ...shadow,
  },
  reportButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  reportButtonSubtitle: {
    fontSize: 12,
    color: COLORS.textSoft,
    textAlign: 'center',
  },
});
