// routes/webhook.js
import express from 'express';
import * as line from '@line/bot-sdk';
import { lineConfig } from '../lib/line.js';
import { handleTextMessage, handlePostback, handleFollow } from '../lib/handlers.js';
import crypto from 'crypto';

const router = express.Router();

// Handle GET requests (สำหรับ verification)
router.get('/', (req, res) => {
  console.log('🔍 GET request to webhook endpoint');
  res.status(200).send('Webhook endpoint is working');
});

// Custom middleware สำหรับตรวจสอบ signature
function validateLineSignature(req, res, next) {
  const signature = req.headers['x-line-signature'];
  
  if (!signature) {
    console.log('⚠️ ไม่มี X-Line-Signature header');
    return res.status(400).json({ error: 'Missing signature' });
  }
  
  // ตรวจสอบ signature
  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', lineConfig.channelSecret)
    .update(body)
    .digest('base64');
  
  if (signature !== hash) {
    console.log('❌ Signature validation failed');
    console.log('Expected:', hash);
    console.log('Received:', signature);
    return res.status(400).json({ error: 'Invalid signature' });
  }
  
  console.log('✅ Signature validation passed');
  next();
}

// Handle POST requests
router.post('/', express.json(), validateLineSignature, async (req, res) => {
  try {
    console.log('🌐 [Webhook Event Received]');
    const events = req.body.events || [];
    console.log('📥 Received webhook events:', events.length);
    
    if (events.length === 0) {
      console.log('ℹ️ ไม่มี events ใน webhook');
      return res.status(200).json({ message: 'No events' });
    }
    
    await Promise.all(events.map(handleEvent));
    res.status(200).json({ message: 'Success' });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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

export default router;
