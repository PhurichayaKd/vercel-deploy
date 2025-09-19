import dotenv from 'dotenv';
import { Client } from '@line/bot-sdk';

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

console.log('🧹 ทำความสะอาด Rich Menu และตั้งค่าใหม่');
console.log('==================================================');

async function cleanupAndSetupRichMenu() {
  try {
    // ดึงรายการ Rich Menu ทั้งหมด
    console.log('📋 ดึงรายการ Rich Menu ทั้งหมด...');
    const richMenus = await client.getRichMenuList();
    
    if (richMenus.length === 0) {
      console.log('❌ ไม่พบ Rich Menu ใดๆ');
      return;
    }
    
    console.log(`✅ พบ Rich Menu จำนวน: ${richMenus.length}`);
    
    // เก็บ Rich Menu ล่าสุด (รายการสุดท้าย)
    const latestRichMenu = richMenus[richMenus.length - 1];
    console.log(`🎯 จะใช้ Rich Menu: ${latestRichMenu.richMenuId}`);
    
    // ลบ Rich Menu เก่าๆ (ยกเว้นรายการสุดท้าย)
    for (let i = 0; i < richMenus.length - 1; i++) {
      const menu = richMenus[i];
      console.log(`🗑️ ลบ Rich Menu เก่า: ${menu.richMenuId}`);
      try {
        await client.deleteRichMenu(menu.richMenuId);
        console.log(`✅ ลบสำเร็จ: ${menu.richMenuId}`);
      } catch (error) {
        console.log(`❌ ลบไม่สำเร็จ: ${menu.richMenuId} - ${error.message}`);
      }
    }
    
    // ตั้งค่า Rich Menu ล่าสุดเป็นค่าเริ่มต้น
    console.log(`\n🎯 ตั้งค่า Rich Menu เป็นค่าเริ่มต้น: ${latestRichMenu.richMenuId}`);
    try {
      await client.setDefaultRichMenu(latestRichMenu.richMenuId);
      console.log('✅ ตั้งค่า Rich Menu เริ่มต้นสำเร็จ');
    } catch (error) {
      console.log('❌ ตั้งค่า Rich Menu เริ่มต้นไม่สำเร็จ:', error.message);
    }
    
    // ตรวจสอบผลลัพธ์
    console.log('\n🔍 ตรวจสอบผลลัพธ์...');
    const finalRichMenus = await client.getRichMenuList();
    console.log(`📊 Rich Menu ที่เหลือ: ${finalRichMenus.length} รายการ`);
    
    finalRichMenus.forEach((menu, index) => {
      console.log(`   ${index + 1}. ${menu.richMenuId} - ${menu.name}`);
    });
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    if (error.statusCode) {
      console.error(`   📊 Status Code: ${error.statusCode}`);
    }
  }
}

// รันการทำความสะอาด
cleanupAndSetupRichMenu()
  .then(() => {
    console.log('\n🎉 การทำความสะอาดและตั้งค่าเสร็จสิ้น!');
    console.log('\n📱 ตอนนี้ Rich Menu ควรทำงานได้แล้ว:');
    console.log('   1. เปิดแอป LINE บนมือถือ');
    console.log('   2. เข้าไปในแชทกับ Bot');
    console.log('   3. ดูที่ด้านล่างของหน้าจอ ควรเห็น Rich Menu');
    console.log('   4. ลองกดปุ่มต่างๆ ควรได้รับการตอบกลับที่เหมาะสม');
    console.log('\n🔧 หากยังมีปัญหา:');
    console.log('   - ตรวจสอบ logs ของเซิร์ฟเวอร์เมื่อกดปุ่ม');
    console.log('   - ตรวจสอบ webhook URL ใน LINE Developers Console');
  })
  .catch(error => {
    console.error('❌ เกิดข้อผิดพลาดในการทำความสะอาด:', error);
  });