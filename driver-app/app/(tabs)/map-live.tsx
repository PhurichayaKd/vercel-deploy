// app/(tabs)/map.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, SafeAreaView, StyleSheet, Text, View,
  Dimensions, TouchableOpacity, Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/services/supabaseClient';
import { router } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

type Pt = { lat: number; lng: number };
type StudentRow = {
  student_id: number; student_name: string;
  home_lat?: number | null; home_lng?: number | null;
  lat?: number | null; lng?: number | null;
  geo_lat?: number | null; geo_lng?: number | null;
  address?: string | null;
};
type StudentWithGeo = StudentRow & { lat: number; lng: number; dist: number };

const UPDATE_MS = 10000;
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/* ======= ENHANCED THEME (Professional Minimal) ======= */
const COLORS = {
  // Background & Surface
  bg: '#FAFBFC',
  bgSecondary: '#F8FAFC',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  
  // Text Colors
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textMuted: '#94A3B8',
  
  // Border & Divider
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#E2E8F0',
  
  // Primary Brand (Blue)
  primary: '#0a7ea4',
  primaryDark: '#0369A1',
  primaryLight: '#0EA5E9',
  primarySoft: '#EFF6FF',
  primaryGradient: ['#0a7ea4', '#0369A1'],
  
  // Status Colors
  success: '#059669',
  successSoft: '#ECFDF5',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  info: '#2563EB',
  infoSoft: '#EFF6FF',
  
  // Interactive States
  hover: '#F8FAFC',
  pressed: '#F1F5F9',
  focus: '#0a7ea4',
  
  // Shadows
  shadow: 'rgba(15, 23, 42, 0.08)',
  shadowDark: 'rgba(15, 23, 42, 0.15)',
};

export default function MapScreen() {
  const webRef = useRef<WebView>(null);
  const [bus, setBus] = useState<Pt | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);

  const driverIdRef = useRef<number | null>(null);
  const getMyDriverId = useCallback(async () => {
    if (driverIdRef.current) return driverIdRef.current;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from('driver_bus').select('driver_id').eq('auth_user_id', user.id).single();
    driverIdRef.current = data?.driver_id ?? null;
    return driverIdRef.current;
  }, []);

  const hv = useCallback((a: Pt, b: Pt) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat);
    const la2 = toRad(b.lat);
    const aa = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(aa));
  }, []);

  const studentsWithGeo: StudentWithGeo[] = useMemo(() => {
    if (!bus) return [];
    return students.map(r => {
      const lat = (r.home_lat ?? r.lat ?? r.geo_lat) as number | null;
      const lng = (r.home_lng ?? r.lng ?? r.geo_lng) as number | null;
      if (lat == null || lng == null) return null;
      return { ...r, lat, lng, dist: hv(bus, { lat, lng }) };
    }).filter(Boolean).sort((a: any, b: any) => a.dist - b.dist) as any;
  }, [students, bus, hv]);

  const html = useMemo(() => {
    const INIT = bus ?? { lat: 13.7563, lng: 100.5018 };
    return `
<!doctype html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0} .num{background:#2563eb;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font:bold 12px system-ui;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.18)}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const map = L.map('map').setView([${INIT.lat},${INIT.lng}], 15);
L.tileLayer('${TILE_URL}', {maxZoom: 19, attribution: '&copy; OpenStreetMap'}).addTo(map);

function post(m){window.ReactNativeWebView?.postMessage(JSON.stringify(m));}

let busMarker = L.circleMarker([${INIT.lat},${INIT.lng}],{radius:8,color:'#16a34a',fill:true,fillOpacity:.9}).addTo(map).bindPopup('ตำแหน่งรถ');
let stuMarkers = []; let routeLine=null;

function clearStudents(){stuMarkers.forEach(m=>m.remove());stuMarkers=[]; if(routeLine){routeLine.remove();routeLine=null;}}
function setBus(lat,lng){busMarker.setLatLng([lat,lng]);}
function addStudents(items){
  clearStudents();
  items.forEach((s, i)=>{
    const ic = L.divIcon({html:'<div class="num">'+(i+1)+'</div>', className:'', iconSize:[24,24], iconAnchor:[12,12]});
    const m = L.marker([s.lat,s.lng],{icon:ic}).addTo(map).bindPopup((i+1)+'. '+(s.student_name||'นักเรียน'));
    stuMarkers.push(m);
  });
}
function drawRoute(to){
  if(routeLine) {routeLine.remove();routeLine=null;}
  if(!to) return;
  routeLine = L.polyline([[to.bus.lat,to.bus.lng],[to.stu.lat,to.stu.lng]],{color:'#16a34a',weight:6,opacity:.9}).addTo(map);
  map.fitBounds(L.latLngBounds([[to.bus.lat,to.bus.lng],[to.stu.lat,to.stu.lng]]),{padding:[50,50]});
}

function handle(raw){
  try{
    const m = JSON.parse(raw||'{}');
    if(m.type==='bus') setBus(m.lat,m.lng);
    if(m.type==='students') addStudents(m.items||[]);
    if(m.type==='route') drawRoute(m.to||null);
  }catch(e){}
}
document.addEventListener('message',e=>handle(e.data));
window.addEventListener('message',e=>handle(e.data));
</script></body></html>`;
  }, [bus]);

  const send = useCallback((p: any)=>{
    const s = JSON.stringify(p).replace(/\\/g,'\\\\').replace(/`/g,'\\`');
    webRef.current?.injectJavaScript(`(function(){window.dispatchEvent(new MessageEvent('message',{data:\`${s}\`}));})();true;`);
  },[]);

  // Request location permission
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      if (status !== 'granted') {
        Alert.alert(
          'ต้องการสิทธิ์เข้าถึงตำแหน่ง',
          'แอปต้องการเข้าถึงตำแหน่งของคุณเพื่อแสดงตำแหน่งรถบนแผนที่',
          [
            { text: 'ยกเลิก', style: 'cancel' },
            { text: 'ตั้งค่า', onPress: () => Location.requestForegroundPermissionsAsync() }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setLocationPermission(false);
    }
  };

  // Load students once
  useEffect(()=>{
    (async()=>{
      const { data } = await supabase.from('students')
        .select('student_id, student_name, address, home_latitude, home_longitude, geo_lat, geo_lng, status');
      setStudents((data||[]).map(r=>({
        ...r,
        home_lat: r.home_latitude, home_lng: r.home_longitude
      })) as any);
      setLoading(false);
    })();
  },[]);

  // Location tracking loop
  useEffect(()=>{
    let interval: any;
    
    const startLocationTracking = async () => {
      if (locationPermission) {
        const ping = async ()=>{
          try {
            const pos = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced});
            const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setBus(pt);
            
            // Persist location data
            const driverId = await getMyDriverId();
            if(driverId){
              const nowISO = new Date().toISOString();
              await supabase.from('driver_bus').update({
                current_latitude: pt.lat, current_longitude: pt.lng, current_updated_at: nowISO
              }).eq('driver_id', driverId);
              await supabase.from('live_driver_locations').upsert({
                driver_id: driverId, latitude: pt.lat, longitude: pt.lng, last_updated: nowISO
              });
            }
          } catch (error) {
            console.error('Error getting location:', error);
          }
        };
        
        await ping();
        interval = setInterval(ping, UPDATE_MS);
      }
    };
    
    startLocationTracking();
    return () => interval && clearInterval(interval);
  }, [locationPermission, getMyDriverId]);

  // Push data to webview
  useEffect(()=>{ if(bus) send({type:'bus', lat:bus.lat, lng:bus.lng}); },[bus,send]);
  useEffect(()=>{ if(studentsWithGeo.length) send({type:'students',items:studentsWithGeo.map(s=>({student_id:s.student_id,student_name:s.student_name,lat:s.lat,lng:s.lng}))}); },[studentsWithGeo,send]);
  useEffect(()=>{ if(bus && studentsWithGeo[0]) send({type:'route', to:{ bus, stu:{lat:studentsWithGeo[0].lat, lng:studentsWithGeo[0].lng} }}); else send({type:'route',to:null}); },[bus,studentsWithGeo,send]);

  const StudentItem = ({ item, index }: { item: StudentWithGeo; index: number }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentNumber}>
        <Text style={styles.studentNumberText}>{index+1}</Text>
      </View>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.student_name}</Text>
        <Text style={styles.studentAddress} numberOfLines={1}>{item.address ?? '—'}</Text>
        <Text style={styles.studentDistance}>{item.dist.toFixed(2)} กม. จากรถ</Text>
      </View>
      <Ionicons name="navigate-outline" size={18} color={COLORS.textTertiary} />
    </View>
  );

  if (locationPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIconWrap}>
            <Ionicons name="location-outline" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.permissionTitle}>ต้องการสิทธิ์เข้าถึงตำแหน่ง</Text>
          <Text style={styles.permissionSubtitle}>
            แอปต้องการเข้าถึงตำแหน่งของคุณเพื่อแสดงตำแหน่งรถบนแผนที่และคำนวณเส้นทางไปยังนักเรียน
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestLocationPermission}>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.permissionButtonText}>อนุญาต</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (locationPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <View style={[styles.permissionIconWrap, { backgroundColor: COLORS.dangerSoft }]}>
            <Ionicons name="location-outline" size={48} color={COLORS.danger} />
          </View>
          <Text style={styles.permissionTitle}>ไม่สามารถเข้าถึงตำแหน่งได้</Text>
          <Text style={styles.permissionSubtitle}>
            กรุณาเปิดใช้งานการเข้าถึงตำแหน่งในการตั้งค่าเพื่อใช้งานแผนที่
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestLocationPermission}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.permissionButtonText}>ลองอีกครั้ง</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <Ionicons name="map" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.brandText}>
              <Text style={styles.appTitle}>แผนที่เส้นทาง</Text>
              <View style={styles.titleRow}>
                <Text style={styles.subtitle}>ตำแหน่งรถและนักเรียน</Text>
                {bus && (
                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>ออนไลน์</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Map Container */}
      <View style={styles.mapContainer}>
        <WebView 
          ref={webRef} 
          source={{ html }} 
          originWhitelist={['*']} 
          javaScriptEnabled 
          domStorageEnabled 
          mixedContentMode="always"
          style={styles.webview}
        />
        
        {/* Students List Bottom Sheet */}
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>ลำดับที่ต้องรับ-ส่ง</Text>
            <Text style={styles.sheetSubtitle}>
              {studentsWithGeo.length} นักเรียน • เรียงตามระยะทางใกล้สุด
            </Text>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
            </View>
          ) : (
            <FlatList 
              data={studentsWithGeo} 
              keyExtractor={v=>String(v.student_id)} 
              renderItem={({item,index})=> <StudentItem item={item} index={index} />} 
              ItemSeparatorComponent={()=> <View style={{height:8}}/> }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const shadow = Platform.select({
  ios: {
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  android: { elevation: 3 },
});

const shadowElevated = Platform.select({
  ios: {
    shadowColor: COLORS.shadowDark,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 6 },
});

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.bg,
  },
  
  // Header Styles
  headerContainer: {
    backgroundColor: COLORS.card,
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    ...shadow,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandText: {
    flex: 1,
  },
  appTitle: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: COLORS.text, 
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  titleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    columnGap: 12, 
    marginTop: 2 
  },
  subtitle: { 
    color: COLORS.textSecondary, 
    fontWeight: '600', 
    fontSize: 14,
    letterSpacing: 0.1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    backgroundColor: COLORS.successSoft,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.success + '20',
  },
  statusDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: COLORS.success 
  },
  statusText: { 
    color: COLORS.success, 
    fontSize: 11, 
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Map Styles
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },

  // Bottom Sheet Styles
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '50%',
    ...shadowElevated,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.1,
  },

  // Student Card Styles
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  studentNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  studentNumberText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontWeight: '800',
    color: COLORS.text,
    fontSize: 15,
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  studentAddress: {
    color: COLORS.textTertiary,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  studentDistance: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  // Loading Styles
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 16,
  },

  // Permission Styles
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  permissionSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    ...shadow,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});