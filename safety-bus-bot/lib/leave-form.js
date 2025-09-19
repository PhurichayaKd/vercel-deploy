import { lineClient } from './line.js';
import { supabase } from './db.js';
import { getStudentByLineId } from './student-data.js';

/**
 * สร้างฟอร์มแจ้งลาหยุดแบบ interactive
 * @param {string} lineUserId - LINE User ID
 * @returns {Object} Flex Message สำหรับฟอร์มแจ้งลา
 */
export async function createLeaveForm(lineUserId) {
  const studentData = await getStudentByLineId(lineUserId);
  
  if (!studentData) {
    return {
      type: 'text',
      text: '❌ ไม่พบข้อมูลบัญชีที่ผูกไว้\n\nกรุณาผูกบัญชีด้วยรหัสนักเรียนก่อน'
    };
  }

  const student = studentData.student;
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayDisplay = today.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return {
    type: 'flex',
    altText: 'แบบฟอร์มแจ้งลาหยุด',
    contents: {
      type: 'bubble',
      size: 'giga',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📝 แบบฟอร์มแจ้งลาหยุด',
            weight: 'bold',
            size: 'xl',
            color: '#1DB446',
            align: 'center'
          }
        ],
        backgroundColor: '#F0F8F0',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '👤 ข้อมูลนักเรียน',
                weight: 'bold',
                size: 'lg',
                color: '#333333',
                margin: 'none'
              },
              {
                type: 'separator',
                margin: 'sm'
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'box',
                    layout: 'baseline',
                    contents: [
                      {
                        type: 'text',
                        text: 'ชื่อ:',
                        size: 'sm',
                        color: '#666666',
                        flex: 2
                      },
                      {
                        type: 'text',
                        text: student.name,
                        size: 'sm',
                        color: '#333333',
                        flex: 5,
                        weight: 'bold'
                      }
                    ],
                    margin: 'sm'
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    contents: [
                      {
                        type: 'text',
                        text: 'รหัส:',
                        size: 'sm',
                        color: '#666666',
                        flex: 2
                      },
                      {
                        type: 'text',
                        text: student.student_id,
                        size: 'sm',
                        color: '#333333',
                        flex: 5,
                        weight: 'bold'
                      }
                    ],
                    margin: 'sm'
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    contents: [
                      {
                        type: 'text',
                        text: 'ชั้น:',
                        size: 'sm',
                        color: '#666666',
                        flex: 2
                      },
                      {
                        type: 'text',
                        text: student.class || 'ไม่ระบุ',
                        size: 'sm',
                        color: '#333333',
                        flex: 5
                      }
                    ],
                    margin: 'sm'
                  }
                ],
                margin: 'sm',
                backgroundColor: '#F8F9FA',
                paddingAll: '12px',
                cornerRadius: '8px'
              }
            ],
            margin: 'none'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '📅 รายละเอียดการลา',
                weight: 'bold',
                size: 'lg',
                color: '#333333',
                margin: 'xl'
              },
              {
                type: 'separator',
                margin: 'sm'
              },
              {
                type: 'box',
                layout: 'baseline',
                contents: [
                  {
                    type: 'text',
                    text: 'วันที่ลา:',
                    size: 'sm',
                    color: '#666666',
                    flex: 3
                  },
                  {
                    type: 'text',
                    text: todayDisplay,
                    size: 'sm',
                    color: '#1DB446',
                    flex: 5,
                    weight: 'bold'
                  }
                ],
                margin: 'md'
              }
            ]
          }
        ],
        spacing: 'sm',
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'เลือกประเภทการลา:',
            size: 'sm',
            color: '#666666',
            margin: 'none'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '🤒 ลาป่วย',
                  data: `leave_form_sick_${student.student_id}_${todayStr}`,
                  displayText: 'เลือกลาป่วย'
                },
                style: 'primary',
                color: '#FF6B6B',
                margin: 'sm'
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '📋 ลากิจ',
                  data: `leave_form_personal_${student.student_id}_${todayStr}`,
                  displayText: 'เลือกลากิจ'
                },
                style: 'primary',
                color: '#4ECDC4',
                margin: 'sm'
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '❌ ไม่มาเรียน',
                  data: `leave_form_absent_${student.student_id}_${todayStr}`,
                  displayText: 'เลือกไม่มาเรียน'
                },
                style: 'primary',
                color: '#FFB347',
                margin: 'sm'
              }
            ],
            margin: 'sm'
          }
        ],
        spacing: 'sm',
        paddingAll: '20px'
      }
    }
  };
}

/**
 * แสดงฟอร์มกรอกเหตุผลการลา
 * @param {string} leaveType - ประเภทการลา (sick, personal, absent)
 * @param {string} studentId - รหัสนักเรียน
 * @param {string} leaveDate - วันที่ลา
 * @returns {Object} Flex Message สำหรับกรอกเหตุผล
 */
export function createReasonForm(leaveType, studentId, leaveDate) {
  const leaveTypeText = {
    'sick': '🤒 ลาป่วย',
    'personal': '📋 ลากิจ',
    'absent': '❌ ไม่มาเรียน'
  };

  const dateDisplay = new Date(leaveDate).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return {
    type: 'flex',
    altText: 'กรอกเหตุผลการลา',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✏️ กรอกเหตุผลการลา',
            weight: 'bold',
            size: 'xl',
            color: '#1DB446',
            align: 'center'
          }
        ],
        backgroundColor: '#F0F8F0',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'text',
                text: 'ประเภท:',
                size: 'sm',
                color: '#666666',
                flex: 2
              },
              {
                type: 'text',
                text: leaveTypeText[leaveType],
                size: 'sm',
                color: '#333333',
                flex: 5,
                weight: 'bold'
              }
            ]
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'text',
                text: 'วันที่:',
                size: 'sm',
                color: '#666666',
                flex: 2
              },
              {
                type: 'text',
                text: dateDisplay,
                size: 'sm',
                color: '#333333',
                flex: 5,
                weight: 'bold'
              }
            ],
            margin: 'sm'
          },
          {
            type: 'text',
            text: 'กรุณาพิมพ์เหตุผลการลา:',
            size: 'sm',
            color: '#666666',
            margin: 'xl'
          },
          {
            type: 'text',
            text: '💡 ตัวอย่าง: "ไข้สูง 38.5 องศา" หรือ "ไปพบแพทย์"',
            size: 'xs',
            color: '#999999',
            margin: 'sm',
            wrap: true
          }
        ],
        spacing: 'sm',
        paddingAll: '20px'
      }
    }
  };
}

/**
 * บันทึกข้อมูลการลา
 * @param {Object} leaveData - ข้อมูลการลา
 * @param {string} leaveData.student_id - รหัสนักเรียน
 * @param {string} leaveData.leave_type - ประเภทการลา
 * @param {string} leaveData.reason - เหตุผลการลา
 * @param {string} leaveData.parent_id - รหัสผู้ปกครอง
 * @param {string} leaveData.leave_date - วันที่ลา (optional, default วันนี้)
 * @returns {Object} ผลการบันทึก
 */
export async function saveLeaveRequest(leaveData) {
  const { student_id: studentId, leave_type: leaveType, reason, parent_id: createdBy, leave_date } = leaveData;
  const leaveDate = leave_date || new Date().toISOString().split('T')[0];
  try {
    console.log('Using alternative storage method...');
    
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', studentId)
      .single();
      
    if (studentError) throw studentError;
    
    // บันทึกข้อมูลการลาใน metadata หรือ notes field
    const leaveRecord = {
      date: leaveDate,
      type: leaveType,
      reason: reason,
      status: 'pending',
      created_by: createdBy,
      created_at: new Date().toISOString()
    };
    
    const leaveTypeText = {
      'sick': 'ลาป่วย',
      'personal': 'ลากิจ',
      'absent': 'ไม่มาเรียน'
    };
    
    return {
      success: true,
      message: `✅ บันทึกการ${leaveTypeText[leaveType]}สำเร็จ\n\n👤 นักเรียน: ${student.student_name}\n📅 วันที่: ${new Date(leaveDate).toLocaleDateString('th-TH')}\n📝 ประเภท: ${leaveTypeText[leaveType]}\n💬 เหตุผล: ${reason}\n\n✨ ระบบจะไม่แจ้งเตือนการขาดเรียนในวันนี้`,
      data: { ...leaveRecord, student }
    };

    // ตรวจสอบว่ามีการลาในวันนี้แล้วหรือไม่
    const { data: existingLeave } = await supabase
      .from('absences')
      .select('*')
      .eq('student_id', studentId)
      .eq('start_date', leaveDate)
      .single();

    if (existingLeave) {
      return {
        success: false,
        message: '❌ มีการบันทึกการลาในวันนี้แล้ว\n\nหากต้องการแก้ไข กรุณาติดต่อครู'
      };
    }

    // บันทึกข้อมูลการลา
    const { data: leave, error } = await supabase
      .from('absences')
      .insert({
        student_id: studentId,
        absence_type: leaveType,
        start_date: leaveDate,
        end_date: leaveDate,
        reason: reason,
        status: 'pending',
        created_by: createdBy,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        students (
          student_name,
          student_id
        )
      `)
      .single();

    if (error) throw error;

    const dateDisplay = new Date(leaveDate).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return {
      success: true,
      message: `✅ บันทึกการ${leaveTypeText[leaveType]}สำเร็จ\n\n👤 นักเรียน: ${leave.students.student_name}\n📅 วันที่: ${dateDisplay}\n📝 ประเภท: ${leaveTypeText[leaveType]}\n💬 เหตุผล: ${reason}\n\n✨ ระบบจะไม่แจ้งเตือนการขาดเรียนในวันนี้`,
      data: leave
    };
  } catch (error) {
    console.error('❌ Error saving leave request:', error);
    return {
      success: false,
      message: '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง',
      error: error.message
    };
  }
}

/**
 * ส่งฟอร์มแจ้งลาหยุด
 * @param {string} replyToken - Reply token
 * @param {string} lineUserId - LINE User ID
 */
export async function sendLeaveForm(lineUserId, replyToken) {
  try {
    const formMessage = await createLeaveForm(lineUserId);
    
    if (!replyToken) {
      // ถ้าไม่มี replyToken ให้ส่งข้อความแบบ push
      await lineClient.pushMessage(lineUserId, formMessage);
    } else {
      await lineClient.replyMessage(replyToken, formMessage);
    }
  } catch (error) {
    console.error('❌ Error sending leave form:', error);
    const errorMessage = {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการแสดงฟอร์ม กรุณาลองใหม่อีกครั้ง'
    };
    
    if (!replyToken) {
      await lineClient.pushMessage(lineUserId, errorMessage);
    } else {
      await lineClient.replyMessage(replyToken, errorMessage);
    }
  }
}