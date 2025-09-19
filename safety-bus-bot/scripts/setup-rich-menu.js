// scripts/setup-rich-menu.js
import dotenv from 'dotenv';
import { createRichMenu, setDefaultRichMenu } from '../lib/menu.js';

dotenv.config();

async function setupRichMenu() {
  try {
    console.log('🚀 กำลังสร้าง Rich Menu...');
    console.log('📋 ตรวจสอบการเชื่อมต่อ LINE API...');
    
    // สร้าง Rich Menu
    const richMenuId = await createRichMenu();
    console.log(`✅ สร้าง Rich Menu สำเร็จ ID: ${richMenuId}`);
    
    // ตั้งเป็น Default Rich Menu
    await setDefaultRichMenu(richMenuId);
    console.log('✅ ตั้งค่า Default Rich Menu สำเร็จ');
    
    console.log('🎉 ตั้งค่า Rich Menu เสร็จสิ้น!');
    console.log('📱 ผู้ใช้ใหม่จะเห็นเมนูโดยอัตโนมัติ');
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการตั้งค่า Rich Menu:', error.message);
    console.error('📋 รายละเอียดข้อผิดพลาด:', error);
    
    if (error.message.includes('Channel access token')) {
      console.log('💡 กรุณาตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN ในไฟล์ .env');
    }
    
    if (error.message.includes('Rich menu image')) {
      console.log('💡 กรุณาตรวจสอบ RICH_MENU_IMAGE_URL ในไฟล์ .env');
      console.log('   หรือใช้รูปภาพ default ที่มีอยู่ในระบบ');
    }
    
    process.exit(1);
  }
}

// เรียกใช้งาน
// Check if this file is being run directly
const currentFileUrl = import.meta.url;
const runningFileUrl = `file:///${process.argv[1].replace(/\\/g, '/')}`;

if (currentFileUrl === runningFileUrl) {
  setupRichMenu();
}

export { setupRichMenu };