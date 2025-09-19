import dotenv from 'dotenv';
import { supabase } from '../lib/db.js';

dotenv.config();

async function checkStudents() {
  console.log('🔍 ตรวจสอบข้อมูลนักเรียน...');
  
  try {
    // ดึงข้อมูลนักเรียนทั้งหมด
    const { data: students, error } = await supabase
      .from('students')
      .select('student_id, student_name, grade, parent_id')
      .limit(10);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`✅ พบข้อมูลนักเรียน ${students.length} คน`);
    
    students.forEach((student, index) => {
      console.log(`${index + 1}. รหัส: ${student.student_id}, ชื่อ: ${student.student_name}, ชั้น: ${student.grade}, Parent ID: ${student.parent_id}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkStudents();