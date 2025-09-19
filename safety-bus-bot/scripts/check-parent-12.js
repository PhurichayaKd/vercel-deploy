import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkParent12() {
  console.log('🔍 Checking students with parent_id 12...');
  
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('parent_id', 12);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Students data:', JSON.stringify(data, null, 2));
  
  // ตรวจสอบว่ามี parent_name และ parent_phone หรือไม่
  if (data && data.length > 0) {
    const student = data[0];
    console.log('\n📋 Field check:');
    console.log('- parent_name:', student.parent_name || 'NOT FOUND');
    console.log('- parent_phone:', student.parent_phone || 'NOT FOUND');
  }
}

checkParent12().catch(console.error);