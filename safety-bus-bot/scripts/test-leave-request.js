// scripts/test-leave-request.js
import { createLeaveForm } from '../lib/leave-form.js';
import { checkLinkStatus } from '../lib/account-linking.js';
import dotenv from 'dotenv';

// โหลด environment variables
dotenv.config();

async function testLeaveRequest() {
  console.log('🧪 ทดสอบฟังก์ชัน createLeaveForm...');
  
  const userId = 'tartar-c-v';
  
  try {
    // ตรวจสอบสถานะการเชื่อมโยงบัญชี
    console.log('🔍 ตรวจสอบสถานะการเชื่อมโยงบัญชี...');
    const linkStatus = await checkLinkStatus(userId);
    console.log('📊 สถานะการเชื่อมโยง:', linkStatus);
    
    if (!linkStatus.isLinked) {
      console.log('❌ บัญชีไม่ได้เชื่อมโยง');
      return;
    }
    
    // สร้างฟอร์มแจ้งลา
    console.log('📝 สร้างฟอร์มแจ้งลา...');
    const leaveForm = await createLeaveForm(userId);
    
    console.log('✅ สร้างฟอร์มสำเร็จ!');
    console.log('📋 ข้อมูลฟอร์ม:');
    console.log(JSON.stringify(leaveForm, null, 2));
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// รันการทดสอบ
testLeaveRequest();