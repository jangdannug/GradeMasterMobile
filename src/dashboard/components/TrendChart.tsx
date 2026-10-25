import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { EnrollmentPoint } from '../dashboard-data';
import { useDashboardTheme } from '../theme';

interface Props {
  data: EnrollmentPoint[];
  width: number;
}

const fmt = (n: number) => n.toLocaleString();

export default function TrendChart({ data, width }: Props) {
  const t = useDashboardTheme();
  const studentsColor = t.primary;
  const teachersColor = t.chartTeachers;

  // Students (~12k) and teachers (~480) differ by 25x, so teachers get their own right-hand axis
  const axisWidth = 44;
  const innerWidth = width - axisWidth * 2;
  const edge = 14;
  const spacing = (innerWidth - edge * 2 - 6) / Math.max(data.length - 1, 1);

  const axisText = { color: t.muted, fontSize: 10 };

  return (
    <View>
      <View style={styles.legend}>
        <LegendItem color={studentsColor} label="students" textColor={t.muted} />
        <LegendItem color={teachersColor} label="teachers" textColor={t.muted} />
      </View>

      <LineChart
        width={innerWidth}
        height={190}
        data={data.map((d) => ({ value: d.students, label: d.month }))}
        secondaryData={data.map((d) => ({ value: d.teachers }))}
        secondaryLineConfig={{ color: teachersColor, thickness: 2.5, curved: true, dataPointsColor: teachersColor, dataPointsRadius: 3 }}
        secondaryYAxis={{
          yAxisOffset: 440,
          maxValue: 60,
          noOfSections: 4,
          yAxisColor: 'transparent',
          yAxisTextStyle: axisText,
          yAxisLabelWidth: axisWidth,
          showFractionalValues: false,
        }}
        yAxisOffset={11500}
        maxValue={1500}
        noOfSections={4}
        spacing={spacing}
        initialSpacing={edge}
        endSpacing={edge}
        color={studentsColor}
        thickness={2.5}
        curved
        dataPointsColor={studentsColor}
        dataPointsRadius={3}
        yAxisLabelWidth={axisWidth}
        yAxisColor="transparent"
        xAxisColor={t.border}
        yAxisTextStyle={axisText}
        xAxisLabelTextStyle={axisText}
        formatYLabel={(v: string) => `${(Number(v) / 1000).toFixed(1)}k`}
        rulesColor={t.border}
        rulesType="dashed"
        dashWidth={4}
        dashGap={4}
        backgroundColor="transparent"
        pointerConfig={{
          pointerStripColor: t.border,
          pointerStripWidth: 1,
          pointerColor: studentsColor,
          radius: 5,
          pointerLabelWidth: 130,
          pointerLabelHeight: 74,
          autoAdjustPointerLabelPosition: true,
          pointerLabelComponent: (_items: any[], _secondary: any, index: number) => {
            const point = data[index];
            if (!point) return null;
            return (
              <View style={[styles.tooltip, { backgroundColor: t.card, borderColor: t.border }]}>
                <Text style={[styles.tooltipTitle, { color: t.foreground }]}>{point.month}</Text>
                <Text style={[styles.tooltipLine, { color: studentsColor }]}>students: {fmt(point.students)}</Text>
                <Text style={[styles.tooltipLine, { color: teachersColor }]}>teachers: {fmt(point.teachers)}</Text>
              </View>
            );
          },
        }}
      />
    </View>
  );
}

function LegendItem({ color, label, textColor }: { color: string; label: string; textColor: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12.5 },
  tooltip: { borderRadius: 10, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10 },
  tooltipTitle: { fontSize: 12.5, fontWeight: '700', marginBottom: 3 },
  tooltipLine: { fontSize: 12, fontWeight: '600' },
});
