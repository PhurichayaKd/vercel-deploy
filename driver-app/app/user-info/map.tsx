// app/pick/map.tsx
import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, router, Href } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

type Pt = { lat:number; lng:number };
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export default function PickMap() {
  const webRef = useRef<WebView>(null);
  const { returnTo, field, lat, lng } = useLocalSearchParams<{returnTo?:string; field?:string; lat?:string; lng?:string}>();
  const [picked, setPicked] = useState<Pt | null>(null);

  // html แผนที่ (มีแต่ pick-mode)
  const html = useMemo(()=>{
    const INIT = (lat && lng) ? { lat: Number(lat), lng: Number(lng) } : { lat: 13.7563, lng: 100.5018 };
    return `
<!doctype html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0} .pick{background:#111827;color:#fff;border-radius:12px;padding:2px 8px;font:bold 12px system-ui;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.18)}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const map = L.map('map').setView([${INIT.lat},${INIT.lng}], 15);
L.tileLayer('${TILE_URL}', {maxZoom: 19, attribution: '&copy; OpenStreetMap'}).addTo(map);
function post(m){window.ReactNativeWebView?.postMessage(JSON.stringify(m));}

let pickMarker=null;
function setPicked(lat,lng){
  if(!pickMarker){
    pickMarker = L.marker([lat,lng],{draggable:true,icon:L.divIcon({className:'',html:'<div class="pick">เลือก</div>'})}).addTo(map);
    pickMarker.on('dragend',()=>{const p=pickMarker.getLatLng(); post({type:'picked',lat:p.lat,lng:p.lng});});
  } else { pickMarker.setLatLng([lat,lng]); }
}
map.on('click',e=>{ setPicked(e.latlng.lat,e.latlng.lng); post({type:'picked',lat:e.latlng.lat,lng:e.latlng.lng}); });
${(lat && lng) ? `setPicked(${Number(lat)},${Number(lng)});` : ''}
</script></body></html>`;
  }, [lat, lng]);

  const onMsg = useCallback((e:any)=>{
    try{
      const m = JSON.parse(e?.nativeEvent?.data||'{}');
      if(m.type==='picked') setPicked({lat:m.lat,lng:m.lng});
    }catch{}
  },[]);

  const confirm = ()=>{
    if(!picked) return;
    const base = (typeof returnTo === 'string' && returnTo.length) ? returnTo : '/';
    const sep = base.includes('?') ? '&' : '?';
    const url = `${base}${sep}field=${field||'home'}&lat=${picked.lat}&lng=${picked.lng}`;
    router.replace(url as Href);
  };

  return (
    <SafeAreaView style={{flex:1,backgroundColor:'#F6F7FB'}}>
      <View style={{flex:1}}>
        <WebView ref={webRef} source={{ html }} originWhitelist={['*']} onMessage={onMsg} javaScriptEnabled domStorageEnabled mixedContentMode="always" />
        <View style={styles.bar}>
          <View style={{flex:1}}>
            <Text style={{fontWeight:'900',color:'#0F172A'}}>โหมดปักหมุด</Text>
            <Text style={{color:'#334155',fontSize:12}}>{picked?`${picked.lat.toFixed(6)}, ${picked.lng.toFixed(6)}`:'แตะบนแผนที่เพื่อเลือกตำแหน่ง'}</Text>
          </View>
          <TouchableOpacity style={[styles.btn,!picked&&{opacity:.5}]} disabled={!picked} onPress={confirm}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={{color:'#fff',fontWeight:'800'}}>ยืนยันตำแหน่ง</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const shadow = Platform.select({ ios:{shadowColor:'#000',shadowOpacity:.12,shadowRadius:14,shadowOffset:{width:0,height:6}}, android:{elevation:3} });
const styles = StyleSheet.create({
  bar:{position:'absolute',left:16,right:16,bottom:16,backgroundColor:'#fff',borderRadius:16,padding:12,flexDirection:'row',alignItems:'center',columnGap:10,...shadow},
  btn:{backgroundColor:'#2563EB',height:42,borderRadius:20,paddingHorizontal:14,flexDirection:'row',alignItems:'center',columnGap:6},
});