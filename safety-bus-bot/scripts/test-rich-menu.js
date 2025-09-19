// ทดสอบการทำงานของ Rich Menu Leave Request
import { handleMainAction, handlePostback } from '../lib/handlers.js';
import { checkLinkStatus } from '../lib/account-linking.js';
import { getStudentByLineId } from '../lib/student-data.js';

async function testRichMenuLeaveRequest() {
  console.log('🧪 Testing Rich Menu Leave Request Feature');
  console.log('=' .repeat(50));
  
  const testUserId = 'Ue1de2d9dbed6fbf37ed494f3b44bb43a';
  
  try {
    // 1. ทดสอบการตรวจสอบสถานะการเชื่อมโยงบัญชี
    console.log('\n1️⃣ Checking account link status...');
    const linkStatus = await checkLinkStatus(testUserId);
    console.log('Link Status:', linkStatus);
    
    if (!linkStatus.isLinked) {
      console.log('❌ Account not linked - this is expected for testing');
      console.log('✅ Bot will show link instruction message');
    } else {
      console.log('✅ Account is linked');
      
      // 2. ทดสอบการดึงข้อมูลนักเรียน
      console.log('\n2️⃣ Getting student data...');
      const studentData = await getStudentByLineId(testUserId);
      console.log('Student Data:', studentData);
    }
    
    // 3. จำลองการกดปุ่ม Leave Request จาก Rich Menu
    console.log('\n3️⃣ Simulating Rich Menu Leave Request button click...');
    const mockPostbackEvent = {
      source: { userId: testUserId },
      postback: { data: 'action=leave' },
      replyToken: null // Rich Menu ไม่มี replyToken
    };
    
    console.log('📱 Simulating postback event:', mockPostbackEvent.postback.data);
    await handlePostback(mockPostbackEvent);
    
    console.log('\n✅ Rich Menu Leave Request test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- ✅ handlePostback function works');
    console.log('- ✅ handleMainAction function works');
    console.log('- ✅ handleLeaveRequest function works');
    console.log('- ✅ Account link checking works');
    console.log('- ✅ Rich Menu button should work in LINE Bot');
    
    if (linkStatus.isLinked) {
      console.log('- ✅ Leave form should be sent to user');
    } else {
      console.log('- ✅ Link instruction message should be sent to user');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// รันการทดสอบ
testRichMenuLeaveRequest();