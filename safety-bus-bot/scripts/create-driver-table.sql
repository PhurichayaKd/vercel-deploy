-- สร้างตาราง driver_line_links สำหรับเก็บข้อมูลการเชื่อมโยงบัญชีคนขับ
CREATE TABLE IF NOT EXISTS driver_line_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(50) REFERENCES students(student_id),
  line_user_id VARCHAR(255) UNIQUE NOT NULL,
  driver_name VARCHAR(255),
  linked_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- สร้าง index สำหรับการค้นหาที่เร็วขึ้น
CREATE INDEX IF NOT EXISTS idx_driver_line_links_student_id ON driver_line_links(student_id);
CREATE INDEX IF NOT EXISTS idx_driver_line_links_line_user_id ON driver_line_links(line_user_id);
CREATE INDEX IF NOT EXISTS idx_driver_line_links_active ON driver_line_links(is_active);

-- เพิ่ม comment สำหรับตาราง
COMMENT ON TABLE driver_line_links IS 'ตารางเก็บข้อมูลการเชื่อมโยงบัญชี LINE ของคนขับรถกับรหัสนักเรียน';
COMMENT ON COLUMN driver_line_links.student_id IS 'รหัสนักเรียนที่คนขับรถดูแล';
COMMENT ON COLUMN driver_line_links.line_user_id IS 'LINE User ID ของคนขับรถ';
COMMENT ON COLUMN driver_line_links.driver_name IS 'ชื่อคนขับรถ (ไม่บังคับ)';
COMMENT ON COLUMN driver_line_links.linked_at IS 'วันที่และเวลาที่เชื่อมโยงบัญชี';
COMMENT ON COLUMN driver_line_links.is_active IS 'สถานะการใช้งาน (true = ใช้งาน, false = ปิดใช้งาน)';