// scripts/test-real-webhook.js
import crypto from 'crypto';
import dotenv from 'dotenv';

// โหลด environment variables
dotenv.config();

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const WEBHOOK_URL = 'http://localhost:3000/webhook';

function createSignature(body, secret) {
  return crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');
}

async function testWebhook() {
  console.log('🧪 ทดสอบ webhook จริง...');
  
  const userId = 'tartar-c-v';
  
  // สร้าง event สำหรับข้อความ "แจ้งลา"
  const event = {
    events: [
      {
        type: 'message',
        message: {
          type: 'text',
          text: 'แจ้งลา'
        },
        source: {
          userId: userId
        },
        replyToken: 'test-reply-token-webhook',
        timestamp: Date.now()
      }
    ],
    destination: 'test'
  };
  
  const body = JSON.stringify(event);
  const signature = createSignature(body, CHANNEL_SECRET);
  
  try {
    console.log('📤 ส่งข้อความ "แจ้งลา" ไปยัง webhook...');
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': signature
      },
      body: body
    });
    
    console.log('📊 สถานะการตอบกลับ:', response.status);
    
    if (response.ok) {
      console.log('✅ ส่งข้อความสำเร็จ!');
      const responseText = await response.text();
      if (responseText) {
        console.log('📝 Response:', responseText);
      }
    } else {
      console.log('❌ เกิดข้อผิดพลาด:', response.statusText);
      const errorText = await response.text();
      console.log('📝 Error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ:', error.message);
  }
}

// รันการทดสอบ
testWebhook();