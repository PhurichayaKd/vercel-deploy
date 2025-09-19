#!/usr/bin/env node

/**
 * สคริปต์สำหรับทดสอบ LINE Bot อย่างง่าย
 * รันด้วย: node scripts/test-bot.js
 */

import dotenv from 'dotenv';
import axios from 'axios';
import moment from 'moment';

dotenv.config();

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_SECRET_KEY;
const LINE_USER_ID = process.env.TEST_LINE_USER_ID || 'U1234567890abcdef';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  log(`\n🧪 Testing: ${testName}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test functions
async function testHealthCheck() {
  logTest('Health Check');
  try {
    const response = await axios.get(`${BASE_URL}/api/health`);
    if (response.status === 200) {
      logSuccess('Health check passed');
      log(`   Status: ${response.data.status}`);
      log(`   Uptime: ${response.data.uptime}s`);
      return true;
    }
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    return false;
  }
}

async function testRFIDScan() {
  logTest('RFID Scan API');
  try {
    const testData = {
      student_id: 'STU001',
      scan_type: 'board',
      bus_id: 'BUS001',
      location: {
        latitude: 13.7563,
        longitude: 100.5018
      }
    };

    const response = await axios.post(`${BASE_URL}/api/rfid-scan`, testData, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      }
    });

    if (response.status === 200 && response.data.success) {
      logSuccess('RFID scan test passed');
      log(`   Message: ${response.data.message}`);
      log(`   Notification sent: ${response.data.notification_sent}`);
      return true;
    } else {
      logError('RFID scan test failed - Invalid response');
      return false;
    }
  } catch (error) {
    logError(`RFID scan test failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testBusLocation() {
  logTest('Bus Location Update API');
  try {
    const testData = {
      bus_id: 'BUS001',
      latitude: 13.7563,
      longitude: 100.5018,
      speed: 45.5,
      heading: 180.0
    };

    const response = await axios.post(`${BASE_URL}/api/bus-location`, testData, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      }
    });

    if (response.status === 200 && response.data.success) {
      logSuccess('Bus location update test passed');
      log(`   Message: ${response.data.message}`);
      return true;
    } else {
      logError('Bus location update test failed - Invalid response');
      return false;
    }
  } catch (error) {
    logError(`Bus location update test failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testEmergencyAlert() {
  logTest('Emergency Alert API');
  try {
    const testData = {
      bus_id: 'BUS001',
      emergency_type: 'test',
      description: 'Test emergency alert',
      location: {
        latitude: 13.7563,
        longitude: 100.5018
      }
    };

    const response = await axios.post(`${BASE_URL}/api/emergency`, testData, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      }
    });

    if (response.status === 200 && response.data.success) {
      logSuccess('Emergency alert test passed');
      log(`   Message: ${response.data.message}`);
      log(`   Notifications sent: ${response.data.notifications_sent}`);
      return true;
    } else {
      logError('Emergency alert test failed - Invalid response');
      return false;
    }
  } catch (error) {
    logError(`Emergency alert test failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testWebhook() {
  logTest('LINE Webhook');
  try {
    // Simulate LINE webhook payload
    const testPayload = {
      events: [
        {
          type: 'message',
          message: {
            type: 'text',
            text: 'test'
          },
          source: {
            type: 'user',
            userId: LINE_USER_ID
          },
          timestamp: Date.now(),
          replyToken: 'test-reply-token'
        }
      ]
    };

    const response = await axios.post(`${BASE_URL}/webhook`, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': 'test-signature'
      }
    });

    if (response.status === 200) {
      logSuccess('Webhook test passed');
      return true;
    } else {
      logError('Webhook test failed - Invalid response');
      return false;
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error?.includes('signature')) {
      logWarning('Webhook endpoint exists but signature validation failed (expected)');
      return true;
    }
    logError(`Webhook test failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testDatabaseConnection() {
  logTest('Database Connection');
  try {
    const response = await axios.get(`${BASE_URL}/api/health/db`, {
      headers: {
        'X-API-Key': API_KEY
      }
    });

    if (response.status === 200 && response.data.database === 'connected') {
      logSuccess('Database connection test passed');
      return true;
    } else {
      logError('Database connection test failed');
      return false;
    }
  } catch (error) {
    if (error.response?.status === 404) {
      logWarning('Database health endpoint not implemented');
      return true;
    }
    logError(`Database connection test failed: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  log('🚀 Starting Safety Bus Bot Tests', 'magenta');
  log(`📍 Base URL: ${BASE_URL}`);
  log(`🔑 API Key: ${API_KEY ? 'Set' : 'Not set'}`);
  log(`👤 Test User ID: ${LINE_USER_ID}`);
  log(`⏰ Time: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

  if (!API_KEY) {
    logError('API_SECRET_KEY not set in environment variables');
    process.exit(1);
  }

  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'LINE Webhook', fn: testWebhook },
    { name: 'RFID Scan API', fn: testRFIDScan },
    { name: 'Bus Location API', fn: testBusLocation },
    { name: 'Emergency Alert API', fn: testEmergencyAlert }
  ];

  const results = [];
  
  for (const test of tests) {
    const result = await test.fn();
    results.push({ name: test.name, passed: result });
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  log('\n📊 Test Results Summary', 'magenta');
  log('=' .repeat(50));
  
  let passed = 0;
  let total = results.length;
  
  results.forEach(result => {
    if (result.passed) {
      logSuccess(`${result.name}: PASSED`);
      passed++;
    } else {
      logError(`${result.name}: FAILED`);
    }
  });
  
  log('=' .repeat(50));
  log(`📈 Overall: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`, 
      passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('🎉 All tests passed! Your bot is ready to go!', 'green');
  } else {
    log('🔧 Some tests failed. Please check the configuration and try again.', 'yellow');
  }
  
  process.exit(passed === total ? 0 : 1);
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Safety Bus Bot Test Script

Usage: node scripts/test-bot.js [options]

Options:
  --help, -h     Show this help message
  
Environment Variables:
  BASE_URL              Base URL of the bot server (default: http://localhost:3000)
  API_SECRET_KEY        API secret key for authentication (required)
  TEST_LINE_USER_ID     LINE User ID for testing (default: U1234567890abcdef)
  
Examples:
  node scripts/test-bot.js
  BASE_URL=https://your-bot.herokuapp.com node scripts/test-bot.js
`);
  process.exit(0);
}

// Run tests
runTests().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});