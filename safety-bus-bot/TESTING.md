# คู่มือการทดสอบระบบ Safety Bus Bot

## การเตรียมสภาพแวดล้อมสำหรับทดสอบ

### 1. ติดตั้ง Dependencies สำหรับทดสอบ

```bash
npm install --save-dev jest supertest
```

### 2. ตั้งค่าไฟล์ทดสอบ

สร้างไฟล์ `jest.config.js`:
```javascript
module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
```

### 3. ตั้งค่า Environment Variables สำหรับทดสอบ

สร้างไฟล์ `.env.test`:
```env
NODE_ENV=test
LINE_CHANNEL_ACCESS_TOKEN=test_token
LINE_CHANNEL_SECRET=test_secret
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=test_key
API_SECRET_KEY=test_api_key
PORT=3001
```

## การทดสอบ Unit Tests

### 1. ทดสอบ Validation Functions

สร้างไฟล์ `tests/validation.test.js`:
```javascript
const { validateRfidScan, validateEmergency } = require('../lib/validation');

describe('Validation Tests', () => {
  describe('RFID Scan Validation', () => {
    test('should validate correct RFID scan data', () => {
      const validData = {
        student_id: 'STU001',
        scan_type: 'board',
        bus_id: 'BUS001',
        location: {
          latitude: 13.7563,
          longitude: 100.5018
        }
      };
      
      const { error } = validateRfidScan(validData);
      expect(error).toBeUndefined();
    });
    
    test('should reject invalid scan_type', () => {
      const invalidData = {
        student_id: 'STU001',
        scan_type: 'invalid',
        bus_id: 'BUS001'
      };
      
      const { error } = validateRfidScan(invalidData);
      expect(error).toBeDefined();
    });
  });
});
```

### 2. ทดสอบ Account Linking Functions

สร้างไฟล์ `tests/account-linking.test.js`:
```javascript
const { createLinkToken, linkByStudentId } = require('../lib/account-linking');

// Mock Supabase
jest.mock('../lib/supabase', () => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn()
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    }))
  }))
}));

describe('Account Linking Tests', () => {
  test('should create link token successfully', async () => {
    const parentId = 'parent-123';
    const token = await createLinkToken(parentId);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });
});
```

### 3. ทดสอบ Message Handlers

สร้างไฟล์ `tests/handlers.test.js`:
```javascript
const { handleTextMessage } = require('../lib/handlers');

describe('Message Handlers Tests', () => {
  test('should handle menu command', async () => {
    const mockEvent = {
      type: 'message',
      message: { type: 'text', text: 'เมนู' },
      source: { userId: 'test-user-123' },
      replyToken: 'reply-token-123'
    };
    
    const result = await handleTextMessage(mockEvent);
    expect(result).toBeDefined();
  });
});
```

## การทดสอบ Integration Tests

### 1. ทดสอบ API Endpoints

สร้างไฟล์ `tests/api.test.js`:
```javascript
const request = require('supertest');
const app = require('../app');

describe('API Endpoints', () => {
  describe('POST /api/rfid-scan', () => {
    test('should accept valid RFID scan', async () => {
      const scanData = {
        student_id: 'STU001',
        scan_type: 'board',
        bus_id: 'BUS001',
        location: {
          latitude: 13.7563,
          longitude: 100.5018
        }
      };
      
      const response = await request(app)
        .post('/api/rfid-scan')
        .set('X-API-Key', process.env.API_SECRET_KEY)
        .send(scanData)
        .expect(200);
        
      expect(response.body.success).toBe(true);
    });
    
    test('should reject request without API key', async () => {
      const scanData = {
        student_id: 'STU001',
        scan_type: 'board',
        bus_id: 'BUS001'
      };
      
      await request(app)
        .post('/api/rfid-scan')
        .send(scanData)
        .expect(401);
    });
  });
  
  describe('GET /api/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
        
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
```

### 2. ทดสอบ Webhook

สร้างไฟล์ `tests/webhook.test.js`:
```javascript
const request = require('supertest');
const crypto = require('crypto');
const app = require('../app');

function generateSignature(body, secret) {
  return crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');
}

describe('LINE Webhook', () => {
  test('should handle valid webhook request', async () => {
    const webhookBody = {
      events: [{
        type: 'message',
        message: { type: 'text', text: 'สวัสดี' },
        source: { userId: 'test-user-123' },
        replyToken: 'reply-token-123'
      }]
    };
    
    const bodyString = JSON.stringify(webhookBody);
    const signature = generateSignature(bodyString, process.env.LINE_CHANNEL_SECRET);
    
    await request(app)
      .post('/webhook')
      .set('X-Line-Signature', signature)
      .send(webhookBody)
      .expect(200);
  });
  
  test('should reject invalid signature', async () => {
    const webhookBody = { events: [] };
    
    await request(app)
      .post('/webhook')
      .set('X-Line-Signature', 'invalid-signature')
      .send(webhookBody)
      .expect(401);
  });
});
```

## การทดสอบ End-to-End (E2E)

### 1. ทดสอบ Flow การผูกบัญชี

```javascript
// tests/e2e/account-linking.test.js
const { Client } = require('@line/bot-sdk');
const supabase = require('../../lib/supabase');

describe('Account Linking E2E', () => {
  let testParentId;
  let testStudentId;
  
  beforeAll(async () => {
    // สร้างข้อมูลทดสอบ
    const { data: parent } = await supabase
      .from('parents')
      .insert({ name: 'Test Parent', phone: '0812345678' })
      .select()
      .single();
    testParentId = parent.id;
    
    const { data: student } = await supabase
      .from('students')
      .insert({
        student_id: 'TEST001',
        name: 'Test Student',
        parent_id: testParentId
      })
      .select()
      .single();
    testStudentId = student.id;
  });
  
  afterAll(async () => {
    // ลบข้อมูลทดสอบ
    await supabase.from('students').delete().eq('id', testStudentId);
    await supabase.from('parents').delete().eq('id', testParentId);
  });
  
  test('should complete account linking flow', async () => {
    // 1. ผู้ใช้ส่งคำสั่ง "ผูกบัญชี"
    // 2. บอทขอรหัสนักเรียน
    // 3. ผู้ใช้ส่งรหัสนักเรียน
    // 4. บอทยืนยันการผูกบัญชี
    // 5. ตรวจสอบข้อมูลในฐานข้อมูล
    
    const { data: linkData } = await supabase
      .from('parent_line_links')
      .select('*')
      .eq('parent_id', testParentId)
      .single();
      
    expect(linkData).toBeDefined();
    expect(linkData.active).toBe(true);
  });
});
```

### 2. ทดสอบ Flow การแจ้งเตือน

```javascript
// tests/e2e/notifications.test.js
describe('Notification Flow E2E', () => {
  test('should send notification when student boards bus', async () => {
    // 1. ส่งข้อมูล RFID scan ผ่าน API
    // 2. ระบบค้นหาผู้ปกครองที่เชื่อมโยง
    // 3. ส่ง Push Message ไปยัง LINE
    // 4. บันทึก log การส่งข้อความ
    
    const scanData = {
      student_id: 'TEST001',
      scan_type: 'board',
      bus_id: 'BUS001',
      location: {
        latitude: 13.7563,
        longitude: 100.5018
      }
    };
    
    const response = await request(app)
      .post('/api/rfid-scan')
      .set('X-API-Key', process.env.API_SECRET_KEY)
      .send(scanData)
      .expect(200);
      
    expect(response.body.success).toBe(true);
    expect(response.body.notification_sent).toBe(true);
  });
});
```

## การทดสอบ Performance

### 1. ทดสอบ Load Testing

```javascript
// tests/performance/load.test.js
const request = require('supertest');
const app = require('../../app');

describe('Load Testing', () => {
  test('should handle multiple concurrent requests', async () => {
    const promises = [];
    const requestCount = 100;
    
    for (let i = 0; i < requestCount; i++) {
      promises.push(
        request(app)
          .get('/api/health')
          .expect(200)
      );
    }
    
    const startTime = Date.now();
    await Promise.all(promises);
    const endTime = Date.now();
    
    const avgResponseTime = (endTime - startTime) / requestCount;
    expect(avgResponseTime).toBeLessThan(100); // ต้องไม่เกิน 100ms ต่อ request
  });
});
```

### 2. ทดสอบ Memory Usage

```javascript
// tests/performance/memory.test.js
describe('Memory Usage Testing', () => {
  test('should not have memory leaks', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // ทำงานหนักๆ หลายรอบ
    for (let i = 0; i < 1000; i++) {
      await request(app)
        .post('/api/rfid-scan')
        .set('X-API-Key', process.env.API_SECRET_KEY)
        .send({
          student_id: `STU${i}`,
          scan_type: 'board',
          bus_id: 'BUS001'
        });
    }
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase ต้องไม่เกิน 50MB
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});
```

## การทดสอบ Security

### 1. ทดสอบ Input Validation

```javascript
// tests/security/validation.test.js
describe('Security Validation Tests', () => {
  test('should reject SQL injection attempts', async () => {
    const maliciousData = {
      student_id: "'; DROP TABLE students; --",
      scan_type: 'board',
      bus_id: 'BUS001'
    };
    
    await request(app)
      .post('/api/rfid-scan')
      .set('X-API-Key', process.env.API_SECRET_KEY)
      .send(maliciousData)
      .expect(400);
  });
  
  test('should reject XSS attempts', async () => {
    const xssData = {
      student_id: '<script>alert("xss")</script>',
      scan_type: 'board',
      bus_id: 'BUS001'
    };
    
    await request(app)
      .post('/api/rfid-scan')
      .set('X-API-Key', process.env.API_SECRET_KEY)
      .send(xssData)
      .expect(400);
  });
});
```

### 2. ทดสอบ Authentication

```javascript
// tests/security/auth.test.js
describe('Authentication Tests', () => {
  test('should reject requests without API key', async () => {
    await request(app)
      .post('/api/rfid-scan')
      .send({ student_id: 'STU001' })
      .expect(401);
  });
  
  test('should reject requests with invalid API key', async () => {
    await request(app)
      .post('/api/rfid-scan')
      .set('X-API-Key', 'invalid-key')
      .send({ student_id: 'STU001' })
      .expect(401);
  });
});
```

## การรันการทดสอบ

### 1. รันการทดสอบทั้งหมด

```bash
# รันทุก test
npm test

# รัน test พร้อม coverage
npm run test:coverage

# รัน test แบบ watch mode
npm run test:watch
```

### 2. รันการทดสอบแยกประเภท

```bash
# รัน unit tests เท่านั้น
npm run test:unit

# รัน integration tests เท่านั้น
npm run test:integration

# รัน e2e tests เท่านั้น
npm run test:e2e

# รัน performance tests เท่านั้น
npm run test:performance
```

### 3. เพิ่ม Scripts ใน package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e",
    "test:performance": "jest tests/performance",
    "test:security": "jest tests/security"
  }
}
```

## การทดสอบ Manual

### 1. ทดสอบ LINE Bot

1. เพิ่ม Friend บอทใน LINE
2. ทดสอบคำสั่งต่างๆ:
   - "เมนู" - ควรแสดงเมนูหลัก
   - "สถานะ" - ควรแสดงสถานะการเชื่อมโยง
   - "ผูกบัญชี" - ควรเริ่ม flow การผูกบัญชี
   - "ประวัติ" - ควรแสดงประวัติการเดินทาง (หากผูกบัญชีแล้ว)
   - "ตำแหน่งรถ" - ควรแสดงตำแหน่งรถปัจจุบัน
   - "ลาหยุด" - ควรเริ่ม flow การแจ้งลาหยุด

### 2. ทดสอบ API ด้วย Postman

1. Import Postman Collection:
```json
{
  "info": {
    "name": "Safety Bus Bot API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/api/health",
          "host": ["{{base_url}}"],
          "path": ["api", "health"]
        }
      }
    },
    {
      "name": "RFID Scan",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "X-API-Key",
            "value": "{{api_key}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"student_id\": \"STU001\",\n  \"scan_type\": \"board\",\n  \"bus_id\": \"BUS001\",\n  \"location\": {\n    \"latitude\": 13.7563,\n    \"longitude\": 100.5018\n  }\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/rfid-scan",
          "host": ["{{base_url}}"],
          "path": ["api", "rfid-scan"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "https://your-domain.com"
    },
    {
      "key": "api_key",
      "value": "your_api_secret_key"
    }
  ]
}
```

### 3. ทดสอบ Database

```sql
-- ทดสอบการเพิ่มข้อมูล parent
INSERT INTO parents (name, phone, email) 
VALUES ('Test Parent', '0812345678', 'test@example.com');

-- ทดสอบการเพิ่มข้อมูล student
INSERT INTO students (student_id, name, parent_id, bus_route) 
VALUES ('STU001', 'Test Student', (SELECT id FROM parents WHERE name = 'Test Parent'), 'Route A');

-- ทดสอบการ query ข้อมูล
SELECT s.*, p.name as parent_name 
FROM students s 
JOIN parents p ON s.parent_id = p.id 
WHERE s.student_id = 'STU001';

-- ทดสอบการลบข้อมูล
DELETE FROM students WHERE student_id = 'STU001';
DELETE FROM parents WHERE name = 'Test Parent';
```

## การ Monitor การทดสอบ

### 1. Test Coverage Report

```bash
# สร้าง coverage report
npm run test:coverage

# เปิด HTML report
open coverage/lcov-report/index.html
```

### 2. Continuous Integration

สร้างไฟล์ `.github/workflows/test.yml`:
```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - run: npm ci
    - run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
```

### 3. Test Metrics

- **Code Coverage**: ต้องไม่ต่ำกว่า 80%
- **Test Pass Rate**: ต้อง 100%
- **Performance**: API response time < 200ms
- **Memory Usage**: ไม่เกิน 512MB
- **Error Rate**: < 1%

## Best Practices

1. **เขียน Test ก่อนเขียน Code** (TDD)
2. **ใช้ Mock สำหรับ External Services**
3. **แยก Test Environment จาก Production**
4. **ทดสอบทั้ง Happy Path และ Error Cases**
5. **ใช้ Descriptive Test Names**
6. **Clean Up Test Data หลังทดสอบ**
7. **Run Tests ใน CI/CD Pipeline**
8. **Monitor Test Performance**
9. **Update Tests เมื่อ Code เปลี่ยน**
10. **Document Test Scenarios**

---

**หมายเหตุ:** การทดสอบเป็นส่วนสำคัญของการพัฒนาซอฟต์แวร์ ควรทำการทดสอบอย่างสม่ำเสมอและครอบคลุมทุกส่วนของระบบ