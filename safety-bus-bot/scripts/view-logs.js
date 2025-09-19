// scripts/view-logs.js
import dotenv from 'dotenv';
import { supabase } from '../lib/db.js';
import moment from 'moment';

dotenv.config();

// ตั้งค่า timezone เป็นไทย
moment.locale('th');

async function viewLogs(options = {}) {
  const {
    limit = 50,
    type = 'all', // 'all', 'notification', 'api', 'error'
    hours = 24 // ดู logs ย้อนหลัง x ชั่วโมง
  } = options;

  try {
    console.log(`📊 แสดง Logs ย้อนหลัง ${hours} ชั่วโมง (จำนวน ${limit} รายการ)\n`);
    
    // คำนวณเวลาย้อนหลัง
    const timeAgo = moment().subtract(hours, 'hours').toISOString();
    
    // ดู Notification Logs
    if (type === 'all' || type === 'notification') {
      console.log('🔔 === NOTIFICATION LOGS ===');
      const { data: notificationLogs, error: notError } = await supabase
        .from('notification_logs')
        .select(`
          *,
          students(student_name),
          parents(parent_name)
        `)
        .gte('created_at', timeAgo)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (notError) {
        console.error('❌ ข้อผิดพลาดในการดึง notification logs:', notError.message);
      } else if (notificationLogs && notificationLogs.length > 0) {
        notificationLogs.forEach(log => {
          const time = moment(log.created_at).format('DD/MM/YYYY HH:mm:ss');
          const status = log.success ? '✅' : '❌';
          const studentName = log.students?.student_name || 'ไม่ระบุ';
          const parentName = log.parents?.parent_name || 'ไม่ระบุ';
          
          console.log(`${status} [${time}] ${log.notification_type}`);
          console.log(`   👨‍👩‍👧‍👦 ${parentName} (นักเรียน: ${studentName})`);
          console.log(`   📱 LINE ID: ${log.line_user_id}`);
          console.log(`   💬 ข้อความ: ${log.message_preview}`);
          if (!log.success && log.error_message) {
            console.log(`   ⚠️  ข้อผิดพลาด: ${log.error_message}`);
          }
          console.log('');
        });
      } else {
        console.log('   ไม่มี notification logs ในช่วงเวลาที่กำหนด\n');
      }
    }

    // ดู API Logs (ถ้ามีตาราง api_logs)
    if (type === 'all' || type === 'api') {
      console.log('🔌 === API LOGS ===');
      const { data: apiLogs, error: apiError } = await supabase
        .from('api_logs')
        .select('*')
        .gte('created_at', timeAgo)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (apiError && !apiError.message.includes('relation "api_logs" does not exist')) {
        console.error('❌ ข้อผิดพลาดในการดึง API logs:', apiError.message);
      } else if (apiLogs && apiLogs.length > 0) {
        apiLogs.forEach(log => {
          const time = moment(log.created_at).format('DD/MM/YYYY HH:mm:ss');
          const status = log.status_code < 400 ? '✅' : '❌';
          
          console.log(`${status} [${time}] ${log.method} ${log.endpoint}`);
          console.log(`   📊 Status: ${log.status_code}`);
          console.log(`   🔑 API Key: ${log.api_key_used || 'ไม่ระบุ'}`);
          if (log.error_message) {
            console.log(`   ⚠️  ข้อผิดพลาด: ${log.error_message}`);
          }
          console.log('');
        });
      } else {
        console.log('   ไม่มี API logs หรือยังไม่ได้สร้างตาราง api_logs\n');
      }
    }

    // สถิติสรุป
    console.log('📈 === สถิติสรุป ===');
    
    // นับจำนวน notifications ที่สำเร็จ/ล้มเหลว
    const { data: notStats } = await supabase
      .from('notification_logs')
      .select('success')
      .gte('created_at', timeAgo);
    
    if (notStats) {
      const successful = notStats.filter(n => n.success).length;
      const failed = notStats.filter(n => !n.success).length;
      const total = notStats.length;
      
      console.log(`📤 การแจ้งเตือนทั้งหมด: ${total} รายการ`);
      console.log(`✅ สำเร็จ: ${successful} รายการ (${total > 0 ? Math.round(successful/total*100) : 0}%)`);
      console.log(`❌ ล้มเหลว: ${failed} รายการ (${total > 0 ? Math.round(failed/total*100) : 0}%)`);
    }
    
    // นับจำนวนผู้ใช้ที่ผูกบัญชีแล้ว
    const { data: linkedUsers } = await supabase
      .from('parent_line_links')
      .select('id')
      .eq('active', true);
    
    if (linkedUsers) {
      console.log(`👥 ผู้ปกครองที่ผูกบัญชีแล้ว: ${linkedUsers.length} คน`);
    }
    
    console.log('\n✨ เสร็จสิ้นการแสดง logs');
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการดึงข้อมูล logs:', error.message);
    
    if (error.message.includes('JWT')) {
      console.log('💡 กรุณาตรวจสอบ SUPABASE_URL และ SUPABASE_ANON_KEY ในไฟล์ .env');
    }
    
    process.exit(1);
  }
}

// ฟังก์ชันสำหรับดู logs แบบ real-time (ทางเลือก)
async function watchLogs() {
  console.log('👀 กำลังติดตาม logs แบบ real-time... (กด Ctrl+C เพื่อหยุด)\n');
  
  // ดู logs ทุก 5 วินาที
  setInterval(async () => {
    console.clear();
    console.log('🔄 อัพเดต:', moment().format('DD/MM/YYYY HH:mm:ss'));
    console.log('=' .repeat(50));
    await viewLogs({ limit: 10, hours: 1 });
  }, 5000);
}

// Command line interface
// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'watch') {
    watchLogs();
  } else {
    const options = {};
    
    // Parse command line arguments
    args.forEach(arg => {
      if (arg.startsWith('--limit=')) {
        options.limit = parseInt(arg.split('=')[1]);
      } else if (arg.startsWith('--type=')) {
        options.type = arg.split('=')[1];
      } else if (arg.startsWith('--hours=')) {
        options.hours = parseInt(arg.split('=')[1]);
      }
    });
    
    viewLogs(options);
  }
}

export { viewLogs, watchLogs };