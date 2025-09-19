// lib/handlers.js
import { lineClient } from './line.js';
import { supabase } from './db.js';
import { sendMainMenu, sendLeaveMenu } from './menu.js';
import { consumeToken, markTokenUsed } from './tokens.js';
import { linkByStudentId, linkDriverByStudentId, linkLineAccount, checkLinkStatus, unlinkAccount } from './account-linking.js';
import { sendTravelHistory, sendTravelStatistics } from './travel-history.js';
import { sendBusLocation } from './bus-tracking.js';
import { sendAbsenceList, createAbsenceFromLine, createAbsenceQuickReply } from './absence-management.js';
import { sendLeaveForm, createReasonForm, saveLeaveRequest } from './leave-form.js';
import { getStudentByLineId } from './student-data.js';

// ตัวแปรเก็บสถานะการกรอกฟอร์ม
const userFormStates = new Map();

// จัดการ text message
async function handleTextMessage(event) {
  const userId = event.source.userId;
  const text = event.message.text.trim();
  
  console.log(`📝 Text message from ${userId}: ${text}`);
  
  // ตรวจสอบว่าผู้ใช้กำลังกรอกเหตุผลการลาหรือไม่
  if (userFormStates.has(userId)) {
    await handleLeaveReasonInput(event, text);
    return;
  }
  
  // คำสั่งพิเศษ
  if (text === 'เมนู' || text === 'menu') {
    await sendMainMenu(userId);
    return;
  }
  
  // ตรวจสอบว่าเป็นโทเคนสำหรับผูกบัญชีหรือไม่
  if (text.startsWith('LINK:')) {
    const token = text.replace('LINK:', '').trim();
    await handleAccountLinking(event, token);
    return;
  }
  
  // ตรวจสอบคำสั่งประวัติการเดินทาง
  if (text.includes('ประวัติ') || text.includes('history')) {
    await handleTravelHistory(event);
    return;
  }
  
  // ตรวจสอบคำสั่งตำแหน่งรถ
  if (text.includes('ตำแหน่งรถ') || text.includes('รถ') || text.includes('location')) {
    await handleBusLocation(event);
    return;
  }
  
  // ตรวจสอบคำสั่งการลาหยุด
  if (text.includes('ลา') || text.includes('absence') || text.includes('ขาด')) {
    await handleAbsenceCommand(event);
    return;
  }
  
  // ตรวจสอบคำสั่งสำหรับคนขับ
  if (text.includes('คนขับ') || text.includes('driver')) {
    await handleDriverCommand(event);
    return;
  }
  
  // ตรวจสอบว่าเป็นรหัสนักเรียนหรือไม่
  if (/^[a-zA-Z0-9]{8,20}$/.test(text)) {
    await handleStudentIdInput(event, text);
    return;
  }
  
  // ตรวจสอบว่าเป็นข้อมูลการลาหรือไม่
  const isAbsenceData = await processAbsenceData(event);
  if (isAbsenceData) {
    return;
  }
  
  // ข้อความทั่วไป - แสดงเมนู
  await lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: `สวัสดีครับ! 👋\n\nพิมพ์ "เมนู" เพื่อดูตัวเลือกต่างๆ\n\nหรือส่งรหัสนักเรียนเพื่อผูกบัญชี\n\nคำสั่งที่ใช้ได้:\n• "ประวัติ" - ดูประวัติการเดินทาง\n• "ตำแหน่งรถ" - ดูตำแหน่งรถบัส\n• "ลาหยุด" - แจ้งลาหยุด\n• "คนขับ" - สำหรับคนขับรถ`
  });
}

// จัดการ postback event
async function handlePostback(event) {
  const userId = event.source.userId;
  const data = event.postback.data;
  
  console.log(`🔄 Postback from ${userId}: ${data}`);
  
  // แยกประเภท action
  if (data.startsWith('action=')) {
    const action = data.split('=')[1];
    await handleMainAction(event, action);
  } else if (data.startsWith('leave_type=')) {
    const leaveType = data.split('=')[1];
    await handleLeaveRequest(event, leaveType);
  } else if (data.startsWith('confirm_leave=')) {
    const leaveId = data.split('=')[1];
    await handleLeaveConfirmation(event, leaveId);
  } else if (data.startsWith('leave_form_')) {
    await handleLeaveFormPostback(event, data);
  }
}

// จัดการคำสั่งประวัติการเดินทาง
async function handleTravelHistory(event) {
  const text = event.message.text.toLowerCase();
  let options = { format: 'flex', days: 7 };
  
  // ตรวจสอบตัวเลือกเพิ่มเติม
  if (text.includes('สัปดาห์')) {
    options.days = 7;
  } else if (text.includes('เดือน')) {
    options.days = 30;
  } else if (text.includes('สถิติ')) {
    await sendTravelStatistics(event.source.userId, 30);
    return;
  }
  
  await sendTravelHistory(event.source.userId, options);
}

// จัดการคำสั่งตำแหน่งรถ
async function handleBusLocation(event) {
  await sendBusLocation(event.source.userId, { format: 'flex' });
}

// จัดการคำสั่งการลาหยุด
async function handleAbsenceCommand(event) {
  const text = event.message.text.toLowerCase();
  
  if (text.includes('ดูรายการ') || text.includes('รายการลา')) {
    await sendAbsenceList(event.source.userId, { format: 'flex' });
  } else if (text.includes('ลาป่วย') || text.includes('ป่วย')) {
    await handleAbsenceRequest(event, 'sick');
  } else if (text.includes('ลากิจ') || text.includes('กิจ')) {
    await handleAbsenceRequest(event, 'personal');
  } else if (text.includes('ลาฉุกเฉิน') || text.includes('ฉุกเฉิน')) {
    await handleAbsenceRequest(event, 'emergency');
  } else {
    // ใช้ฟอร์มแจ้งลาหยุดใหม่
    await sendLeaveForm(event.source.userId, event.replyToken);
  }
}

// จัดการคำขอลาหยุด
async function handleAbsenceRequest(event, absenceType) {
  // ส่งข้อความให้ผู้ใช้ระบุรายละเอียด
  const typeText = {
    'sick': '🤒 ลาป่วย',
    'personal': '👨‍👩‍👧‍👦 ลากิจ',
    'emergency': '🚨 ลาฉุกเฉิน'
  };
  
  const replyMessage = {
    type: 'text',
    text: `${typeText[absenceType]}\n\nกรุณาระบุรายละเอียดในรูปแบบ:\n\n📅 วันที่: DD/MM/YYYY\n📝 เหตุผล: [เหตุผลการลา]\n\nตัวอย่าง:\n📅 วันที่: 25/12/2024\n📝 เหตุผล: ไข้หวัด`
  };
  
  await lineClient.replyMessage(event.replyToken, replyMessage);
}

// ตรวจสอบและประมวลผลข้อมูลการลา
async function processAbsenceData(event) {
  const text = event.message.text;
  
  // ตรวจสอบรูปแบบข้อมูลการลา
  const dateMatch = text.match(/วันที่[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i);
  const reasonMatch = text.match(/เหตุผล[:\s]*(.+)/i);
  
  if (dateMatch && reasonMatch) {
    const dateStr = dateMatch[1];
    const reason = reasonMatch[1].trim();
    
    // แปลงวันที่
    const [day, month, year] = dateStr.split('/');
    const startDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    // กำหนดประเภทการลาจากข้อความ
    let absenceType = 'other';
    if (text.includes('ป่วย') || text.includes('ไข้') || text.includes('เจ็บ')) {
      absenceType = 'sick';
    } else if (text.includes('กิจ') || text.includes('ธุระ')) {
      absenceType = 'personal';
    } else if (text.includes('ฉุกเฉิน') || text.includes('เร่งด่วน')) {
      absenceType = 'emergency';
    }
    
    // สร้างคำขอลา
    await createAbsenceFromLine(event.source.userId, {
      absence_type: absenceType,
      start_date: startDate,
      reason: reason
    });
    
    return true;
  }
  
  return false;
}

// จัดการ follow event (เมื่อผู้ใช้เพิ่มเพื่อน)
async function handleFollow(event) {
  const userId = event.source.userId;
  
  console.log(`👥 New follower: ${userId}`);
  
  // ตรวจสอบว่าผู้ใช้ผูกบัญชีไว้แล้วหรือไม่
  const linkStatus = await checkLinkStatus(userId);
  
  if (linkStatus.isLinked) {
    // ผู้ใช้ผูกบัญชีไว้แล้ว - แสดงข้อมูลและเมนู
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: `🎉 ยินดีต้อนรับกลับมา!\n\n👤 ผู้ปกครอง: ${linkStatus.parent_name}\n👶 นักเรียน: ${linkStatus.student_name}\n🆔 รหัส: ${linkStatus.student_id}\n\n✅ บัญชีของคุณพร้อมใช้งานแล้ว\nเลือกเมนูด้านล่างเพื่อเริ่มใช้งาน`
    });
    
    // ส่งเมนูหลักทันที
    setTimeout(() => {
      sendMainMenu(userId);
    }, 1500);
  } else {
    // ผู้ใช้ยังไม่ได้ผูกบัญชี - แสดงคำแนะนำ
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: `🚍 ยินดีต้อนรับสู่ระบบ Safety Bus!\n\n📱 เพื่อใช้งานระบบ กรุณาเลือกวิธีการผูกบัญชี:\n\n1️⃣ ใส่รหัสนักเรียน (8-20 ตัวอักษร)\n2️⃣ ใช้โทเคนจากเว็บไซต์ (LINK:xxxxx)\n\n💡 หรือพิมพ์ \"เมนู\" เพื่อดูตัวเลือกอื่นๆ`
    });
  }
}

// จัดการ action หลัก
async function handleMainAction(event, action) {
  const userId = event.source.userId;
  
  switch (action) {
    case 'history':
      await handleHistoryRequest(event);
      break;
    case 'leave':
      await handleLeaveRequest(event);
      break;
    case 'location':
      await handleLocationRequest(event);
      break;
    case 'contact':
      await handleContactRequest(event);
      break;
    case 'main_menu':
      await sendMainMenu(userId);
      break;
    case 'driver_student_info':
      await handleDriverStudentInfo(event);
      break;
    case 'change_student':
      await handleChangeStudent(event);
      break;
    default:
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: 'ไม่พบคำสั่งที่ระบุ กรุณาลองใหม่อีกครั้ง'
      });
  }
}

// จัดการคำขอดูประวัติ
async function handleHistoryRequest(event) {
  const userId = event.source.userId;
  
  try {
    // ค้นหาข้อมูลผู้ปกครองจาก LINE user ID
    const { data: parentLink } = await supabase
      .from('parent_line_links')
      .select('parent_id, parents(name), students(name, student_id)')
      .eq('line_user_id', userId)
      .single();
    
    if (!parentLink) {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ ไม่พบข้อมูลบัญชีที่ผูกไว้\n\nกรุณาผูกบัญชีด้วยรหัสนักเรียนก่อน'
      });
      return;
    }
    
    // ดึงประวัติการเดินทาง 7 วันล่าสุด
    const { data: trips } = await supabase
      .from('trips')
      .select('*')
      .eq('student_id', parentLink.students.student_id)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    
    let message = `📊 ประวัติการเดินทาง - ${parentLink.students.name}\n\n`;
    
    if (trips && trips.length > 0) {
      trips.forEach(trip => {
        const date = new Date(trip.created_at).toLocaleDateString('th-TH');
        const time = new Date(trip.created_at).toLocaleTimeString('th-TH', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        message += `📅 ${date} ${time}\n`;
        message += `${trip.type === 'pickup' ? '🚌 ขึ้นรถ' : '🏠 ลงรถ'} - ${trip.location || 'ไม่ระบุ'}\n\n`;
      });
    } else {
      message += 'ไม่มีข้อมูลการเดินทางในช่วง 7 วันที่ผ่านมา';
    }
    
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: message
    });
    
  } catch (error) {
    console.error('❌ Error fetching history:', error);
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการดึงข้อมูล กรุณาลองใหม่อีกครั้ง'
    });
  }
}

// จัดการคำขอแจ้งลา (ใช้ฟอร์ม interactive)
async function handleLeaveRequest(event) {
  const userId = event.source.userId;
  
  // ตรวจสอบสถานะการเชื่อมโยงบัญชีก่อน
  const linkStatus = await checkLinkStatus(userId);
  
  if (!linkStatus.isLinked) {
    const message = {
      type: 'text',
      text: '❌ ไม่พบข้อมูลบัญชีที่ผูกไว้\n\n📝 กรุณาผูกบัญชีด้วยรหัสนักเรียนก่อนใช้งานฟีเจอร์แจ้งลา\n\n💡 วิธีผูกบัญชี:\n1. พิมพ์ "ผูกบัญชี" หรือ "link"\n2. ใส่รหัสนักเรียน\n3. ยืนยันข้อมูล\n\nหรือติดต่อเจ้าหน้าที่เพื่อขอรหัสเชื่อมโยงบัญชี'
    };
    
    // ใช้ replyMessage หากมี replyToken หรือ pushMessage หากไม่มี
    if (event.replyToken) {
      await lineClient.replyMessage(event.replyToken, message);
    } else {
      await lineClient.pushMessage(userId, message);
    }
    return;
  }
  
  // ใช้ฟอร์ม interactive แทน LIFF
  await sendLeaveForm(userId, event.replyToken);
}

// จัดการฟอร์มแจ้งลาแบบเก่า (เก็บไว้เพื่อ backward compatibility)
async function handleOldLeaveRequest(event, leaveType) {
  const userId = event.source.userId;
  
  try {
    // ค้นหาข้อมูลผู้ปกครองและนักเรียน
    const { data: parentLink } = await supabase
      .from('parent_line_links')
      .select('parent_id, students(name, student_id)')
      .eq('line_user_id', userId)
      .single();
    
    if (!parentLink) {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ ไม่พบข้อมูลบัญชีที่ผูกไว้\n\nกรุณาผูกบัญชีด้วยรหัสนักเรียนก่อน'
      });
      return;
    }
    
    const leaveTypeText = {
      'sick': 'ลาป่วย',
      'personal': 'ลากิจ',
      'absent': 'ไม่มาเรียน'
    };
    
    // บันทึกข้อมูลการลา
    const { data: leave, error } = await supabase
      .from('student_leaves')
      .insert({
        student_id: parentLink.students.student_id,
        leave_type: leaveType,
        leave_date: new Date().toISOString().split('T')[0],
        reason: leaveTypeText[leaveType],
        status: 'approved',
        created_by: parentLink.parent_id
      })
      .select()
      .single();
    
    if (error) throw error;
    
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: `✅ บันทึกการ${leaveTypeText[leaveType]}สำเร็จ\n\n👤 นักเรียน: ${parentLink.students.name}\n📅 วันที่: ${new Date().toLocaleDateString('th-TH')}\n📝 ประเภท: ${leaveTypeText[leaveType]}\n\n✨ ระบบจะไม่แจ้งเตือนการขาดเรียนในวันนี้`
    });
    
  } catch (error) {
    console.error('❌ Error processing leave request:', error);
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง'
    });
  }
}

// จัดการคำขอดูตำแหน่ง
async function handleLocationRequest(event) {
  await lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: '📍 ระบบติดตามตำแหน่งรถ\n\n🚧 ฟีเจอร์นี้อยู่ระหว่างการพัฒนา\nจะเปิดให้ใช้งานเร็วๆ นี้\n\n🔄 กรุณาติดตามการอัพเดต'
  });
}

// จัดการคำขอติดต่อคนขับ
async function handleContactRequest(event) {
  await lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: '📞 ติดต่อคนขับรถ\n\n🚧 ฟีเจอร์นี้อยู่ระหว่างการพัฒนา\nจะเปิดให้ใช้งานเร็วๆ นี้\n\n📱 ในกรณีฉุกเฉิน กรุณาโทร 191'
  });
}

// จัดการการผูกบัญชีด้วยโทเคน
async function handleAccountLinking(event, token) {
  const userId = event.source.userId;
  
  try {
    // ตรวจสอบโทเคน
    const tokenData = await consumeToken(token);
    
    // ตรวจสอบว่ามีการผูกบัญชีอยู่แล้วหรือไม่
    const { data: existingLink } = await supabase
      .from('parent_line_links')
      .select('*')
      .eq('line_user_id', userId)
      .single();
    
    if (existingLink) {
      await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '⚠️ บัญชี LINE นี้ได้ผูกกับระบบแล้ว\n\n🔄 หากต้องการเปลี่ยนแปลงข้อมูล\nกรุณาติดต่อเจ้าหน้าที่โรงเรียน\n\n📞 หรือพิมพ์ "เมนู" เพื่อใช้งานระบบ'
    });
      return;
    }
    
    // บันทึกการผูกบัญชี
    const { error: linkError } = await supabase
      .from('parent_line_links')
      .insert({
        parent_id: tokenData.parent_id,
        line_user_id: userId,
        linked_at: new Date().toISOString()
      });
    
    if (linkError) throw linkError;
    
    // ทำเครื่องหมายโทเคนว่าใช้แล้ว
    await markTokenUsed(token, userId);
    
    // ดึงข้อมูลผู้ปกครองและนักเรียน
    const { data: parentData } = await supabase
      .from('parents')
      .select('name, students(name)')
      .eq('parent_id', tokenData.parent_id)
      .single();
    
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: `🎉 ผูกบัญชีสำเร็จแล้ว!\n\n👤 ผู้ปกครอง: ${parentData.name}\n👶 นักเรียน: ${parentData.students.name}\n\n✅ ระบบพร้อมใช้งาน\n🔔 คุณจะได้รับการแจ้งเตือนเกี่ยวกับการเดินทางของนักเรียน\n\n📱 เลือกเมนูด้านล่างเพื่อเริ่มใช้งาน`
    });
    
  } catch (error) {
    console.error('❌ Error linking account:', error);
    
    let errorMessage = '❌ เกิดข้อผิดพลาดในการผูกบัญชี\n\n🔄 กรุณาลองใหม่อีกครั้ง\nหรือติดต่อเจ้าหน้าที่โรงเรียน';
    
    if (error.message === 'TOKEN_NOT_FOUND') {
      errorMessage = '❌ รหัสโทเคนไม่ถูกต้อง\n\n🔍 กรุณาตรวจสอบรหัสอีกครั้ง\n📝 หรือขอรหัสใหม่จากเว็บไซต์';
    } else if (error.message === 'TOKEN_USED') {
      errorMessage = '❌ รหัสโทเคนนี้ถูกใช้งานแล้ว\n\n🆕 กรุณาขอรหัสใหม่จากเว็บไซต์\n📞 หรือติดต่อเจ้าหน้าที่';
    } else if (error.message === 'TOKEN_EXPIRED') {
      errorMessage = '❌ รหัสโทเคนหมดอายุแล้ว\n\n⏰ กรุณาขอรหัสใหม่จากเว็บไซต์\n📞 หรือติดต่อเจ้าหน้าที่โรงเรียน';
    }
    
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: errorMessage
    });
  }
}

// จัดการการป้อนรหัสนักเรียน
async function handleStudentIdInput(event, studentId) {
  const userId = event.source.userId;
  
  try {
    // ตรวจสอบว่าผู้ใช้เป็นคนขับหรือไม่
    const userState = userFormStates.get(userId);
    if (userState && userState.type === 'driver_linking') {
      await handleDriverStudentIdInput(event, studentId);
      return;
    }
    
    // ตรวจสอบว่าผู้ใช้กำลังเปลี่ยนนักเรียนหรือไม่
    if (userState && userState.type === 'driver_change_student') {
      await handleDriverChangeStudentId(event, studentId);
      return;
    }
    
    const result = await linkByStudentId(userId, studentId);
    
    if (result.success) {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: `🎉 ผูกบัญชีสำเร็จแล้ว!\n\n👨‍👩‍👧‍👦 ผู้ปกครอง: ${result.parent_name}\n👦👧 นักเรียน: ${result.student_name}\n🆔 รหัสนักเรียน: ${studentId}\n\n✅ ระบบพร้อมใช้งาน\n🔔 คุณจะได้รับการแจ้งเตือนเกี่ยวกับการเดินทางของนักเรียน\n\n📱 เลือกเมนูด้านล่างเพื่อเริ่มใช้งาน`
      });
      
      // ส่งเมนูหลักหลังจากผูกบัญชีสำเร็จ
      setTimeout(() => {
        sendMainMenu(userId);
      }, 2000);
    } else {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: `❌ ${result.error}`
      });
    }
    
  } catch (error) {
    console.error('❌ Error processing student ID:', error);
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการค้นหาข้อมูล\n\n🔄 กรุณาลองใหม่อีกครั้ง\n📞 หรือติดต่อเจ้าหน้าที่โรงเรียน'
    });
  }
}

// จัดการคำสั่งสำหรับคนขับ
async function handleDriverCommand(event) {
  const userId = event.source.userId;
  
  await lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: `🚌 ระบบสำหรับคนขับรถ\n\n📝 กรุณากรอกข้อมูลต่อไปนี้:\n\n1️⃣ ชื่อคนขับ (ชื่อ-นามสกุล)\n2️⃣ รหัสนักเรียนที่รับผิดชอบ\n\n💡 ตัวอย่าง:\nสมชาย ใจดี\n12345678\n\nหรือส่งรหัสนักเรียนเพื่อเชื่อมโยงบัญชี`
  });
  
  // ตั้งสถานะผู้ใช้เป็นคนขับที่กำลังเชื่อมโยงบัญชี
  userFormStates.set(userId, {
    type: 'driver_linking',
    step: 'waiting_name',
    timestamp: Date.now()
  });
}

// จัดการการกรอกรหัสนักเรียนสำหรับคนขับ
async function handleDriverStudentIdInput(event, studentId) {
  const userId = event.source.userId;
  const userState = userFormStates.get(userId);
  
  if (!userState || !userState.driverName) {
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ กรุณากรอกชื่อคนขับก่อน\n\n💡 พิมพ์ "คนขับ" เพื่อเริ่มต้นใหม่'
    });
    return;
  }
  
  try {
    const result = await linkDriverByStudentId(userId, studentId, userState.driverName);
    
    if (result.success) {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: `🎉 เชื่อมโยงบัญชีคนขับสำเร็จ!\n\n🚌 คนขับ: ${userState.driverName}\n👦👧 นักเรียน: ${result.student_name}\n🆔 รหัสนักเรียน: ${studentId}\n\n✅ ระบบพร้อมใช้งาน\n🔔 คุณสามารถดูข้อมูลการเดินทางของนักเรียนได้\n\n📱 เลือกเมนูด้านล่างเพื่อเริ่มใช้งาน`
      });
      
      // ลบสถานะผู้ใช้
      userFormStates.delete(userId);
      
      // ส่งเมนูหลักหลังจากเชื่อมโยงสำเร็จ
      setTimeout(() => {
        sendMainMenu(userId);
      }, 2000);
    } else {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: `❌ ${result.error}\n\n💡 พิมพ์ "คนขับ" เพื่อเริ่มต้นใหม่`
      });
      userFormStates.delete(userId);
    }
    
  } catch (error) {
    console.error('❌ Error processing driver student ID:', error);
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการเชื่อมโยงบัญชี\n\n🔄 กรุณาลองใหม่อีกครั้ง\n📞 หรือติดต่อเจ้าหน้าที่โรงเรียน'
    });
    userFormStates.delete(userId);
  }
}

// จัดการ postback สำหรับฟอร์มแจ้งลา
async function handleLeaveFormPostback(event, data) {
  const userId = event.source.userId;
  
  // จัดการ postback แบบเก่า
  if (data === 'leave_form_sick' || data === 'leave_form_personal' || data === 'leave_form_emergency') {
    const leaveType = data.replace('leave_form_', '');
    
    // เก็บสถานะการกรอกฟอร์ม
    userFormStates.set(userId, {
      type: leaveType,
      step: 'reason'
    });
    
    const typeText = {
      'sick': '🤒 ลาป่วย',
      'personal': '👨‍👩‍👧‍👦 ลากิจ',
      'emergency': '🚨 ลาฉุกเฉิน'
    };
    
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: `${typeText[leaveType]}\n\nกรุณาระบุเหตุผลการลา:`
    });
  }
  // จัดการ postback แบบใหม่ที่มี studentId และ date
  else if (data.startsWith('leave_form_')) {
    const parts = data.split('_');
    if (parts.length >= 5) {
      const leaveType = parts[2]; // sick, personal, absent
      const studentId = parts[3];
      const leaveDate = parts[4];
      
      // เก็บสถานะการกรอกฟอร์ม
      userFormStates.set(userId, {
        type: leaveType,
        studentId: studentId,
        leaveDate: leaveDate,
        step: 'reason'
      });
      
      const typeText = {
        'sick': '🤒 ลาป่วย',
        'personal': '👨‍👩‍👧‍👦 ลากิจ',
        'absent': '❌ ไม่มาเรียน'
      };
      
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: `${typeText[leaveType]}\n\nกรุณาระบุเหตุผลการลา:`
      });
    }
  }
}

// จัดการข้อมูลนักเรียนสำหรับคนขับ
async function handleDriverStudentInfo(event) {
  const userId = event.source.userId;
  
  try {
    // ค้นหาข้อมูลคนขับและนักเรียนที่รับผิดชอบ
    const { data: driverLink } = await supabase
      .from('driver_line_links')
      .select('driver_name, students(student_name, student_id)')
      .eq('line_user_id', userId)
      .single();
    
    if (!driverLink) {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ ไม่พบข้อมูลคนขับที่ผูกไว้\n\nกรุณาผูกบัญชีด้วยรหัสนักเรียนก่อน'
      });
      return;
    }
    
    // ดึงประวัติการเดินทางล่าสุด
    const { data: recentTrips } = await supabase
      .from('trips')
      .select('*')
      .eq('student_id', driverLink.students.student_id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    let message = `👨‍🚗 ข้อมูลนักเรียนที่รับผิดชอบ\n\n`;
    message += `🚌 คนขับ: ${driverLink.driver_name}\n`;
    message += `👦👧 นักเรียน: ${driverLink.students.student_name}\n`;
    message += `🆔 รหัส: ${driverLink.students.student_id}\n\n`;
    
    if (recentTrips && recentTrips.length > 0) {
      message += `📊 การเดินทางล่าสุด:\n`;
      recentTrips.forEach(trip => {
        const date = new Date(trip.created_at).toLocaleDateString('th-TH');
        const time = new Date(trip.created_at).toLocaleTimeString('th-TH', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        message += `• ${date} ${time} - ${trip.type === 'pickup' ? '🚌 ขึ้นรถ' : '🏠 ลงรถ'}\n`;
      });
    } else {
      message += `📊 ยังไม่มีข้อมูลการเดินทาง`;
    }
    
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: message
    });
    
  } catch (error) {
    console.error('❌ Error fetching driver student info:', error);
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการดึงข้อมูล กรุณาลองใหม่อีกครั้ง'
    });
  }
}

// จัดการการเปลี่ยนนักเรียนสำหรับคนขับ
async function handleChangeStudent(event) {
  const userId = event.source.userId;
  
  await lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: `🔄 เปลี่ยนนักเรียนที่รับผิดชอบ\n\n📝 กรุณาส่งรหัสนักเรียนใหม่ที่ต้องการรับผิดชอบ\n\n💡 ตัวอย่าง: 12345678\n\n⚠️ การเปลี่ยนแปลงนี้จะมีผลทันที`
  });
  
  // ตั้งสถานะผู้ใช้เป็นคนขับที่กำลังเปลี่ยนนักเรียน
  userFormStates.set(userId, {
    type: 'driver_change_student',
    step: 'waiting_student_id',
    timestamp: Date.now()
  });
}

// จัดการการกรอกรหัสนักเรียนใหม่สำหรับคนขับ
async function handleDriverChangeStudentId(event, studentId) {
  const userId = event.source.userId;
  
  try {
    // ค้นหาข้อมูลนักเรียนใหม่
    const { data: student } = await supabase
      .from('students')
      .select('student_name')
      .eq('student_id', studentId)
      .single();
    
    if (!student) {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ ไม่พบข้อมูลนักเรียนที่ระบุ\n\n🔍 กรุณาตรวจสอบรหัสนักเรียนอีกครั้ง'
      });
      return;
    }
    
    // อัปเดตข้อมูลคนขับ
    const { error } = await supabase
      .from('driver_line_links')
      .update({ student_id: studentId })
      .eq('line_user_id', userId);
    
    if (error) throw error;
    
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: `✅ เปลี่ยนนักเรียนสำเร็จ!\n\n👦👧 นักเรียนใหม่: ${student.student_name}\n🆔 รหัส: ${studentId}\n\n🔔 คุณจะได้รับข้อมูลการเดินทางของนักเรียนคนนี้ต่อไป`
    });
    
    // ลบสถานะผู้ใช้
    userFormStates.delete(userId);
    
    // ส่งเมนูหลักหลังจากเปลี่ยนสำเร็จ
    setTimeout(() => {
      sendMainMenu(userId);
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error changing student:', error);
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการเปลี่ยนนักเรียน\n\n🔄 กรุณาลองใหม่อีกครั้ง'
    });
    userFormStates.delete(userId);
  }
}

// จัดการการกรอกเหตุผลการลา
async function handleLeaveReasonInput(event, reason) {
  const userId = event.source.userId;
  const formState = userFormStates.get(userId);
  
  if (!formState) {
    userFormStates.delete(userId);
    return;
  }
  
  // จัดการการกรอกชื่อคนขับ
  if (userState.type === 'driver_linking' && userState.step === 'waiting_name') {
    const driverName = reason.trim();
    
    if (driverName.length < 2) {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ กรุณากรอกชื่อคนขับให้ถูกต้อง\n\n💡 ตัวอย่าง: สมชาย ใจดี'
      });
      return;
    }
    
    // อัปเดตสถานะผู้ใช้
    userFormStates.set(userId, {
      ...userState,
      driverName: driverName,
      step: 'waiting_student_id'
    });
    
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: `✅ บันทึกชื่อคนขับ: ${driverName}\n\n📝 ตอนนี้กรุณาส่งรหัสนักเรียนที่คุณรับผิดชอบ\n\n💡 ตัวอย่าง: 12345678`
    });
    return;
  }
  
  // จัดการการเปลี่ยนนักเรียนสำหรับคนขับ
  if (userState.type === 'driver_change_student' && userState.step === 'waiting_student_id') {
    await handleDriverChangeStudentId(event, reason.trim());
    return;
  }
  
  try {
    let studentId, parentId, studentName;
    
    // ถ้ามี studentId ในสถานะ (จากฟอร์มใหม่) ให้ใช้ข้อมูลนั้น
    if (formState.studentId) {
      studentId = formState.studentId;
      
      // ค้นหาข้อมูลนักเรียนและผู้ปกครอง
      const { data: student } = await supabase
        .from('students')
        .select('student_name, student_guardians(parent_id)')
        .eq('student_id', studentId)
        .single();
      
      if (!student) {
        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: '❌ ไม่พบข้อมูลนักเรียน'
        });
        userFormStates.delete(userId);
        return;
      }
      
      studentName = student.student_name;
      parentId = student.student_guardians?.parent_id;
    } else {
      // ใช้วิธีเก่า - ค้นหาจาก parent_line_links
      const { data: parentLink } = await supabase
        .from('parent_line_links')
        .select('parent_id, students(student_name, student_id)')
        .eq('line_user_id', userId)
        .single();
      
      if (!parentLink) {
        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: '❌ ไม่พบข้อมูลบัญชีที่ผูกไว้\n\nกรุณาผูกบัญชีด้วยรหัสนักเรียนก่อน'
        });
        userFormStates.delete(userId);
        return;
      }
      
      studentId = parentLink.students.student_id;
      studentName = parentLink.students.student_name;
      parentId = parentLink.parent_id;
    }
    
    // บันทึกข้อมูลการลา
    const leaveData = {
      student_id: studentId,
      absence_type: formState.type,
      reason: reason,
      parent_id: parentId
    };
    
    // เพิ่มวันที่ถ้ามี
    if (formState.leaveDate) {
      leaveData.start_date = formState.leaveDate;
      leaveData.end_date = formState.leaveDate;
    }
    
    const result = await saveLeaveRequest(leaveData);
    
    if (result.success) {
      const typeText = {
        'sick': 'ลาป่วย',
        'personal': 'ลากิจ',
        'emergency': 'ลาฉุกเฉิน',
        'absent': 'ไม่มาเรียน'
      };
      
      const displayDate = formState.leaveDate || new Date().toLocaleDateString('th-TH');
      
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: `✅ บันทึกการ${typeText[formState.type]}สำเร็จ\n\n👤 นักเรียน: ${studentName}\n📅 วันที่: ${displayDate}\n📝 ประเภท: ${typeText[formState.type]}\n💬 เหตุผล: ${reason}\n\n✨ ระบบจะไม่แจ้งเตือนการขาดเรียนในวันนี้`
      });
    } else {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง'
      });
    }
    
  } catch (error) {
    console.error('❌ Error saving leave request:', error);
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง'
    });
  }
  
  // ลบสถานะการกรอกฟอร์ม
  userFormStates.delete(userId);
}

export {
  handleTextMessage,
  handlePostback,
  handleFollow,
  handleMainAction,
  handleHistoryRequest,
  handleLeaveRequest,
  handleLocationRequest,
  handleContactRequest,
  handleAccountLinking,
  handleStudentIdInput,
  handleDriverCommand,
  handleDriverStudentIdInput,
  handleDriverStudentInfo,
  handleChangeStudent,
  handleDriverChangeStudentId,
  handleTravelHistory,
  handleBusLocation,
  handleAbsenceCommand,
  handleAbsenceRequest,
  processAbsenceData,
  handleLeaveFormPostback,
  handleLeaveReasonInput,
  userFormStates
};