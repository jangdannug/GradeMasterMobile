import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  children?: React.ReactNode;
}

export default function ScreenPlaceholder({ title, icon, children }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={36} color="#1E3A5F" />
        </View>
        {children ?? <Text style={styles.soon}>Coming soon</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#1E3A5F' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  soon: { fontSize: 15, color: '#64748B' },
});
