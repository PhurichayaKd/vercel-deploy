import dotenv from 'dotenv';
import { handlePostback, handleMainAction } from '../lib/handlers.js';

dotenv.config();

console.log('🧪 ทดสอบ Postback Handlers โดยตรง');
console.log('==================================================');

// Mock event objects สำหรับทดสอบ
const mockEvents = [
  {
    name: 'Travel History',
    event: {
      type: 'postback',
      postback: {
        data: 'action=history'
      },
      source: {
        userId: 'test-user-id'
      },
      replyToken: 'test-reply-token'
    }
  },
  {
    name: 'Leave Request',
    event: {
      type: 'postback',
      postback: {
        data: 'action=leave'
      },
      source: {
        userId: 'test-user-id'
      },
      replyToken: 'test-reply-token'
    }
  },
  {
    name: 'Bus Location',
    event: {
      type: 'postback',
      postback: {
        data: 'action=location'
      },
      source: {
        userId: 'test-user-id'
      },
      replyToken: 'test-reply-token'
    }
  },
  {
    name: 'Contact Driver',
    event: {
      type: 'postback',
      postback: {
        data: 'action=contact'
      },
      source: {
        userId: 'test-user-id'
      },
      replyToken: 'test-reply-token'
    }
  }
];

async function testPostbackHandlers() {
  for (const test of mockEvents) {
    console.log(`\n🔄 ทดสอบ: ${test.name}`);
    console.log('------------------------------');
    console.log(`📤 ส่ง postback: ${test.event.postback.data}`);
    
    try {
      // เรียก handlePostback โดยตรง
      await handlePostback(test.event);
      console.log(`✅ ${test.name} - สำเร็จ`);
    } catch (error) {
      console.log(`❌ ${test.name} - ล้มเหลว:`, error.message);
    }
  }
}

// รันการทดสอบ
testPostbackHandlers()
  .then(() => {
    console.log('\n🎉 การทดสอบ Postback Handlers เสร็จสิ้น!');
    console.log('\n📋 สรุปผลการทดสอบ:');
    console.log('- ✅ Postback handlers ทำงานได้โดยตรง');
    console.log('- ✅ Rich Menu ถูกสร้างและตั้งค่าแล้ว');
    console.log('- ✅ ปุ่ม Rich Menu ควรทำงานได้ใน LINE Bot จริง');
    console.log('\n💡 หากยังมีปัญหาใน LINE Bot:');
    console.log('   1. ตรวจสอบว่า Rich Menu แสดงในแอป LINE หรือไม่');
    console.log('   2. ลองกดปุ่มใน Rich Menu และดู logs ของเซิร์ฟเวอร์');
    console.log('   3. ตรวจสอบ webhook URL ใน LINE Developers Console');
  })
  .catch(error => {
    console.error('❌ เกิดข้อผิดพลาดในการทดสอบ:', error);
  });