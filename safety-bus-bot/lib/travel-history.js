// lib/travel-history.js
import { supabase } from './db.js';
import { lineClient } from './line.js';
import moment from 'moment';
import { checkLinkStatus } from './account-linking.js';

// ตั้งค่า timezone เป็นไทย
moment.locale('th');

/**
 * ดึงประวัติการเดินทางของนักเรียน
 * @param {string} studentId - รหัสนักเรียน
 * @param {Object} options - ตัวเลือกการค้นหา
 * @returns {Promise<Object>} ประวัติการเดินทาง
 */
async function getTravelHistory(studentId, options = {}) {
  const {
    limit = 10,
    days = 7,
    tripType = null, // 'pickup', 'dropoff', หรือ null สำหรับทั้งหมด
    startDate = null,
    endDate = null
  } = options;

  try {
    let query = supabase
      .from('trips')
      .select(`
        id, trip_type, location, coordinates, bus_number,
        created_at, updated_at,
        students(student_name),
        buses(bus_name, license_plate)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    // กรองตามประเภทการเดินทาง
    if (tripType) {
      query = query.eq('trip_type', tripType);
    }

    // กรองตามช่วงวันที่
    if (startDate && endDate) {
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    } else if (days) {
      const daysAgo = moment().subtract(days, 'days').toISOString();
      query = query.gte('created_at', daysAgo);
    }

    // จำกัดจำนวนผลลัพธ์
    query = query.limit(limit);

    const { data: trips, error } = await query;

    if (error) {
      console.error('Error fetching travel history:', error);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติ'
      };
    }

    return {
      success: true,
      trips: trips || [],
      total: trips ? trips.length : 0
    };

  } catch (error) {
    console.error('Error in getTravelHistory:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * สร้างข้อความแสดงประวัติการเดินทาง
 * @param {Array} trips - รายการการเดินทาง
 * @param {string} studentName - ชื่อนักเรียน
 * @param {number} days - จำนวนวันที่ค้นหา
 * @returns {string} ข้อความประวัติการเดินทาง
 */
function formatTravelHistoryMessage(trips, studentName, days = 7) {
  if (!trips || trips.length === 0) {
    return `📊 ประวัติการเดินทาง\n\n👦👧 นักเรียน: ${studentName}\n📅 ช่วงเวลา: ${days} วันที่ผ่านมา\n\n❌ ไม่มีข้อมูลการเดินทางในช่วงเวลานี้`;
  }

  let message = `📊 ประวัติการเดินทาง\n\n👦👧 นักเรียน: ${studentName}\n📅 ช่วงเวลา: ${days} วันที่ผ่านมา\n📈 จำนวน: ${trips.length} รายการ\n\n`;

  // จัดกลุ่มตามวันที่
  const tripsByDate = {};
  trips.forEach(trip => {
    const date = moment(trip.created_at).format('DD/MM/YYYY');
    if (!tripsByDate[date]) {
      tripsByDate[date] = [];
    }
    tripsByDate[date].push(trip);
  });

  // แสดงข้อมูลแต่ละวัน
  Object.keys(tripsByDate).forEach(date => {
    message += `📅 ${date}\n`;
    
    tripsByDate[date].forEach(trip => {
      const time = moment(trip.created_at).format('HH:mm');
      const tripIcon = trip.trip_type === 'pickup' ? '🚌' : '🏠';
      const tripText = trip.trip_type === 'pickup' ? 'ขึ้นรถ' : 'ลงรถ';
      const busInfo = trip.buses ? `รถ ${trip.buses.license_plate}` : `รถ ${trip.bus_number}`;
      
      message += `  ${tripIcon} ${time} - ${tripText}\n`;
      message += `     📍 ${trip.location}\n`;
      message += `     🚐 ${busInfo}\n`;
    });
    
    message += '\n';
  });

  return message.trim();
}

/**
 * สร้าง Flex Message สำหรับแสดงประวัติการเดินทาง
 * @param {Array} trips - รายการการเดินทาง
 * @param {string} studentName - ชื่อนักเรียน
 * @param {number} days - จำนวนวันที่ค้นหา
 * @returns {Object} Flex Message
 */
function createTravelHistoryFlexMessage(trips, studentName, days = 7) {
  const contents = [];

  if (!trips || trips.length === 0) {
    return {
      type: 'flex',
      altText: 'ประวัติการเดินทาง',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📊 ประวัติการเดินทาง',
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
              type: 'text',
              text: `📅 ${days} วันที่ผ่านมา`,
              size: 'sm',
              color: '#666666'
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'text',
              text: '❌ ไม่มีข้อมูลการเดินทาง',
              align: 'center',
              margin: 'md',
              color: '#999999'
            }
          ]
        }
      }
    };
  }

  // จัดกลุ่มตามวันที่
  const tripsByDate = {};
  trips.forEach(trip => {
    const date = moment(trip.created_at).format('DD/MM/YYYY');
    if (!tripsByDate[date]) {
      tripsByDate[date] = [];
    }
    tripsByDate[date].push(trip);
  });

  // สร้าง bubble สำหรับแต่ละวัน
  Object.keys(tripsByDate).slice(0, 10).forEach(date => { // จำกัดไม่เกิน 10 วัน
    const dayTrips = tripsByDate[date];
    const tripContents = [];

    dayTrips.forEach((trip, index) => {
      const time = moment(trip.created_at).format('HH:mm');
      const tripIcon = trip.trip_type === 'pickup' ? '🚌' : '🏠';
      const tripText = trip.trip_type === 'pickup' ? 'ขึ้นรถ' : 'ลงรถ';
      const busInfo = trip.buses ? trip.buses.license_plate : trip.bus_number;

      if (index > 0) {
        tripContents.push({
          type: 'separator',
          margin: 'sm'
        });
      }

      tripContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: tripIcon,
            size: 'sm',
            flex: 1
          },
          {
            type: 'box',
            layout: 'vertical',
            flex: 5,
            contents: [
              {
                type: 'text',
                text: `${time} - ${tripText}`,
                weight: 'bold',
                size: 'sm'
              },
              {
                type: 'text',
                text: `📍 ${trip.location}`,
                size: 'xs',
                color: '#666666'
              },
              {
                type: 'text',
                text: `🚐 ${busInfo}`,
                size: 'xs',
                color: '#666666'
              }
            ]
          }
        ],
        margin: 'sm'
      });
    });

    contents.push({
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `📅 ${date}`,
            weight: 'bold',
            size: 'md',
            color: '#1DB446'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: tripContents
      }
    });
  });

  return {
    type: 'flex',
    altText: `ประวัติการเดินทาง - ${studentName}`,
    contents: {
      type: 'carousel',
      contents: contents
    }
  };
}

/**
 * ส่งประวัติการเดินทางให้ผู้ปกครอง
 * @param {string} lineUserId - LINE User ID
 * @param {Object} options - ตัวเลือกการค้นหา
 * @returns {Promise<Object>} ผลลัพธ์การส่ง
 */
async function sendTravelHistory(lineUserId, options = {}) {
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

    // ดึงประวัติการเดินทาง
    const historyResult = await getTravelHistory(linkStatus.student_id, options);
    
    if (!historyResult.success) {
      await client.pushMessage(lineUserId, {
        type: 'text',
        text: `❌ ${historyResult.error}`
      });
      return historyResult;
    }

    // เลือกรูปแบบการแสดงผล
    const { format = 'flex', days = 7 } = options;
    
    if (format === 'text') {
      // ส่งเป็นข้อความธรรมดา
      const message = formatTravelHistoryMessage(
        historyResult.trips, 
        linkStatus.student_name, 
        days
      );
      
      await client.pushMessage(lineUserId, {
        type: 'text',
        text: message
      });
    } else {
      // ส่งเป็น Flex Message
      const flexMessage = createTravelHistoryFlexMessage(
        historyResult.trips,
        linkStatus.student_name,
        days
      );
      
      await lineClient.pushMessage(lineUserId, flexMessage);
    }

    return {
      success: true,
      trips_count: historyResult.total
    };

  } catch (error) {
    console.error('Error sending travel history:', error);
    
    await client.pushMessage(lineUserId, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการดึงข้อมูลประวัติ\nกรุณาลองใหม่อีกครั้ง'
    });
    
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * ดึงสถิติการเดินทางของนักเรียน
 * @param {string} studentId - รหัสนักเรียน
 * @param {number} days - จำนวนวันที่ต้องการดูสถิติ
 * @returns {Promise<Object>} สถิติการเดินทาง
 */
async function getTravelStatistics(studentId, days = 30) {
  try {
    const daysAgo = moment().subtract(days, 'days').toISOString();
    
    // ดึงข้อมูลการเดินทางทั้งหมด
    const { data: trips, error } = await supabase
      .from('trips')
      .select('trip_type, created_at')
      .eq('student_id', studentId)
      .gte('created_at', daysAgo);
    
    if (error) {
      console.error('Error fetching travel statistics:', error);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ'
      };
    }
    
    const pickupTrips = trips.filter(trip => trip.trip_type === 'pickup');
    const dropoffTrips = trips.filter(trip => trip.trip_type === 'dropoff');
    
    // คำนวณวันที่มาเรียน
    const schoolDays = new Set();
    pickupTrips.forEach(trip => {
      const date = moment(trip.created_at).format('YYYY-MM-DD');
      schoolDays.add(date);
    });
    
    // คำนวณเวลาเฉลี่ย
    const pickupTimes = pickupTrips.map(trip => moment(trip.created_at).format('HH:mm'));
    const dropoffTimes = dropoffTrips.map(trip => moment(trip.created_at).format('HH:mm'));
    
    return {
      success: true,
      statistics: {
        total_trips: trips.length,
        pickup_trips: pickupTrips.length,
        dropoff_trips: dropoffTrips.length,
        school_days: schoolDays.size,
        attendance_rate: schoolDays.size > 0 ? Math.round((schoolDays.size / days) * 100) : 0,
        avg_pickup_time: pickupTimes.length > 0 ? calculateAverageTime(pickupTimes) : null,
        avg_dropoff_time: dropoffTimes.length > 0 ? calculateAverageTime(dropoffTimes) : null,
        period_days: days
      }
    };
    
  } catch (error) {
    console.error('Error in getTravelStatistics:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

/**
 * คำนวณเวลาเฉลี่ย
 * @param {Array} times - รายการเวลาในรูปแบบ HH:mm
 * @returns {string} เวลาเฉลี่ย
 */
function calculateAverageTime(times) {
  if (!times || times.length === 0) return null;
  
  const totalMinutes = times.reduce((sum, time) => {
    const [hours, minutes] = time.split(':').map(Number);
    return sum + (hours * 60) + minutes;
  }, 0);
  
  const avgMinutes = Math.round(totalMinutes / times.length);
  const hours = Math.floor(avgMinutes / 60);
  const minutes = avgMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * ส่งสถิติการเดินทางให้ผู้ปกครอง
 * @param {string} lineUserId - LINE User ID
 * @param {number} days - จำนวนวันที่ต้องการดูสถิติ
 * @returns {Promise<Object>} ผลลัพธ์การส่ง
 */
async function sendTravelStatistics(lineUserId, days = 30) {
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

    // ดึงสถิติการเดินทาง
    const statsResult = await getTravelStatistics(linkStatus.student_id, days);
    
    if (!statsResult.success) {
      await client.pushMessage(lineUserId, {
        type: 'text',
        text: `❌ ${statsResult.error}`
      });
      return statsResult;
    }

    const stats = statsResult.statistics;
    
    const message = `📈 สถิติการเดินทาง\n\n👦👧 นักเรียน: ${linkStatus.student_name}\n📅 ช่วงเวลา: ${days} วันที่ผ่านมา\n\n📊 สรุปข้อมูล:\n🚌 ขึ้นรถ: ${stats.pickup_trips} ครั้ง\n🏠 ลงรถ: ${stats.dropoff_trips} ครั้ง\n📚 วันที่มาเรียน: ${stats.school_days} วัน\n📈 อัตราการมาเรียน: ${stats.attendance_rate}%\n\n⏰ เวลาเฉลี่ย:\n🌅 ขึ้นรถ: ${stats.avg_pickup_time || 'ไม่มีข้อมูล'}\n🌆 ลงรถ: ${stats.avg_dropoff_time || 'ไม่มีข้อมูล'}`;
    
    await client.pushMessage(lineUserId, {
      type: 'text',
      text: message
    });

    return {
      success: true,
      statistics: stats
    };

  } catch (error) {
    console.error('Error sending travel statistics:', error);
    
    await client.pushMessage(lineUserId, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ\nกรุณาลองใหม่อีกครั้ง'
    });
    
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
}

export {
  getTravelHistory,
  sendTravelHistory,
  getTravelStatistics,
  sendTravelStatistics,
  formatTravelHistoryMessage,
  createTravelHistoryFlexMessage
};