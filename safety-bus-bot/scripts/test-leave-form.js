// scripts/test-leave-form.js
import { createLeaveForm } from '../lib/leave-form.js';
import { checkLinkStatus } from '../lib/account-linking.js';
import { getStudentByLineId } from '../lib/student-data.js';

// ทดสอบกับ LINE User ID ที่มีอยู่ในฐานข้อมูล
const testLineUserIds = [
  'dd333_',      // parent_line_links
  '0834608586',  // parent_line_links
  'tartar-c-v'   // student_line_links
];

async function testLeaveForm() {
  console.log('🧪 Testing Leave Form Feature...');
  console.log('=' .repeat(50));
  
  for (const lineUserId of testLineUserIds) {
    console.log(`\n📱 Testing with LINE User ID: ${lineUserId}`);
    console.log('-'.repeat(30));
    
    try {
      // ทดสอบ checkLinkStatus
      console.log('1. Testing checkLinkStatus...');
      const linkStatus = await checkLinkStatus(lineUserId);
      console.log('Link Status:', JSON.stringify(linkStatus, null, 2));
      
      // ทดสอบ getStudentByLineId
      console.log('\n2. Testing getStudentByLineId...');
      const studentData = await getStudentByLineId(lineUserId);
      console.log('Student Data:', JSON.stringify(studentData, null, 2));
      
      // ทดสอบ createLeaveForm
      console.log('\n3. Testing createLeaveForm...');
      const leaveForm = await createLeaveForm(lineUserId);
      
      if (leaveForm.type === 'text') {
        console.log('❌ Leave Form Error:', leaveForm.text);
      } else {
        console.log('✅ Leave Form Created Successfully');
        console.log('Form Type:', leaveForm.type);
        console.log('Alt Text:', leaveForm.altText);
        
        // แสดงข้อมูลนักเรียนในฟอร์ม
        if (leaveForm.contents && leaveForm.contents.body) {
          const bodyContents = leaveForm.contents.body.contents;
          const studentInfo = bodyContents.find(item => 
            item.contents && item.contents.some(subItem => 
              subItem.contents && subItem.contents.some(text => 
                text.text && text.text.includes('ชื่อ:')
              )
            )
          );
          
          if (studentInfo) {
            console.log('📝 Student info found in form');
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error testing:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 Test completed!');
}

// เรียกใช้ฟังก์ชันทดสอบ
testLeaveForm().catch(console.error);