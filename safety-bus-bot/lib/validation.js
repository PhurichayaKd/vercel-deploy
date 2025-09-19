// lib/validation.js
import Joi from 'joi';

// Schema สำหรับการสแกน RFID
const rfidScanSchema = Joi.object({
  student_id: Joi.string().required().min(8).max(20),
  scan_type: Joi.string().valid('pickup', 'dropoff').required(),
  bus_number: Joi.string().required().min(3).max(10),
  location: Joi.string().required().max(100),
  coordinates: Joi.string().pattern(/^-?\d+\.\d+,-?\d+\.\d+$/).optional(),
  timestamp: Joi.date().iso().optional()
});

// Schema สำหรับเหตุฉุกเฉิน
const emergencySchema = Joi.object({
  bus_number: Joi.string().required().min(3).max(10),
  emergency_type: Joi.string().valid('fire', 'accident', 'medical', 'breakdown', 'other').required(),
  location: Joi.string().required().max(100),
  coordinates: Joi.string().pattern(/^-?\d+\.\d+,-?\d+\.\d+$/).required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  description: Joi.string().max(500).optional(),
  driver_id: Joi.string().max(20).optional(),
  timestamp: Joi.date().iso().optional()
});

// Schema สำหรับตำแหน่งรถ
const busLocationSchema = Joi.object({
  bus_number: Joi.string().required().min(3).max(10),
  driver_id: Joi.string().required().max(20),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  speed: Joi.number().min(0).max(200).optional(),
  heading: Joi.number().min(0).max(360).optional(),
  timestamp: Joi.date().iso().optional()
});

// Schema สำหรับการแจ้งความล่าช้า
const delayNotificationSchema = Joi.object({
  bus_number: Joi.string().required().min(3).max(10),
  delay_minutes: Joi.number().min(1).max(120).required(),
  reason: Joi.string().max(200).optional(),
  estimated_arrival: Joi.date().iso().optional(),
  affected_stops: Joi.array().items(Joi.string().max(50)).optional(),
  driver_id: Joi.string().max(20).optional()
});

// Schema สำหรับการตรวจสอบการขาดเรียน
const attendanceCheckSchema = Joi.object({
  date: Joi.date().iso().optional(),
  bus_numbers: Joi.array().items(Joi.string().min(3).max(10)).optional(),
  check_time: Joi.string().valid('morning', 'afternoon', 'both').default('morning')
});

// Schema สำหรับการทดสอบการแจ้งเตือน
const testNotificationSchema = Joi.object({
  target_type: Joi.string().valid('parent', 'driver', 'admin', 'all').required(),
  target_id: Joi.string().when('target_type', {
    is: Joi.string().valid('parent', 'driver'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  message_type: Joi.string().valid('text', 'flex', 'template').default('text'),
  test_message: Joi.string().max(1000).required()
});

// Schema สำหรับการผูกบัญชี LINE
const linkAccountSchema = Joi.object({
  studentId: Joi.string().required().min(3).max(20),
  lineUserId: Joi.string().required(),
  parentName: Joi.string().max(100).optional(),
  phoneNumber: Joi.string().pattern(/^[0-9+\-\s()]+$/).max(20).optional()
});

// Schema สำหรับการแจ้งลาหยุด
const leaveNotificationSchema = Joi.object({
  student_id: Joi.string().required().min(8).max(20),
  leave_type: Joi.string().valid('sick', 'personal', 'emergency', 'other').required(),
  leave_date: Joi.date().iso().required(),
  reason: Joi.string().max(300).optional(),
  parent_id: Joi.string().required(),
  contact_number: Joi.string().pattern(/^[0-9+\-\s()]+$/).max(20).optional()
});

// ฟังก์ชันสำหรับ validate ข้อมูล
function validateData(schema, data) {
  const { error, value } = schema.validate(data, {
    abortEarly: false, // แสดงข้อผิดพลาดทั้งหมด
    stripUnknown: true, // ลบ field ที่ไม่รู้จัก
    convert: true // แปลงประเภทข้อมูลอัตโนมัติ
  });
  
  if (error) {
    const errorMessages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    
    return {
      isValid: false,
      errors: errorMessages,
      data: null
    };
  }
  
  return {
    isValid: true,
    errors: null,
    data: value
  };
}

// ฟังก์ชันสำหรับตรวจสอบ API Key
function validateApiKey(apiKey) {
  if (!apiKey) {
    return {
      isValid: false,
      error: 'API key is required'
    };
  }
  
  if (apiKey !== process.env.API_SECRET_KEY) {
    return {
      isValid: false,
      error: 'Invalid API key'
    };
  }
  
  return {
    isValid: true,
    error: null
  };
}

// ฟังก์ชันสำหรับตรวจสอบพิกัด
function validateCoordinates(coordinates) {
  if (!coordinates) return { isValid: false, error: 'Coordinates are required' };
  
  const coordPattern = /^-?\d+\.\d+,-?\d+\.\d+$/;
  if (!coordPattern.test(coordinates)) {
    return {
      isValid: false,
      error: 'Invalid coordinates format. Expected: "latitude,longitude"'
    };
  }
  
  const [lat, lng] = coordinates.split(',').map(Number);
  
  if (lat < -90 || lat > 90) {
    return {
      isValid: false,
      error: 'Latitude must be between -90 and 90'
    };
  }
  
  if (lng < -180 || lng > 180) {
    return {
      isValid: false,
      error: 'Longitude must be between -180 and 180'
    };
  }
  
  return {
    isValid: true,
    latitude: lat,
    longitude: lng
  };
}

// ฟังก์ชันสำหรับตรวจสอบรหัสนักเรียน
function validateStudentId(studentId) {
  if (!studentId) {
    return { isValid: false, error: 'Student ID is required' };
  }
  
  // ตรวจสอบรูปแบบรหัสนักเรียน (8-20 ตัวอักษร)
  if (studentId.length < 8 || studentId.length > 20) {
    return {
      isValid: false,
      error: 'Student ID must be between 8-20 characters'
    };
  }
  
  // ตรวจสอบว่าเป็นตัวเลขและตัวอักษรเท่านั้น
  if (!/^[a-zA-Z0-9]+$/.test(studentId)) {
    return {
      isValid: false,
      error: 'Student ID can only contain letters and numbers'
    };
  }
  
  return { isValid: true };
}

// ฟังก์ชันสำหรับตรวจสอบหมายเลขโทรศัพท์
function validatePhoneNumber(phoneNumber) {
  if (!phoneNumber) return { isValid: true }; // ไม่บังคับ
  
  // ลบช่องว่างและอักขระพิเศษ
  const cleanNumber = phoneNumber.replace(/[\s()\-+]/g, '');
  
  // ตรวจสอบว่าเป็นตัวเลขทั้งหมด
  if (!/^\d+$/.test(cleanNumber)) {
    return {
      isValid: false,
      error: 'Phone number can only contain digits'
    };
  }
  
  // ตรวจสอบความยาว (9-15 หลัก)
  if (cleanNumber.length < 9 || cleanNumber.length > 15) {
    return {
      isValid: false,
      error: 'Phone number must be between 9-15 digits'
    };
  }
  
  return {
    isValid: true,
    cleanNumber: cleanNumber
  };
}

// Middleware สำหรับ Express
function createValidationMiddleware(schema) {
  return (req, res, next) => {
    const validation = validateData(schema, req.body);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }
    
    // แทนที่ req.body ด้วยข้อมูลที่ผ่านการ validate แล้ว
    req.body = validation.data;
    next();
  };
}

// Middleware สำหรับตรวจสอบ API Key
function apiKeyMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validation = validateApiKey(apiKey);
  
  if (!validation.isValid) {
    return res.status(401).json({
      success: false,
      error: validation.error
    });
  }
  
  next();
}

export {
  // Schemas
  rfidScanSchema,
  emergencySchema,
  busLocationSchema,
  delayNotificationSchema,
  attendanceCheckSchema,
  testNotificationSchema,
  linkAccountSchema,
  leaveNotificationSchema,
  
  // Validation functions
  validateData,
  validateApiKey,
  validateCoordinates,
  validateStudentId,
  validatePhoneNumber,
  
  // Middleware
  createValidationMiddleware,
  apiKeyMiddleware
};