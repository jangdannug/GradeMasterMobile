import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDashboardTheme } from '../dashboard/theme';
import {
  StatusTone,
  submissionBadgeTone,
  submissionStatusHint,
  submissionStatusIcon,
  submissionStatusLabel,
} from './logic';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tone = StatusTone;

/** A pill with an optional icon; tapping it can explain what it means */
export function Pill({
  label,
  tone,
  icon,
  onPress,
}: {
  label: string;
  tone: Tone;
  icon?: IconName | null;
  onPress?: () => void;
}) {
  const t = useDashboardTheme();
  const palette: Record<Tone, { bg: string; fg: string }> = {
    info: { bg: t.primaryTint, fg: t.primary },
    warning: { bg: t.warningTint, fg: t.warning },
    success: { bg: t.successTint, fg: t.success },
    danger: { bg: t.destructiveTint, fg: t.destructive },
    secondary: { bg: t.secondaryTint, fg: t.muted },
  };
  const c = palette[tone];
  const body = (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      {!!icon && <Ionicons name={icon} size={13} color={c.fg} />}
      <Text style={[styles.pillText, { color: c.fg }]}>{label}</Text>
    </View>
  );
  return onPress ? (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      {body}
    </TouchableOpacity>
  ) : (
    body
  );
}

/** The submission status badge; tap it for the explanation */
export function StatusBadge({ status, editable }: { status: unknown; editable: boolean }) {
  return (
    <Pill
      label={submissionStatusLabel(status)}
      tone={submissionBadgeTone(status)}
      icon={submissionStatusIcon(status) as IconName | null}
      onPress={() => Alert.alert(submissionStatusLabel(status), submissionStatusHint(status, editable))}
    />
  );
}

/** "Oct 25, 2026 06:30 PM" in local time */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hours = d.getHours();
  const hh = String(hours % 12 || 12).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()} ${hh}:${mm} ${hours >= 12 ? 'PM' : 'AM'}`;
}

interface SheetBadgesProps {
  hasSheet: boolean;
  status: number;
  editable: boolean;
  isGpOpen: boolean;
  isSyActive: boolean;
  isLate: boolean;
  submittedAt: string;
  isDirty: boolean;
  justSaved: boolean;
  overMaxCount: number;
  blankCount: number;
  isSubmitted: boolean;
}

/** The badge row above the roster */
export function SheetBadges(p: SheetBadgesProps) {
  const readOnlyHint = !p.isSyActive
    ? 'The school year is not active. Score entry is disabled.'
    : !p.isGpOpen
      ? 'This grading period is outside its scoring window. Score entry is disabled.'
      : submissionStatusHint(p.status, p.editable);

  return (
    <View style={styles.row}>
      {p.isSubmitted && <StatusBadge status={p.status} editable={p.editable} />}
      {p.overMaxCount > 0 && (
        <Pill label={`${p.overMaxCount} error(s) found`} tone="danger" icon="alert-circle" />
      )}
      {p.blankCount > 0 && p.editable && (
        <Pill
          label={`${p.blankCount} blank grade(s)`}
          tone="warning"
          onPress={() => Alert.alert('Blank grades', 'Blank grades save as a draft but must be filled before submitting')}
        />
      )}
      {p.isLate && (
        <Pill
          label="Late"
          tone="warning"
          icon="time"
          onPress={() =>
            Alert.alert('Late', `This record was submitted after its deadline (${formatDateTime(p.submittedAt) || 'date unknown'}).`)
          }
        />
      )}
      {p.isDirty && <Pill label="Unsaved changes" tone="warning" />}
      {p.justSaved && !p.isDirty && <Pill label="Saved" tone="info" icon="checkmark" />}
      {p.hasSheet && (!p.editable || !p.isGpOpen) && (
        <Pill
          label="Read-only"
          tone="secondary"
          icon="lock-closed"
          onPress={() => Alert.alert('Read-only', readOnlyHint)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  pillText: { fontSize: 12, fontWeight: '700' },
});
