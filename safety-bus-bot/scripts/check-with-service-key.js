import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
// ใช้ anon key ปกติแต่ตรวจสอบ RLS policies
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ ไม่พบ SUPABASE_URL');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLinkedLineIds() {
  try {
    console.log('🔍 ตรวจสอบ LINE ID ที่ผูกไว้ในระบบ (ตรวจสอบ RLS)\n');
    
    // ตรวจสอบ RLS policies ก่อน
    console.log('🔒 ตรวจสอบ RLS policies:');
    const { data: rlsCheck, error: rlsError } = await supabase.rpc('check_rls_policies');
    if (rlsError) {
      console.log(`   ⚠️  ไม่สามารถตรวจสอบ RLS: ${rlsError.message}`);
    }
    
    // ตรวจสอบ parent_line_links ทั้งหมด
    console.log('👨‍👩‍👧‍👦 ผู้ปกครองที่ผูก LINE ID (ทั้งหมด):');
    const { data: parentLinks, error: parentError } = await supabase
      .from('parent_line_links')
      .select(`
        link_id,
        parent_id,
        line_user_id,
        linked_at,
        active,
        parents(
          parent_name,
          parent_phone
        )
      `)
      .order('linked_at', { ascending: false });
    
    if (parentError) {
      console.log(`   ❌ Error: ${parentError.message}`);
    } else if (parentLinks && parentLinks.length > 0) {
      parentLinks.forEach((link, index) => {
        console.log(`   ${index + 1}. LINE ID: ${link.line_user_id}`);
        console.log(`      Parent ID: ${link.parent_id}`);
        console.log(`      ชื่อ: ${link.parents?.parent_name || 'ไม่ระบุ'}`);
        console.log(`      เบอร์: ${link.parents?.parent_phone || 'ไม่ระบุ'}`);
        console.log(`      สถานะ: ${link.active ? 'ใช้งาน' : 'ไม่ใช้งาน'}`);
        console.log(`      วันที่ผูก: ${new Date(link.linked_at).toLocaleString('th-TH')}`);
        console.log('');
      });
    } else {
      console.log('   ไม่มีผู้ปกครองที่ผูก LINE ID');
    }
    
    console.log('\n👨‍🎓 นักเรียนที่ผูก LINE ID (ทั้งหมด):');
    const { data: studentLinks, error: studentError } = await supabase
      .from('student_line_links')
      .select(`
        link_id,
        student_id,
        line_user_id,
        linked_at,
        active,
        students(
          student_name,
          grade
        )
      `)
      .order('linked_at', { ascending: false });
    
    if (studentError) {
      console.log(`   ❌ Error: ${studentError.message}`);
    } else if (studentLinks && studentLinks.length > 0) {
      studentLinks.forEach((link, index) => {
        console.log(`   ${index + 1}. LINE ID: ${link.line_user_id}`);
        console.log(`      Student ID: ${link.student_id}`);
        console.log(`      ชื่อ: ${link.students?.student_name || 'ไม่ระบุ'}`);
        console.log(`      ชั้น: ${link.students?.grade || 'ไม่ระบุ'}`);
        console.log(`      สถานะ: ${link.active ? 'ใช้งาน' : 'ไม่ใช้งาน'}`);
        console.log(`      วันที่ผูก: ${new Date(link.linked_at).toLocaleString('th-TH')}`);
        console.log('');
      });
    } else {
      console.log('   ไม่มีนักเรียนที่ผูก LINE ID');
    }
    
    // สรุปจำนวน
    const activeParents = parentLinks?.filter(link => link.active).length || 0;
    const activeStudents = studentLinks?.filter(link => link.active).length || 0;
    
    console.log('\n📊 สรุป:');
    console.log(`👨‍👩‍👧‍👦 ผู้ปกครองทั้งหมด: ${parentLinks?.length || 0} คน (ใช้งาน: ${activeParents} คน)`);
    console.log(`👨‍🎓 นักเรียนทั้งหมด: ${studentLinks?.length || 0} คน (ใช้งาน: ${activeStudents} คน)`);
    console.log(`🔗 รวมทั้งหมด: ${(parentLinks?.length || 0) + (studentLinks?.length || 0)} การผูก (ใช้งาน: ${activeParents + activeStudents} การผูก)`);
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
  }
}

checkLinkedLineIds();