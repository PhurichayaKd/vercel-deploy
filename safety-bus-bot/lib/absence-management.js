// lib/absence-management.js
import { supabase } from './db.js';
import { lineClient } from './line.js';
import moment from 'moment';
import { checkLinkStatus } from './account-linking.js';
import { v4 as uuidv4 } from 'uuid';

// ตั้งค่า timezone เป็นไทย
moment.locale('th');

/**
 * สร้างคำขอลาหยุด
 * @param {string} studentId - รหัสนักเรียน
 * @param {Object} absenceData - ข้อมูลการลา
 * @returns {Promise<Object>} ผลลัพธ์การสร้างคำขอ
 */
async function createAbsenceRequest(studentId, absenceData) {
  const {
    absence_type, // 'sick', 'personal', 'emergency', 'other'
    start_date,
    end_date = null,
    reason,
    note = null,
    parent_id = null
  } = absenceData;

  try {
    // ตรวจสอบข้อมูลพื้นฐาน
    if (!absence_type || !start_date || !reason) {
      return {
        success: false,
        error: 'ข้อมูลไม่ครบถ้วน กรุณาระบุประเภทการลา วันที่ และเหตุผล'
      };
    }

    // ตรวจสอบวันที่
    const startMoment = moment(start_date);
    const endMoment = end_date ? moment(end_date) : startMoment;
    
    if (!startMoment.isValid() || (end_date && !endMoment.isValid())) {
      return {
        success: false,
        error: 'รูปแบบวันที่ไม่ถูกต้อง'
      };
    }

    if (endMoment.isBefore(startMoment)) {
      return {
        success: false,
        error: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น'
      };
    }

    // สร้างรหัสคำขอ
    const requestId = uuidv4();
    
    // บันทึกคำขอลาหยุด
    const { data: absence, error } = await supabase
      .from('absences')
      .insert({
        id: requestId,
        student_id: studentId,
        parent_id: parent_id,
        absence_type: absence_type,
        start_date: startMoment.format('YYYY-MM-DD'),
        end_date: end_date ? endMoment.format('YYYY-MM-DD') : startMoment.format('YYYY-MM-DD'),
        reason: reason,
        note: note,
        status: 'pending', // pending, approved, rejected
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating absence request:', error);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการบันทึกคำขอลา'
      };
    }

    // บันทึก log
    await supabase
      .from('absence_logs')
      .insert({
        absence_id: requestId,
        action: 'created',
        details: `สร้างคำขอลา: ${absence_type}`,
        created_at: new Date().toISOString()
      });

    return {
      success: true,
      absence: absence,
      message: 'บันทึกคำขอลาหยุดสำเร็จ'
    };

  } catch (error) {
    console.error('Error in createAbsenceRequest:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * ดึงรายการคำขอลาหยุด
 * @param {string} studentId - รหัสนักเรียน
 * @param {Object} options - ตัวเลือกการค้นหา
 * @returns {Promise<Object>} รายการคำขอลา
 */
async function getAbsenceRequests(studentId, options = {}) {
  const {
    limit = 10,
    status = null, // 'pending', 'approved', 'rejected'
    days = 30
  } = options;

  try {
    let query = supabase
      .from('absences')
      .select(`
        id, absence_type, start_date, end_date, reason, note,
        status, created_at, updated_at,
        students(student_name),
        parents(parent_name)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    // กรองตามสถานะ
    if (status) {
      query = query.eq('status', status);
    }

    // กรองตามช่วงวันที่
    if (days) {
      const daysAgo = moment().subtract(days, 'days').toISOString();
      query = query.gte('created_at', daysAgo);
    }

    // จำกัดจำนวนผลลัพธ์
    query = query.limit(limit);

    const { data: absences, error } = await query;

    if (error) {
      console.error('Error fetching absence requests:', error);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำขอลา'
      };
    }

    return {
      success: true,
      absences: absences || [],
      total: absences ? absences.length : 0
    };

  } catch (error) {
    console.error('Error in getAbsenceRequests:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * อัพเดตสถานะคำขอลาหยุด
 * @param {string} absenceId - รหัสคำขอลา
 * @param {string} status - สถานะใหม่
 * @param {string} note - หมายเหตุ
 * @returns {Promise<Object>} ผลลัพธ์การอัพเดต
 */
async function updateAbsenceStatus(absenceId, status, note = null) {
  try {
    // ตรวจสอบสถานะ
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return {
        success: false,
        error: 'สถานะไม่ถูกต้อง'
      };
    }

    // อัพเดตสถานะ
    const { data: absence, error } = await supabase
      .from('absences')
      .update({
        status: status,
        admin_note: note,
        updated_at: new Date().toISOString()
      })
      .eq('id', absenceId)
      .select(`
        *, 
        students(student_name),
        parents(line_user_id, parent_name)
      `)
      .single();

    if (error) {
      console.error('Error updating absence status:', error);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการอัพเดตสถานะ'
      };
    }

    // บันทึก log
    await supabase
      .from('absence_logs')
      .insert({
        absence_id: absenceId,
        action: 'status_updated',
        details: `เปลี่ยนสถานะเป็น: ${status}`,
        note: note,
        created_at: new Date().toISOString()
      });

    // ส่งการแจ้งเตือนให้ผู้ปกครอง
    if (absence.parents && absence.parents.line_user_id) {
      const statusText = {
        'approved': '✅ อนุมัติ',
        'rejected': '❌ ไม่อนุมัติ',
        'pending': '⏳ รอพิจารณา'
      };

      const message = `📋 สถานะคำขอลาหยุด\n\n👦👧 นักเรียน: ${absence.students.student_name}\n📅 วันที่: ${moment(absence.start_date).format('DD/MM/YYYY')}${absence.end_date !== absence.start_date ? ` - ${moment(absence.end_date).format('DD/MM/YYYY')}` : ''}\n📝 เหตุผล: ${absence.reason}\n\n📊 สถานะ: ${statusText[status]}${note ? `\n💬 หมายเหตุ: ${note}` : ''}`;

      try {
        await client.pushMessage(absence.parents.line_user_id, {
          type: 'text',
          text: message
        });
      } catch (pushError) {
        console.error('Error sending absence status notification:', pushError);
      }
    }

    return {
      success: true,
      absence: absence,
      message: 'อัพเดตสถานะสำเร็จ'
    };

  } catch (error) {
    console.error('Error in updateAbsenceStatus:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * สร้างข้อความแสดงรายการคำขอลา
 * @param {Array} absences - รายการคำขอลา
 * @param {string} studentName - ชื่อนักเรียน
 * @returns {string} ข้อความรายการคำขอลา
 */
function formatAbsenceListMessage(absences, studentName) {
  if (!absences || absences.length === 0) {
    return `📋 รายการคำขอลาหยุด\n\n👦👧 นักเรียน: ${studentName}\n\n❌ ไม่มีคำขอลาหยุด`;
  }

  let message = `📋 รายการคำขอลาหยุด\n\n👦👧 นักเรียน: ${studentName}\n📈 จำนวน: ${absences.length} รายการ\n\n`;

  const statusIcons = {
    'pending': '⏳',
    'approved': '✅',
    'rejected': '❌'
  };

  const typeText = {
    'sick': '🤒 ป่วย',
    'personal': '👨‍👩‍👧‍👦 กิจส่วนตัว',
    'emergency': '🚨 เหตุฉุกเฉิน',
    'other': '📝 อื่นๆ'
  };

  absences.forEach((absence, index) => {
    const startDate = moment(absence.start_date).format('DD/MM/YYYY');
    const endDate = absence.end_date !== absence.start_date ? 
      ` - ${moment(absence.end_date).format('DD/MM/YYYY')}` : '';
    
    message += `${index + 1}. ${statusIcons[absence.status]} ${typeText[absence.absence_type] || absence.absence_type}\n`;
    message += `   📅 ${startDate}${endDate}\n`;
    message += `   📝 ${absence.reason}\n`;
    
    if (absence.admin_note) {
      message += `   💬 ${absence.admin_note}\n`;
    }
    
    message += '\n';
  });

  return message.trim();
}

/**
 * สร้าง Flex Message สำหรับแสดงรายการคำขอลา
 * @param {Array} absences - รายการคำขอลา
 * @param {string} studentName - ชื่อนักเรียน
 * @returns {Object} Flex Message
 */
function createAbsenceListFlexMessage(absences, studentName) {
  if (!absences || absences.length === 0) {
    return {
      type: 'flex',
      altText: 'รายการคำขอลาหยุด',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📋 รายการคำขอลาหยุด',
              weight: 'bold',
              size: 'lg',
              color: '#1DB446'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `👦👧 ${studentName}`,
              weight: 'bold',
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'text',
              text: '❌ ไม่มีคำขอลาหยุด',
              align: 'center',
              margin: 'md',
              color: '#999999'
            }
          ]
        }
      }
    };
  }

  const statusColors = {
    'pending': '#FF8800',
    'approved': '#00C851',
    'rejected': '#FF4444'
  };

  const statusText = {
    'pending': '⏳ รอพิจารณา',
    'approved': '✅ อนุมัติ',
    'rejected': '❌ ไม่อนุมัติ'
  };

  const typeText = {
    'sick': '🤒 ป่วย',
    'personal': '👨‍👩‍👧‍👦 กิจส่วนตัว',
    'emergency': '🚨 เหตุฉุกเฉิน',
    'other': '📝 อื่นๆ'
  };

  const contents = [];

  // แบ่งเป็น bubble ละ 5 รายการ
  for (let i = 0; i < absences.length; i += 5) {
    const batchAbsences = absences.slice(i, i + 5);
    const bodyContents = [];

    batchAbsences.forEach((absence, index) => {
      const startDate = moment(absence.start_date).format('DD/MM');
      const endDate = absence.end_date !== absence.start_date ? 
        ` - ${moment(absence.end_date).format('DD/MM')}` : '';

      if (index > 0) {
        bodyContents.push({
          type: 'separator',
          margin: 'md'
        });
      }

      bodyContents.push({
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: typeText[absence.absence_type] || absence.absence_type,
                weight: 'bold',
                size: 'sm',
                flex: 3
              },
              {
                type: 'text',
                text: statusText[absence.status],
                size: 'xs',
                color: statusColors[absence.status],
                align: 'end',
                flex: 2
              }
            ]
          },
          {
            type: 'text',
            text: `📅 ${startDate}${endDate}`,
            size: 'xs',
            color: '#666666',
            margin: 'xs'
          },
          {
            type: 'text',
            text: `📝 ${absence.reason}`,
            size: 'xs',
            color: '#666666',
            wrap: true,
            margin: 'xs'
          }
        ],
        margin: 'md'
      });

      if (absence.admin_note) {
        bodyContents.push({
          type: 'text',
          text: `💬 ${absence.admin_note}`,
          size: 'xs',
          color: '#999999',
          wrap: true,
          margin: 'xs'
        });
      }
    });

    contents.push({
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: i === 0 ? '📋 รายการคำขอลาหยุด' : `📋 รายการคำขอลาหยุด (${i + 1}-${Math.min(i + 5, absences.length)})`,
            weight: 'bold',
            size: 'lg',
            color: '#1DB446'
          },
          {
            type: 'text',
            text: `👦👧 ${studentName}`,
            size: 'sm',
            color: '#666666'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents
      }
    });
  }

  return {
    type: 'flex',
    altText: `รายการคำขอลาหยุด - ${studentName}`,
    contents: contents.length === 1 ? contents[0] : {
      type: 'carousel',
      contents: contents
    }
  };
}

/**
 * ส่งรายการคำขอลาให้ผู้ปกครอง
 * @param {string} lineUserId - LINE User ID
 * @param {Object} options - ตัวเลือก
 * @returns {Promise<Object>} ผลลัพธ์การส่ง
 */
async function sendAbsenceList(lineUserId, options = {}) {
  try {
    // ตรวจสอบการผูกบัญชี
    const linkStatus = await checkLinkStatus(lineUserId);
    
    if (!linkStatus.isLinked) {
      await lineClient.pushMessage(lineUserId, {
        type: 'text',
        text: '❌ ยังไม่ได้ผูกบัญชี\nกรุณาส่งรหัสนักเรียนเพื่อผูกบัญชี'
      });
      return {
        success: false,
        error: 'ไม่ได้ผูกบัญชี'
      };
    }

    // ดึงรายการคำขอลา
    const absenceResult = await getAbsenceRequests(linkStatus.student_id, options);
    
    if (!absenceResult.success) {
      await client.pushMessage(lineUserId, {
        type: 'text',
        text: `❌ ${absenceResult.error}`
      });
      return absenceResult;
    }

    // เลือกรูปแบบการแสดงผล
    const { format = 'flex' } = options;
    
    if (format === 'text') {
      // ส่งเป็นข้อความธรรมดา
      const message = formatAbsenceListMessage(
        absenceResult.absences, 
        linkStatus.student_name
      );
      
      await client.pushMessage(lineUserId, {
        type: 'text',
        text: message
      });
    } else {
      // ส่งเป็น Flex Message
      const flexMessage = createAbsenceListFlexMessage(
        absenceResult.absences,
        linkStatus.student_name
      );
      
      await client.pushMessage(lineUserId, flexMessage);
    }

    return {
      success: true,
      absences_count: absenceResult.total
    };

  } catch (error) {
    console.error('Error sending absence list:', error);
    
    await client.pushMessage(lineUserId, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการดึงข้อมูลคำขอลา\nกรุณาลองใหม่อีกครั้ง'
    });
    
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * สร้างคำขอลาผ่าน LINE
 * @param {string} lineUserId - LINE User ID
 * @param {Object} absenceData - ข้อมูลการลา
 * @returns {Promise<Object>} ผลลัพธ์การสร้างคำขอ
 */
async function createAbsenceFromLine(lineUserId, absenceData) {
  try {
    // ตรวจสอบการผูกบัญชี
    const linkStatus = await checkLinkStatus(lineUserId);
    
    if (!linkStatus.isLinked) {
      await client.pushMessage(lineUserId, {
        type: 'text',
        text: '❌ ยังไม่ได้ผูกบัญชี\nกรุณาส่งรหัสนักเรียนเพื่อผูกบัญชี'
      });
      return {
        success: false,
        error: 'ไม่ได้ผูกบัญชี'
      };
    }

    // สร้างคำขอลา
    const result = await createAbsenceRequest(linkStatus.student_id, {
      ...absenceData,
      parent_id: linkStatus.parent_id
    });
    
    if (!result.success) {
      await client.pushMessage(lineUserId, {
        type: 'text',
        text: `❌ ${result.error}`
      });
      return result;
    }

    // ส่งการยืนยัน
    const absence = result.absence;
    const startDate = moment(absence.start_date).format('DD/MM/YYYY');
    const endDate = absence.end_date !== absence.start_date ? 
      ` ถึง ${moment(absence.end_date).format('DD/MM/YYYY')}` : '';
    
    const typeText = {
      'sick': '🤒 ป่วย',
      'personal': '👨‍👩‍👧‍👦 กิจส่วนตัว',
      'emergency': '🚨 เหตุฉุกเฉิน',
      'other': '📝 อื่นๆ'
    };

    const message = `✅ บันทึกคำขอลาหยุดสำเร็จ\n\n👦👧 นักเรียน: ${linkStatus.student_name}\n📋 ประเภท: ${typeText[absence.absence_type]}\n📅 วันที่: ${startDate}${endDate}\n📝 เหตุผล: ${absence.reason}\n\n📊 สถานะ: ⏳ รอพิจารณา\n🆔 รหัสคำขอ: ${absence.id.substring(0, 8)}`;

    await client.pushMessage(lineUserId, {
      type: 'text',
      text: message
    });

    return {
      success: true,
      absence: absence
    };

  } catch (error) {
    console.error('Error creating absence from LINE:', error);
    
    await client.pushMessage(lineUserId, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการบันทึกคำขอลา\nกรุณาลองใหม่อีกครั้ง'
    });
    
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * สร้าง Quick Reply สำหรับการลาหยุด
 * @returns {Object} Quick Reply items
 */
function createAbsenceQuickReply() {
  return {
    items: [
      {
        type: 'action',
        action: {
          type: 'message',
          label: '🤒 ลาป่วย',
          text: 'ลาป่วย'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '👨‍👩‍👧‍👦 ลากิจ',
          text: 'ลากิจ'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '🚨 เหตุฉุกเฉิน',
          text: 'ลาฉุกเฉิน'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '📋 ดูรายการลา',
          text: 'ดูรายการลา'
        }
      }
    ]
  };
}

export {
  createAbsenceRequest,
  getAbsenceRequests,
  updateAbsenceStatus,
  sendAbsenceList,
  createAbsenceFromLine,
  formatAbsenceListMessage,
  createAbsenceListFlexMessage,
  createAbsenceQuickReply
};