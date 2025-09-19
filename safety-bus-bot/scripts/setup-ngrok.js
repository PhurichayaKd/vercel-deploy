import { spawn } from 'child_process';
import { Client } from '@line/bot-sdk';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

console.log('🚀 ตั้งค่า ngrok และอัปเดต Webhook URL');
console.log('==================================================');

async function setupNgrok() {
  console.log('📋 ขั้นตอนการตั้งค่า:');
  console.log('1. 🔧 เริ่ม ngrok tunnel');
  console.log('2. 🌐 ดึง public URL');
  console.log('3. 📝 อัปเดต webhook URL ใน LINE');
  console.log('4. ✅ ทดสอบการเชื่อมต่อ\n');
  
  console.log('⚠️ คำแนะนำ:');
  console.log('1. ติดตั้ง ngrok ก่อน: npm install -g ngrok');
  console.log('2. รันคำสั่งนี้ในอีก terminal หนึ่ง: ngrok http 3000');
  console.log('3. คัดลอก HTTPS URL ที่ได้ (เช่น https://abc123.ngrok.io)');
  console.log('4. ไปที่ LINE Developers Console');
  console.log('5. อัปเดต Webhook URL เป็น: https://abc123.ngrok.io/webhook');
  console.log('6. กด "Verify" เพื่อทดสอบ');
  console.log('7. เปิดใช้งาน "Use webhook"\n');
  
  // ตรวจสอบ ngrok API
  console.log('🔍 ตรวจสอบ ngrok tunnels ที่มีอยู่...');
  try {
    const response = await axios.get('http://localhost:4040/api/tunnels');
    const tunnels = response.data.tunnels;
    
    if (tunnels.length === 0) {
      console.log('❌ ไม่พบ ngrok tunnel ที่ทำงานอยู่');
      console.log('💡 กรุณารันคำสั่ง: ngrok http 3000');
      return;
    }
    
    // หา HTTPS tunnel
    const httpsTunnel = tunnels.find(tunnel => tunnel.proto === 'https');
    if (!httpsTunnel) {
      console.log('❌ ไม่พบ HTTPS tunnel');
      return;
    }
    
    const ngrokUrl = httpsTunnel.public_url;
    const webhookUrl = `${ngrokUrl}/webhook`;
    
    console.log(`✅ พบ ngrok tunnel: ${ngrokUrl}`);
    console.log(`🎯 Webhook URL: ${webhookUrl}`);
    
    // ทดสอบการเชื่อมต่อ
    console.log('\n🧪 ทดสอบการเชื่อมต่อ...');
    try {
      const testResponse = await axios.get(`${ngrokUrl}/health`);
      console.log(`✅ การเชื่อมต่อสำเร็จ (Status: ${testResponse.status})`);
    } catch (error) {
      console.log(`❌ การเชื่อมต่อล้มเหลว: ${error.message}`);
      return;
    }
    
    // แสดงขั้นตอนการอัปเดต webhook
    console.log('\n📝 ขั้นตอนการอัปเดต Webhook URL:');
    console.log('1. เข้า https://developers.line.biz/');
    console.log('2. เลือก Channel ของคุณ');
    console.log('3. ไปที่ Messaging API > Webhook settings');
    console.log(`4. อัปเดต Webhook URL เป็น: ${webhookUrl}`);
    console.log('5. กด "Update"');
    console.log('6. กด "Verify" เพื่อทดสอบ');
    console.log('7. เปิดใช้งาน "Use webhook"');
    
    console.log('\n🎉 เมื่อตั้งค่าเสร็จแล้ว:');
    console.log('- กดปุ่มใน Rich Menu บนแอป LINE');
    console.log('- ดู logs ของเซิร์ฟเวอร์');
    console.log('- ควรเห็น "🌐 [Webhook Event Received]"');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ ngrok ไม่ทำงาน');
      console.log('💡 กรุณารันคำสั่ง: ngrok http 3000');
    } else {
      console.log(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  }
}

// รันการตั้งค่า
setupNgrok()
  .catch(error => {
    console.error('❌ เกิดข้อผิดพลาดในการตั้งค่า:', error.message);
  });