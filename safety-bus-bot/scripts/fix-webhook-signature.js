import express from 'express';
import * as line from '@line/bot-sdk';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

console.log('🔧 แก้ไขปัญหา Webhook Signature Validation');
console.log('==================================================');

// ตรวจสอบค่า environment variables
console.log('🔍 ตรวจสอบการตั้งค่า:');
console.log('LINE_CHANNEL_SECRET:', process.env.LINE_CHANNEL_SECRET ? '✅ มีค่า' : '❌ ไม่มีค่า');
console.log('LINE_CHANNEL_ACCESS_TOKEN:', process.env.LINE_CHANNEL_ACCESS_TOKEN ? '✅ มีค่า' : '❌ ไม่มีค่า');
console.log('LINE_CHANNEL_ID:', process.env.LINE_CHANNEL_ID ? '✅ มีค่า' : '❌ ไม่มีค่า');

if (!process.env.LINE_CHANNEL_SECRET) {
  console.log('❌ LINE_CHANNEL_SECRET ไม่ได้ตั้งค่า');
  process.exit(1);
}

if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
  console.log('❌ LINE_CHANNEL_ACCESS_TOKEN ไม่ได้ตั้งค่า');
  process.exit(1);
}

console.log('\n🧪 ทดสอบการสร้าง signature:');

// ทดสอบการสร้าง signature
const testBody = JSON.stringify({ events: [] });
const testSignature = crypto
  .createHmac('SHA256', process.env.LINE_CHANNEL_SECRET)
  .update(testBody)
  .digest('base64');

console.log('Test Body:', testBody);
console.log('Test Signature:', testSignature);

// สร้าง LINE config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

console.log('\n✅ LINE Config สร้างสำเร็จ');

// สร้างไฟล์ webhook ใหม่ที่มี error handling ดีขึ้น
const newWebhookContent = `// routes/webhook.js
import express from 'express';
import * as line from '@line/bot-sdk';
import { lineConfig } from '../lib/line.js';
import { handleTextMessage, handlePostback, handleFollow } from '../lib/handlers.js';

const router = express.Router();

// Custom middleware สำหรับ debug
router.use('/webhook', (req, res, next) => {
  console.log('🌐 [Webhook Event Received]');
  console.log('Method:', req.method);
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    'x-line-signature': req.headers['x-line-signature'] ? '✅ มี signature' : '❌ ไม่มี signature'
  });
  next();
});

// LINE middleware with error handling
router.post('/', (req, res, next) => {
  // ตรวจสอบ signature ก่อน
  const signature = req.headers['x-line-signature'];
  if (!signature) {
    console.log('⚠️ ไม่มี X-Line-Signature header');
    return res.status(400).send('Missing signature');
  }
  
  // ใช้ LINE middleware
  line.middleware(lineConfig)(req, res, next);
}, async (req, res) => {
  try {
    const events = req.body.events || [];
    console.log('📥 Received webhook events:', events.length);
    
    if (events.length === 0) {
      console.log('ℹ️ ไม่มี events ใน webhook');
      return res.sendStatus(200);
    }
    
    await Promise.all(events.map(handleEvent));
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.sendStatus(500);
  }
});

// Handle GET requests (สำหรับ verification)
router.get('/', (req, res) => {
  console.log('🔍 GET request to webhook endpoint');
  res.status(200).send('Webhook endpoint is working');
});

async function handleEvent(event) {
  console.log('🔄 Processing event:', event.type);
  
  try {
    switch (event.type) {
      case 'message':
        if (event.message.type === 'text') {
          await handleTextMessage(event);
        }
        break;
        
      case 'postback':
        console.log('📤 Postback data:', event.postback.data);
        await handlePostback(event);
        break;
        
      case 'follow':
        await handleFollow(event);
        break;
        
      case 'unfollow':
        console.log('👋 User unfollowed:', event.source.userId);
        break;
        
      default:
        console.log('ℹ️ Unhandled event type:', event.type);
    }
  } catch (error) {
    console.error('❌ Error handling event:', error);
  }
}

export default router;`;

console.log('\n📝 สร้างไฟล์ webhook ใหม่...');

// เขียนไฟล์ webhook ใหม่
import fs from 'fs';
fs.writeFileSync('./routes/webhook.js', newWebhookContent);

console.log('✅ อัปเดตไฟล์ webhook.js เรียบร้อย');

console.log('\n🔧 การแก้ไขที่ทำ:');
console.log('- ✅ เพิ่ม error handling สำหรับ signature');
console.log('- ✅ เพิ่ม debug logging');
console.log('- ✅ เพิ่ม GET endpoint สำหรับ verification');
console.log('- ✅ ปรับปรุงการจัดการ events');

console.log('\n📱 ขั้นตอนต่อไป:');
console.log('1. รีสตาร์ทเซิร์ฟเวอร์');
console.log('2. ทดสอบ webhook ใน LINE Developers Console');
console.log('3. ลองกดปุ่ม Rich Menu ในแอป LINE');

console.log('\n🎉 เสร็จสิ้น!');