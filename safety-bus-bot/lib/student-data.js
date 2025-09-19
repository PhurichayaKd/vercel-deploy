import { supabase } from './db.js';

/**
 * ดึงข้อมูลนักเรียนจาก LINE ID ที่เชื่อมโยงแล้ว
 * @param {string} lineUserId - LINE User ID
 * @returns {Object|null} ข้อมูลนักเรียนหรือ null หากไม่พบ
 */
export async function getStudentByLineId(lineUserId) {
  try {
    // ตรวจสอบการเชื่อมโยงจากตาราง parent_line_links
    const { data: parentLink, error: parentError } = await supabase
      .from('parent_line_links')
      .select('parent_id')
      .eq('line_user_id', lineUserId)
      .eq('active', true)
      .single();

    if (parentError && parentError.code !== 'PGRST116') {
      throw parentError;
    }

    if (parentLink) {
      // หาข้อมูลนักเรียนจาก students table โดยตรง
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('student_id, student_name, grade')
        .eq('parent_id', parentLink.parent_id)
        .single();
      
      if (student && !studentError) {
        return {
          type: 'parent',
          student: {
            student_id: student.student_id,
            name: student.student_name,
            class: student.grade
          },
          parentId: parentLink.parent_id
        };
      }
    }

    // ตรวจสอบการเชื่อมโยงจากตาราง driver_line_links
    const { data: driverLink, error: driverError } = await supabase
      .from('driver_line_links')
      .select(`
        student_id,
        driver_name,
        students (
          student_id,
          student_name,
          grade
        )
      `)
      .eq('line_user_id', lineUserId)
      .eq('is_active', true)
      .single();

    if (driverError && driverError.code !== 'PGRST116') {
      throw driverError;
    }

    if (driverLink && driverLink.students) {
      const student = driverLink.students;
      return {
        type: 'driver',
        student: {
          student_id: student.student_id,
          name: student.student_name,
          class: student.grade
        },
        driverName: driverLink.driver_name,
        studentId: driverLink.student_id
      };
    }

    // ตรวจสอบการเชื่อมโยงจากตาราง student_line_links (หากมี)
    const { data: studentLink, error: studentError } = await supabase
      .from('student_line_links')
      .select(`
        student_id,
        students (
          student_id,
          student_name,
          grade
        )
      `)
      .eq('line_user_id', lineUserId)
      .eq('active', true)
      .single();

    if (studentError && studentError.code !== 'PGRST116') {
      throw studentError;
    }

    if (studentLink && studentLink.students) {
      const student = studentLink.students;
      return {
        type: 'student',
        student: {
          student_id: student.student_id,
          name: student.student_name,
          class: student.grade
        },
        studentId: studentLink.student_id
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching student data:', error);
    return null;
  }
}

/**
 * ตรวจสอบสถานะการเชื่อมโยงบัญชี LINE
 * @param {string} lineUserId - LINE User ID
 * @returns {Object} สถานะการเชื่อมโยง
 */
export async function checkAccountLinkStatus(lineUserId) {
  try {
    const studentData = await getStudentByLineId(lineUserId);
    
    if (studentData) {
      return {
        isLinked: true,
        type: studentData.type,
        student: studentData.student
      };
    }

    return {
      isLinked: false,
      type: null,
      student: null
    };
  } catch (error) {
    console.error('❌ Error checking link status:', error);
    return {
      isLinked: false,
      type: null,
      student: null,
      error: error.message
    };
  }
}

/**
 * ดึงรายการนักเรียนทั้งหมดที่ผู้ปกครองดูแล
 * @param {string} lineUserId - LINE User ID ของผู้ปกครอง
 * @returns {Array} รายการนักเรียน
 */
export async function getStudentsByParentLineId(lineUserId) {
  try {
    const { data: parentLinks, error } = await supabase
      .from('parent_line_links')
      .select(`
        parent_id,
        parents (
          student_guardians (
            students (
              student_id,
              student_name,
              grade
            )
          )
        )
      `)
      .eq('line_user_id', lineUserId)
      .eq('active', true);

    if (error) throw error;

    if (!parentLinks || parentLinks.length === 0) {
      return [];
    }

    const students = [];
    parentLinks.forEach(link => {
      if (link.parents && link.parents.student_guardians) {
        link.parents.student_guardians.forEach(guardian => {
          if (guardian.students) {
            students.push(guardian.students);
          }
        });
      }
    });

    return students;
  } catch (error) {
    console.error('❌ Error fetching students by parent:', error);
    return [];
  }
}

/**
 * ตรวจสอบสถานะการเชื่อมโยงบัญชีคนขับ
 * @param {string} lineUserId - LINE User ID ของคนขับ
 * @returns {Object} สถานะการเชื่อมโยงคนขับ
 */
export async function checkDriverLinkStatus(lineUserId) {
  try {
    const { data: driverLink, error } = await supabase
      .from('driver_line_links')
      .select(`
        id,
        student_id,
        driver_name,
        linked_at,
        is_active,
        students (
          student_id,
          student_name,
          grade
        )
      `)
      .eq('line_user_id', lineUserId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (driverLink && driverLink.students) {
      return {
        isLinked: true,
        type: 'driver',
        driverName: driverLink.driver_name,
        linkedAt: driverLink.linked_at,
        student: {
          student_id: driverLink.students.student_id,
          name: driverLink.students.student_name,
          class: driverLink.students.grade
        }
      };
    }

    return {
      isLinked: false,
      type: null,
      student: null
    };
  } catch (error) {
    console.error('❌ Error checking driver link status:', error);
    return {
      isLinked: false,
      type: null,
      student: null,
      error: error.message
    };
  }
}

/**
 * ดึงข้อมูลนักเรียนที่คนขับดูแล
 * @param {string} lineUserId - LINE User ID ของคนขับ
 * @returns {Object|null} ข้อมูลนักเรียนหรือ null หากไม่พบ
 */
export async function getStudentByDriverLineId(lineUserId) {
  try {
    const { data: driverLink, error } = await supabase
      .from('driver_line_links')
      .select(`
        student_id,
        driver_name,
        students (
          student_id,
          student_name,
          grade,
          bus_route,
          pickup_location,
          dropoff_location
        )
      `)
      .eq('line_user_id', lineUserId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (driverLink && driverLink.students) {
      const student = driverLink.students;
      return {
        type: 'driver',
        driverName: driverLink.driver_name,
        student: {
          student_id: student.student_id,
          name: student.student_name,
          class: student.grade,
          bus_route: student.bus_route,
          pickup_location: student.pickup_location,
          dropoff_location: student.dropoff_location
        }
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching student by driver:', error);
    return null;
  }
}