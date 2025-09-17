// app/driver-info/index.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function DriverInfoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ข้อมูลคนขับ</Text>
      
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/driver-info/bus-form')}
      >
        <Ionicons name="bus" size={24} color="#007AFF" />
        <Text style={styles.menuText}>ฟอร์มข้อมูลคนขับ</Text>
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