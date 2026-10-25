import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDashboardTheme } from '../theme';

interface Props {
  title: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}

export default function Card({ title, icon, iconColor, loading, empty, emptyText = 'No data yet', children }: Props) {
  const t = useDashboardTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={styles.header}>
        {icon && <Ionicons name={icon} size={18} color={iconColor ?? t.warning} />}
        <Text style={[styles.title, { color: t.foreground }]}>{title}</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={styles.state} color={t.primary} />
      ) : empty ? (
        <Text style={[styles.state, styles.empty, { color: t.muted }]}>{emptyText}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '700' },
  state: { paddingVertical: 28 },
  empty: { textAlign: 'center', fontSize: 13.5 },
});
