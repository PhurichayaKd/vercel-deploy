import { Client } from '@line/bot-sdk';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

console.log('🔄 อัปเดต Webhook URL ใน LINE Bot');
console.log('==================================================');

async function updateWebhookUrl() {
  try {
    // ดึง ngrok URL
    console.log('🔍 ดึงข้อมูล ngrok tunnel...');
    const response = await axios.get('http://localhost:4040/api/tunnels');
    const tunnels = response.data.tunnels;
    
    if (tunnels.length === 0) {
      console.log('❌ ไม่พบ ngrok tunnel');
      console.log('💡 กรุณารันคำสั่ง: ngrok http 3000');
      return;
    }
    
    const httpsTunnel = tunnels.find(tunnel => tunnel.proto === 'https');
    if (!httpsTunnel) {
      console.log('❌ ไม่พบ HTTPS tunnel');
      return;
    }
    
    const ngrokUrl = httpsTunnel.public_url;
    const webhookUrl = `${ngrokUrl}/webhook`;
    
    console.log(`✅ พบ ngrok URL: ${ngrokUrl}`);
    console.log(`🎯 Webhook URL: ${webhookUrl}`);
    
    // ทดสอบการเชื่อมต่อก่อน
    console.log('\n🧪 ทดสอบการเชื่อมต่อ...');
    try {
      const testResponse = await axios.get(`${ngrokUrl}/health`);
      console.log(`✅ การเชื่อมต่อสำเร็จ (Status: ${testResponse.status})`);
    } catch (error) {
      console.log(`❌ การเชื่อมต่อล้มเหลว: ${error.message}`);
      return;
    }
    
    // อัปเดต webhook URL
    console.log('\n📝 อัปเดต Webhook URL...');
    try {
      await client.setWebhookEndpointUrl(webhookUrl);
      console.log('✅ อัปเดต Webhook URL สำเร็จ');
    } catch (error) {
      console.log(`❌ อัปเดต Webhook URL ล้มเหลว: ${error.message}`);
      console.log('💡 กรุณาอัปเดตด้วยตนเองใน LINE Developers Console');
    }
    
    // ตรวจสอบผลลัพธ์
    console.log('\n🔍 ตรวจสอบการตั้งค่าปัจจุบัน...');
    try {
      const webhookInfo = await client.getWebhookEndpointInfo();
      console.log(`📍 Webhook URL ปัจจุบัน: ${webhookInfo.endpoint}`);
      console.log(`✅ สถานะ: ${webhookInfo.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`);
      
      if (webhookInfo.endpoint === webhookUrl) {
        console.log('🎉 Webhook URL ได้รับการอัปเดตเรียบร้อยแล้ว!');
      } else {
        console.log('⚠️ Webhook URL ยังไม่ตรงกัน กรุณาตรวจสอบ');
      }
    } catch (error) {
      console.log(`❌ ไม่สามารถดึงข้อมูล webhook: ${error.message}`);
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ ngrok ไม่ทำงาน');
      console.log('💡 กรุณารันคำสั่ง: ngrok http 3000');
    } else {
      console.log(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  }
}

// รันการอัปเดต
updateWebhookUrl()
  .then(() => {
    console.log('\n📱 ขั้นตอนสุดท้าย:');
    console.log('1. เปิดแอป LINE บนมือถือ');
    console.log('2. เข้าไปในแชทกับ Bot');
    console.log('3. ลองกดปุ่มใน Rich Menu');
    console.log('4. ดู logs ของเซิร์ฟเวอร์');
    console.log('5. ควรเห็น "🌐 [Webhook Event Received]"');
    
    console.log('\n🔧 หากยังมีปัญหา:');
    console.log('- ตรวจสอบว่า "Use webhook" เปิดใช้งานใน LINE Developers Console');
    console.log('- ลอง "Verify" webhook URL ใน LINE Developers Console');
    console.log('- ตรวจสอบว่า Rich Menu แสดงในแอป LINE');
  })
  .catch(error => {
    console.error('❌ เกิดข้อผิดพลาดในการอัปเดต:', error.message);
  });