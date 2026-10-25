import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

// Palette mirrors GradeMasterFrontend (slate-900 / primary-950)
const SLATE_900 = '#0F172A';
const PRIMARY_950 = '#0E1F31';

export default function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={[SLATE_900, PRIMARY_950, SLATE_900]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <StatusBar style="light" />

      {/* Gradient orbs and shapes */}
      <View style={styles.decor} pointerEvents="none">
        <View style={[styles.orb, styles.orbTop]} />
        <View style={[styles.orb, styles.orbBottom]} />
        <View style={[styles.orb, styles.orbMid]} />
        <View style={[styles.diamond, { top: '14%', right: '12%' }]} />
        <View style={[styles.dot, { top: '26%', left: '8%' }]} />
        <View style={[styles.ring, { bottom: '22%', right: '8%' }]} />
        <View style={[styles.dot, { bottom: '34%', left: '14%', backgroundColor: 'rgba(96,165,250,0.35)' }]} />
      </View>

      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  decor: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 999 },
  orbTop: {
    top: -140,
    right: -120,
    width: 380,
    height: 380,
    backgroundColor: 'rgba(59,130,246,0.14)',
  },
  orbBottom: {
    bottom: -130,
    left: -110,
    width: 340,
    height: 340,
    backgroundColor: 'rgba(99,102,241,0.14)',
  },
  orbMid: {
    top: '38%',
    left: -60,
    width: 180,
    height: 180,
    backgroundColor: 'rgba(34,211,238,0.07)',
  },
  diamond: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    transform: [{ rotate: '45deg' }],
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  ring: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    transform: [{ rotate: '12deg' }],
  },
});
