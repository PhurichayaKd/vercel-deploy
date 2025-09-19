import dotenv from 'dotenv';
import { supabase } from '../lib/db.js';

dotenv.config();

async function createTestStudent() {
  console.log('🔧 สร้างข้อมูลนักเรียนทดสอบ...');
  
  try {
    // สร้างข้อมูลนักเรียนทดสอบ
    const { data: student, error: studentError } = await supabase
      .from('students')
      .insert({
        student_id: '66543210',
        student_name: 'นักเรียนทดสอบ',
        grade: 'ม.1',
        parent_id: 2 // ใช้ parent_id ที่มีอยู่แล้ว
      })
      .select()
      .single();
    
    if (studentError) {
      console.error('❌ Error creating student:', studentError);
      return;
    }
    
    console.log('✅ สร้างข้อมูลนักเรียนสำเร็จ:', student);
    
    // ตรวจสอบข้อมูลที่สร้าง
    const { data: checkStudent, error: checkError } = await supabase
      .from('students')
      .select(`
        student_id, student_name, grade, parent_id,
        parents(parent_name, parent_phone)
      `)
      .eq('student_id', '66543210')
      .single();
    
    if (checkError) {
      console.error('❌ Error checking student:', checkError);
      return;
    }
    
    console.log('🔍 ข้อมูลนักเรียนที่สร้าง:', checkStudent);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTestStudent();