# Safety Bus LIFF App - Vercel Deployment

นี่คือ LIFF App สำหรับระบบแจ้งลาของรถรับส่งนักเรียน ที่พร้อมสำหรับ deploy ไปยัง Vercel

## ขั้นตอนการ Deploy ไปยัง Vercel

### 1. เตรียมบัญชี Vercel
- ไปที่ [vercel.com](https://vercel.com)
- สมัครสมาชิกด้วย GitHub, GitLab, หรือ Bitbucket (แนะนำ GitHub)
- ยืนยันอีเมล

### 2. วิธีที่ 1: Deploy ผ่าน Vercel CLI (แนะนำ)

#### ติดตั้ง Vercel CLI
```bash
npm install -g vercel
```

#### Login และ Deploy
```bash
# เข้าสู่ระบบ
vercel login

# ไปยังโฟลเดอร์ vercel-deploy
cd vercel-deploy

# Deploy
vercel
```

#### ตอบคำถาม
- Set up and deploy? → Y
- Which scope? → เลือก account ของคุณ
- Link to existing project? → N
- What's your project's name? → safety-bus-liff-app
- In which directory is your code located? → ./

### 3. วิธีที่ 2: Deploy ผ่าน GitHub

#### สร้าง Repository ใหม่
1. ไปที่ GitHub และสร้าง repository ใหม่
2. Upload ไฟล์ทั้งหมดในโฟลเดอร์ vercel-deploy

#### เชื่อมต่อกับ Vercel
1. ไปที่ [vercel.com/dashboard](https://vercel.com/dashboard)
2. คลิก "New Project"
3. เลือก repository ที่สร้าง
4. คลิก "Deploy"

### 4. วิธีที่ 3: Drag & Drop

1. ไปที่ [vercel.com/new](https://vercel.com/new)
2. เลือก "Browse all templates"
3. คลิก "Deploy" ที่ "Other"
4. Drag & Drop โฟลเดอร์ vercel-deploy ทั้งหมด
5. ตั้งชื่อโปรเจกต์และคลิก "Deploy"

## หลังจาก Deploy สำเร็จ

### 1. รับ URL
Vercel จะให้ URL ในรูปแบบ:
```
https://your-project-name.vercel.app
```

### 2. อัปเดต LIFF ID
1. ไปที่ [LINE Developers Console](https://developers.line.biz/)
2. เลือกโปรเจกต์และ LIFF app
3. ใส่ URL ที่ได้จาก Vercel
4. บันทึกและคัดลอก LIFF ID

### 3. อัปเดตโค้ด
แก้ไขไฟล์ `js/date-picker.js` บรรทัดที่ 9:
```javascript
await liff.init({ liffId: 'YOUR_ACTUAL_LIFF_ID' });
```

### 4. Deploy ใหม่
หลังจากแก้ไข LIFF ID แล้ว ให้ deploy ใหม่:
```bash
vercel --prod
```

## การทดสอบ

1. เปิด URL ที่ได้จาก Vercel ในเบราว์เซอร์
2. ทดสอบใน LINE app โดยส่งลิงก์ LIFF
3. ตรวจสอบการทำงานของ date picker

## ข้อมูลเพิ่มเติม

- **ค่าใช้จ่าย**: ฟรี 100% สำหรับ hobby plan
- **Custom Domain**: สามารถเพิ่มได้ในภายหลัง
- **HTTPS**: มีให้อัตโนมัติ
- **CDN**: มีให้ทั่วโลก

## การแก้ไขปัญหา

### ปัญหาที่พบบ่อย
1. **LIFF ID ไม่ถูกต้อง**: ตรวจสอบ LIFF ID ในไฟล์ JS
2. **URL ไม่ตรงกัน**: ตรวจสอบ URL ใน LINE Developers Console
3. **CORS Error**: ตรวจสอบการตั้งค่า domain ใน LINE

### Log และ Debug
- ดู logs ใน Vercel Dashboard
- ใช้ Developer Tools ในเบราว์เซอร์
- ตรวจสอบ Network tab สำหรับ API calls

## สนับสนุน

หากมีปัญหาในการ deploy สามารถ:
1. ตรวจสอบ [Vercel Documentation](https://vercel.com/docs)
2. ดู [LINE LIFF Documentation](https://developers.line.biz/en/docs/liff/)
3. ติดต่อทีมพัฒนา