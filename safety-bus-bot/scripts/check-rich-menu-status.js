import dotenv from 'dotenv';
import { Client } from '@line/bot-sdk';

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

console.log('🔍 ตรวจสอบสถานะ Rich Menu');
console.log('==================================================');

async function checkRichMenuStatus() {
  try {
    // ดึงรายการ Rich Menu ทั้งหมด
    console.log('📋 ดึงรายการ Rich Menu ทั้งหมด...');
    const richMenus = await client.getRichMenuList();
    
    if (richMenus.length === 0) {
      console.log('❌ ไม่พบ Rich Menu ใดๆ');
      return;
    }
    
    console.log(`✅ พบ Rich Menu จำนวน: ${richMenus.length}`);
    
    for (const menu of richMenus) {
      console.log(`\n📱 Rich Menu ID: ${menu.richMenuId}`);
      console.log(`   📝 ชื่อ: ${menu.name}`);
      console.log(`   📏 ขนาด: ${menu.size.width}x${menu.size.height}`);
      console.log(`   🎯 จำนวนพื้นที่: ${menu.areas.length}`);
      
      // แสดงรายละเอียดพื้นที่
      menu.areas.forEach((area, index) => {
        console.log(`   🔘 พื้นที่ ${index + 1}: ${area.action.type} - ${area.action.data || area.action.text || 'N/A'}`);
      });
    }
    
    // ตรวจสอบ Rich Menu เริ่มต้น
    console.log('\n🎯 ตรวจสอบ Rich Menu เริ่มต้น...');
    try {
      const defaultRichMenu = await client.getDefaultRichMenu();
      console.log(`✅ Rich Menu เริ่มต้น: ${defaultRichMenu.richMenuId}`);
    } catch (error) {
      if (error.statusCode === 404) {
        console.log('❌ ไม่มี Rich Menu เริ่มต้น');
      } else {
        console.log('❌ เกิดข้อผิดพลาดในการดึง Rich Menu เริ่มต้น:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    if (error.statusCode) {
      console.error(`   📊 Status Code: ${error.statusCode}`);
    }
  }
}

// รันการตรวจสอบ
checkRichMenuStatus()
  .then(() => {
    console.log('\n🎉 การตรวจสอบเสร็จสิ้น!');
    console.log('\n💡 หากต้องการทดสอบ Rich Menu:');
    console.log('   1. เปิดแอป LINE บนมือถือ');
    console.log('   2. เข้าไปในแชทกับ Bot');
    console.log('   3. ดูที่ด้านล่างของหน้าจอ ควรเห็น Rich Menu');
    console.log('   4. ลองกดปุ่มต่างๆ และดู logs ของเซิร์ฟเวอร์');
  })
  .catch(error => {
    console.error('❌ เกิดข้อผิดพลาดในการตรวจสอบ:', error);
  });