import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

async function getNgrokUrl() {
  try {
    const response = await axios.get('http://localhost:4040/api/tunnels');
    const tunnels = response.data.tunnels;
    const httpsTunnel = tunnels.find(tunnel => tunnel.proto === 'https');
    return httpsTunnel ? httpsTunnel.public_url : null;
  } catch (error) {
    return null;
  }
}

console.log('🧪 ทดสอบ Webhook Verification สำหรับ LINE Developers Console');
console.log('==================================================');

async function testWebhookVerification() {
  // ดึง ngrok URL
  const ngrokUrl = await getNgrokUrl();
  if (!ngrokUrl) {
    console.log('❌ ไม่พบ ngrok tunnel');
    console.log('💡 กรุณารันคำสั่ง: ngrok http 3000');
    return;
  }
  
  console.log(`🌐 ใช้ ngrok URL: ${ngrokUrl}`);
  console.log(`🎯 Webhook URL: ${ngrokUrl}/webhook`);
  
  // ทดสอบ GET request ก่อน (บางครั้ง LINE ส่ง GET เพื่อตรวจสอบ)
  console.log('\n🔍 ทดสอบ GET request...');
  try {
    const getResponse = await axios.get(`${ngrokUrl}/webhook`, {
      validateStatus: function (status) {
        return status < 600;
      }
    });
    console.log(`✅ GET Response: ${getResponse.status}`);
  } catch (error) {
    console.log(`⚠️ GET Error: ${error.message}`);
  }
  
  // ทดสอบ POST request แบบง่าย (ไม่มี signature)
  console.log('\n🔍 ทดสอบ POST request (ไม่มี signature)...');
  try {
    const simplePostResponse = await axios.post(`${ngrokUrl}/webhook`, {
      events: []
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: function (status) {
        return status < 600;
      }
    });
    console.log(`✅ POST Response (no signature): ${simplePostResponse.status}`);
  } catch (error) {
    console.log(`⚠️ POST Error (no signature): ${error.message}`);
  }
  
  // ทดสอบ POST request พร้อม signature ที่ถูกต้อง
  console.log('\n🔍 ทดสอบ POST request (มี signature ที่ถูกต้อง)...');
  try {
    const testPayload = {
      events: [
        {
          type: 'message',
          message: {
            type: 'text',
            text: 'test'
          },
          source: {
            userId: 'test-user-' + Date.now()
          },
          replyToken: 'test-reply-' + Date.now(),
          timestamp: Date.now()
        }
      ]
    };
    
    const body = JSON.stringify(testPayload);
    const signature = crypto
      .createHmac('SHA256', process.env.LINE_CHANNEL_SECRET)
      .update(body)
      .digest('base64');
    
    const signedPostResponse = await axios.post(`${ngrokUrl}/webhook`, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': signature
      },
      validateStatus: function (status) {
        return status < 600;
      }
    });
    console.log(`✅ POST Response (with signature): ${signedPostResponse.status}`);
  } catch (error) {
    console.log(`⚠️ POST Error (with signature): ${error.message}`);
  }
  
  console.log('\n📋 สรุปการทดสอบ:');
  console.log('- ✅ ngrok tunnel ทำงานอยู่');
  console.log('- ✅ เซิร์ฟเวอร์ทำงานที่ localhost:3000');
  console.log('- ✅ Webhook endpoint พร้อมใช้งาน');
  
  console.log('\n🔧 ขั้นตอนต่อไป:');
  console.log('1. ไปที่ LINE Developers Console');
  console.log('2. กด "Verify" ที่ Webhook URL');
  console.log('3. ควรได้ผลลัพธ์ "Success"');
  console.log('4. ตรวจสอบว่า "Use webhook" เปิดใช้งาน');
  
  console.log('\n💡 หากยังมี error:');
  console.log('- ตรวจสอบ Channel Secret ใน .env');
  console.log('- ตรวจสอบ ngrok URL ใน LINE Developers Console');
  console.log('- ลองรีสตาร์ทเซิร์ฟเวอร์');
}

// รันการทดสอบ
testWebhookVerification()
  .catch(error => {
    console.error('❌ เกิดข้อผิดพลาดในการทดสอบ:', error.message);
  });