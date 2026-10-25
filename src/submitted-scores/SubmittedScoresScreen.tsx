import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '../api';
import { ClassRecordRow, gradeSubmissionApi, SectionReadiness } from '../api/gradeSubmission';
import { gradeLevelsApi } from '../api/gradeLevels';
import { sectionsApi } from '../api/sections';
import { academicKeys } from '../academic-setup/keys';
import ActivitySheet from '../class-record/ActivitySheet';
import { ClassRecordStatus, SectionSubmissionStatus } from '../class-record/logic';
import { classRecordKeys } from '../class-record/useGradingSheet';
import { Pill, StatusBadge } from '../class-record/StatusBadges';
import { DashedEmpty } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { todayString } from '../school-setup/dates';
import { useGradingPeriods, useSchoolYears } from '../school-setup/hooks';

const SECTION_LABELS: Record<number, { label: string; tone: 'secondary' | 'info' | 'success' | 'danger' | 'warning' }> = {
  [SectionSubmissionStatus.Draft]: { label: 'Not submitted', tone: 'secondary' },
  [SectionSubmissionStatus.Submitted]: { label: 'For review', tone: 'info' },
  [SectionSubmissionStatus.Approved]: { label: 'Approved', tone: 'success' },
  [SectionSubmissionStatus.Rejected]: { label: 'Rejected', tone: 'danger' },
  [SectionSubmissionStatus.Returned]: { label: 'Returned', tone: 'warning' },
};

/** School head tab: review a section's submissions for a grading period, then approve or reject */
export default function SubmittedScoresScreen() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const schoolYears = useSchoolYears();
  const schoolYear = useMemo(
    () => (schoolYears.data ?? []).find((s) => s.isActive && !s.isDraft) ?? (schoolYears.data ?? []).find((s) => s.isActive),
    [schoolYears.data]
  );
  const periodsQuery = useGradingPeriods(schoolYear?.id ?? '', !!schoolYear);
  const periods = useMemo(() => [...(periodsQuery.data ?? [])].sort((a, b) => a.sequenceNo - b.sequenceNo), [periodsQuery.data]);
  const [pickedPeriodId, setPickedPeriodId] = useState('');
  const gradingPeriod = useMemo(() => {
    const picked = periods.find((p) => p.id === pickedPeriodId);
    if (picked) return picked;
    const today = todayString();
    return periods.find((p) => today >= p.startDate && today <= p.endDate) ?? periods[0];
  }, [periods, pickedPeriodId]);
  const gpId = gradingPeriod?.id ?? '';

  const sectionsQuery = useQuery({
    queryKey: ['sy-sections', schoolYear?.id ?? ''],
    queryFn: () => sectionsApi.allForSchoolYear(schoolYear!.id),
    enabled: !!schoolYear,
  });
  const levelsQuery = useQuery({ queryKey: academicKeys.gradeLevels, queryFn: gradeLevelsApi.list });

  const sections = useMemo(() => {
    const levels = new Map((levelsQuery.data ?? []).map((l) => [l.id, l]));
    return (sectionsQuery.data ?? [])
      .map((s) => ({
        id: s.id,
        name: s.name,
        levelName: levels.get(s.gradeLevelId)?.name ?? 'Grade',
        level: levels.get(s.gradeLevelId)?.numericLevel ?? 0,
      }))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [sectionsQuery.data, levelsQuery.data]);

  const readiness = useQueries({
    queries: sections.map((s) => ({
      queryKey: classRecordKeys.readiness(s.id, gpId),
      queryFn: () => gradeSubmissionApi.readiness(s.id, gpId),
      enabled: !!gpId,
      staleTime: 30 * 1000,
    })),
  });

  const [selectedId, setSelectedId] = useState('');
  const selected = sections.find((s) => s.id === selectedId);
  const selectedIndex = sections.findIndex((s) => s.id === selectedId);
  const selectedReadiness: SectionReadiness | undefined = selectedIndex >= 0 ? readiness[selectedIndex]?.data : undefined;

  const [activityOpen, setActivityOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['section-readiness'] });

  const approve = useMutation({
    mutationFn: (id: string) => gradeSubmissionApi.approveSection(id),
    onSuccess: () => {
      refresh();
      Alert.alert('Approved', 'The section has been approved and its records are locked.');
    },
    onError: (e) => Alert.alert('Could not approve', apiErrorMessage(e)),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all(readiness.map((q) => q.refetch()));
    } finally {
      setRefreshing(false);
    }
  };

  const sgsId = selectedReadiness?.sectionGradeSubmissionId ?? '';
  const sectionStatus = selectedReadiness?.status ?? 0;
  const canDecide = !!sgsId && sectionStatus === SectionSubmissionStatus.Submitted;

  // ---------------------------------------------------------------------------------------------
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        <Text style={[styles.title, { color: t.primary }]}>Submitted Scores</Text>
        <Text style={[styles.subtitle, { color: t.muted }]}>
          {schoolYear ? `S.Y. ${schoolYear.name} · ` : ''}Review section submissions
        </Text>

        <View style={styles.periods}>
          {periods.map((p) => {
            const active = p.id === gradingPeriod?.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.period, { borderColor: active ? t.primary : t.border, backgroundColor: active ? t.primaryTint : t.card }]}
                onPress={() => setPickedPeriodId(p.id)}
              >
                <Text style={[styles.periodText, { color: active ? t.primary : t.muted }]}>{p.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!schoolYear && !schoolYears.isLoading ? (
          <DashedEmpty icon="calendar-outline" title="No active school year." />
        ) : sectionsQuery.isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={t.primary} />
        ) : sections.length === 0 ? (
          <DashedEmpty icon="albums-outline" title="No sections in this school year." />
        ) : (
          sections.map((s, i) => {
            const r = readiness[i]?.data;
            const meta = r ? SECTION_LABELS[r.status] : undefined;
            const active = s.id === selectedId;
            return (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.8}
                style={[styles.card, { backgroundColor: active ? t.primaryTint : t.card, borderColor: active ? t.primary : t.border }]}
                onPress={() => setSelectedId(active ? '' : s.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: t.foreground }]}>
                    {s.levelName} - {s.name}
                  </Text>
                  <Text style={[styles.cardMeta, { color: t.muted }]}>
                    {r ? `${r.classRecords.length} class record(s)` : readiness[i]?.isLoading ? 'Loading…' : '—'}
                  </Text>
                </View>
                {meta && <Pill label={meta.label} tone={meta.tone} />}
              </TouchableOpacity>
            );
          })
        )}

        {selected && (
          <View style={[styles.detail, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.detailTitle, { color: t.primary }]}>
              {selected.levelName} - {selected.name} · {gradingPeriod?.name}
            </Text>
            {readiness[selectedIndex]?.isLoading ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={t.primary} />
            ) : !selectedReadiness || selectedReadiness.classRecords.length === 0 ? (
              <DashedEmpty icon="document-outline" title="Nothing submitted for this section yet." />
            ) : (
              selectedReadiness.classRecords.map((rec: ClassRecordRow) => (
                <View key={rec.classSubjectOfferingId} style={[styles.record, { borderTopColor: t.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recordName, { color: t.foreground }]}>{rec.subjectName}</Text>
                    {rec.isLate && <Text style={{ color: t.warning, fontSize: 12, marginTop: 2 }}>Submitted late</Text>}
                  </View>
                  <StatusBadge status={rec.status} editable={false} />
                </View>
              ))
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.iconBtn, { borderColor: t.border }, !sgsId && { opacity: 0.35 }]}
                disabled={!sgsId}
                onPress={() => setActivityOpen(true)}
              >
                <Ionicons name="chatbubbles-outline" size={20} color={t.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: t.destructive }, (!canDecide || approve.isPending) && { opacity: 0.35 }]}
                disabled={!canDecide || approve.isPending}
                onPress={() => setRejectOpen(true)}
              >
                <Text style={styles.btnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: t.success }, (!canDecide || approve.isPending) && { opacity: 0.35 }]}
                disabled={!canDecide || approve.isPending}
                onPress={() =>
                  Alert.alert('Approve section', 'Approving locks every class record in this section for this grading period.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Approve', onPress: () => approve.mutate(sgsId) },
                  ])
                }
              >
                {approve.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Approve</Text>}
              </TouchableOpacity>
            </View>
            {!canDecide && !!sgsId && (
              <Text style={[styles.hint, { color: t.muted }]}>
                {sectionStatus === SectionSubmissionStatus.Approved
                  ? 'This section is already approved.'
                  : 'Waiting for the section adviser to submit the section for review.'}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <RejectSheet
        visible={rejectOpen}
        records={(selectedReadiness?.classRecords ?? []).filter(
          (r) => r.status === ClassRecordStatus.PendingHeadReview || r.status === ClassRecordStatus.Submitted
        )}
        onClose={() => setRejectOpen(false)}
        onSubmit={async (comment, ids) => {
          await gradeSubmissionApi.rejectSection(sgsId, comment, ids);
          setRejectOpen(false);
          refresh();
          queryClient.invalidateQueries({ queryKey: ['activities'] });
        }}
      />

      <ActivitySheet
        target={
          activityOpen && sgsId
            ? { sectionGradeSubmissionId: sgsId, title: `${selected?.levelName ?? ''} - ${selected?.name ?? ''} · ${gradingPeriod?.name ?? ''}` }
            : null
        }
        onClose={() => setActivityOpen(false)}
      />
    </SafeAreaView>
  );
}

function RejectSheet({
  visible,
  records,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  records: ClassRecordRow[];
  onClose: () => void;
  onSubmit: (comment: string, returnedIds: string[]) => Promise<void>;
}) {
  const t = useDashboardTheme();
  const reason = useRef('');
  const [hasReason, setHasReason] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const close = () => {
    reason.current = '';
    setHasReason(false);
    setPicked([]);
    onClose();
  };

  const send = async () => {
    setBusy(true);
    try {
      await onSubmit(reason.current.trim(), picked);
      reason.current = '';
      setHasReason(false);
      setPicked([]);
    } catch (e) {
      Alert.alert('Could not reject', apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.title, { color: t.primary, flex: 1, fontSize: 20 }]}>Reject submission</Text>
            <TouchableOpacity onPress={close}>
              <Ionicons name="close" size={26} color={t.muted} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            A reason is required. Optionally pick the class records to return to their teachers; with none picked, the whole section is rejected.
          </Text>
          <TextInput
            style={[styles.reason, { color: t.foreground, borderColor: t.border, backgroundColor: t.card }]}
            placeholder="Reason for rejection"
            placeholderTextColor="#94A3B8"
            multiline
            onChangeText={(v) => {
              reason.current = v;
              setHasReason(v.trim().length > 0);
            }}
          />
          {records.map((r) => {
            const on = picked.includes(r.classRecordSubmissionId);
            return (
              <TouchableOpacity
                key={r.classRecordSubmissionId}
                style={[styles.pick, { borderColor: on ? t.primary : t.border, backgroundColor: t.card }]}
                onPress={() =>
                  setPicked((p) => (on ? p.filter((x) => x !== r.classRecordSubmissionId) : [...p, r.classRecordSubmissionId]))
                }
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? t.primary : t.muted} />
                <Text style={{ color: t.foreground, fontSize: 15, fontWeight: '600', flex: 1 }}>{r.subjectName}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: t.destructive, flex: 0 }, (!hasReason || busy) && { opacity: 0.4 }]}
            disabled={!hasReason || busy}
            onPress={send}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reject</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 40, gap: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: -6, marginBottom: 4, fontSize: 13 },
  periods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  period: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  periodText: { fontSize: 13, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 15.5, fontWeight: '700' },
  cardMeta: { fontSize: 12.5, marginTop: 2 },
  detail: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 4 },
  detailTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  record: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  recordName: { fontSize: 14.5, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  iconBtn: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  hint: { marginTop: 10, fontSize: 12.5 },
  reason: { minHeight: 110, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, textAlignVertical: 'top' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 12 },
});
