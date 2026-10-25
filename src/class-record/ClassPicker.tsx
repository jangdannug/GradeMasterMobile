import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ClassRecordRow } from '../api/gradeSubmission';
import { DashedEmpty } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { cardInitials, isSubmittedStatus, subjectTint } from './logic';
import { StatusBadge } from './StatusBadges';
import { ClassCard, ClassGroup } from './useGradingSheet';

/** Classes grouped by section: "Grade X - Section" headers with a tappable card per subject */
export default function ClassPicker({
  groups,
  loading,
  selectedId,
  recordByOffering,
  onSelect,
}: {
  groups: ClassGroup[];
  loading: boolean;
  selectedId: string;
  recordByOffering: Map<string, ClassRecordRow>;
  onSelect: (card: ClassCard) => void;
}) {
  const t = useDashboardTheme();

  if (loading) return <ActivityIndicator style={{ marginVertical: 24 }} color={t.primary} />;
  if (groups.length === 0) {
    return (
      <DashedEmpty
        icon="school-outline"
        title="No classes assigned to you this school year."
        subtitle="Classes appear here once an administrator assigns you as a subject teacher."
      />
    );
  }

  return (
    <View>
      {groups.map((group) => (
        <View key={group.sectionId} style={styles.group}>
          <Text style={[styles.groupTitle, { color: t.primary }]}>{group.title}</Text>
          {group.cards.map((card) => {
            const tint = subjectTint(card.numericLevel, card.subjectCode || card.subjectName, t.isDark);
            const record = recordByOffering.get(card.offeringId);
            const selected = card.offeringId === selectedId;
            return (
              <TouchableOpacity
                key={card.offeringId}
                activeOpacity={0.75}
                onPress={() => onSelect(card)}
                style={[
                  styles.card,
                  { backgroundColor: t.card, borderColor: selected ? t.primary : t.border },
                  selected && { backgroundColor: t.primaryTint },
                ]}
              >
                <View style={[styles.tile, { backgroundColor: tint.bg }]}>
                  <Text style={[styles.tileText, { color: tint.fg }]}>
                    {cardInitials(card.subjectCode || card.subjectName)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: t.foreground }]} numberOfLines={1}>
                    {card.subjectName}
                  </Text>
                  <Text style={[styles.code, { color: t.muted }]}>{card.subjectCode}</Text>
                </View>
                {/* A badge shows only once the record has left Draft */}
                {record && isSubmittedStatus(record.status) && <StatusBadge status={record.status} editable={false} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  groupTitle: { fontSize: 13.5, fontWeight: '800', marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 12, marginBottom: 8 },
  tile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontSize: 15, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700' },
  code: { fontSize: 12, marginTop: 2 },
});
