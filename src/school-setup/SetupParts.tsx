import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDashboardTheme } from '../dashboard/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Card header: icon + title on the left, "Add ..." button on the right */
export function TabHeader({
  icon,
  title,
  addLabel,
  onAdd,
}: {
  icon: IconName;
  title: string;
  addLabel: string;
  onAdd: () => void;
}) {
  const t = useDashboardTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerTitle}>
        <Ionicons name={icon} size={20} color={t.primary} />
        <Text style={[styles.title, { color: t.foreground }]}>{title}</Text>
      </View>
      <TouchableOpacity style={[styles.addButton, { backgroundColor: t.primary }]} onPress={onAdd} activeOpacity={0.85}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.addText}>{addLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function RowCard({
  children,
  highlighted,
}: {
  children: React.ReactNode;
  highlighted?: boolean;
}) {
  const t = useDashboardTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: highlighted ? t.primaryTint : t.card, borderColor: highlighted ? t.primary : t.border },
      ]}
    >
      {children}
    </View>
  );
}

/** "..." button for the row action menu; greyed out (but tappable, to explain why) when disabled */
export function MoreButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const t = useDashboardTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.more, disabled && { opacity: 0.35 }]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="ellipsis-horizontal" size={20} color={t.muted} />
    </TouchableOpacity>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const t = useDashboardTheme();
  return <Text style={[styles.section, { color: t.primary }]}>{children}</Text>;
}

export const joinParts = (parts: (string | null | undefined)[], separator: string) =>
  parts.filter((p) => p && String(p).trim()).join(separator);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  title: { fontSize: 17, fontWeight: '700' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  addText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  more: { padding: 4 },
  section: { fontSize: 14, fontWeight: '800', marginTop: 6, marginBottom: 12 },
});
