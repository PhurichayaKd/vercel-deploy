// routes/api.js
import express from 'express';
import { supabase } from '../lib/db.js';
import { notifyParent, notifyMultipleParents, broadcastEmergency } from '../lib/notifications.js';
import {
  createValidationMiddleware,
  apiKeyMiddleware,
  rfidScanSchema,
  emergencySchema,
  busLocationSchema,
  delayNotificationSchema,
  attendanceCheckSchema,
  testNotificationSchema,
  linkAccountSchema
} from '../lib/validation.js';
import { linkByStudentId, checkLinkStatus } from '../lib/account-linking.js';
import { getStudentByLineId } from '../lib/student-data.js';
import { saveLeaveRequest } from '../lib/leave-form.js';
import jwt from 'jsonwebtoken';
const router = express.Router();

// ใช้ middleware สำหรับทุก route ยกเว้น LIFF endpoints
router.use((req, res, next) => {
  // ยกเว้น LIFF endpoints จาก API key validation
  if (req.path === '/student-info' || req.path === '/submit-leave') {
    return next();
  }
  return apiKeyMiddleware(req, res, next);
});

// API สำหรับบันทึกการขึ้น-ลงรถ (จาก RFID Scanner)
router.post('/rfid-scan', createValidationMiddleware(rfidScanSchema), async (req, res) => {
  try {
    const { 
      student_id, 
      rfid_tag, 
      scan_type, // 'pickup' หรือ 'dropoff'
      bus_number,
      location,
      coordinates,
      timestamp 
    } = req.body;
    
    console.log(`📡 RFID Scan received: ${student_id} - ${scan_type}`);
    
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!student_id || !scan_type) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['student_id', 'scan_type'] 
      });
    }
    
    // ตรวจสอบว่านักเรียนมีอยู่ในระบบ
    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', student_id)
      .single();
    
    if (!student) {
      return res.status(404).json({ 
        error: 'Student not found', 
        student_id 
      });
    }
    
    // บันทึกข้อมูลการเดินทาง
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        student_id,
        type: scan_type,
        bus_number,
        location,
        coordinates,
        rfid_tag,
        timestamp: timestamp || new Date().toISOString()
      })
      .select()
      .single();
    
    if (tripError) {
      console.error('❌ Error saving trip:', tripError);
      return res.status(500).json({ error: 'Failed to save trip data' });
    }
    
    // ส่งการแจ้งเตือนให้ผู้ปกครอง
    const notificationSent = await notifyParent(student_id, scan_type, {
      location,
      busNumber: bus_number,
      coordinates,
      timestamp
    });
    
    res.json({
      success: true,
      trip_id: trip.id,
      notification_sent: notificationSent,
      message: `${scan_type} recorded successfully`
    });
    
  } catch (error) {
    console.error('❌ RFID scan error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// API สำหรับแจ้งเหตุฉุกเฉิน
router.post('/emergency', createValidationMiddleware(emergencySchema), async (req, res) => {
  try {
    const {
      bus_number,
      location,
      coordinates,
      emergency_type, // 'fire', 'accident', 'medical', 'other'
      description,
      severity, // 'low', 'medium', 'high', 'critical'
      reported_by // 'driver', 'sensor', 'student', 'manual'
    } = req.body;
    
    console.log(`🚨 Emergency alert: ${emergency_type} on bus ${bus_number}`);
    
    // บันทึกเหตุฉุกเฉิน
    const { data: emergency, error: emergencyError } = await supabase
      .from('emergencies')
      .insert({
        bus_number,
        location,
        coordinates,
        emergency_type,
        description,
        severity: severity || 'medium',
        reported_by: reported_by || 'system',
        status: 'active',
        timestamp: new Date().toISOString()
      })
      .select()
      .single();
    
    if (emergencyError) {
      console.error('❌ Error saving emergency:', emergencyError);
      return res.status(500).json({ error: 'Failed to save emergency data' });
    }
    
    // ส่งการแจ้งเตือนฉุกเฉินให้ทุกคน
    const broadcastSent = await broadcastEmergency({
      busNumber: bus_number,
      location,
      coordinates,
      emergencyType: emergency_type,
      description,
      severity
    });
    
    res.json({
      success: true,
      emergency_id: emergency.id,
      broadcast_sent: broadcastSent,
      message: 'Emergency alert sent'
    });
    
  } catch (error) {
    console.error('❌ Emergency alert error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// API สำหรับอัพเดตตำแหน่งรถ (จากแอปคนขับ)
router.post('/bus-location', createValidationMiddleware(busLocationSchema), async (req, res) => {
  try {
    const {
      bus_number,
      driver_id,
      latitude,
      longitude,
      speed,
      heading,
      accuracy,
      timestamp
    } = req.body;
    
    if (!bus_number || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['bus_number', 'latitude', 'longitude'] 
      });
    }
    
    // บันทึกตำแหน่งรถ
    const { error: locationError } = await supabase
      .from('bus_locations')
      .upsert({
        bus_number,
        driver_id,
        latitude,
        longitude,
        speed: speed || 0,
        heading: heading || 0,
        accuracy: accuracy || 0,
        timestamp: timestamp || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'bus_number'
      });
    
    if (locationError) {
      console.error('❌ Error saving location:', locationError);
      return res.status(500).json({ error: 'Failed to save location data' });
    }
    
    // ตรวจสอบ Geo-fence (ใกล้จุดรับ-ส่ง)
    await checkGeofence(bus_number, latitude, longitude);
    
    res.json({
      success: true,
      message: 'Location updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Location update error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// API สำหรับแจ้งความล่าช้า
router.post('/delay-notification', createValidationMiddleware(delayNotificationSchema), async (req, res) => {
  try {
    const {
      bus_number,
      route_id,
      delay_minutes,
      reason,
      affected_stops
    } = req.body;
    
    console.log(`⏰ Delay notification: Bus ${bus_number} delayed ${delay_minutes} minutes`);
    
    // ดึงรายชื่อนักเรียนที่ได้รับผลกระทบ
    const { data: affectedStudents } = await supabase
      .from('students')
      .select('student_id')
      .in('pickup_stop', affected_stops || []);
    
    if (affectedStudents && affectedStudents.length > 0) {
      // ส่งการแจ้งเตือนให้ผู้ปกครองที่ได้รับผลกระทบ
      const notifications = affectedStudents.map(student => ({
        studentId: student.student_id,
        type: 'late_pickup',
        payload: {
          busNumber: bus_number,
          delayMinutes: delay_minutes,
          reason,
          stopName: affected_stops?.[0] || 'ไม่ระบุ'
        }
      }));
      
      await notifyMultipleParents(notifications);
    }
    
    res.json({
      success: true,
      affected_students: affectedStudents?.length || 0,
      message: 'Delay notification sent'
    });
    
  } catch (error) {
    console.error('❌ Delay notification error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// API สำหรับตรวจสอบการขาดเรียน
router.post('/check-attendance', createValidationMiddleware(attendanceCheckSchema), async (req, res) => {
  try {
    const { date, route_id } = req.body;
    const checkDate = date || new Date().toISOString().split('T')[0];
    
    console.log(`📊 Checking attendance for ${checkDate}`);
    
    // ดึงรายชื่อนักเรียนที่ควรมาเรียน
    const { data: expectedStudents } = await supabase
      .from('students')
      .select('student_id, name')
      .eq('active', true);
    
    if (!expectedStudents) {
      return res.json({ success: true, absent_students: [] });
    }
    
    // ตรวจสอบว่าใครขึ้นรถแล้วบ้าง
    const { data: presentStudents } = await supabase
      .from('trips')
      .select('student_id')
      .eq('type', 'pickup')
      .gte('timestamp', `${checkDate}T00:00:00Z`)
      .lt('timestamp', `${checkDate}T23:59:59Z`);
    
    const presentIds = presentStudents?.map(s => s.student_id) || [];
    
    // ตรวจสอบใครลาหยุด
    const { data: onLeave } = await supabase
      .from('student_leaves')
      .select('student_id')
      .eq('leave_date', checkDate)
      .eq('status', 'approved');
    
    const leaveIds = onLeave?.map(s => s.student_id) || [];
    
    // หานักเรียนที่ขาดเรียน (ไม่ขึ้นรถและไม่ได้ลา)
    const absentStudents = expectedStudents.filter(student => 
      !presentIds.includes(student.student_id) && 
      !leaveIds.includes(student.student_id)
    );
    
    // ส่งการแจ้งเตือนขาดเรียน
    if (absentStudents.length > 0) {
      const notifications = absentStudents.map(student => ({
        studentId: student.student_id,
        type: 'absent_alert',
        payload: {
          date: checkDate,
          studentName: student.name
        }
      }));
      
      await notifyMultipleParents(notifications);
    }
    
    res.json({
      success: true,
      date: checkDate,
      total_students: expectedStudents.length,
      present_students: presentIds.length,
      on_leave: leaveIds.length,
      absent_students: absentStudents.length,
      absent_list: absentStudents
    });
    
  } catch (error) {
    console.error('❌ Attendance check error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// ฟังก์ชันตรวจสอบ Geo-fence
async function checkGeofence(busNumber, latitude, longitude) {
  try {
    // ดึงข้อมูลจุดรับ-ส่งทั้งหมด
    const { data: stops } = await supabase
      .from('bus_stops')
      .select('*')
      .eq('active', true);
    
    if (!stops) return;
    
    for (const stop of stops) {
      const distance = calculateDistance(
        latitude, longitude,
        stop.latitude, stop.longitude
      );
      
      // ถ้าอยู่ในรัศมี 500 เมตร
      if (distance <= 0.5) {
        console.log(`📍 Bus ${busNumber} approaching ${stop.name}`);
        
        // ดึงรายชื่อนักเรียนที่ใช้จุดนี้
        const { data: students } = await supabase
          .from('students')
          .select('student_id')
          .eq('pickup_stop', stop.name)
          .eq('active', true);
        
        if (students && students.length > 0) {
          // ส่งการแจ้งเตือน "ใกล้ถึงแล้ว"
          const notifications = students.map(student => ({
            studentId: student.student_id,
            type: 'approaching',
            payload: {
              stopName: stop.name,
              busNumber,
              estimatedMinutes: Math.ceil(distance * 2) // ประมาณ 2 นาทีต่อกิโลเมตร
            }
          }));
          
          await notifyMultipleParents(notifications);
        }
      }
    }
  } catch (error) {
    console.error('❌ Geofence check error:', error);
  }
}

// ฟังก์ชันคำนวณระยะทาง (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // รัศมีโลกในกิโลเมตร
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// API สำหรับทดสอบการส่งข้อความ
router.post('/test-notification', createValidationMiddleware(testNotificationSchema), async (req, res) => {
  try {
    const { student_id, notification_type, test_payload } = req.body;
    
    if (!student_id || !notification_type) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['student_id', 'notification_type'] 
      });
    }
    
    const success = await notifyParent(student_id, notification_type, test_payload || {});
    
    res.json({
      success,
      message: success ? 'Test notification sent' : 'Failed to send notification'
    });
    
  } catch (error) {
    console.error('❌ Test notification error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// API สำหรับผูกบัญชี LINE ด้วยรหัสนักเรียน
router.post('/link-by-student-id', createValidationMiddleware(linkAccountSchema), async (req, res) => {
  try {
    const { lineUserId, studentId, parentName, phoneNumber } = req.body;
    
    console.log(`🔗 Link account request: ${studentId} -> ${lineUserId}`);
    
    const result = await linkByStudentId(lineUserId, studentId, parentName, phoneNumber);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Account linked successfully',
        data: {
          link_id: result.link_id,
          parent_name: result.parent_name,
          student_name: result.student_name,
          student_id: result.student_id
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Link account error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to link account' 
    });
  }
});

// API สำหรับดึงข้อมูลนักเรียนจาก LIFF
router.post('/student-info', async (req, res) => {
  try {
    const { idToken, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing userId'
      });
    }
    
    console.log(`📋 Getting student info for LIFF: ${userId}`);
    
    // ตรวจสอบสถานะการผูกบัญชี
    const linkStatus = await checkLinkStatus(userId);
    
    if (!linkStatus.isLinked) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูลบัญชีที่ผูกไว้\n\nกรุณาผูกบัญชีด้วยรหัสนักเรียนก่อน'
      });
    }
    
    // ดึงข้อมูลนักเรียน
    const studentData = await getStudentByLineId(userId);
    
    if (!studentData) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูลนักเรียน'
      });
    }
    
    res.json({
      success: true,
      data: studentData
    });
    
  } catch (error) {
    console.error('❌ Error getting student info:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล'
    });
  }
});

// API สำหรับบันทึกการแจ้งลาจาก LIFF
router.post('/submit-leave', async (req, res) => {
  try {
    const { student_id, leave_type, leave_date, reason, parent_id } = req.body;
    
    if (!student_id || !leave_type || !leave_date || !reason) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่ครบถ้วน'
      });
    }
    
    console.log(`📝 Submitting leave request: ${student_id} - ${leave_type}`);
    
    const leaveData = {
      student_id,
      leave_type,
      leave_date,
      reason,
      parent_id: parent_id || student_id
    };
    
    const result = await saveLeaveRequest(leaveData);
    
    if (result.success) {
      console.log(`✅ Leave request saved: ${student_id}`);
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      console.log(`❌ Failed to save leave request: ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('❌ Error submitting leave:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'
    });
  }
});

export default router;