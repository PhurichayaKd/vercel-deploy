# 🚀 Quick Start Guide - Safety Bus Bot

คู่มือเริ่มต้นใช้งานอย่างรวดเร็วสำหรับการทดสอบ LINE Bot

## ⚡ เริ่มต้นใน 5 นาที

### 1. ติดตั้ง Dependencies

```bash
cd d:\Project-IoT\safety-bus-bot
npm install
```

### 2. ตั้งค่า Environment Variables

```bash
# คัดลอกไฟล์ตัวอย่าง
copy .env.example .env

# แก้ไขไฟล์ .env
notepad .env
```

**ตัวแปรที่จำเป็นขั้นต่ำ:**
```env
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
LINE_CHANNEL_SECRET=your_channel_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
API_SECRET_KEY=your_strong_secret_key
```

### 3. รันระบบ

```bash
npm start
```

### 4. ทดสอบระบบ

```bash
# ทดสอบอัตโนมัติ
npm test

# ทดสอบ health check
npm run health

# ดู logs
npm run logs
```

## 📱 การทดสอบ LINE Bot

### วิธีที่ 1: ใช้ Ngrok (แนะนำ)

1. **ติดตั้ง Ngrok:**
   ```bash
   # Download จาก https://ngrok.com/download
   # หรือใช้ chocolatey
   choco install ngrok
   ```

2. **รัน Ngrok:**
   ```bash
   # Terminal 1: รัน bot
   npm start
   
   # Terminal 2: รัน ngrok
   ngrok http 3000
   ```

3. **คัดลอก HTTPS URL:**
   ```
   https://abc123.ngrok.io
   ```

4. **ตั้งค่าใน LINE Console:**
   - ไปที่ LINE Developers Console
   - Messaging API > Webhook settings
   - Webhook URL: `https://abc123.ngrok.io/webhook`
   - คลิก "Verify" และ "Update"

### วิธีที่ 2: Deploy ไปยัง Cloud (Production)

ดู [DEPLOYMENT.md](./DEPLOYMENT.md) สำหรับรายละเอียด

## 🧪 การทดสอบฟีเจอร์

### ทดสอบคำสั่งพื้นฐาน

1. **เพิ่ม Friend บอท**
   - สแกน QR Code จาก LINE Console

2. **ส่งข้อความทดสอบ:**
   ```
   สวัสดี          → ข้อความต้อนรับ
   เมนู            → แสดงเมนูหลัก
   สถานะ          → สถานะการเชื่อมโยงบัญชี
   ผูกบัญชี        → เริ่มการผูกบัญชี
   ```

### ทดสอบการผูกบัญชี

1. **ส่งคำสั่ง:** `ผูกบัญชี`
2. **ใส่รหัสนักเรียน:** `STU001` (ตัวอย่าง)
3. **ตรวจสอบผลลัพธ์**

### ทดสอบฟีเจอร์หลัก (หลังผูกบัญชี)

```
ประวัติ          → ประวัติการเดินทาง
ตำแหน่งรถ        → ตำแหน่งรถบัสปัจจุบัน
ลาหยุด          → เริ่มการแจ้งลาหยุด
```

## 🔧 การทดสอบ API

### ใช้ curl

```bash
# Health Check
curl http://localhost:3000/api/health

# RFID Scan
curl -X POST http://localhost:3000/api/rfid-scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_secret_key" \
  -d '{
    "student_id": "STU001",
    "scan_type": "board",
    "bus_id": "BUS001",
    "location": {
      "latitude": 13.7563,
      "longitude": 100.5018
    }
  }'

# Bus Location
curl -X POST http://localhost:3000/api/bus-location \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_secret_key" \
  -d '{
    "bus_id": "BUS001",
    "latitude": 13.7563,
    "longitude": 100.5018,
    "speed": 45.5,
    "heading": 180.0
  }'
```

### ใช้ Postman

1. **Import Collection:**
   - ดาวน์โหลด [Postman Collection](./postman/Safety-Bus-Bot.postman_collection.json)
   - Import ใน Postman

2. **ตั้งค่า Environment:**
   ```
   base_url: http://localhost:3000
   api_key: your_api_secret_key
   ```

## 📊 การดู Logs และ Debug

### ดู Logs

```bash
# ดู logs ทั้งหมด
npm run logs

# ดู logs แบบ real-time
npm run logs:follow

# ดู error logs เท่านั้น
npm run logs:error
```

### Debug Mode

```bash
# รันในโหมด debug
DEBUG=* npm start

# Debug เฉพาะ LINE Bot
DEBUG=line:* npm start
```

### ตรวจสอบ Database

**ใน Supabase Dashboard:**

1. **Table Editor** → ดูข้อมูลในตาราง
2. **SQL Editor** → รัน query
   ```sql
   -- ดูการเชื่อมโยงบัญชี
   SELECT * FROM parent_line_links;
   
   -- ดู RFID scans ล่าสุด
   SELECT * FROM rfid_scans 
   ORDER BY scanned_at DESC 
   LIMIT 10;
   
   -- ดู LINE logs
   SELECT * FROM line_logs 
   WHERE status = 'error' 
   ORDER BY sent_at DESC;
   ```

## ❗ แก้ไขปัญหาที่พบบ่อย

### 1. Webhook ไม่ทำงาน

**ตรวจสอบ:**
```bash
# ตรวจสอบ server ทำงาน
curl http://localhost:3000/api/health

# ตรวจสอบ ngrok
curl https://your-ngrok-url.ngrok.io/api/health
```

**แก้ไข:**
- ตรวจสอบ HTTPS URL ใน LINE Console
- ตรวจสอบ Channel Secret
- ดู error logs

### 2. Push Message ไม่ส่ง

**ตรวจสอบ:**
- Channel Access Token ถูกต้อง
- LINE User ID ถูกต้อง
- Rate Limit ไม่เกิน

### 3. Database Error

**ตรวจสอบ:**
- Supabase URL และ Key
- Network connection
- Database schema

### 4. API Authentication Error

**ตรวจสอบ:**
- API_SECRET_KEY ตั้งค่าถูกต้อง
- Header X-API-Key ส่งมาถูกต้อง

## 📋 Checklist การทดสอบ

### พื้นฐาน
- [ ] `npm install` สำเร็จ
- [ ] `.env` ตั้งค่าครบถ้วน
- [ ] `npm start` รันได้
- [ ] `npm test` ผ่านทุกข้อ
- [ ] `npm run health` ตอบกลับ OK

### LINE Bot
- [ ] เพิ่ม Friend ได้
- [ ] ตอบกลับข้อความได้
- [ ] แสดงเมนูได้
- [ ] ผูกบัญชีได้
- [ ] แสดงประวัติได้
- [ ] แสดงตำแหน่งรถได้
- [ ] แจ้งลาหยุดได้

### API
- [ ] Health check ทำงาน
- [ ] RFID scan API ทำงาน
- [ ] Bus location API ทำงาน
- [ ] Emergency API ทำงาน
- [ ] Authentication ทำงาน

### Database
- [ ] เชื่อมต่อ Supabase ได้
- [ ] บันทึกข้อมูลได้
- [ ] Query ข้อมูลได้

## 🎯 Next Steps

หลังจากทดสอบเสร็จแล้ว:

1. **Setup Rich Menu** → `npm run setup-menu`
2. **Deploy to Production** → ดู [DEPLOYMENT.md](./DEPLOYMENT.md)
3. **Security Review** → ดู [SECURITY.md](./SECURITY.md)
4. **Full Testing** → ดู [TESTING.md](./TESTING.md)

## 🆘 ต้องการความช่วยเหลือ

- **Documentation:** [README.md](./README.md)
- **Detailed Testing:** [HOW-TO-TEST.md](./HOW-TO-TEST.md)
- **Deployment:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Security:** [SECURITY.md](./SECURITY.md)

---

**Happy Testing! 🎉**

หากมีปัญหาหรือข้อสงสัย สามารถดู logs หรือติดต่อทีมพัฒนาได้