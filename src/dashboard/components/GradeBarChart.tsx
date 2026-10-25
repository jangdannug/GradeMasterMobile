import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { GradeLevelPoint } from '../dashboard-data';
import { useDashboardTheme } from '../theme';

interface Props {
  data: GradeLevelPoint[];
  width: number;
}

export default function GradeBarChart({ data, width }: Props) {
  const t = useDashboardTheme();
  const axisText = { color: t.muted, fontSize: 10 };

  return (
    <BarChart
      width={width - 40}
      height={190}
      data={data.map((d) => ({
        value: d.students,
        label: d.grade.replace('Grade ', 'G'),
        frontColor: t.primary,
      }))}
      barWidth={22}
      spacing={16}
      initialSpacing={10}
      endSpacing={10}
      roundedTop
      maxValue={1400}
      noOfSections={4}
      yAxisLabelWidth={40}
      yAxisColor="transparent"
      xAxisColor={t.border}
      yAxisTextStyle={axisText}
      xAxisLabelTextStyle={axisText}
      rulesColor={t.border}
      rulesType="dashed"
      dashWidth={4}
      dashGap={4}
      backgroundColor="transparent"
      renderTooltip={(item: { value: number; label: string }, index: number) => (
        <View style={[styles.tooltip, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.tooltipGrade, { color: t.foreground }]}>{data[index]?.grade ?? item.label}</Text>
          <Text style={[styles.tooltipValue, { color: t.primary }]}>{item.value.toLocaleString()} students</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  tooltip: { borderRadius: 8, borderWidth: 1, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 6, width: 96 },
  tooltipGrade: { fontSize: 11.5, fontWeight: '700' },
  tooltipValue: { fontSize: 11, fontWeight: '600' },
});
