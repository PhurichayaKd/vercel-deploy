// scripts/test-postback.js
import { handleLeaveFormPostback, handleLeaveReasonInput, userFormStates } from '../lib/handlers.js';
import dotenv from 'dotenv';

// โหลด environment variables
dotenv.config();

// Mock LINE client โดยการแทนที่ในไฟล์ line.js
import { lineClient } from '../lib/line.js';

// สำรองฟังก์ชันเดิม
const originalReplyMessage = lineClient.replyMessage;

// แทนที่ด้วย mock function
lineClient.replyMessage = async (replyToken, message) => {
  console.log('📤 ส่งข้อความ reply (mock):');
  console.log('🎯 Reply Token:', replyToken);
  console.log('💬 Message:', JSON.stringify(message, null, 2));
  return { success: true };
};

// ฟังก์ชันสำหรับคืนค่าเดิม
function restoreLineClient() {
  lineClient.replyMessage = originalReplyMessage;
}

async function testPostback() {
  console.log('🧪 ทดสอบ postback events...');
  
  const userId = 'tartar-c-v';
  
  try {
    // ทดสอบ postback สำหรับเลือกประเภทการลา
    console.log('\n1️⃣ ทดสอบการเลือกประเภทการลา (ลาป่วย)...');
    const postbackEvent = {
      type: 'postback',
      postback: {
        data: 'leave_form_sick_10_2025-09-18'
      },
      source: {
        userId: userId
      },
      replyToken: 'test-reply-token-1'
    };
    
    await handleLeaveFormPostback(postbackEvent, 'leave_form_sick_10_2025-09-18');
    
    // ตรวจสอบ form state
    console.log('\n📊 สถานะฟอร์มหลังจากเลือกประเภท:');
    console.log(userFormStates.get(userId));
    
    // ทดสอบการกรอกเหตุผล
    console.log('\n2️⃣ ทดสอบการกรอกเหตุผลการลา...');
    const reasonEvent = {
      type: 'message',
      message: {
        type: 'text',
        text: 'ป่วยเป็นไข้'
      },
      source: {
        userId: userId
      },
      replyToken: 'test-reply-token-2'
    };
    
    await handleLeaveReasonInput(reasonEvent, 'ป่วยเป็นไข้');
    
    console.log('\n✅ ทดสอบ postback สำเร็จ!');
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// รันการทดสอบ
testPostback();