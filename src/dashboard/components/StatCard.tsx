import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DashboardStat, StatIcon } from '../dashboard-data';
import { useDashboardTheme } from '../theme';

const ICONS: Record<StatIcon, React.ComponentProps<typeof Ionicons>['name']> = {
  users: 'people',
  teachers: 'school',
  sections: 'grid',
  'trending-up': 'trending-up',
};

export default function StatCard({ stat }: { stat: DashboardStat }) {
  const t = useDashboardTheme();
  const up = stat.changeType === 'increase';
  const changeColor = up ? t.success : t.destructive;

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={styles.top}>
        <Text style={[styles.title, { color: t.muted }]} numberOfLines={2}>
          {stat.title}
        </Text>
        <View style={[styles.iconBox, { backgroundColor: t.primaryTint }]}>
          <Ionicons name={ICONS[stat.icon]} size={18} color={t.primary} />
        </View>
      </View>
      <Text style={[styles.value, { color: t.foreground }]}>{stat.value}</Text>
      <View style={styles.change}>
        <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={13} color={changeColor} />
        <Text style={[styles.changeText, { color: changeColor }]}>{stat.change}</Text>
        <Text style={[styles.vs, { color: t.muted }]}>vs last month</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexBasis: '47%', flexGrow: 1, borderRadius: 16, borderWidth: 1, padding: 14 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value: { marginTop: 10, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  change: { marginTop: 6, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3 },
  changeText: { fontSize: 12, fontWeight: '700' },
  vs: { fontSize: 11 },
});
