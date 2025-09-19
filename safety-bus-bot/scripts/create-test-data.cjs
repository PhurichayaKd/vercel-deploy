require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// สร้าง Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function createTestData() {
  try {
    console.log('🔧 สร้างข้อมูลทดสอบ...');
    console.log('📡 Supabase URL:', process.env.SUPABASE_URL);

    // ดูข้อมูลนักเรียนที่มีอยู่
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('student_id, student_name, grade')
      .limit(5);

    if (studentsError) {
      console.log('❌ Error fetching students:', studentsError);
      return;
    }

    console.log('📚 นักเรียนที่มีอยู่:');
    students.forEach((student, index) => {
      console.log(`${index + 1}. ID: ${student.student_id}, Name: ${student.student_name}, Grade: ${student.grade}`);
    });

    if (students.length === 0) {
      console.log('❌ ไม่มีข้อมูลนักเรียนในระบบ');
      return;
    }

    // ใช้นักเรียนคนแรกสำหรับทดสอบ
    const testStudent = students[0];
    console.log(`\n🎯 ใช้นักเรียน: ${testStudent.student_name} (ID: ${testStudent.student_id})`);

    // สร้างข้อมูล student_line_links ทดสอบ
    // ใช้ LINE User ID ที่คุณต้องการทดสอบ
    const testLineUserId = 'U1234567890abcdef1234567890abcdef'; // เปลี่ยนเป็น LINE User ID จริงของคุณ
    
    // ลบข้อมูลเก่าก่อน (ถ้ามี)
    await supabase
      .from('student_line_links')
      .delete()
      .eq('line_user_id', testLineUserId);

    const { data: linkData, error: linkError } = await supabase
      .from('student_line_links')
      .insert({
        line_user_id: testLineUserId,
        student_id: testStudent.student_id,
        active: true,
        linked_at: new Date().toISOString()
      })
      .select()
      .single();

    if (linkError) {
      console.log('❌ Error creating student link:', linkError);
      return;
    }

    console.log('✅ สร้างการเชื่อมโยง LINE สำเร็จ:', linkData);
    console.log('\n🎉 ข้อมูลทดสอบพร้อมใช้งาน!');
    console.log(`📱 LINE User ID: ${testLineUserId}`);
    console.log(`👤 Student ID: ${testStudent.student_id}`);
    console.log(`📚 Student Name: ${testStudent.student_name}`);
    console.log('\n💡 หมายเหตุ: เปลี่ยน LINE User ID ในสคริปต์เป็น ID จริงของคุณเพื่อทดสอบ');
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  }
}

createTestData();