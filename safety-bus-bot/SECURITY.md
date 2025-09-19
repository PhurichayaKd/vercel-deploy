# คู่มือความปลอดภัย Safety Bus Bot

## หลักการความปลอดภัยพื้นฐาน

### 1. Defense in Depth
ระบบใช้หลักการป้องกันหลายชั้น:
- **Application Layer**: Input validation, Authentication, Authorization
- **Network Layer**: HTTPS, Firewall, Rate limiting
- **Database Layer**: Parameterized queries, Access control
- **Infrastructure Layer**: Secure hosting, Regular updates

### 2. Principle of Least Privilege
- ให้สิทธิ์เฉพาะที่จำเป็น
- แยกสิทธิ์ระหว่าง Admin, User, และ System
- ใช้ API Keys แยกสำหรับแต่ละ service

### 3. Data Protection
- เข้ารหัสข้อมูลสำคัญ
- ไม่เก็บข้อมูลที่ไม่จำเป็น
- ลบข้อมูลที่หมดอายุ

## การรักษาความปลอดภัย LINE Bot

### 1. Webhook Security

#### การตรวจสอบ Signature
```javascript
const crypto = require('crypto');

function validateSignature(body, signature, secret) {
  const expectedSignature = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// ใช้งานใน middleware
app.use('/webhook', (req, res, next) => {
  const signature = req.get('X-Line-Signature');
  const body = JSON.stringify(req.body);
  
  if (!validateSignature(body, signature, process.env.LINE_CHANNEL_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
});
```

#### การป้องกัน Replay Attack
```javascript
const recentRequests = new Map();
const REQUEST_TIMEOUT = 5 * 60 * 1000; // 5 minutes

function preventReplayAttack(req, res, next) {
  const timestamp = req.get('X-Line-Timestamp');
  const signature = req.get('X-Line-Signature');
  
  // ตรวจสอบ timestamp
  const now = Date.now();
  if (Math.abs(now - parseInt(timestamp)) > REQUEST_TIMEOUT) {
    return res.status(401).json({ error: 'Request too old' });
  }
  
  // ตรวจสอบ duplicate request
  const requestKey = `${timestamp}-${signature}`;
  if (recentRequests.has(requestKey)) {
    return res.status(401).json({ error: 'Duplicate request' });
  }
  
  recentRequests.set(requestKey, now);
  
  // ลบ request เก่า
  for (const [key, time] of recentRequests.entries()) {
    if (now - time > REQUEST_TIMEOUT) {
      recentRequests.delete(key);
    }
  }
  
  next();
}
```

### 2. Access Token Security

#### การจัดเก็บ Token อย่างปลอดภัย
```javascript
// ใช้ Environment Variables
const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// ไม่เก็บใน code หรือ database
// ไม่ log token ออกมา
function logSafeData(data) {
  const safeData = { ...data };
  if (safeData.access_token) {
    safeData.access_token = '***REDACTED***';
  }
  console.log(safeData);
}
```

#### การ Rotate Token
```javascript
// ตั้งเตือนให้เปลี่ยน token เป็นประจำ
const TOKEN_ROTATION_INTERVAL = 90 * 24 * 60 * 60 * 1000; // 90 days

function checkTokenAge() {
  const tokenCreatedAt = new Date(process.env.TOKEN_CREATED_AT);
  const now = new Date();
  
  if (now - tokenCreatedAt > TOKEN_ROTATION_INTERVAL) {
    console.warn('⚠️ LINE Access Token should be rotated');
    // ส่งแจ้งเตือนไปยัง admin
  }
}
```

## การรักษาความปลอดภัย API

### 1. API Key Management

#### การสร้าง API Key ที่ปลอดภัย
```javascript
const crypto = require('crypto');

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function hashApiKey(apiKey) {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

// เก็บเฉพาะ hash ในฐานข้อมูล
const apiKeyHash = hashApiKey(apiKey);
```

#### การตรวจสอบ API Key
```javascript
function validateApiKey(req, res, next) {
  const apiKey = req.get('X-API-Key');
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API key required',
      code: 'MISSING_API_KEY'
    });
  }
  
  const hashedKey = hashApiKey(apiKey);
  const validKeys = process.env.VALID_API_KEYS.split(',');
  
  if (!validKeys.includes(hashedKey)) {
    // Log suspicious activity
    console.warn(`Invalid API key attempt from ${req.ip}`);
    
    return res.status(401).json({ 
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }
  
  next();
}
```

### 2. Rate Limiting

#### การจำกัดอัตราการเรียก API
```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('redis');

const redisClient = Redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

// Rate limit สำหรับ API endpoints
const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // จำกัด 100 requests ต่อ 15 นาที
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit สำหรับ webhook
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // จำกัด 60 requests ต่อนาที
  keyGenerator: (req) => {
    // ใช้ LINE User ID เป็น key
    const events = req.body.events || [];
    return events[0]?.source?.userId || req.ip;
  }
});

app.use('/api', apiLimiter);
app.use('/webhook', webhookLimiter);
```

### 3. Input Validation และ Sanitization

#### การป้องกัน Injection Attacks
```javascript
const Joi = require('joi');
const DOMPurify = require('isomorphic-dompurify');

// Schema validation
const studentIdSchema = Joi.string()
  .alphanum()
  .min(3)
  .max(20)
  .required();

const locationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

// Sanitization function
function sanitizeInput(input) {
  if (typeof input === 'string') {
    // ลบ HTML tags
    const cleaned = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
    
    // ลบ special characters ที่อันตราย
    return cleaned.replace(/[<>"'%;()&+]/g, '');
  }
  
  return input;
}

// Middleware สำหรับ validation
function validateAndSanitize(schema) {
  return (req, res, next) => {
    // Sanitize input
    req.body = sanitizeObject(req.body);
    
    // Validate schema
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Invalid input',
        details: error.details.map(d => d.message)
      });
    }
    
    req.body = value;
    next();
  };
}

function sanitizeObject(obj) {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = sanitizeInput(value);
    }
  }
  
  return sanitized;
}
```

## การรักษาความปลอดภัยฐานข้อมูล

### 1. Parameterized Queries

```javascript
// ✅ ปลอดภัย - ใช้ parameterized query
async function getStudentById(studentId) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('student_id', studentId)
    .single();
    
  return { data, error };
}

// ❌ อันตราย - SQL injection
async function getStudentByIdUnsafe(studentId) {
  const query = `SELECT * FROM students WHERE student_id = '${studentId}'`;
  // ไม่ควรใช้วิธีนี้
}
```

### 2. Database Access Control

```sql
-- สร้าง role สำหรับ application
CREATE ROLE app_user;

-- ให้สิทธิ์เฉพาะที่จำเป็น
GRANT SELECT, INSERT, UPDATE ON students TO app_user;
GRANT SELECT, INSERT, UPDATE ON parents TO app_user;
GRANT SELECT, INSERT ON rfid_scans TO app_user;

-- ไม่ให้สิทธิ์ DROP หรือ ALTER
REVOKE DROP, ALTER ON ALL TABLES FROM app_user;

-- สร้าง user สำหรับ application
CREATE USER safety_bus_app WITH PASSWORD 'strong_password';
GRANT app_user TO safety_bus_app;
```

### 3. Data Encryption

```javascript
const crypto = require('crypto');

class DataEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }
  
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  decrypt(encryptedData) {
    const { encrypted, iv, authTag } = encryptedData;
    
    const decipher = crypto.createDecipher(
      this.algorithm, 
      this.key, 
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// ใช้งาน
const encryption = new DataEncryption();

// เข้ารหัสข้อมูลสำคัญก่อนบันทึก
function encryptSensitiveData(data) {
  if (data.phone) {
    data.phone = encryption.encrypt(data.phone);
  }
  if (data.email) {
    data.email = encryption.encrypt(data.email);
  }
  return data;
}
```

## การจัดการ Session และ Authentication

### 1. Secure Session Management

```javascript
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only
    httpOnly: true, // ป้องกัน XSS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict' // ป้องกัน CSRF
  },
  name: 'sessionId' // เปลี่ยนชื่อ default
}));
```

### 2. JWT Token Security

```javascript
const jwt = require('jsonwebtoken');

class TokenManager {
  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET;
    this.accessTokenExpiry = '15m';
    this.refreshTokenExpiry = '7d';
  }
  
  generateTokens(payload) {
    const accessToken = jwt.sign(
      payload, 
      this.accessTokenSecret, 
      { 
        expiresIn: this.accessTokenExpiry,
        issuer: 'safety-bus-bot',
        audience: 'safety-bus-users'
      }
    );
    
    const refreshToken = jwt.sign(
      { userId: payload.userId }, 
      this.refreshTokenSecret, 
      { 
        expiresIn: this.refreshTokenExpiry,
        issuer: 'safety-bus-bot'
      }
    );
    
    return { accessToken, refreshToken };
  }
  
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.accessTokenSecret);
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }
  
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshTokenSecret);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
}
```

## การป้องกัน Common Attacks

### 1. CSRF Protection

```javascript
const csrf = require('csurf');

// CSRF protection สำหรับ web forms
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

app.use('/admin', csrfProtection);
```

### 2. XSS Protection

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
```

### 3. Directory Traversal Protection

```javascript
const path = require('path');

function validateFilePath(filePath) {
  const normalizedPath = path.normalize(filePath);
  const allowedDir = path.resolve('./uploads');
  const resolvedPath = path.resolve(allowedDir, normalizedPath);
  
  // ตรวจสอบว่าไฟล์อยู่ใน directory ที่อนุญาต
  if (!resolvedPath.startsWith(allowedDir)) {
    throw new Error('Invalid file path');
  }
  
  return resolvedPath;
}
```

## การ Logging และ Monitoring

### 1. Security Logging

```javascript
const winston = require('winston');

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/security.log',
      level: 'warn'
    }),
    new winston.transports.File({ 
      filename: 'logs/security-error.log',
      level: 'error'
    })
  ]
});

// Log security events
function logSecurityEvent(event, details) {
  securityLogger.warn('Security Event', {
    event,
    details,
    timestamp: new Date().toISOString(),
    ip: details.ip,
    userAgent: details.userAgent
  });
}

// ใช้งาน
app.use((req, res, next) => {
  // Log suspicious requests
  if (req.path.includes('../') || req.path.includes('..\\')) {
    logSecurityEvent('DIRECTORY_TRAVERSAL_ATTEMPT', {
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  
  next();
});
```

### 2. Intrusion Detection

```javascript
class IntrusionDetection {
  constructor() {
    this.suspiciousIPs = new Map();
    this.maxAttempts = 5;
    this.timeWindow = 15 * 60 * 1000; // 15 minutes
  }
  
  recordSuspiciousActivity(ip, activity) {
    const now = Date.now();
    
    if (!this.suspiciousIPs.has(ip)) {
      this.suspiciousIPs.set(ip, []);
    }
    
    const activities = this.suspiciousIPs.get(ip);
    activities.push({ activity, timestamp: now });
    
    // ลบ activity เก่า
    const recentActivities = activities.filter(
      a => now - a.timestamp < this.timeWindow
    );
    
    this.suspiciousIPs.set(ip, recentActivities);
    
    // ตรวจสอบว่าเกินขีดจำกัดหรือไม่
    if (recentActivities.length >= this.maxAttempts) {
      this.blockIP(ip);
      return true; // blocked
    }
    
    return false; // not blocked
  }
  
  blockIP(ip) {
    logSecurityEvent('IP_BLOCKED', {
      ip,
      reason: 'Too many suspicious activities',
      activities: this.suspiciousIPs.get(ip)
    });
    
    // เพิ่ม IP ใน blacklist
    // อาจใช้ Redis หรือ database
  }
  
  isBlocked(ip) {
    // ตรวจสอบจาก blacklist
    return false; // implement based on your storage
  }
}

const ids = new IntrusionDetection();

// Middleware สำหรับตรวจสอบ
app.use((req, res, next) => {
  if (ids.isBlocked(req.ip)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});
```

## การ Backup และ Recovery

### 1. Automated Backup

```javascript
const cron = require('node-cron');
const { exec } = require('child_process');

// Backup ทุกวันเวลา 02:00
cron.schedule('0 2 * * *', async () => {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupFile = `backup-${timestamp}.sql`;
    
    // Backup database
    const command = `pg_dump ${process.env.DATABASE_URL} > backups/${backupFile}`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Backup failed:', error);
        logSecurityEvent('BACKUP_FAILED', { error: error.message });
      } else {
        console.log('Backup completed:', backupFile);
        
        // อัปโหลดไปยัง cloud storage
        uploadToCloudStorage(backupFile);
      }
    });
  } catch (error) {
    console.error('Backup error:', error);
  }
});
```

### 2. Disaster Recovery Plan

```markdown
## Disaster Recovery Procedures

### 1. Database Corruption
1. Stop application
2. Restore from latest backup
3. Verify data integrity
4. Restart application
5. Monitor for issues

### 2. Security Breach
1. Isolate affected systems
2. Change all passwords and API keys
3. Review logs for extent of breach
4. Restore from clean backup if needed
5. Implement additional security measures
6. Notify affected users

### 3. Service Outage
1. Check system status
2. Identify root cause
3. Implement temporary fix
4. Restore service
5. Implement permanent fix
6. Post-mortem analysis
```

## Security Checklist

### Development
- [ ] ใช้ HTTPS สำหรับทุก communications
- [ ] Validate และ sanitize ทุก inputs
- [ ] ใช้ parameterized queries
- [ ] เข้ารหัสข้อมูลสำคัญ
- [ ] ไม่ hard-code secrets ใน code
- [ ] ใช้ secure headers (Helmet.js)
- [ ] Implement rate limiting
- [ ] ใช้ CSRF protection
- [ ] Validate file uploads
- [ ] ใช้ secure session management

### Deployment
- [ ] ใช้ environment variables สำหรับ secrets
- [ ] ตั้งค่า firewall
- [ ] ใช้ reverse proxy (Nginx)
- [ ] Enable SSL/TLS
- [ ] ตั้งค่า monitoring และ alerting
- [ ] Backup ข้อมูลเป็นประจำ
- [ ] Update dependencies เป็นประจำ
- [ ] ใช้ container security scanning
- [ ] Implement log rotation
- [ ] ตั้งค่า intrusion detection

### Operations
- [ ] Monitor logs เป็นประจำ
- [ ] Review access logs
- [ ] ตรวจสอบ security alerts
- [ ] Update security patches
- [ ] ทดสอบ backup recovery
- [ ] Review user permissions
- [ ] Conduct security audits
- [ ] Train team on security practices
- [ ] Document incident response procedures
- [ ] Regular penetration testing

## การรายงานช่องโหว่ความปลอดภัย

หากพบช่องโหว่ความปลอดภัย กรุณา:

1. **ไม่เปิดเผยต่อสาธารณะ** จนกว่าจะได้รับการแก้ไข
2. **ส่งรายงานไปยัง**: security@yourcompany.com
3. **รวมข้อมูล**:
   - รายละเอียดช่องโหว่
   - ขั้นตอนการทำซ้ำ
   - ผลกระทบที่เป็นไปได้
   - แนวทางแก้ไขที่แนะนำ

4. **รอการตอบกลับ** ภายใน 48 ชั่วโมง
5. **ให้เวลาแก้ไข** อย่างน้อย 90 วัน

## การอัปเดตความปลอดภัย

เอกสารนี้จะได้รับการอัปเดตเป็นประจำเพื่อให้ทันกับ:
- ภัยคุกคามใหม่ๆ
- Best practices ที่เปลี่ยนแปลง
- การอัปเดต dependencies
- ผลจากการ security audit

---

**หมายเหตุ**: ความปลอดภัยเป็นกระบวนการต่อเนื่อง ไม่ใช่จุดหมายปลายทาง ควรทบทวนและปรับปรุงมาตรการความปลอดภัยอย่างสม่ำเสมอ