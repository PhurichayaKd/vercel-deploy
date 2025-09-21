# แก้ไข Vercel Configuration Error

## ❌ Error ที่เกิดขึ้น
```
If 'rewrites', 'redirects', 'headers', 'cleanUrls' or 'trailingSlash' are used, then 'routes' cannot be present.
```

## 🔍 สาเหตุของปัญหา
- ใน Vercel v2 ไม่สามารถใช้ `routes` ร่วมกับ `headers`, `rewrites`, `redirects`, `cleanUrls` หรือ `trailingSlash` ได้
- ไฟล์ `vercel.json` เดิมมีทั้ง `routes` และ `headers` ซึ่งขัดแย้งกัน

## ✅ วิธีแก้ไข

### 1. แก้ไขไฟล์ vercel.json
ลบส่วน `routes` ออกจากไฟล์ `vercel.json`:

**ก่อนแก้ไข:**
```json
{
  "version": 2,
  "name": "safety-bus-liff-app",
  "builds": [...],
  "routes": [
    {
      "src": "/",
      "dest": "/index.html"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "headers": [...]
}
```

**หลังแก้ไข:**
```json
{
  "version": 2,
  "name": "safety-bus-liff-app",
  "builds": [...],
  "headers": [...]
}
```

### 2. อัปเดต GitHub Repository
```bash
git add vercel.json
git commit -m "Fix Vercel config: remove routes to resolve conflict with headers"
git push origin main
```

### 3. Deploy ใหม่ใน Vercel
1. ไปที่ Vercel Dashboard
2. เลือกโปรเจกต์ `safety-bus-liff`
3. คลิก **"Redeploy"**
4. รอให้ deployment เสร็จสิ้น

## 📋 ผลลัพธ์หลังแก้ไข
- ✅ Error สีแดงจะหายไป
- ✅ Deployment จะสำเร็จ
- ✅ Static files จะถูก serve ได้ปกติ
- ✅ Security headers ยังคงทำงานได้

## 🔧 ทำไมถึงใช้งานได้
- **Static Build**: ใช้ `@vercel/static` สำหรับ serve ไฟล์ static
- **Default Routing**: Vercel จะ route ไฟล์ static อัตโนมัติ
- **Security Headers**: ยังคงมี security headers ที่จำเป็น

## 📝 หมายเหตุ
- การลบ `routes` ไม่ส่งผลกระทบต่อการทำงานของ LIFF app
- Vercel จะ serve `index.html` เป็น default page อัตโนมัติ
- ไฟล์ CSS และ JS จะยังคงเข้าถึงได้ปกติ

---

**สถานะ:** ✅ แก้ไขเสร็จสิ้นแล้ว  
**อัปเดตล่าสุด:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")