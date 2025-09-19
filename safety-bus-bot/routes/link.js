// routes/link.js
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/db.js';
import { consumeToken, markTokenUsed } from '../lib/tokens.js';
import { lineClient } from '../lib/line.js';

const router = express.Router();

async function verifyIdToken(idToken) {
  const params = new URLSearchParams();
  params.append('id_token', idToken);
  params.append('client_id', process.env.LINE_CHANNEL_ID); // ใส่ Channel ID ของช่องที่สร้าง LIFF

  const { data } = await axios.post('https://api.line.me/oauth2/v2.1/verify', params);
  return data; // data.sub = line userId
}

router.post('/confirm', async (req, res) => {
  try {
    const { token, idToken } = req.body;
    if (!token || !idToken) return res.status(400).json({ ok: false, message: 'missing token or idToken' });

    const idt = await verifyIdToken(idToken);
    const lineUserId = idt.sub;

    const row = await consumeToken(token); // ตรวจ token สด/ยังไม่ใช้

    const { error: insErr } = await supabase.from('parent_line_links')
      .insert({ parent_id: row.parent_id, line_user_id: lineUserId });
    if (insErr && insErr.code !== '23505') throw insErr; // 23505 = unique violation (เคยผูกแล้ว)

    await markTokenUsed(token, lineUserId);

    await lineClient.pushMessage(lineUserId, {
      type: 'text',
      text: 'ผูกบัญชีสำเร็จแล้วครับ 🎉',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: 'สถานะวันนี้', text: 'สถานะวันนี้' } },
          { type: 'action', action: { type: 'message', label: 'ลา/ไม่มา', text: 'ลา' } },
          { type: 'action', action: { type: 'uri', label: 'ตำแหน่งรถ', uri: `${process.env.BASE_URL}/map` } }
        ]
      }
    });

    res.json({ ok: true, message: 'ผูกบัญชีสำเร็จแล้ว คุณสามารถกลับไปที่แชทและใช้เมนูได้' });
  } catch (e) {
    console.error('link confirm error:', e.response?.data || e.message);
    res.status(400).json({ ok: false, message: e.message || 'link failed' });
  }
});

// Route สำหรับ LIFF leave form
router.get('/leave-form', (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'server', 'public', 'leave-form.html');
    let html = fs.readFileSync(filePath, 'utf8');
    
    // แทนที่ LIFF_ID ด้วยค่าจริงจาก environment
    html = html.replace('{{LIFF_ID}}', process.env.LINE_LIFF_ID);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error serving leave form:', error);
    res.status(500).send('Error loading leave form');
  }
});

export default router;
