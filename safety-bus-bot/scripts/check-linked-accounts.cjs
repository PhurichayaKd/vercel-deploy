require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// สร้าง Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkLinkedAccounts() {
  try {
    console.log('🔍 ตรวจสอบบัญชี LINE ที่ผูกแล้ว...');
    console.log('📡 Supabase URL:', process.env.SUPABASE_URL);

    // ตรวจสอบจำนวนข้อมูลในตาราง parent_line_links
    const { count: parentCount, error: parentCountError } = await supabase
      .from('parent_line_links')
      .select('*', { count: 'exact', head: true });

    if (parentCountError) {
      console.log('❌ Error counting parent links:', parentCountError);
    } else {
      console.log(`\n📊 จำนวนข้อมูลใน parent_line_links: ${parentCount} แถว`);
    }

    // ตรวจสอบจำนวนข้อมูลในตาราง student_line_links
    const { count: studentCount, error: studentCountError } = await supabase
      .from('student_line_links')
      .select('*', { count: 'exact', head: true });

    if (studentCountError) {
      console.log('❌ Error counting student links:', studentCountError);
    } else {
      console.log(`📊 จำนวนข้อมูลใน student_line_links: ${studentCount} แถว`);
    }

    // ถ้ามีข้อมูล ให้แสดงรายละเอียด
    if (parentCount > 0) {
      const { data: parentLinks, error: parentError } = await supabase
        .from('parent_line_links')
        .select(`
          line_user_id,
          parent_id,
          active,
          linked_at,
          parents(parent_name)
        `);

      if (parentError) {
        console.log('❌ Error fetching parent links:', parentError);
      } else {
        console.log('\n📋 Parent LINE Links (All):');
        parentLinks.forEach((link, index) => {
          console.log(`${index + 1}. LINE ID: ${link.line_user_id}`);
          console.log(`   Parent ID: ${link.parent_id}`);
          console.log(`   Parent: ${link.parents?.parent_name || 'N/A'}`);
          console.log(`   Active: ${link.active ? '✅' : '❌'}`);
          console.log(`   Linked: ${new Date(link.linked_at).toLocaleString('th-TH')}`);
          console.log('---');
        });
      }
    }

    if (studentCount > 0) {
      const { data: studentLinks, error: studentError } = await supabase
        .from('student_line_links')
        .select(`
          line_user_id,
          student_id,
          active,
          linked_at,
          students(student_name, student_id)
        `);

      if (studentError) {
        console.log('❌ Error fetching student links:', studentError);
      } else {
        console.log('\n📋 Student LINE Links (All):');
        studentLinks.forEach((link, index) => {
          console.log(`${index + 1}. LINE ID: ${link.line_user_id}`);
          console.log(`   Student ID: ${link.student_id}`);
          console.log(`   Student: ${link.students?.student_name || 'N/A'}`);
          console.log(`   Active: ${link.active ? '✅' : '❌'}`);
          console.log(`   Linked: ${new Date(link.linked_at).toLocaleString('th-TH')}`);
          console.log('---');
        });
      }
    }

    console.log('\n✅ เสร็จสิ้นการตรวจสอบ');
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  }
}

checkLinkedAccounts();