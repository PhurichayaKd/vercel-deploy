-- สคริปต์ตรวจสอบข้อมูล LINE ID ก่อนและหลังการย้าย
-- ใช้สำหรับตรวจสอบว่าข้อมูลถูกย้ายอย่างถูกต้องหรือไม่

-- ตรวจสอบข้อมูล LINE ID ในตาราง students ที่ยังไม่ได้ย้าย
SELECT 
    'Students with LINE ID (not migrated)' as status,
    COUNT(*) as count
FROM students 
WHERE student_line_id IS NOT NULL 
    AND student_line_id != ''
    AND student_line_id NOT IN (
        SELECT line_user_id 
        FROM student_line_links 
        WHERE line_user_id IS NOT NULL
    );

-- ตรวจสอบข้อมูล LINE ID ในตาราง parents ที่ยังไม่ได้ย้าย
SELECT 
    'Parents with LINE ID (not migrated)' as status,
    COUNT(*) as count
FROM parents 
WHERE parent_line_id IS NOT NULL 
    AND parent_line_id != ''
    AND parent_line_id NOT IN (
        SELECT line_user_id 
        FROM parent_line_links 
        WHERE line_user_id IS NOT NULL
    );

-- แสดงรายละเอียดข้อมูล students ที่มี LINE ID
SELECT 
    'Student LINE IDs in students table' as type,
    student_id,
    student_name,
    student_line_id as line_id,
    'students table' as source
FROM students 
WHERE student_line_id IS NOT NULL AND student_line_id != ''
UNION ALL
SELECT 
    'Student LINE IDs in links table' as type,
    sll.student_id::text,
    s.student_name,
    sll.line_user_id as line_id,
    'student_line_links table' as source
FROM student_line_links sll
JOIN students s ON sll.student_id = s.student_id
WHERE sll.active = true
ORDER BY type, student_id;

-- แสดงรายละเอียดข้อมูล parents ที่มี LINE ID
SELECT 
    'Parent LINE IDs in parents table' as type,
    parent_id::text,
    parent_name,
    parent_line_id as line_id,
    'parents table' as source
FROM parents 
WHERE parent_line_id IS NOT NULL AND parent_line_id != ''
UNION ALL
SELECT 
    'Parent LINE IDs in links table' as type,
    pll.parent_id::text,
    p.parent_name,
    pll.line_user_id as line_id,
    'parent_line_links table' as source
FROM parent_line_links pll
JOIN parents p ON pll.parent_id = p.parent_id
WHERE pll.active = true
ORDER BY type, parent_id;

-- ตรวจสอบข้อมูลที่ซ้ำกัน (LINE ID เดียวกันใน 2 ตาราง)
SELECT 
    'Duplicate Student LINE IDs' as issue_type,
    s.student_line_id as line_id,
    COUNT(*) as occurrences
FROM students s
WHERE s.student_line_id IS NOT NULL 
    AND s.student_line_id != ''
    AND EXISTS (
        SELECT 1 FROM student_line_links sll 
        WHERE sll.line_user_id = s.student_line_id
    )
GROUP BY s.student_line_id
UNION ALL
SELECT 
    'Duplicate Parent LINE IDs' as issue_type,
    p.parent_line_id as line_id,
    COUNT(*) as occurrences
FROM parents p
WHERE p.parent_line_id IS NOT NULL 
    AND p.parent_line_id != ''
    AND EXISTS (
        SELECT 1 FROM parent_line_links pll 
        WHERE pll.line_user_id = p.parent_line_id
    )
GROUP BY p.parent_line_id;

-- สรุปสถิติทั้งหมด
SELECT 
    'Summary' as section,
    'Students with LINE ID in students table' as description,
    COUNT(*) as count
FROM students 
WHERE student_line_id IS NOT NULL AND student_line_id != ''
UNION ALL
SELECT 
    'Summary' as section,
    'Students with LINE ID in student_line_links table' as description,
    COUNT(*) as count
FROM student_line_links 
WHERE active = true
UNION ALL
SELECT 
    'Summary' as section,
    'Parents with LINE ID in parents table' as description,
    COUNT(*) as count
FROM parents 
WHERE parent_line_id IS NOT NULL AND parent_line_id != ''
UNION ALL
SELECT 
    'Summary' as section,
    'Parents with LINE ID in parent_line_links table' as description,
    COUNT(*) as count
FROM parent_line_links 
WHERE active = true
ORDER BY section, description;