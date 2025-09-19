// lib/notifications.js
import { lineClient } from './line.js';
import { supabase } from './db.js';

// ฟังก์ชันหลักสำหรับส่งการแจ้งเตือนให้ผู้ปกครอง
async function notifyParent(studentId, notificationType, payload) {
  try {
    console.log(`📢 Sending notification for student ${studentId}: ${notificationType}`);
    
    // ค้นหา LINE User ID ของผู้ปกครอง
    const { data: parentLink } = await supabase
      .from('parent_line_links')
      .select(`
        line_user_id,
        parents(name),
        students(name, student_id)
      `)
      .eq('students.student_id', studentId)
      .single();
    
    if (!parentLink || !parentLink.line_user_id) {
      console.log(`⚠️ No LINE account linked for student ${studentId}`);
      return false;
    }
    
    // สร้างข้อความตามประเภทการแจ้งเตือน
    const message = createNotificationMessage(notificationType, payload, parentLink.students.name);
    
    // ส่งข้อความ
    await lineClient.pushMessage(parentLink.line_user_id, message);
    
    // บันทึก log การส่ง
    await logNotification({
      student_id: studentId,
      parent_id: parentLink.parents?.id,
      line_user_id: parentLink.line_user_id,
      notification_type: notificationType,
      message_content: JSON.stringify(message),
      payload: JSON.stringify(payload),
      status: 'sent'
    });
    
    console.log(`✅ Notification sent successfully to ${parentLink.line_user_id}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error sending notification:`, error);
    
    // บันทึก error log
    await logNotification({
      student_id: studentId,
      notification_type: notificationType,
      payload: JSON.stringify(payload),
      status: 'failed',
      error_message: error.message
    });
    
    return false;
  }
}

// สร้างข้อความแจ้งเตือนตามประเภท
function createNotificationMessage(type, payload, studentName) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('th-TH', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const dateStr = now.toLocaleDateString('th-TH');
  
  switch (type) {
    case 'pickup':
      return {
        type: 'text',
        text: `🚌 ขึ้นรถแล้ว\n\n👤 ${studentName}\n⏰ เวลา: ${timeStr}\n📍 สถานที่: ${payload.location || 'ไม่ระบุ'}\n🚍 รถ: ${payload.busNumber || 'ไม่ระบุ'}\n\n✅ นักเรียนขึ้นรถเรียบร้อยแล้ว`
      };
    
    case 'dropoff':
      return {
        type: 'text',
        text: `🏠 ลงรถแล้ว\n\n👤 ${studentName}\n⏰ เวลา: ${timeStr}\n📍 สถานที่: ${payload.location || 'โรงเรียน'}\n🚍 รถ: ${payload.busNumber || 'ไม่ระบุ'}\n\n✅ นักเรียนถึงจุดหมายเรียบร้อยแล้ว`
      };
    
    case 'emergency':
      return {
        type: 'text',
        text: `🚨 แจ้งเหตุฉุกเฉิน\n\n👤 ${studentName}\n⏰ เวลา: ${timeStr}\n🚍 รถ: ${payload.busNumber || 'ไม่ระบุ'}\n📍 พิกัด: ${payload.coordinates || 'ไม่ระบุ'}\n\n⚠️ กรุณาติดต่อโรงเรียนหรือโทร 191 ทันที`
      };
    
    case 'approaching':
      return {
        type: 'text',
        text: `🚌 ใกล้ถึงแล้ว\n\n👤 ${studentName}\n📍 จุดรับ-ส่ง: ${payload.stopName || 'ไม่ระบุ'}\n⏱️ ประมาณ: ${payload.estimatedMinutes || 5} นาที\n🚍 รถ: ${payload.busNumber || 'ไม่ระบุ'}\n\n🏃‍♂️ กรุณาเตรียมตัวรอรับ`
      };
    
    case 'absent_alert':
      return {
        type: 'text',
        text: `⚠️ แจ้งเตือนขาดเรียน\n\n👤 ${studentName}\n📅 วันที่: ${dateStr}\n⏰ เวลา: ${timeStr}\n\n❓ ไม่พบการขึ้นรถในเวลาปกติ\nหากนักเรียนลาหยุด กรุณาแจ้งผ่านระบบ`
      };
    
    case 'late_pickup':
      return {
        type: 'text',
        text: `⏰ แจ้งเตือนรถล่าช้า\n\n👤 ${studentName}\n📍 จุดรับ: ${payload.stopName || 'ไม่ระบุ'}\n⏱️ ล่าช้า: ${payload.delayMinutes || 'ไม่ระบุ'} นาที\n🚍 รถ: ${payload.busNumber || 'ไม่ระบุ'}\n\n🙏 ขออภัยในความไม่สะดวก`
      };
    
    default:
      return {
        type: 'text',
        text: `📢 แจ้งเตือนจากระบบ Safety Bus\n\n👤 ${studentName}\n⏰ เวลา: ${timeStr}\n\n${payload.message || 'ไม่มีรายละเอียด'}`
      };
  }
}

// ฟังก์ชันส่งการแจ้งเตือนหลายคนพร้อมกัน
async function notifyMultipleParents(notifications) {
  const results = await Promise.allSettled(
    notifications.map(({ studentId, type, payload }) => 
      notifyParent(studentId, type, payload)
    )
  );
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed = results.length - successful;
  
  console.log(`📊 Bulk notification results: ${successful} sent, ${failed} failed`);
  
  return { successful, failed, results };
}

// ฟังก์ชันส่งการแจ้งเตือนฉุกเฉิน (ส่งให้ทุกคน)
async function broadcastEmergency(payload) {
  try {
    // ดึงรายชื่อผู้ปกครองทั้งหมดที่มี LINE
    const { data: parentLinks } = await supabase
      .from('parent_line_links')
      .select(`
        line_user_id,
        parents(name),
        students(name)
      `);
    
    if (!parentLinks || parentLinks.length === 0) {
      console.log('⚠️ No parents with LINE accounts found');
      return false;
    }
    
    const message = {
      type: 'text',
      text: `🚨 แจ้งเตือนฉุกเฉิน - Safety Bus\n\n⏰ เวลา: ${new Date().toLocaleString('th-TH')}\n🚍 รถ: ${payload.busNumber || 'ไม่ระบุ'}\n📍 สถานที่: ${payload.location || 'ไม่ระบุ'}\n\n${payload.message || 'เกิดเหตุฉุกเฉิน กรุณาติดต่อโรงเรียนทันที'}\n\n📞 โทรฉุกเฉิน: 191`
    };
    
    // ส่งข้อความให้ทุกคน
    const results = await Promise.allSettled(
      parentLinks.map(link => 
        lineClient.pushMessage(link.line_user_id, message)
      )
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;
    
    console.log(`🚨 Emergency broadcast: ${successful} sent, ${failed} failed`);
    
    // บันทึก log
    await logNotification({
      notification_type: 'emergency_broadcast',
      message_content: JSON.stringify(message),
      payload: JSON.stringify(payload),
      status: 'sent',
      recipients_count: parentLinks.length,
      successful_count: successful,
      failed_count: failed
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error broadcasting emergency:', error);
    return false;
  }
}

// บันทึก log การส่งการแจ้งเตือน
async function logNotification(logData) {
  try {
    await supabase
      .from('notification_logs')
      .insert({
        ...logData,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('❌ Error logging notification:', error);
  }
}

// ฟังก์ชันทดสอบการส่งข้อความ
async function testNotification(lineUserId, message = 'ทดสอบระบบการแจ้งเตือน') {
  try {
    await lineClient.pushMessage(lineUserId, {
      type: 'text',
      text: `🧪 ${message}\n\n⏰ ${new Date().toLocaleString('th-TH')}\n\n✅ ระบบทำงานปกติ`
    });
    
    console.log(`✅ Test notification sent to ${lineUserId}`);
    return true;
  } catch (error) {
    console.error('❌ Test notification failed:', error);
    return false;
  }
}

export {
  notifyParent,
  notifyMultipleParents,
  broadcastEmergency,
  createNotificationMessage,
  logNotification,
  testNotification
};