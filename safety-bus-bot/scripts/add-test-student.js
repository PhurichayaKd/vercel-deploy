import dotenv from 'dotenv';
import { supabase } from '../lib/db.js';

dotenv.config();

async function addTestStudent() {
  console.log('🔧 เพิ่มข้อมูลนักเรียนทดสอบ...');
  
  try {
    // เพิ่มผู้ปกครอง
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .insert({
        parent_name: 'ผู้ปกครองทดสอบ',
        parent_phone: '0834608586'
      })
      .select()
      .single();
    
    if (parentError) {
      console.error('❌ Error adding parent:', parentError);
      return;
    }
    
    console.log('✅ เพิ่มผู้ปกครองสำเร็จ:', parent.parent_name);
    
    // เพิ่มนักเรียน
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // เพิ่ม 1 ปี
    
    const { data: student, error: studentError } = await supabase
      .from('students')
      .insert({
        student_id: '0834608586',
        student_name: 'นักเรียนทดสอบ',
        grade: 'ป.6',
        parent_id: parent.parent_id,
        start_date: new Date().toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'active'
      })
      .select()
      .single();
    
    if (studentError) {
      console.error('❌ Error adding student:', studentError);
      return;
    }
    
    console.log('✅ เพิ่มนักเรียนสำเร็จ:', student.student_name, 'รหัส:', student.student_id);
    
    // เพิ่มความสัมพันธ์ผู้ปกครอง-นักเรียน
    const { error: guardianError } = await supabase
      .from('student_guardians')
      .insert({
        student_id: student.student_id,
        parent_id: parent.parent_id,
        relationship: 'parent'
      });
    
    if (guardianError) {
      console.error('❌ Error adding guardian relationship:', guardianError);
      return;
    }
    
    console.log('✅ เพิ่มความสัมพันธ์ผู้ปกครอง-นักเรียนสำเร็จ');
    console.log('\n🎉 เพิ่มข้อมูลทดสอบเสร็จสิ้น!');
    console.log('📋 รหัสนักเรียน: 0834608586');
    console.log('👤 ชื่อ: นักเรียนทดสอบ');
    console.log('👨‍👩‍👧‍👦 ผู้ปกครอง: ผู้ปกครองทดสอบ');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addTestStudent();