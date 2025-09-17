// app/user-info/index.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function UserInfoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ข้อมูลผู้ใช้</Text>
      
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/user-info/passenger-list')}
      >
        <Ionicons name="people" size={24} color="#007AFF" />
        <Text style={styles.menuText}>รายชื่อผู้โดยสาร</Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/user-info/map')}
      >
        <Ionicons name="location" size={24} color="#007AFF" />
        <Text style={styles.menuText}>เลือกตำแหน่ง</Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 15,
  },
});