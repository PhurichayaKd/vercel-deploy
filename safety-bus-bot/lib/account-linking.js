// lib/account-linking.js
import { supabase } from './db.js';
import { lineClient } from './line.js';
import { issueToken, consumeToken } from './tokens.js';
import { validateStudentId, validatePhoneNumber } from './validation.js';
import moment from 'moment';

/**
 * สร้างโทเคนสำหรับผูกบัญชี
 * @param {string} parentId - ID ของผู้ปกครอง
 * @param {string} studentId - รหัสนักเรียน
 * @returns {Promise<Object>} ผลลัพธ์การสร้างโทเคน
 */
async function createLinkToken(parentId, studentId) {
  try {
    // ตรวจสอบว่าผู้ปกครองและนักเรียนมีอยู่จริง
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('id, parent_name, parent_phone')
      .eq('id', parentId)
      .single();
    
    if (parentError || !parent) {
      return {
        success: false,
        error: 'ไม่พบข้อมูลผู้ปกครอง'
      };
    }
    
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, student_id, student_name, parent_id')
      .eq('student_id', studentId)
      .single();
    
    if (studentError || !student) {
      return {
        success: false,
        error: 'ไม่พบข้อมูลนักเรียน'
      };
    }
    
    // ตรวจสอบว่านักเรียนเป็นลูกของผู้ปกครองคนนี้หรือไม่
    if (student.parent_id !== parentId) {
      return {
        success: false,
        error: 'นักเรียนไม่ใช่ลูกของผู้ปกครองคนนี้'
      };
    }
    
    // สร้างโทเคน
    const tokenResult = await issueToken(parentId, 'account_link', {
      student_id: studentId,
      student_name: student.student_name,
      parent_name: parent.parent_name
    });
    
    if (!tokenResult.success) {
      return tokenResult;
    }
    
    return {
      success: true,
      token: tokenResult.token,
      expires_at: tokenResult.expires_at,
      link_url: `${process.env.BASE_URL}/link?token=${tokenResult.token}`,
      student_name: student.student_name,
      parent_name: parent.parent_name
    };
    
  } catch (error) {
    console.error('Error creating link token:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในการสร้างโทเคน'
    };
  }
}

/**
 * ผูกบัญชี LINE กับผู้ปกครอง
 * @param {string} lineUserId - LINE User ID
 * @param {string} token - โทเคนสำหรับผูกบัญชี
 * @returns {Promise<Object>} ผลลัพธ์การผูกบัญชี
 */
async function linkLineAccount(lineUserId, token) {
  try {
    // ตรวจสอบและใช้โทเคน
    const tokenResult = await consumeToken(token, 'account_link');
    
    if (!tokenResult.success) {
      return {
        success: false,
        error: tokenResult.error || 'โทเคนไม่ถูกต้องหรือหมดอายุ'
      };
    }
    
    const { parent_id, payload } = tokenResult;
    
    // ตรวจสอบว่า LINE User ID นี้ผูกกับบัญชีอื่นอยู่หรือไม่
    const { data: existingLink } = await supabase
      .from('parent_line_links')
      .select('id, parent_id, active')
      .eq('line_user_id', lineUserId)
      .eq('active', true)
      .single();
    
    if (existingLink) {
      return {
        success: false,
        error: 'บัญชี LINE นี้ถูกผูกกับผู้ปกครองคนอื่นแล้ว'
      };
    }
    
    // ตรวจสอบว่าผู้ปกครองคนนี้ผูกกับ LINE อื่นอยู่หรือไม่
    const { data: parentLink } = await supabase
      .from('parent_line_links')
      .select('id, line_user_id, active')
      .eq('parent_id', parent_id)
      .eq('active', true)
      .single();
    
    if (parentLink) {
      // ยกเลิกการผูกเก่า
      await supabase
        .from('parent_line_links')
        .update({ 
          active: false,
          unlinked_at: new Date().toISOString(),
          unlink_reason: 'replaced_by_new_link'
        })
        .eq('id', parentLink.id);
    }
    
    // สร้างการผูกใหม่
    const { data: newLink, error: linkError } = await supabase
      .from('parent_line_links')
      .insert({
        parent_id: parent_id,
        line_user_id: lineUserId,
        linked_at: new Date().toISOString(),
        active: true
         // metadata และ link_method ไม่มีในตารางใหม่แล้ว
      })
      .select()
      .single();
    
    if (linkError) {
      console.error('Error creating link:', linkError);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการผูกบัญชี'
      };
    }
    
    // ส่งข้อความยืนยัน
    const confirmMessage = {
      type: 'text',
      text: `✅ ผูกบัญชีสำเร็จ!\n\n👨‍👩‍👧‍👦 ผู้ปกครอง: ${payload.parent_name}\n👦👧 นักเรียน: ${payload.student_name}\n🆔 รหัส: ${payload.student_id}\n\nคุณจะได้รับการแจ้งเตือนเกี่ยวกับการเดินทางของนักเรียนแล้ว\n\nพิมพ์ "เมนู" เพื่อดูตัวเลือกต่างๆ`
    };
    
    await lineClient.pushMessage(lineUserId, confirmMessage);
    
    return {
      success: true,
      link_id: newLink.id,
      parent_name: payload.parent_name,
      student_name: payload.student_name,
      student_id: payload.student_id
    };
    
  } catch (error) {
    console.error('Error linking LINE account:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในการผูกบัญชี'
    };
  }
}

/**
 * ผูกบัญชีด้วยรหัสนักเรียน (วิธีง่าย)
 * @param {string} lineUserId - LINE User ID
 * @param {string} studentId - รหัสนักเรียน
 * @param {string} parentName - ชื่อผู้ปกครอง (ทางเลือก)
 * @param {string} phoneNumber - หมายเลขโทรศัพท์ (ทางเลือก)
 * @returns {Promise<Object>} ผลลัพธ์การผูกบัญชี
 */
async function linkByStudentId(lineUserId, studentId, parentName = null, phoneNumber = null) {
  try {
    // ตรวจสอบรูปแบบรหัสนักเรียน
    const studentValidation = validateStudentId(studentId);
    if (!studentValidation.isValid) {
      return {
        success: false,
        error: studentValidation.error
      };
    }
    
    // ตรวจสอบหมายเลขโทรศัพท์ (ถ้ามี)
    if (phoneNumber) {
      const phoneValidation = validatePhoneNumber(phoneNumber);
      if (!phoneValidation.isValid) {
        return {
          success: false,
          error: phoneValidation.error
        };
      }
      phoneNumber = phoneValidation.cleanNumber;
    }
    
    // ค้นหานักเรียน
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id, student_id, student_name, parent_id,
        parents(id, parent_name, parent_phone)
      `)
      .eq('student_id', studentId)
      .single();
    
    if (studentError || !student) {
      return {
        success: false,
        error: 'ไม่พบรหัสนักเรียนในระบบ กรุณาตรวจสอบรหัสอีกครั้ง'
      };
    }
    
    // ตรวจสอบข้อมูลผู้ปกครอง (ถ้ามีการระบุ)
    if (parentName && student.parents.parent_name.toLowerCase() !== parentName.toLowerCase()) {
      return {
        success: false,
        error: 'ชื่อผู้ปกครองไม่ตรงกับข้อมูลในระบบ'
      };
    }
    
    if (phoneNumber && student.parents.parent_phone && 
        student.parents.parent_phone.replace(/[^0-9]/g, '') !== phoneNumber) {
      return {
        success: false,
        error: 'หมายเลขโทรศัพท์ไม่ตรงกับข้อมูลในระบบ'
      };
    }
    
    // ตรวจสอบว่า LINE User ID นี้ผูกกับบัญชีอื่นอยู่หรือไม่
    const { data: existingLink } = await supabase
      .from('parent_line_links')
      .select('id, parent_id, active')
      .eq('line_user_id', lineUserId)
      .eq('active', true)
      .single();
    
    if (existingLink) {
      return {
        success: false,
        error: 'บัญชี LINE นี้ถูกผูกกับผู้ปกครองคนอื่นแล้ว\nหากต้องการเปลี่ยน กรุณาติดต่อเจ้าหน้าที่'
      };
    }
    
    // ตรวจสอบว่าผู้ปกครองคนนี้ผูกกับ LINE อื่นอยู่หรือไม่
    const { data: parentLink } = await supabase
      .from('parent_line_links')
      .select('id, line_user_id, active')
      .eq('parent_id', student.parent_id)
      .eq('active', true)
      .single();
    
    if (parentLink) {
      // ยกเลิกการผูกเก่า
      await supabase
        .from('parent_line_links')
        .update({ 
          active: false,
          unlinked_at: new Date().toISOString(),
          unlink_reason: 'replaced_by_student_id_link'
        })
        .eq('id', parentLink.id);
    }
    
    // สร้างการผูกใหม่
    const { data: newLink, error: linkError } = await supabase
      .from('parent_line_links')
      .insert({
        parent_id: student.parent_id,
        line_user_id: lineUserId,
        linked_at: new Date().toISOString(),
        active: true
      })
      .select()
      .single();
    
    if (linkError) {
      console.error('Error creating link:', linkError);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการผูกบัญชี'
      };
    }
    
    // ส่งข้อความยืนยัน
    const confirmMessage = {
      type: 'text',
      text: `✅ ผูกบัญชีสำเร็จ!\n\n👨‍👩‍👧‍👦 ผู้ปกครอง: ${student.parents.parent_name}\n👦👧 นักเรียน: ${student.student_name}\n🆔 รหัส: ${student.student_id}\n\nคุณจะได้รับการแจ้งเตือนเกี่ยวกับการเดินทางของนักเรียนแล้ว\n\nพิมพ์ "เมนู" เพื่อดูตัวเลือกต่างๆ`
    };
    
    await lineClient.pushMessage(lineUserId, confirmMessage);
    
    return {
      success: true,
      link_id: newLink.id,
      parent_name: student.parents.parent_name,
      student_name: student.student_name,
      student_id: student.student_id
    };
    
  } catch (error) {
    console.error('Error linking by student ID:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในการผูกบัญชี'
    };
  }
}

/**
 * ยกเลิกการผูกบัญชี
 * @param {string} lineUserId - LINE User ID
 * @param {string} reason - เหตุผลในการยกเลิก
 * @returns {Promise<Object>} ผลลัพธ์การยกเลิก
 */
async function unlinkAccount(lineUserId, reason = 'user_request') {
  try {
    // ค้นหาการผูกที่ active
    const { data: link, error: linkError } = await supabase
      .from('parent_line_links')
      .select(`
        id, parent_id,
        parents(parent_name),
        metadata
      `)
      .eq('line_user_id', lineUserId)
      .eq('active', true)
      .single();
    
    if (linkError || !link) {
      return {
        success: false,
        error: 'ไม่พบการผูกบัญชีที่ active'
      };
    }
    
    // ยกเลิกการผูก
    const { error: unlinkError } = await supabase
      .from('parent_line_links')
      .update({
        active: false,
        unlinked_at: new Date().toISOString(),
        unlink_reason: reason
      })
      .eq('id', link.id);
    
    if (unlinkError) {
      console.error('Error unlinking account:', unlinkError);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการยกเลิกการผูกบัญชี'
      };
    }
    
    // ส่งข้อความยืนยัน
    const confirmMessage = {
      type: 'text',
      text: `❌ ยกเลิกการผูกบัญชีแล้ว\n\n👨‍👩‍👧‍👦 ผู้ปกครอง: ${link.parents.parent_name}\n\nคุณจะไม่ได้รับการแจ้งเตือนอีกต่อไป\n\nหากต้องการผูกบัญชีใหม่ ให้ส่งรหัสนักเรียนมาใหม่`
    };
    
    await lineClient.pushMessage(lineUserId, confirmMessage);
    
    return {
      success: true,
      parent_name: link.parents.parent_name
    };
    
  } catch (error) {
    console.error('Error unlinking account:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในการยกเลิกการผูกบัญชี'
    };
  }
}

/**
 * ตรวจสอบสถานะการผูกบัญชี
 * @param {string} lineUserId - LINE User ID
 * @returns {Promise<Object>} ข้อมูลการผูกบัญชี
 */
async function checkLinkStatus(lineUserId) {
  try {
    // ตรวจสอบการเชื่อมโยงจาก parent_line_links
    const { data: parentLink, error: parentError } = await supabase
      .from('parent_line_links')
      .select('link_id, parent_id, linked_at, active')
      .eq('line_user_id', lineUserId)
      .eq('active', true)
      .single();
    
    if (parentLink && !parentError) {
      // หาข้อมูลนักเรียนจาก students table โดยตรง
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('student_id, student_name, grade')
        .eq('parent_id', parentLink.parent_id)
        .single();
      
      if (student && !studentError) {
        return {
          isLinked: true,
          link_id: parentLink.link_id,
          parent_id: parentLink.parent_id,
          parent_name: 'ผู้ปกครอง',
          student_id: student.student_id,
          student_name: student.student_name,
          linked_at: parentLink.linked_at,
          link_type: 'parent'
        };
      }
    }
    
    // ตรวจสอบการเชื่อมโยงจาก student_line_links
    const { data: studentLink, error: studentError } = await supabase
      .from('student_line_links')
      .select(`
        link_id, student_id, linked_at, active,
        students(student_id, student_name, grade)
      `)
      .eq('line_user_id', lineUserId)
      .eq('active', true)
      .single();
    
    if (studentLink && !studentError && studentLink.students) {
      return {
        isLinked: true,
        link_id: studentLink.link_id,
        student_id: studentLink.students.student_id,
        student_name: studentLink.students.student_name,
        linked_at: studentLink.linked_at,
        link_type: 'student'
      };
    }
    
    return {
      isLinked: false,
      error: 'ไม่พบการผูกบัญชี'
    };
    
  } catch (error) {
    console.error('Error checking link status:', error);
    return {
      isLinked: false,
      error: 'เกิดข้อผิดพลาดในการตรวจสอบสถานะ'
    };
  }
}

/**
 * ดึงรายการผู้ปกครองที่ผูกกับนักเรียน
 * @param {string} studentId - รหัสนักเรียน
 * @returns {Promise<Array>} รายการ LINE User ID ของผู้ปกครอง
 */
async function getLinkedParents(studentId) {
  try {
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('parent_id')
      .eq('student_id', studentId)
      .single();
    
    if (studentError || !student) {
      return [];
    }
    
    const { data: links, error: linksError } = await supabase
      .from('parent_line_links')
      .select('line_user_id, parents(parent_name)')
      .eq('parent_id', student.parent_id)
      .eq('active', true);
    
    if (linksError) {
      console.error('Error getting linked parents:', linksError);
      return [];
    }
    
    return links || [];
    
  } catch (error) {
    console.error('Error getting linked parents:', error);
    return [];
  }
}

/**
 * ผูกบัญชี LINE ของคนขับรถกับรหัสนักเรียน
 * @param {string} lineUserId - LINE User ID ของคนขับ
 * @param {string} studentId - รหัสนักเรียน
 * @param {string} driverName - ชื่อคนขับ (ไม่บังคับ)
 * @returns {Promise<Object>} ผลลัพธ์การผูกบัญชี
 */
async function linkDriverByStudentId(lineUserId, studentId, driverName = null) {
  try {
    // ตรวจสอบรูปแบบรหัสนักเรียน
    const studentValidation = validateStudentId(studentId);
    if (!studentValidation.isValid) {
      return {
        success: false,
        error: studentValidation.error
      };
    }

    // ค้นหานักเรียน
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, student_id, student_name, parent_id')
      .eq('student_id', studentId)
      .single();

    if (studentError || !student) {
      return {
        success: false,
        error: 'ไม่พบรหัสนักเรียนในระบบ กรุณาตรวจสอบรหัสอีกครั้ง'
      };
    }

    // ตรวจสอบว่า LINE User ID นี้ผูกกับนักเรียนอื่นอยู่หรือไม่
    const { data: existingLink } = await supabase
      .from('driver_line_links')
      .select('id, student_id, is_active')
      .eq('line_user_id', lineUserId)
      .eq('is_active', true)
      .single();

    if (existingLink) {
      return {
        success: false,
        error: 'บัญชี LINE นี้ถูกผูกกับนักเรียนคนอื่นแล้ว\nหากต้องการเปลี่ยน กรุณาติดต่อเจ้าหน้าที่'
      };
    }

    // ตรวจสอบว่านักเรียนคนนี้มีคนขับผูกอยู่แล้วหรือไม่
    const { data: studentLink } = await supabase
      .from('driver_line_links')
      .select('id, line_user_id, is_active')
      .eq('student_id', studentId)
      .eq('is_active', true)
      .single();

    if (studentLink) {
      // ยกเลิกการผูกเก่า
      await supabase
        .from('driver_line_links')
        .update({ 
          is_active: false,
          unlinked_at: new Date().toISOString()
        })
        .eq('id', studentLink.id);
    }

    // สร้างการผูกใหม่
    const { data: newLink, error: linkError } = await supabase
      .from('driver_line_links')
      .insert({
        student_id: studentId,
        line_user_id: lineUserId,
        driver_name: driverName,
        linked_at: new Date().toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (linkError) {
      console.error('Error creating driver link:', linkError);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการผูกบัญชี'
      };
    }

    // ส่งข้อความยืนยัน
    const confirmMessage = {
      type: 'text',
      text: `✅ ผูกบัญชีคนขับสำเร็จ!\n\n🚌 คนขับ: ${driverName || 'ไม่ระบุชื่อ'}\n👦👧 นักเรียน: ${student.student_name}\n🆔 รหัส: ${student.student_id}\n\nคุณสามารถดูข้อมูลการเดินทางของนักเรียนได้แล้ว\n\nพิมพ์ "เมนู" เพื่อดูตัวเลือกต่างๆ`
    };

    await lineClient.pushMessage(lineUserId, confirmMessage);

    return {
      success: true,
      link_id: newLink.id,
      driver_name: driverName,
      student_name: student.student_name,
      student_id: student.student_id
    };

  } catch (error) {
    console.error('Error linking driver by student ID:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในการผูกบัญชี'
    };
  }
}

export {
  createLinkToken,
  linkLineAccount,
  linkByStudentId,
  linkDriverByStudentId,
  unlinkAccount,
  checkLinkStatus,
  getLinkedParents
};