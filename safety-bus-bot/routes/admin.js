// routes/admin.js
import express from 'express';
import QRCode from 'qrcode';
import { issueToken } from '../lib/tokens.js';

const router = express.Router();

/** DEMO:
 * GET /admin/create-link?parent_id=1&driver_id=100
 * คืนหน้า HTML มี QR + ลิงก์
 */
router.get('/create-link', async (req, res) => {
  try {
    const parent_id = parseInt(req.query.parent_id || '1', 10);
    const driver_id = parseInt(req.query.driver_id || '100', 10);

    const token = await issueToken({ parent_id, issued_by: driver_id });
    const url = `${process.env.BASE_URL}/link?t=${token}`;
    const dataUrl = await QRCode.toDataURL(url);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`
      <h2>QR สำหรับผู้ปกครอง (parent_id=${parent_id})</h2>
      <p>สแกนเพื่อผูกบัญชี LINE:</p>
      <img src="${dataUrl}" alt="QR" />
      <p>หรือเปิดลิงก์: <a href="${url}">${url}</a></p>
    `);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
