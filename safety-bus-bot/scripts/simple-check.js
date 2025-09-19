import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('🔧 การตั้งค่า:');
console.log(`URL: ${supabaseUrl}`);
console.log(`Key: ${supabaseKey?.substring(0, 20)}...`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function simpleCheck() {
  try {
    console.log('\n🔍 ทดสอบการเชื่อมต่อ Supabase...');
    
    // ทดสอบการเชื่อมต่อด้วยการดึงข้อมูลจากตาราง parents
    console.log('\n1. ทดสอบตาราง parents:');
    const { data: parentsData, error: parentsError } = await supabase
      .from('parents')
      .select('*')
      .limit(3);
    
    if (parentsError) {
      console.log(`❌ Error: ${parentsError.message}`);
    } else {
      console.log(`✅ พบข้อมูล ${parentsData?.length || 0} แถว`);
      if (parentsData && parentsData.length > 0) {
        console.log('ตัวอย่าง:', parentsData[0]);
      }
    }
    
    // ทดสอบตาราง parent_line_links โดยไม่ใช้ join
    console.log('\n2. ทดสอบตาราง parent_line_links (ไม่ join):');
    const { data: parentLinksRaw, error: parentLinksError } = await supabase
      .from('parent_line_links')
      .select('*')
      .limit(10);
    
    if (parentLinksError) {
      console.log(`❌ Error: ${parentLinksError.message}`);
    } else {
      console.log(`✅ พบข้อมูล ${parentLinksRaw?.length || 0} แถว`);
      if (parentLinksRaw && parentLinksRaw.length > 0) {
        console.log('ข้อมูลทั้งหมด:');
        parentLinksRaw.forEach((link, index) => {
          console.log(`   ${index + 1}. Link ID: ${link.link_id}, Parent ID: ${link.parent_id}, LINE ID: ${link.line_user_id}, Active: ${link.active}`);
        });
      }
    }
    
    // ทดสอบตาราง student_line_links โดยไม่ใช้ join
    console.log('\n3. ทดสอบตาราง student_line_links (ไม่ join):');
    const { data: studentLinksRaw, error: studentLinksError } = await supabase
      .from('student_line_links')
      .select('*')
      .limit(10);
    
    if (studentLinksError) {
      console.log(`❌ Error: ${studentLinksError.message}`);
    } else {
      console.log(`✅ พบข้อมูล ${studentLinksRaw?.length || 0} แถว`);
      if (studentLinksRaw && studentLinksRaw.length > 0) {
        console.log('ข้อมูลทั้งหมด:');
        studentLinksRaw.forEach((link, index) => {
          console.log(`   ${index + 1}. Link ID: ${link.link_id}, Student ID: ${link.student_id}, LINE ID: ${link.line_user_id}, Active: ${link.active}`);
        });
      }
    }
    
    // ทดสอบ join กับตาราง parents
    console.log('\n4. ทดสอบ join parent_line_links กับ parents:');
    const { data: parentLinksJoin, error: parentJoinError } = await supabase
      .from('parent_line_links')
      .select(`
        *,
        parents(*)
      `)
      .limit(5);
    
    if (parentJoinError) {
      console.log(`❌ Error: ${parentJoinError.message}`);
    } else {
      console.log(`✅ Join สำเร็จ พบข้อมูล ${parentLinksJoin?.length || 0} แถว`);
      if (parentLinksJoin && parentLinksJoin.length > 0) {
        parentLinksJoin.forEach((link, index) => {
          console.log(`   ${index + 1}. LINE ID: ${link.line_user_id}, ชื่อผู้ปกครอง: ${link.parents?.parent_name}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    console.error('Stack:', error.stack);
  }
}

simpleCheck();