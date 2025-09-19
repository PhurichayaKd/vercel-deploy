# คู่มือการ Deploy ระบบ Safety Bus Bot

## ขั้นตอนการเตรียมระบบ

### 1. การตั้งค่า LINE Developers Console

1. เข้าไปที่ [LINE Developers Console](https://developers.line.biz/)
2. สร้าง Provider ใหม่หรือเลือก Provider ที่มีอยู่
3. สร้าง Channel ประเภท "Messaging API"
4. ตั้งค่า Channel:
   - Channel name: "Safety Bus Bot"
   - Channel description: "ระบบแจ้งเตือนความปลอดภัยรถรับส่งนักเรียน"
   - Category: Education
   - Subcategory: School

### 2. การตั้งค่า Webhook

1. ในหน้า Channel Settings:
   - เปิดใช้งาน "Use webhooks"
   - ตั้งค่า Webhook URL: `https://your-domain.com/webhook`
   - เปิดใช้งาน "Redelivery"

2. ในหน้า Messaging API:
   - คัดลอก Channel Access Token
   - คัดลอก Channel Secret
   - ปิดการใช้งาน "Auto-reply messages"
   - ปิดการใช้งาน "Greeting messages"

### 3. การตั้งค่า Supabase

1. สร้างโปรเจค Supabase ใหม่
2. รันคำสั่ง SQL สำหรับสร้างตาราง:

```sql
-- สร้างตาราง parents
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- สร้างตาราง students
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  parent_id UUID REFERENCES parents(id),
  bus_route VARCHAR(100),
  pickup_location VARCHAR(255),
  dropoff_location VARCHAR(255),
  rfid_tag VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- สร้างตาราง parent_line_links
CREATE TABLE parent_line_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parents(id),
  line_user_id VARCHAR(255) UNIQUE NOT NULL,
  linked_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- สร้างตาราง parent_link_tokens
CREATE TABLE parent_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(255) UNIQUE NOT NULL,
  parent_id UUID REFERENCES parents(id),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- สร้างตาราง driver_line_links
CREATE TABLE driver_line_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(50) REFERENCES students(student_id),
  line_user_id VARCHAR(255) UNIQUE NOT NULL,
  driver_name VARCHAR(255),
  linked_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- สร้างตาราง rfid_scans
CREATE TABLE rfid_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  scan_type VARCHAR(20) NOT NULL, -- 'board' หรือ 'exit'
  bus_id VARCHAR(50),
  location JSONB,
  scanned_at TIMESTAMP DEFAULT NOW()
);

-- สร้างตาราง emergencies
CREATE TABLE emergencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id VARCHAR(50) NOT NULL,
  emergency_type VARCHAR(50) NOT NULL,
  description TEXT,
  location JSONB,
  reported_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active'
);

-- สร้างตาราง bus_locations
CREATE TABLE bus_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id VARCHAR(50) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(5, 2),
  heading DECIMAL(5, 2),
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- สร้างตาราง absence_requests
CREATE TABLE absence_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  parent_id UUID REFERENCES parents(id),
  absence_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by VARCHAR(255)
);

-- สร้างตาราง api_logs
CREATE TABLE api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  request_body JSONB,
  response_body JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- สร้างตาราง line_logs
CREATE TABLE line_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id VARCHAR(255),
  message_type VARCHAR(50) NOT NULL,
  message_content JSONB,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT NOW()
);
```

3. คัดลอก Project URL และ Anon Key จาก Settings > API

## ตัวเลือกการ Deploy

### ตัวเลือก 1: Render (แนะนำสำหรับผู้เริ่มต้น)

1. สร้างบัญชี [Render](https://render.com/)
2. เชื่อมต่อ GitHub repository
3. สร้าง Web Service ใหม่:
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
4. ตั้งค่า Environment Variables:
   ```
   LINE_CHANNEL_ACCESS_TOKEN=your_access_token
   LINE_CHANNEL_SECRET=your_channel_secret
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   API_SECRET_KEY=your_random_secret_key
   NODE_ENV=production
   PORT=3000
   ```

### ตัวเลือก 2: Railway

1. สร้างบัญชี [Railway](https://railway.app/)
2. เชื่อมต่อ GitHub repository
3. Deploy โดยอัตโนมัติ
4. ตั้งค่า Environment Variables เหมือนกับ Render

### ตัวเลือก 3: VPS (Ubuntu)

1. ติดตั้ง Node.js และ npm:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. ติดตั้ง PM2:
```bash
sudo npm install -g pm2
```

3. Clone repository:
```bash
git clone https://github.com/your-username/safety-bus-bot.git
cd safety-bus-bot
npm install
```

4. สร้างไฟล์ .env:
```bash
cp .env.example .env
# แก้ไขค่าตัวแปรใน .env
```

5. รัน application ด้วย PM2:
```bash
pm2 start app.js --name "safety-bus-bot"
pm2 startup
pm2 save
```

6. ติดตั้ง Nginx สำหรับ reverse proxy:
```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/safety-bus-bot
```

เนื้อหาไฟล์ Nginx config:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

7. เปิดใช้งาน site และติดตั้ง SSL:
```bash
sudo ln -s /etc/nginx/sites-available/safety-bus-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# ติดตั้ง Certbot สำหรับ SSL
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### ตัวเลือก 4: Ngrok (สำหรับทดสอบ)

1. ติดตั้ง Ngrok:
```bash
npm install -g ngrok
```

2. รัน application:
```bash
npm start
```

3. เปิด terminal ใหม่และรัน Ngrok:
```bash
ngrok http 3000
```

4. คัดลอก HTTPS URL และใส่ใน LINE Webhook URL

## การตั้งค่า Rich Menu

1. รันคำสั่งตั้งค่า Rich Menu:
```bash
npm run setup-menu
```

2. หรือตั้งค่าผ่าน LINE Developers Console:
   - ไปที่ Rich Menu > Create
   - อัปโหลดรูปภาพ Rich Menu (1200x405 pixels)
   - ตั้งค่า Action areas ตามเมนู

## การทดสอบระบบ

### 1. ทดสอบ Webhook
```bash
curl -X POST https://your-domain.com/webhook \
  -H "Content-Type: application/json" \
  -H "X-Line-Signature: test" \
  -d '{"events":[]}'
```

### 2. ทดสอบ API Endpoints
```bash
# ทดสอบ Health Check
curl https://your-domain.com/api/health

# ทดสอบ RFID Scan
curl -X POST https://your-domain.com/api/rfid-scan \
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
```

### 3. ทดสอบการผูกบัญชี
1. เพิ่ม Friend บอทใน LINE
2. ส่งข้อความ "ผูกบัญชี"
3. ใส่รหัสนักเรียนที่มีในฐานข้อมูล
4. ตรวจสอบการบันทึกใน parent_line_links

## การ Monitor และ Maintenance

### 1. ดู Logs
```bash
# ดู logs ทั้งหมด
npm run logs

# ดู PM2 logs (สำหรับ VPS)
pm2 logs safety-bus-bot

# ดู Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 2. การ Backup ฐานข้อมูล
```bash
# Backup Supabase (ผ่าน Dashboard)
# หรือใช้ pg_dump สำหรับ PostgreSQL
pg_dump -h your-supabase-host -U postgres -d your-database > backup.sql
```

### 3. การอัปเดตระบบ
```bash
# Pull code ใหม่
git pull origin main

# ติดตั้ง dependencies ใหม่
npm install

# Restart application
pm2 restart safety-bus-bot
```

## การแก้ไขปัญหาที่พบบ่อย

### 1. Webhook ไม่ทำงาน
- ตรวจสอบ URL ใน LINE Console
- ตรวจสอบ SSL Certificate
- ตรวจสอบ Signature Validation

### 2. Push Message ไม่ส่ง
- ตรวจสอบ Channel Access Token
- ตรวจสอบ LINE User ID
- ตรวจสอบ Rate Limit

### 3. Database Connection Error
- ตรวจสอบ Supabase URL และ Key
- ตรวจสอบ Network Connection
- ตรวจสอบ Database Schema

### 4. API Authentication Error
- ตรวจสอบ API Secret Key
- ตรวจสอบ Header X-API-Key
- ตรวจสอบ Request Format

## Security Checklist

- [ ] ใช้ HTTPS สำหรับทุก endpoints
- [ ] ตรวจสอบ LINE Signature ทุก webhook
- [ ] ใช้ API Key สำหรับ internal APIs
- [ ] ไม่เก็บ sensitive data ใน logs
- [ ] ใช้ Environment Variables สำหรับ secrets
- [ ] ตั้งค่า Rate Limiting
- [ ] ตั้งค่า CORS อย่างเหมาะสม
- [ ] อัปเดต dependencies เป็นประจำ
- [ ] Backup ฐานข้อมูลเป็นประจำ
- [ ] Monitor logs และ errors

## การติดต่อและสนับสนุน

หากพบปัญหาในการ deploy หรือใช้งาน:
1. ตรวจสอบ logs ก่อน
2. อ่าน documentation ใน README.md
3. ตรวจสอบ GitHub Issues
4. ติดต่อทีมพัฒนา

---

**หมายเหตุ:** คู่มือนี้อาจต้องปรับปรุงตามการเปลี่ยนแปลงของ platform ต่างๆ กรุณาตรวจสอบ documentation ล่าสุดของแต่ละ service ด้วย