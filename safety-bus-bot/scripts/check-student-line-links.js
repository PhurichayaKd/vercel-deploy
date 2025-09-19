import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStudentLineLinks() {
  try {
    console.log('Checking student_line_links table...');
    
    // ดึงข้อมูลทั้งหมดจากตาราง student_line_links
    const { data, error } = await supabase
      .from('student_line_links')
      .select('*')
      .limit(10);
    
    if (error) {
      console.error('Error fetching student_line_links:', error);
      return;
    }
    
    console.log(`Found ${data.length} records in student_line_links table:`);
    
    if (data.length > 0) {
      console.log('Sample records:');
      data.forEach((record, index) => {
        console.log(`${index + 1}. Student ID: ${record.student_id}, Line User ID: ${record.line_user_id}, Linked at: ${record.linked_at}`);
      });
    } else {
      console.log('No records found in student_line_links table.');
    }
    
    // นับจำนวนรายการทั้งหมด
    const { count, error: countError } = await supabase
      .from('student_line_links')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error counting records:', countError);
    } else {
      console.log(`Total records in student_line_links: ${count}`);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkStudentLineLinks();