// routes/webhook.js
const express = require('express');
const line = require('@line/bot-sdk');
const { lineConfig, lineClient } = require('../lib/line');

const router = express.Router();

router.post('/', line.middleware(lineConfig), async (req, res) => {
  const events = req.body.events || [];
  await Promise.all(events.map(handleEvent));
  res.sendStatus(200);
});

async function handleEvent(event) {
  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();

    if (text === 'สถานะวันนี้') {
      return lineClient.replyMessage(event.replyToken, { type: 'text', text: 'สถานะ: พร้อมให้บริการ' });
    }
    if (text === 'ลา' || text === 'ลา/ไม่มา') {
      return lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: 'กดเมนู ลา/ไม่มา หรือเปิด https://your.app/absence',
      });
    }
    return lineClient.replyMessage(event.replyToken, { type: 'text', text: `รับข้อความ: ${text}` });
  }

  if (event.type === 'postback') {
    return lineClient.replyMessage(event.replyToken, { type: 'text', text: 'รับ postback แล้ว' });
  }
}

module.exports = router;
