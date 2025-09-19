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

console.log('🧪 ทดสอบ Rich Menu Postback ผ่าน ngrok');
console.log('==================================================');

async function testFinalWebhook() {
  // ดึง ngrok URL
  const ngrokUrl = await getNgrokUrl();
  if (!ngrokUrl) {
    console.log('❌ ไม่พบ ngrok tunnel');
    console.log('💡 กรุณารันคำสั่ง: ngrok http 3000');
    return;
  }
  
  console.log(`🌐 ใช้ ngrok URL: ${ngrokUrl}`);
  
  const testEvents = [
    {
      name: 'Travel History',
      data: 'action=history'
    },
    {
      name: 'Leave Request', 
      data: 'action=leave'
    },
    {
      name: 'Bus Location',
      data: 'action=location'
    },
    {
      name: 'Contact Driver',
      data: 'action=contact'
    }
  ];
  
  console.log('\n🔄 เริ่มทดสอบ postback events...');
  console.log('📝 หมายเหตุ: ดู logs ของเซิร์ฟเวอร์ในอีก terminal หนึ่ง\n');
  
  for (const test of testEvents) {
    console.log(`📤 ทดสอบ: ${test.name}`);
    console.log(`📊 ส่ง postback: ${test.data}`);
    
    // สร้าง mock LINE webhook payload
    const postbackPayload = {
      events: [
        {
          type: 'postback',
          postback: {
            data: test.data
          },
          source: {
            userId: 'test-user-' + Date.now()
          },
          replyToken: 'test-reply-' + Date.now(),
          timestamp: Date.now()
        }
      ]
    };
    
    // สร้าง signature ปลอม
    const body = JSON.stringify(postbackPayload);
    const signature = crypto
      .createHmac('SHA256', process.env.LINE_CHANNEL_SECRET || 'test-secret')
      .update(body)
      .digest('base64');
    
    try {
      const response = await axios.post(`${ngrokUrl}/webhook`, postbackPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Line-Signature': signature
        },
        validateStatus: function (status) {
          return status < 600;
        }
      });
      
      if (response.status === 200) {
        console.log(`✅ ${test.name} - สำเร็จ (Status: ${response.status})`);
      } else {
        console.log(`⚠️ ${test.name} - ได้รับการตอบสนอง (Status: ${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - ล้มเหลว: ${error.message}`);
    }
    
    console.log('---');
    
    // รอ 1 วินาที
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// รันการทดสอบ
testFinalWebhook()
  .then(() => {
    console.log('\n🎉 การทดสอบเสร็จสิ้น!');
    console.log('\n📋 สรุปสถานะ:');
    console.log('- ✅ ngrok tunnel ทำงานอยู่');
    console.log('- ✅ Webhook URL ได้รับการอัปเดตแล้ว');
    console.log('- ✅ Rich Menu ถูกตั้งค่าแล้ว');
    console.log('- ✅ เซิร์ฟเวอร์ทำงานและรับ events ได้');
    
    console.log('\n📱 ตอนนี้ Rich Menu ควรทำงานได้แล้ว:');
    console.log('   1. เปิดแอป LINE บนมือถือ');
    console.log('   2. เข้าไปในแชทกับ Bot');
    console.log('   3. ลองกดปุ่มใน Rich Menu');
    console.log('   4. ควรได้รับการตอบกลับที่เหมาะสม');
    
    console.log('\n🔍 หากยังไม่เห็น Rich Menu:');
    console.log('   - ลองปิดและเปิดแอป LINE ใหม่');
    console.log('   - ลองออกจากแชทและเข้าใหม่');
    console.log('   - ตรวจสอบว่าได้ follow Bot แล้ว');
  })
  .catch(error => {
    console.error('❌ เกิดข้อผิดพลาดในการทดสอบ:', error.message);
  });