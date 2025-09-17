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
  TextInput,
  Modal,
} from 'react-native';
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

interface Student {
  student_id: number;
  student_name: string;
  parent_phone: string;
  pickup_location: string;
}

interface StudentActivity {
  pickup_id: number;
  pickup_time: string;
  dropoff_time: string | null;
  status: 'picked_up' | 'dropped_off' | 'absent';
}

interface EmergencyEvent {
  event_id: number;
  event_time: string;
  event_type: string;
  triggered_by: string;
}

interface StudentStats {
  totalPickups: number;
  totalDropoffs: number;
  totalAbsent: number;
  emergencyEvents: number;
  attendanceRate: number;
}

const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
};

const IndividualView: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentActivities, setStudentActivities] = useState<StudentActivity[]>([]);
  const [emergencyEvents, setEmergencyEvents] = useState<EmergencyEvent[]>([]);
  const [stats, setStats] = useState<StudentStats>({
    totalPickups: 0,
    totalDropoffs: 0,
    totalAbsent: 0,
    emergencyEvents: 0,
    attendanceRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updateNotification, setUpdateNotification] = useState<string | null>(null);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          student_id, 
          student_name, 
          pickup_location,
          primary_parent:parents!students_parent_id_fkey ( parent_phone )
        `)
        .order('student_name');

      if (error) throw error;
      
      // แปลงข้อมูลให้ตรงกับ interface
      const formattedStudents = data?.map((student: any) => ({
        student_id: student.student_id,
        student_name: student.student_name,
        pickup_location: student.pickup_location,
        parent_phone: student.primary_parent?.parent_phone || 'ไม่มีข้อมูล'
      })) || [];
      
      setStudents(formattedStudents);
    } catch (error) {
      console.error('Error fetching students:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลนักเรียนได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStudentDetails = async (studentId: number) => {
    setDetailLoading(true);
    try {
      // ดึงข้อมูลกิจกรรมการขึ้น-ลงรถ
      const { data: activities, error: activitiesError } = await supabase
        .from('pickup_dropoff')
        .select('pickup_id, pickup_time, dropoff_time, status')
        .eq('student_id', studentId)
        .order('pickup_time', { ascending: false })
        .limit(50);

      if (activitiesError) throw activitiesError;
      setStudentActivities(activities || []);

      // ดึงข้อมูลเหตุการณ์ฉุกเฉิน (ถ้ามี)
      const { data: emergencies, error: emergenciesError } = await supabase
        .from('emergency_logs')
        .select('event_id, event_time, event_type, triggered_by')
        .eq('student_id', studentId)
        .order('event_time', { ascending: false })
        .limit(20);

      if (emergenciesError) {
        console.warn('Emergency logs table might not exist or accessible');
        setEmergencyEvents([]);
      } else {
        setEmergencyEvents(emergencies || []);
      }

      // คำนวณสถิติ
      const totalPickups = activities?.filter((a: StudentActivity) => a.status === 'picked_up').length || 0;
      const totalDropoffs = activities?.filter((a: StudentActivity) => a.status === 'dropped_off').length || 0;
      const totalAbsent = activities?.filter((a: StudentActivity) => a.status === 'absent').length || 0;
      const totalActivities = activities?.length || 0;
      const attendanceRate = totalActivities > 0 ? ((totalPickups + totalDropoffs) / totalActivities) * 100 : 0;

      setStats({
        totalPickups,
        totalDropoffs,
        totalAbsent,
        emergencyEvents: emergencies?.length || 0,
        attendanceRate: Math.round(attendanceRate),
      });
    } catch (error) {
      console.error('Error fetching student details:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลรายละเอียดนักเรียนได้');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    
    // ตั้งค่า Realtime subscription สำหรับตาราง students
     const studentsChannel = supabase
       .channel('students-changes')
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'students'
         },
         (payload) => {
            console.log('Students table changed:', payload);
            setLastUpdate(new Date());
            setUpdateNotification('ข้อมูลนักเรียนได้รับการอัปเดต');
            // อัปเดตข้อมูลนักเรียนเมื่อมีการเปลี่ยนแปลง
            fetchStudents();
            // ซ่อนการแจ้งเตือนหลังจาก 3 วินาที
            setTimeout(() => setUpdateNotification(null), 3000);
          }
       )
       .on('system', {}, (status) => {
         if (status === 'SUBSCRIBED') {
           setRealtimeConnected(true);
           console.log('Students realtime subscription active');
         }
       })
       .subscribe();

    // ตั้งค่า Realtime subscription สำหรับตาราง pickup_dropoff
     const activitiesChannel = supabase
       .channel('pickup-dropoff-changes')
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'pickup_dropoff'
         },
         (payload) => {
            console.log('Pickup/Dropoff table changed:', payload);
            setLastUpdate(new Date());
            setUpdateNotification('ข้อมูลการขึ้น-ลงรถได้รับการอัปเดต');
            // อัปเดตข้อมูลกิจกรรมของนักเรียนที่เลือกไว้
            if (selectedStudent) {
              fetchStudentDetails(selectedStudent.student_id);
            }
            // ซ่อนการแจ้งเตือนหลังจาก 3 วินาที
            setTimeout(() => setUpdateNotification(null), 3000);
          }
       )
       .subscribe();

    // ตั้งค่า Realtime subscription สำหรับตาราง emergency_logs
     const emergencyChannel = supabase
       .channel('emergency-logs-changes')
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'emergency_logs'
         },
         (payload) => {
            console.log('Emergency logs table changed:', payload);
            setLastUpdate(new Date());
            setUpdateNotification('ข้อมูลเหตุการณ์ฉุกเฉินได้รับการอัปเดต');
            // อัปเดตข้อมูลเหตุการณ์ฉุกเฉินของนักเรียนที่เลือกไว้
            if (selectedStudent) {
              fetchStudentDetails(selectedStudent.student_id);
            }
            // ซ่อนการแจ้งเตือนหลังจาก 3 วินาที
            setTimeout(() => setUpdateNotification(null), 3000);
          }
       )
       .subscribe();

    // ทำความสะอาด subscriptions เมื่อ component unmount
    return () => {
      supabase.removeChannel(studentsChannel);
      supabase.removeChannel(activitiesChannel);
      supabase.removeChannel(emergencyChannel);
    };
  }, [selectedStudent]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setModalVisible(true);
    fetchStudentDetails(student.student_id);
  };

  const getFilteredStudents = () => {
    if (!searchText) return students;
    return students.filter((student: Student) => 
      student.student_name.toLowerCase().includes(searchText.toLowerCase()) ||
      student.pickup_location.toLowerCase().includes(searchText.toLowerCase())
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'picked_up':
        return 'arrow-up-circle';
      case 'dropped_off':
        return 'arrow-down-circle';
      case 'absent':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'picked_up':
        return COLORS.success;
      case 'dropped_off':
        return COLORS.primary;
      case 'absent':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'picked_up':
        return 'ขึ้นรถ';
      case 'dropped_off':
        return 'ลงรถ';
      case 'absent':
        return 'ลาป่วย';
      default:
        return status;
    }
  };

  const getEventTypeText = (type: string) => {
    switch (type) {
      case 'PANIC_BUTTON':
        return 'ปุ่มฉุกเฉิน';
      case 'SENSOR_ALERT':
        return 'แจ้งเตือนเซ็นเซอร์';
      case 'DRIVER_INCAPACITATED':
        return 'คนขับไม่สามารถขับได้';
      default:
        return type;
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ดูข้อมูลรายบุคคล</Text>
        <Text style={styles.subtitle}>เลือกนักเรียนเพื่อดูประวัติรายละเอียด</Text>
        
        {/* แสดงสถานะการเชื่อมต่อแบบเรียลไทม์ */}
        <View style={styles.realtimeStatus}>
          <View style={[styles.statusIndicator, { backgroundColor: realtimeConnected ? COLORS.success : COLORS.warning }]} />
          <Text style={styles.statusText}>
            {realtimeConnected ? 'เชื่อมต่อแบบเรียลไทม์' : 'กำลังเชื่อมต่อ...'}
          </Text>
          {lastUpdate && (
            <Text style={styles.lastUpdateText}>
              อัปเดตล่าสุด: {lastUpdate.toLocaleTimeString('th-TH')}
            </Text>
          )}
        </View>
      </View>

      {/* ช่องค้นหา */}
      <View style={[styles.searchContainer, shadow]}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="ค้นหาชื่อนักเรียนหรือจุดรับ-ส่ง"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* การแจ้งเตือนการอัปเดต */}
      {updateNotification && (
        <View style={styles.updateNotification}>
          <Text style={styles.updateNotificationText}>{updateNotification}</Text>
        </View>
      )}

      {/* รายการนักเรียน */}
      <ScrollView
        style={styles.studentList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {getFilteredStudents().length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>ไม่พบข้อมูลนักเรียน</Text>
          </View>
        ) : (
          getFilteredStudents().map((student) => (
            <TouchableOpacity
              key={student.student_id}
              style={[styles.studentCard, shadow]}
              onPress={() => handleStudentSelect(student)}
            >
              <View style={styles.studentInfo}>
                <View style={styles.studentHeader}>
                  <Ionicons name="person" size={20} color={COLORS.primary} />
                  <Text style={styles.studentName}>{student.student_name}</Text>
                </View>
                <View style={styles.studentDetails}>
                  <Text style={styles.studentDetail}>
                    📍 {student.pickup_location}
                  </Text>
                  <Text style={styles.studentDetail}>
                    📞 {student.parent_phone}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal แสดงรายละเอียดนักเรียน */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedStudent?.student_name}
            </Text>
            <View style={styles.placeholder} />
          </View>

          {detailLoading ? (
            <View style={styles.modalLoadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalContent}>
              {/* ข้อมูลพื้นฐาน */}
              <View style={[styles.card, shadow]}>
                <Text style={styles.cardTitle}>ข้อมูลพื้นฐาน</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>ชื่อ:</Text>
                  <Text style={styles.infoValue}>{selectedStudent?.student_name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>จุดรับ-ส่ง:</Text>
                  <Text style={styles.infoValue}>{selectedStudent?.pickup_location}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>เบอร์ผู้ปกครong:</Text>
                  <Text style={styles.infoValue}>{selectedStudent?.parent_phone}</Text>
                </View>
              </View>

              {/* สถิติ */}
              <View style={styles.statsContainer}>
                <View style={[styles.statCard, shadow]}>
                  <Ionicons name="arrow-up-circle" size={24} color={COLORS.success} />
                  <Text style={styles.statNumber}>{stats.totalPickups}</Text>
                  <Text style={styles.statLabel}>ขึ้นรถ</Text>
                </View>
                <View style={[styles.statCard, shadow]}>
                  <Ionicons name="arrow-down-circle" size={24} color={COLORS.primary} />
                  <Text style={styles.statNumber}>{stats.totalDropoffs}</Text>
                  <Text style={styles.statLabel}>ลงรถ</Text>
                </View>
                <View style={[styles.statCard, shadow]}>
                  <Ionicons name="close-circle" size={24} color={COLORS.danger} />
                  <Text style={styles.statNumber}>{stats.totalAbsent}</Text>
                  <Text style={styles.statLabel}>ลาป่วย</Text>
                </View>
              </View>

              {/* อัตราการเข้าเรียน */}
              <View style={[styles.card, shadow]}>
                <Text style={styles.cardTitle}>อัตราการเข้าเรียน</Text>
                <View style={styles.attendanceContainer}>
                  <Text style={styles.attendanceRate}>{stats.attendanceRate}%</Text>
                  <Text style={styles.attendanceLabel}>อัตราการเข้าเรียน</Text>
                </View>
              </View>

              {/* ประวัติการขึ้น-ลงรถ */}
              <View style={[styles.card, shadow]}>
                <Text style={styles.cardTitle}>ประวัติการขึ้น-ลงรถ (50 ครั้งล่าสุด)</Text>
                {studentActivities.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>ไม่มีประวัติการขึ้น-ลงรถ</Text>
                  </View>
                ) : (
                  studentActivities.map((activity) => (
                    <View key={activity.pickup_id} style={styles.activityItem}>
                      <View style={styles.activityHeader}>
                        <View style={styles.activityInfo}>
                          <Ionicons
                            name={getStatusIcon(activity.status) as any}
                            size={16}
                            color={getStatusColor(activity.status)}
                          />
                          <Text style={[styles.activityStatus, { color: getStatusColor(activity.status) }]}>
                            {getStatusText(activity.status)}
                          </Text>
                        </View>
                        <Text style={styles.activityDate}>
                          {formatDate(activity.pickup_time)}
                        </Text>
                      </View>
                      <Text style={styles.activityTime}>
                        เวลาขึ้นรถ: {formatDateTime(activity.pickup_time)}
                      </Text>
                      {activity.dropoff_time && (
                        <Text style={styles.activityTime}>
                          เวลาลงรถ: {formatDateTime(activity.dropoff_time)}
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </View>

              {/* ประวัติการกดปุ่มฉุกเฉิน */}
              {emergencyEvents.length > 0 && (
                <View style={[styles.card, shadow]}>
                  <Text style={styles.cardTitle}>ประวัติการกดปุ่มฉุกเฉิน</Text>
                  {emergencyEvents.map((event) => (
                    <View key={event.event_id} style={styles.emergencyItem}>
                      <View style={styles.emergencyHeader}>
                        <Ionicons name="warning" size={16} color={COLORS.danger} />
                        <Text style={styles.emergencyType}>
                          {getEventTypeText(event.event_type)}
                        </Text>
                        <Text style={styles.emergencyTime}>
                          {formatDateTime(event.event_time)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  studentList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  studentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentInfo: {
    flex: 1,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  studentDetails: {
    gap: 4,
  },
  studentDetail: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  placeholder: {
    width: 32,
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    width: 100,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
  attendanceContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  attendanceRate: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  attendanceLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
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
    marginBottom: 4,
  },
  activityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  activityDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  activityTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emergencyItem: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emergencyType: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
    flex: 1,
  },
  emergencyTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  realtimeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 12,
  },
  lastUpdateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  updateNotification: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  updateNotificationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default IndividualView;