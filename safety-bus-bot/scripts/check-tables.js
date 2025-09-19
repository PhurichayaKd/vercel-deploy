import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ไม่พบ SUPABASE_URL หรือ SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  try {
    console.log('🔍 ตรวจสอบตารางในฐานข้อมูล\n');
    
    // ตรวจสอบตาราง parent_line_links
    console.log('📋 ตาราง parent_line_links:');
    const { data: parentData, error: parentError, count: parentCount } = await supabase
      .from('parent_line_links')
      .select('*', { count: 'exact' })
      .limit(5);
    
    if (parentError) {
      console.log(`   ❌ Error: ${parentError.message}`);
    } else {
      console.log(`   ✅ พบข้อมูล ${parentCount} แถว`);
      if (parentData && parentData.length > 0) {
        console.log('   📄 ตัวอย่างข้อมูล:');
        console.log(JSON.stringify(parentData[0], null, 2));
      }
    }
    
    // ตรวจสอบตาราง student_line_links
    console.log('\n📋 ตาราง student_line_links:');
    const { data: studentData, error: studentError, count: studentCount } = await supabase
      .from('student_line_links')
      .select('*', { count: 'exact' })
      .limit(5);
    
    if (studentError) {
      console.log(`   ❌ Error: ${studentError.message}`);
    } else {
      console.log(`   ✅ พบข้อมูล ${studentCount} แถว`);
      if (studentData && studentData.length > 0) {
        console.log('   📄 ตัวอย่างข้อมูล:');
        console.log(JSON.stringify(studentData[0], null, 2));
      }
    }
    
    // ตรวจสอบตาราง parents
    console.log('\n📋 ตาราง parents:');
    const { data: parentsData, error: parentsError, count: parentsCount } = await supabase
      .from('parents')
      .select('*', { count: 'exact' })
      .limit(3);
    
    if (parentsError) {
      console.log(`   ❌ Error: ${parentsError.message}`);
    } else {
      console.log(`   ✅ พบข้อมูล ${parentsCount} แถว`);
      if (parentsData && parentsData.length > 0) {
        console.log('   📄 ตัวอย่างข้อมูล:');
        console.log(JSON.stringify(parentsData[0], null, 2));
      }
    }
    
    // ตรวจสอบตาราง students
    console.log('\n📋 ตาราง students:');
    const { data: studentsData, error: studentsError, count: studentsCount } = await supabase
      .from('students')
      .select('*', { count: 'exact' })
      .limit(3);
    
    if (studentsError) {
      console.log(`   ❌ Error: ${studentsError.message}`);
    } else {
      console.log(`   ✅ พบข้อมูล ${studentsCount} แถว`);
      if (studentsData && studentsData.length > 0) {
        console.log('   📄 ตัวอย่างข้อมูล:');
        console.log(JSON.stringify(studentsData[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
  }
}

checkTables();