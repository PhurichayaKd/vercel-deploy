import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/services/supabaseClient';

const COLORS = {
  primary: '#007AFF',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  background: '#F2F2F7',
  surface: '#FFFFFF',
  text: '#000000',
  textSecondary: '#8E8E93',
  border: '#C6C6C8',
};

interface StudentActivity {
  student_id: number;
  event_time: string;
  event_type: 'pickup' | 'dropoff' | 'absent';
  student_name: string;
}

interface StatusStats {
  totalStudents: number;
  pickedUp: number;
  droppedOff: number;
  absent: number;
  weeklyPickups: number;
  weeklyDropoffs: number;
  monthlyPickups: number;
  monthlyDropoffs: number;
}

const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
};

const StudentStatusReports: React.FC = () => {
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [stats, setStats] = useState<StatusStats>({
    totalStudents: 0,
    pickedUp: 0,
    droppedOff: 0,
    absent: 0,
    weeklyPickups: 0,
    weeklyDropoffs: 0,
    monthlyPickups: 0,
    monthlyDropoffs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const fetchStudentStatusData = async () => {
    try {
      // ดึงข้อมูลการขึ้น-ลงรถ
      const { data: pickupData, error: pickupError } = await supabase
        .from('pickup_dropoff')
        .select(`
          student_id,
          event_time,
          event_type,
          students!inner(student_name)
        `)
        .order('event_time', { ascending: false })
        .limit(100);

      if (pickupError) throw pickupError;

      const formattedActivities = pickupData?.map((item: any) => ({student_id: item.student_id,
        event_time: item.event_time,
        event_type: item.event_type,
        student_name: (item.students as any)?.student_name || 'ไม่ระบุชื่อ',
      })) || [];

      setActivities(formattedActivities);

      // คำนวณสถิติ
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(selectedYear, selectedMonth, 1);
      const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);

      const todayActivities = formattedActivities.filter((activity: StudentActivity) => 
        new Date(activity.event_time) >= today
      );

      const weeklyActivities = formattedActivities.filter((activity: StudentActivity) => 
        new Date(activity.event_time) >= weekAgo
      );

      const monthlyActivities = formattedActivities.filter((activity: StudentActivity) => {
        const activityDate = new Date(activity.event_time);
        return activityDate >= monthStart && activityDate <= monthEnd;
      });

      const pickedUp = todayActivities.filter((a: StudentActivity) => a.event_type === 'pickup').length;
      const droppedOff = todayActivities.filter((a: StudentActivity) => a.event_type === 'dropoff').length;
      const absent = todayActivities.filter((a: StudentActivity) => a.event_type === 'absent').length;

      const weeklyPickups = weeklyActivities.filter((a: StudentActivity) => a.event_type === 'pickup').length;
      const weeklyDropoffs = weeklyActivities.filter((a: StudentActivity) => a.event_type === 'dropoff').length;

      const monthlyPickups = monthlyActivities.filter((a: StudentActivity) => a.event_type === 'pickup').length;
      const monthlyDropoffs = monthlyActivities.filter((a: StudentActivity) => a.event_type === 'dropoff').length;

      setStats({
        totalStudents: todayActivities.length,
        pickedUp,
        droppedOff,
        absent,
        weeklyPickups,
        weeklyDropoffs,
        monthlyPickups,
        monthlyDropoffs,
      });
    } catch (error) {
      console.error('Error fetching student status data:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลสถานะนักเรียนได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStudentStatusData();
  }, [selectedMonth, selectedYear]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudentStatusData();
  };

  const getStatusIcon = (eventType: string) => {
    switch (eventType) {
      case 'pickup':
        return 'arrow-up-circle';
      case 'dropoff':
        return 'arrow-down-circle';
      case 'absent':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const getStatusColor = (eventType: string) => {
    switch (eventType) {
      case 'pickup':
        return COLORS.success;
      case 'dropoff':
        return COLORS.primary;
      case 'absent':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusText = (eventType: string) => {
    switch (eventType) {
      case 'pickup':
        return 'ขึ้นรถ';
      case 'dropoff':
        return 'ลงรถ';
      case 'absent':
        return 'ลาป่วย';
      default:
        return eventType;
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleString('th-TH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFilteredActivities = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(selectedYear, selectedMonth, 1);
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);

    switch (viewMode) {
      case 'daily':
        return activities.filter(activity => 
          new Date(activity.event_time) >= today
        );
      case 'weekly':
        return activities.filter(activity => 
          new Date(activity.event_time) >= weekAgo
        );
      case 'monthly':
        return activities.filter(activity => {
          const activityDate = new Date(activity.event_time);
          return activityDate >= monthStart && activityDate <= monthEnd;
        });
      default:
        return activities;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>สถานะการขึ้น-ลงรถนักเรียน</Text>
        <Text style={styles.subtitle}>ข้อมูลการเดินทางและสถานะนักเรียน</Text>
      </View>

      {/* ตัวเลือกเดือนและปี */}
      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>เลือกช่วงเวลา</Text>
        <View style={styles.pickerContainer}>
          <View style={styles.pickerWrapper}>
            <Text style={styles.pickerLabel}>เดือน:</Text>
            <Picker
              selectedValue={selectedMonth}
              onValueChange={setSelectedMonth}
              style={styles.picker}
            >
              {months.map((month, index) => (
                <Picker.Item key={index} label={month} value={index} />
              ))}
            </Picker>
          </View>
          <View style={styles.pickerWrapper}>
            <Text style={styles.pickerLabel}>ปี:</Text>
            <Picker
              selectedValue={selectedYear}
              onValueChange={setSelectedYear}
              style={styles.picker}
            >
              {years.map(year => (
                <Picker.Item key={year} label={year.toString()} value={year} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      {/* ปุ่มเลือกมุมมอง */}
      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>มุมมองข้อมูล</Text>
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'daily' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('daily')}
          >
            <Text style={[styles.viewModeText, viewMode === 'daily' && styles.viewModeTextActive]}>
              รายวัน
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'weekly' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('weekly')}
          >
            <Text style={[styles.viewModeText, viewMode === 'weekly' && styles.viewModeTextActive]}>
              รายสัปดาห์
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'monthly' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('monthly')}
          >
            <Text style={[styles.viewModeText, viewMode === 'monthly' && styles.viewModeTextActive]}>
              รายเดือน
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* สถิติรวม */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, shadow]}>
          <Ionicons name="arrow-up-circle" size={24} color={COLORS.success} />
          <Text style={styles.statNumber}>{stats.pickedUp}</Text>
          <Text style={styles.statLabel}>ขึ้นรถ</Text>
        </View>
        <View style={[styles.statCard, shadow]}>
          <Ionicons name="arrow-down-circle" size={24} color={COLORS.primary} />
          <Text style={styles.statNumber}>{stats.droppedOff}</Text>
          <Text style={styles.statLabel}>ลงรถ</Text>
        </View>
        <View style={[styles.statCard, shadow]}>
          <Ionicons name="close-circle" size={24} color={COLORS.danger} />
          <Text style={styles.statNumber}>{stats.absent}</Text>
          <Text style={styles.statLabel}>ลาป่วย</Text>
        </View>
      </View>

      {/* สถิติตามช่วงเวลา */}
      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>สถิติตามช่วงเวลา</Text>
        <View style={styles.timeStatsContainer}>
          <View style={styles.timeStatRow}>
            <Text style={styles.timeStatLabel}>สัปดาห์นี้</Text>
            <View style={styles.timeStatValues}>
              <Text style={[styles.timeStatValue, { color: COLORS.success }]}>
                ขึ้น: {stats.weeklyPickups}
              </Text>
              <Text style={[styles.timeStatValue, { color: COLORS.primary }]}>
                ลง: {stats.weeklyDropoffs}
              </Text>
            </View>
          </View>
          <View style={styles.timeStatRow}>
            <Text style={styles.timeStatLabel}>{months[selectedMonth]} {selectedYear}</Text>
            <View style={styles.timeStatValues}>
              <Text style={[styles.timeStatValue, { color: COLORS.success }]}>
                ขึ้น: {stats.monthlyPickups}
              </Text>
              <Text style={[styles.timeStatValue, { color: COLORS.primary }]}>
                ลง: {stats.monthlyDropoffs}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* รายการกิจกรรม */}
      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>รายการกิจกรรม</Text>
        {getFilteredActivities().length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>ไม่มีข้อมูลในช่วงเวลานี้</Text>
          </View>
        ) : (
          getFilteredActivities().map((activity, index) => (
            <View key={`${activity.student_id}-${index}`} style={styles.activityItem}>
              <View style={styles.activityHeader}>
                <View style={styles.activityInfo}>
                  <Ionicons
                    name={getStatusIcon(activity.event_type) as any}
                    size={20}
                    color={getStatusColor(activity.event_type)}
                  />
                  <Text style={styles.studentName}>{activity.student_name}</Text>
                </View>
                <Text style={[styles.statusText, { color: getStatusColor(activity.event_type) }]}>
                  {getStatusText(activity.event_type)}
                </Text>
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTime}>
                  เวลา: {formatDateTime(activity.event_time)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  header: {
    padding: 20,
    backgroundColor: COLORS.surface,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  pickerWrapper: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  picker: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  viewModeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  viewModeTextActive: {
    color: COLORS.surface,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  timeStatsContainer: {
    gap: 16,
  },
  timeStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeStatLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  timeStatValues: {
    flexDirection: 'row',
    gap: 16,
  },
  timeStatValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  activityItem: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityDetails: {
    gap: 4,
  },
  activityTime: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default StudentStatusReports;