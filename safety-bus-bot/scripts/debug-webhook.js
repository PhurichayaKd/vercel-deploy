import dotenv from 'dotenv';
import { Client } from '@line/bot-sdk';
import axios from 'axios';

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

console.log('🔍 ตรวจสอบการตั้งค่า Webhook และ Rich Menu');
console.log('==================================================');

async function debugWebhook() {
  try {
    console.log('📋 ข้อมูลการตั้งค่า:');
    console.log(`   🔑 Channel Access Token: ${process.env.LINE_CHANNEL_ACCESS_TOKEN ? 'มี' : 'ไม่มี'}`);
    console.log(`   🔐 Channel Secret: ${process.env.LINE_CHANNEL_SECRET ? 'มี' : 'ไม่มี'}`);
    console.log(`   🌐 Webhook URL: ${process.env.WEBHOOK_URL || 'ไม่ได้ตั้งค่า'}`);
    
    // ตรวจสอบ Rich Menu
    console.log('\n📱 ตรวจสอบ Rich Menu:');
    const richMenus = await client.getRichMenuList();
    console.log(`   📊 จำนวน Rich Menu: ${richMenus.length}`);
    
    if (richMenus.length > 0) {
      const menu = richMenus[0];
      console.log(`   🆔 Rich Menu ID: ${menu.richMenuId}`);
      console.log(`   📝 ชื่อ: ${menu.name}`);
      console.log(`   🎯 จำนวนปุ่ม: ${menu.areas.length}`);
      
      menu.areas.forEach((area, index) => {
        console.log(`      ${index + 1}. ${area.action.type}: ${area.action.data}`);
      });
    }
    
    // ตรวจสอบ webhook endpoint info
    console.log('\n🌐 ตรวจสอบ Webhook Endpoint:');
    try {
      const webhookInfo = await client.getWebhookEndpointInfo();
      console.log(`   📍 Webhook URL: ${webhookInfo.endpoint}`);
      console.log(`   ✅ สถานะ: ${webhookInfo.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`);
    } catch (error) {
      console.log(`   ❌ ไม่สามารถดึงข้อมูล webhook: ${error.message}`);
    }
    
    // ตรวจสอบเซิร์ฟเวอร์ local
    console.log('\n🖥️ ตรวจสอบเซิร์ฟเวอร์ Local:');
    try {
      const response = await axios.get('http://localhost:3000/health');
      console.log(`   ✅ เซิร์ฟเวอร์ทำงาน: ${response.status}`);
      console.log(`   ⏰ เวลา: ${response.data.timestamp}`);
    } catch (error) {
      console.log(`   ❌ เซิร์ฟเวอร์ไม่ทำงาน: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    if (error.statusCode) {
      console.error(`   📊 Status Code: ${error.statusCode}`);
    }
  }
}

// รันการตรวจสอบ
debugWebhook()
  .then(() => {
    console.log('\n🎯 ขั้นตอนการแก้ไขปัญหา:');
    console.log('\n1. 🌐 ตรวจสอบ Webhook URL ใน LINE Developers Console:');
    console.log('   - เข้า https://developers.line.biz/');
    console.log('   - เลือก Channel ของคุณ');
    console.log('   - ไปที่ Messaging API > Webhook settings');
    console.log('   - ตรวจสอบว่า Webhook URL ถูกต้องหรือไม่');
    console.log('   - ควรเป็น: https://your-domain.com/webhook');
    console.log('   - หรือใช้ ngrok สำหรับการทดสอบ: https://xxx.ngrok.io/webhook');
    
    console.log('\n2. 🔧 หากใช้ localhost ให้ใช้ ngrok:');
    console.log('   - ติดตั้ง ngrok: npm install -g ngrok');
    console.log('   - รันคำสั่ง: ngrok http 3000');
    console.log('   - คัดลอก URL ที่ได้ (เช่น https://abc123.ngrok.io)');
    console.log('   - ตั้งค่าใน LINE Developers Console: https://abc123.ngrok.io/webhook');
    
    console.log('\n3. ✅ ตรวจสอบการตั้งค่า:');
    console.log('   - Webhook URL ต้องเป็น HTTPS');
    console.log('   - Use webhook ต้องเปิดใช้งาน');
    console.log('   - Verify webhook ต้องผ่าน');
    
    console.log('\n4. 🧪 ทดสอบ:');
    console.log('   - กดปุ่มใน Rich Menu');
    console.log('   - ดู logs ของเซิร์ฟเวอร์');
    console.log('   - ควรเห็น "🌐 [Webhook Event Received]"');
  })
  .catch(error => {
    console.error('❌ เกิดข้อผิดพลาดในการตรวจสอบ:', error);
  });