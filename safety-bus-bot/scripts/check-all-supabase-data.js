import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName, limit = 5) {
  try {
    console.log(`\n=== Checking ${tableName} table ===`);
    
    // Count total records
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error(`Error counting ${tableName}:`, countError.message);
      return;
    }
    
    console.log(`Total records: ${count}`);
    
    if (count > 0) {
      // Get sample records
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(limit);
      
      if (error) {
        console.error(`Error fetching ${tableName}:`, error.message);
        return;
      }
      
      console.log(`Sample records (showing ${Math.min(limit, data.length)} of ${count}):`);
      data.forEach((record, index) => {
        console.log(`${index + 1}.`, JSON.stringify(record, null, 2));
      });
    } else {
      console.log('No records found.');
    }
    
  } catch (error) {
    console.error(`Unexpected error checking ${tableName}:`, error.message);
  }
}

async function checkAllData() {
  console.log('🔍 Checking all Supabase data...');
  console.log('Supabase URL:', supabaseUrl);
  
  const tables = [
    'parents',
    'students', 
    'drivers',
    'buses',
    'routes',
    'parent_line_links',
    'student_line_links',
    'driver_line_links',
    'bus_locations',
    'student_bus_assignments',
    'absence_requests',
    'notifications',
    'api_calls'
  ];
  
  for (const table of tables) {
    await checkTable(table);
  }
  
  console.log('\n✅ Data check completed!');
}

checkAllData().catch(console.error);