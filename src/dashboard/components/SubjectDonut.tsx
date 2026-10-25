import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { SubjectScore } from '../dashboard-data';
import { useDashboardTheme } from '../theme';

export default function SubjectDonut({ data }: { data: SubjectScore[] }) {
  const t = useDashboardTheme();
  const [selected, setSelected] = useState<number | null>(null);

  const radius = 92;
  const average = data.reduce((sum, s) => sum + s.value, 0) / Math.max(data.length, 1);
  const active = selected != null ? data[selected] : null;

  return (
    <View>
      <View style={styles.chart}>
        <PieChart
          donut
          radius={radius}
          innerRadius={radius * 0.6}
          innerCircleColor={t.card}
          data={data.map((s, i) => ({
            value: s.value,
            color: s.color,
            focused: selected === i,
            onPress: () => setSelected((cur) => (cur === i ? null : i)),
          }))}
          focusOnPress
          sectionAutoFocus={false}
          centerLabelComponent={() => (
            <View style={styles.center}>
              <Text style={[styles.centerValue, { color: t.foreground }]}>
                {(active ? active.value : average).toFixed(1)}%
              </Text>
              <Text style={[styles.centerLabel, { color: t.muted }]} numberOfLines={1}>
                {active ? active.name : 'Avg Grade'}
              </Text>
            </View>
          )}
        />
      </View>

      <View style={styles.legend}>
        {data.map((s, i) => (
          <View key={s.name} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text
              style={[styles.legendName, { color: selected === i ? t.foreground : t.muted }]}
              numberOfLines={1}
            >
              {s.name}
            </Text>
            <Text style={[styles.legendValue, { color: t.foreground }]}>{s.value}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { alignItems: 'center', marginBottom: 16 },
  center: { alignItems: 'center', maxWidth: 100 },
  centerValue: { fontSize: 20, fontWeight: '800' },
  centerLabel: { fontSize: 11, marginTop: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 12 },
  legendItem: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontSize: 12.5 },
  legendValue: { fontSize: 12.5, fontWeight: '700' },
});
