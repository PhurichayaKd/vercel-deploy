// lib/bus-tracking.js
import { supabase } from './db.js';
import { lineClient } from './line.js';
import moment from 'moment';
import { checkLinkStatus } from './account-linking.js';

// ตั้งค่า timezone เป็นไทย
moment.locale('th');

/**
 * อัพเดตตำแหน่งรถบัส
 * @param {string} busId - รหัสรถบัส
 * @param {Object} locationData - ข้อมูลตำแหน่ง
 * @returns {Promise<Object>} ผลลัพธ์การอัพเดต
 */
async function updateBusLocation(busId, locationData) {
  const {
    latitude,
    longitude,
    speed = 0,
    heading = 0,
    accuracy = null,
    timestamp = new Date().toISOString()
  } = locationData;

  try {
    // อัพเดตตำแหน่งปัจจุบันในตาราง buses
    const { error: busError } = await supabase
      .from('buses')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        last_location_update: timestamp,
        speed: speed,
        heading: heading
      })
      .eq('id', busId);

    if (busError) {
      console.error('Error updating bus location:', busError);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการอัพเดตตำแหน่งรถ'
      };
    }

    // บันทึกประวัติตำแหน่งในตาราง bus_locations
    const { error: locationError } = await supabase
      .from('bus_locations')
      .insert({
        bus_id: busId,
        latitude: latitude,
        longitude: longitude,
        speed: speed,
        heading: heading,
        accuracy: accuracy,
        recorded_at: timestamp
      });

    if (locationError) {
      console.error('Error saving location history:', locationError);
      // ไม่ return error เพราะการอัพเดตตำแหน่งหลักสำเร็จแล้ว
    }

    return {
      success: true,
      message: 'อัพเดตตำแหน่งรถสำเร็จ'
    };

  } catch (error) {
    console.error('Error in updateBusLocation:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * ดึงตำแหน่งปัจจุบันของรถบัส
 * @param {string} busId - รหัสรถบัส
 * @returns {Promise<Object>} ข้อมูลตำแหน่งรถ
 */
async function getCurrentBusLocation(busId) {
  try {
    const { data: bus, error } = await supabase
      .from('buses')
      .select(`
        id, bus_name, license_plate, driver_name, driver_phone,
        current_latitude, current_longitude, last_location_update,
        speed, heading, status
      `)
      .eq('id', busId)
      .single();

    if (error) {
      console.error('Error fetching bus location:', error);
      return {
        success: false,
        error: 'ไม่พบข้อมูลรถบัส'
      };
    }

    if (!bus.current_latitude || !bus.current_longitude) {
      return {
        success: false,
        error: 'ยังไม่มีข้อมูลตำแหน่งรถ'
      };
    }

    return {
      success: true,
      bus: bus,
      location: {
        latitude: bus.current_latitude,
        longitude: bus.current_longitude,
        lastUpdate: bus.last_location_update,
        speed: bus.speed,
        heading: bus.heading
      }
    };

  } catch (error) {
    console.error('Error in getCurrentBusLocation:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * ค้นหารถบัสของนักเรียน
 * @param {string} studentId - รหัสนักเรียน
 * @returns {Promise<Object>} ข้อมูลรถบัสของนักเรียน
 */
async function getStudentBus(studentId) {
  try {
    const { data: student, error } = await supabase
      .from('students')
      .select(`
        id, student_name, bus_id,
        buses(
          id, bus_name, license_plate, driver_name, driver_phone,
          current_latitude, current_longitude, last_location_update,
          speed, heading, status
        )
      `)
      .eq('id', studentId)
      .single();

    if (error) {
      console.error('Error fetching student bus:', error);
      return {
        success: false,
        error: 'ไม่พบข้อมูลนักเรียน'
      };
    }

    if (!student.bus_id || !student.buses) {
      return {
        success: false,
        error: 'นักเรียนยังไม่ได้กำหนดรถบัส'
      };
    }

    return {
      success: true,
      student: {
        id: student.id,
        name: student.student_name
      },
      bus: student.buses
    };

  } catch (error) {
    console.error('Error in getStudentBus:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * คำนวณระยะทางระหว่างจุดสองจุด (Haversine formula)
 * @param {number} lat1 - ละติจูดจุดที่ 1
 * @param {number} lon1 - ลองจิจูดจุดที่ 1
 * @param {number} lat2 - ละติจูดจุดที่ 2
 * @param {number} lon2 - ลองจิจูดจุดที่ 2
 * @returns {number} ระยะทางเป็นกิโลเมตร
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // รัศมีโลกเป็นกิโลเมตร
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * สร้างลิงก์แผนที่ Google Maps
 * @param {number} latitude - ละติจูด
 * @param {number} longitude - ลองจิจูด
 * @param {string} label - ป้ายชื่อตำแหน่ง
 * @returns {string} ลิงก์ Google Maps
 */
function createMapLink(latitude, longitude, label = 'ตำแหน่งรถบัส') {
  return `https://www.google.com/maps?q=${latitude},${longitude}&z=15&t=m&hl=th&gl=th&mapclient=embed&cid=${encodeURIComponent(label)}`;
}

/**
 * สร้างข้อความแสดงตำแหน่งรถ
 * @param {Object} busData - ข้อมูลรถบัส
 * @param {Object} studentData - ข้อมูลนักเรียน
 * @returns {string} ข้อความตำแหน่งรถ
 */
function formatBusLocationMessage(busData, studentData = null) {
  const lastUpdate = moment(busData.last_location_update);
  const timeAgo = lastUpdate.fromNow();
  const updateTime = lastUpdate.format('HH:mm');
  
  const mapLink = createMapLink(
    busData.current_latitude,
    busData.current_longitude,
    `รถบัส ${busData.license_plate}`
  );

  let message = `🚌 ตำแหน่งรถบัส\n\n`;
  
  if (studentData) {
    message += `👦👧 นักเรียน: ${studentData.name}\n`;
  }
  
  message += `🚐 รถ: ${busData.license_plate}\n`;
  message += `👨‍✈️ คนขับ: ${busData.driver_name}\n`;
  message += `📞 โทร: ${busData.driver_phone}\n\n`;
  
  message += `📍 ตำแหน่งปัจจุบัน:\n`;
  message += `⏰ อัพเดต: ${updateTime} (${timeAgo})\n`;
  
  if (busData.speed !== null && busData.speed > 0) {
    message += `🏃‍♂️ ความเร็ว: ${Math.round(busData.speed)} กม./ชม.\n`;
  }
  
  const statusText = {
    'active': '🟢 กำลังเดินทาง',
    'inactive': '🔴 หยุดพัก',
    'maintenance': '🟡 ซ่อมบำรุง'
  };
  
  message += `📊 สถานะ: ${statusText[busData.status] || '❓ ไม่ทราบ'}\n\n`;
  message += `🗺️ ดูแผนที่: ${mapLink}`;
  
  return message;
}

/**
 * สร้าง Flex Message สำหรับแสดงตำแหน่งรถ
 * @param {Object} busData - ข้อมูลรถบัส
 * @param {Object} studentData - ข้อมูลนักเรียน
 * @returns {Object} Flex Message
 */
function createBusLocationFlexMessage(busData, studentData = null) {
  const lastUpdate = moment(busData.last_location_update);
  const timeAgo = lastUpdate.fromNow();
  const updateTime = lastUpdate.format('HH:mm');
  
  const mapLink = createMapLink(
    busData.current_latitude,
    busData.current_longitude,
    `รถบัส ${busData.license_plate}`
  );

  const statusColor = {
    'active': '#00C851',
    'inactive': '#FF4444',
    'maintenance': '#FF8800'
  };
  
  const statusText = {
    'active': '🟢 กำลังเดินทาง',
    'inactive': '🔴 หยุดพัก',
    'maintenance': '🟡 ซ่อมบำรุง'
  };

  const bodyContents = [];
  
  if (studentData) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: '👦👧',
          size: 'sm',
          flex: 1
        },
        {
          type: 'text',
          text: studentData.name,
          size: 'sm',
          flex: 4,
          weight: 'bold'
        }
      ]
    });
    
    bodyContents.push({
      type: 'separator',
      margin: 'md'
    });
  }
  
  bodyContents.push(
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: '🚐',
          size: 'sm',
          flex: 1
        },
        {
          type: 'text',
          text: busData.license_plate,
          size: 'sm',
          flex: 4,
          weight: 'bold'
        }
      ]
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: '👨‍✈️',
          size: 'sm',
          flex: 1
        },
        {
          type: 'text',
          text: busData.driver_name,
          size: 'sm',
          flex: 4
        }
      ],
      margin: 'sm'
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: '📞',
          size: 'sm',
          flex: 1
        },
        {
          type: 'text',
          text: busData.driver_phone,
          size: 'sm',
          flex: 4,
          action: {
            type: 'uri',
            uri: `tel:${busData.driver_phone}`
          }
        }
      ],
      margin: 'sm'
    },
    {
      type: 'separator',
      margin: 'md'
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: '⏰',
          size: 'sm',
          flex: 1
        },
        {
          type: 'text',
          text: `${updateTime} (${timeAgo})`,
          size: 'sm',
          flex: 4
        }
      ],
      margin: 'sm'
    }
  );
  
  if (busData.speed !== null && busData.speed > 0) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: '🏃‍♂️',
          size: 'sm',
          flex: 1
        },
        {
          type: 'text',
          text: `${Math.round(busData.speed)} กม./ชม.`,
          size: 'sm',
          flex: 4
        }
      ],
      margin: 'sm'
    });
  }
  
  bodyContents.push({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: '📊',
        size: 'sm',
        flex: 1
      },
      {
        type: 'text',
        text: statusText[busData.status] || '❓ ไม่ทราบ',
        size: 'sm',
        flex: 4,
        color: statusColor[busData.status] || '#666666'
      }
    ],
    margin: 'sm'
  });

  return {
    type: 'flex',
    altText: `ตำแหน่งรถบัส ${busData.license_plate}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🚌 ตำแหน่งรถบัส',
            weight: 'bold',
            size: 'lg',
            color: '#1DB446'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '🗺️ ดูแผนที่',
              uri: mapLink
            },
            style: 'primary',
            color: '#1DB446'
          }
        ]
      }
    }
  };
}

/**
 * ส่งตำแหน่งรถให้ผู้ปกครอง
 * @param {string} lineUserId - LINE User ID
 * @param {Object} options - ตัวเลือก
 * @returns {Promise<Object>} ผลลัพธ์การส่ง
 */
async function sendBusLocation(lineUserId, options = {}) {
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

    // ค้นหารถบัสของนักเรียน
    const busResult = await getStudentBus(linkStatus.student_id);
    
    if (!busResult.success) {
      await client.pushMessage(lineUserId, {
        type: 'text',
        text: `❌ ${busResult.error}`
      });
      return busResult;
    }

    // ตรวจสอบว่ามีข้อมูลตำแหน่งหรือไม่
    if (!busResult.bus.current_latitude || !busResult.bus.current_longitude) {
      await client.pushMessage(lineUserId, {
        type: 'text',
        text: '❌ ยังไม่มีข้อมูลตำแหน่งรถ\nกรุณาลองใหม่อีกครั้งภายหลัง'
      });
      return {
        success: false,
        error: 'ไม่มีข้อมูลตำแหน่ง'
      };
    }

    // เลือกรูปแบบการแสดงผล
    const { format = 'flex' } = options;
    
    if (format === 'text') {
      // ส่งเป็นข้อความธรรมดา
      const message = formatBusLocationMessage(busResult.bus, busResult.student);
      
      await lineClient.pushMessage(lineUserId, {
        type: 'text',
        text: message
      });
    } else {
      // ส่งเป็น Flex Message
      const flexMessage = createBusLocationFlexMessage(busResult.bus, busResult.student);
      
      await lineClient.pushMessage(lineUserId, flexMessage);
    }

    return {
      success: true,
      bus_id: busResult.bus.id
    };

  } catch (error) {
    console.error('Error sending bus location:', error);
    
    await client.pushMessage(lineUserId, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการดึงข้อมูลตำแหน่งรถ\nกรุณาลองใหม่อีกครั้ง'
    });
    
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * ตรวจสอบ Geofence และส่งการแจ้งเตือน
 * @param {string} busId - รหัสรถบัส
 * @param {number} latitude - ละติจูด
 * @param {number} longitude - ลองจิจูด
 * @returns {Promise<Object>} ผลลัพธ์การตรวจสอบ
 */
async function checkGeofenceAndNotify(busId, latitude, longitude) {
  try {
    // ดึงข้อมูลจุดรับ-ส่งทั้งหมด
    const { data: locations, error: locError } = await supabase
      .from('pickup_locations')
      .select('*');
    
    if (locError) {
      console.error('Error fetching pickup locations:', locError);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลจุดรับ-ส่ง'
      };
    }

    const notifications = [];
    
    // ตรวจสอบแต่ละจุดรับ-ส่ง
    for (const location of locations) {
      const distance = calculateDistance(
        latitude, longitude,
        location.latitude, location.longitude
      );
      
      // ถ้าอยู่ในรัศมี geofence (เช่น 500 เมตร)
      const geofenceRadius = location.geofence_radius || 0.5; // กิโลเมตร
      
      if (distance <= geofenceRadius) {
        // ค้นหานักเรียนที่ใช้จุดรับ-ส่งนี้
        const { data: students, error: studError } = await supabase
          .from('students')
          .select(`
            id, student_name, pickup_location_id, dropoff_location_id,
            parents!inner(line_user_id)
          `)
          .eq('bus_id', busId)
          .or(`pickup_location_id.eq.${location.id},dropoff_location_id.eq.${location.id}`);
        
        if (studError) {
          console.error('Error fetching students for location:', studError);
          continue;
        }
        
        // ส่งการแจ้งเตือนให้ผู้ปกครอง
        for (const student of students) {
          if (student.parents && student.parents.line_user_id) {
            const estimatedTime = Math.round((distance / 30) * 60); // ประมาณ 30 กม./ชม.
            const message = `🚌 รถใกล้ถึงแล้ว!\n\n👦👧 ${student.student_name}\n📍 ${location.location_name}\n⏰ ประมาณ ${estimatedTime} นาที\n\nกรุณาเตรียมตัวรอรับ`;
            
            try {
              await client.pushMessage(student.parents.line_user_id, {
                type: 'text',
                text: message
              });
              
              notifications.push({
                student_id: student.id,
                location_id: location.id,
                distance: distance,
                estimated_time: estimatedTime
              });
            } catch (pushError) {
              console.error('Error sending geofence notification:', pushError);
            }
          }
        }
      }
    }

    return {
      success: true,
      notifications_sent: notifications.length,
      notifications: notifications
    };

  } catch (error) {
    console.error('Error in checkGeofenceAndNotify:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * ดึงประวัติตำแหน่งรถ
 * @param {string} busId - รหัสรถบัส
 * @param {Object} options - ตัวเลือกการค้นหา
 * @returns {Promise<Object>} ประวัติตำแหน่งรถ
 */
async function getBusLocationHistory(busId, options = {}) {
  const {
    limit = 50,
    hours = 24,
    startDate = null,
    endDate = null
  } = options;

  try {
    let query = supabase
      .from('bus_locations')
      .select('*')
      .eq('bus_id', busId)
      .order('recorded_at', { ascending: false });

    // กรองตามช่วงเวลา
    if (startDate && endDate) {
      query = query.gte('recorded_at', startDate).lte('recorded_at', endDate);
    } else if (hours) {
      const hoursAgo = moment().subtract(hours, 'hours').toISOString();
      query = query.gte('recorded_at', hoursAgo);
    }

    // จำกัดจำนวนผลลัพธ์
    query = query.limit(limit);

    const { data: locations, error } = await query;

    if (error) {
      console.error('Error fetching bus location history:', error);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติตำแหน่ง'
      };
    }

    return {
      success: true,
      locations: locations || [],
      total: locations ? locations.length : 0
    };

  } catch (error) {
    console.error('Error in getBusLocationHistory:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

export {
  updateBusLocation,
  getCurrentBusLocation,
  getStudentBus,
  sendBusLocation,
  checkGeofenceAndNotify,
  getBusLocationHistory,
  calculateDistance,
  createMapLink,
  formatBusLocationMessage,
  createBusLocationFlexMessage
};