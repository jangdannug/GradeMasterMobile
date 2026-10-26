import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '../api';
import { SheetRow } from '../api/gradeSubmission';
import { DashedEmpty, SearchInput } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useGradingPeriods, useSchoolYears } from '../school-setup/hooks';
import { todayString } from '../school-setup/dates';
import ActivitySheet from './ActivitySheet';
import ClassPicker from './ClassPicker';
import {
  ClassRecordStatus,
  classRecordStatusValue,
  formatRowName,
  shortPeriodName,
  matchesStudentSearch,
  parseSearchTokens,
} from './logic';
import { SheetBadges } from './StatusBadges';
import StudentScoreCard from './StudentScoreCard';
import { classRecordKeys, useGradingSheet, useTeacherClasses } from './useGradingSheet';

/** Teacher tab: pick a class and grading period, enter scores, save, submit or withdraw */
export default function GradingSheetScreen() {
  const t = useDashboardTheme();
  const schoolYears = useSchoolYears();
  const schoolYear = useMemo(
    () => (schoolYears.data ?? []).find((s) => s.isActive && !s.isDraft) ?? (schoolYears.data ?? []).find((s) => s.isActive),
    [schoolYears.data]
  );
  const periodsQuery = useGradingPeriods(schoolYear?.id ?? '', !!schoolYear);
  const periods = useMemo(
    () => [...(periodsQuery.data ?? [])].sort((a, b) => a.sequenceNo - b.sequenceNo),
    [periodsQuery.data]
  );

  const [pickedPeriodId, setPickedPeriodId] = useState('');
  const gradingPeriod = useMemo(() => {
    const picked = periods.find((p) => p.id === pickedPeriodId);
    if (picked) return picked;
    const today = todayString();
    return periods.find((p) => today >= p.startDate && today <= p.endDate) ?? periods[0];
  }, [periods, pickedPeriodId]);

  const classes = useTeacherClasses(schoolYear?.id ?? '', gradingPeriod?.id ?? '');
  const [offeringId, setOfferingId] = useState('');
  const [pickerOpen, setPickerOpen] = useState(true);
  const card = classes.cards.find((c) => c.offeringId === offeringId);

  const g = useGradingSheet({ schoolYear, gradingPeriod, card });
  const record = card ? classes.recordByOffering.get(card.offeringId) : undefined;

  // ---- Search + focus order ---------------------------------------------------------------------
  const [tokens, setTokens] = useState<string[]>([]);
  const onSearch = useCallback((term: string) => setTokens(parseSearchTokens(term)), []);
  const visibleRows = useMemo(() => g.rows.filter((r) => matchesStudentSearch(r, tokens)), [g.rows, tokens]);

  const inputs = useRef(new Map<string, React.ComponentRef<typeof TextInput>>());
  const registerRef = useCallback((key: string, input: React.ComponentRef<typeof TextInput> | null) => {
    if (input) inputs.current.set(key, input);
    else inputs.current.delete(key);
  }, []);
  const orderRef = useRef<string[]>([]);
  useEffect(() => {
    orderRef.current = visibleRows.flatMap((r) =>
      g.components.flatMap((c) => (c.items.length === 0 ? [`${r.enrollmentId}:${c.id}`] : c.items.map((i) => `${r.enrollmentId}:${i.id}`)))
    );
  }, [visibleRows, g.components]);
  const onNext = useCallback((enrollmentId: string, itemId: string) => {
    const order = orderRef.current;
    const at = order.indexOf(`${enrollmentId}:${itemId}`);
    for (let i = at + 1; i < order.length; i++) {
      const next = inputs.current.get(order[i]);
      if (next) {
        next.focus();
        return;
      }
    }
  }, []);

  // ---- Actions ----------------------------------------------------------------------------------
  const [busy, setBusy] = useState<'' | 'save' | 'submit' | 'withdraw'>('');
  const [activityOpen, setActivityOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const run = async (kind: 'save' | 'submit' | 'withdraw', action: () => Promise<unknown>, done: string) => {
    setBusy(kind);
    try {
      await action();
      if (done) Alert.alert(done);
    } catch (e) {
      Alert.alert(`Could not ${kind === 'save' ? 'save scores' : kind === 'submit' ? 'submit' : 'withdraw'}`, apiErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  const confirmSubmit = () =>
    Alert.alert(
      'Submit for review',
      `Submit ${card?.subjectName ?? 'this class'} for ${gradingPeriod?.name ?? 'this grading period'}? You cannot edit scores while it is under review.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: () => run('submit', g.submit, 'Submitted for review') },
      ]
    );
  const confirmWithdraw = () =>
    Alert.alert('Withdraw submission', 'Withdraw this submission so you can edit the scores again?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: () => run('withdraw', g.withdraw, 'Submission withdrawn') },
    ]);
  const confirmReset = () =>
    Alert.alert('Discard changes', 'Revert all unsaved score changes?', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: g.resetDraft },
    ]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([classes.refetch(), g.sheet || card ? g.refetch() : Promise.resolve()]);
    } finally {
      setRefreshing(false);
    }
  };

  const status = g.sheet?.submissionStatus;
  const canWithdraw =
    (classRecordStatusValue(status) === ClassRecordStatus.Submitted ||
      classRecordStatusValue(status) === ClassRecordStatus.PendingHeadReview) &&
    g.isGpOpen &&
    !g.isSyLocked &&
    !g.isRedacted;
  const sgsId = record?.sectionGradeSubmissionId ?? '';
  const showActions = !!card && !!g.sheet && !g.isRedacted;
  const periodLabel = gradingPeriod ? gradingPeriod.name : '';

  const renderRow = useCallback(
    ({ item }: { item: SheetRow }) => (
      <StudentScoreCard
        enrollmentId={item.enrollmentId}
        name={formatRowName(item)}
        tokens={tokens}
        components={g.components}
        highest={g.highest}
        itemWeights={g.itemWeights}
        scores={g.draft[item.enrollmentId]}
        transmutationRows={g.transmutationRows}
        descriptorRows={g.descriptorRows}
        validation={g.validations.get(item.enrollmentId)}
        canEnter={g.canEnter}
        version={g.version}
        registerRef={registerRef}
        onScore={g.setScore}
        onNext={onNext}
      />
    ),
    [tokens, g.components, g.highest, g.itemWeights, g.draft, g.descriptorRows, g.transmutationRows, g.validations, g.canEnter, g.version, registerRef, g.setScore, onNext]
  );

  const header = (
    <View>
      {periods.length > 0 && (
        <View style={styles.periods}>
          {periods.map((p) => {
            const active = p.id === gradingPeriod?.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.period, { borderColor: active ? t.primary : t.border, backgroundColor: active ? t.primaryTint : t.card }]}
                onPress={() => setPickedPeriodId(p.id)}
              >
                <Text style={[styles.periodText, { color: active ? t.primary : t.muted }]}>{shortPeriodName(p.name)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!schoolYear && !schoolYears.isLoading ? (
        <DashedEmpty icon="calendar-outline" title="No active school year." subtitle="Scores can be entered once a school year is active." />
      ) : card && !pickerOpen ? (
        <TouchableOpacity
          style={[styles.selected, { backgroundColor: t.card, borderColor: t.border }]}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.selectedTitle, { color: t.foreground }]} numberOfLines={1}>
              {card.subjectName}
            </Text>
            <Text style={[styles.selectedMeta, { color: t.muted }]} numberOfLines={1}>
              {schoolYear ? `S.Y. ${schoolYear.name} · ` : ''}{card.gradeLevelName} - {card.sectionName}
            </Text>
          </View>
          <Text style={[styles.change, { color: t.primary }]}>Change</Text>
        </TouchableOpacity>
      ) : (
        <ClassPicker
          groups={classes.groups}
          loading={classes.isLoading || schoolYears.isLoading}
          selectedId={offeringId}
          recordByOffering={classes.recordByOffering}
          onSelect={(c) => {
            if (g.isDirty && c.offeringId !== offeringId) {
              Alert.alert('Unsaved changes', 'Switching class will discard your unsaved scores.', [
                { text: 'Stay', style: 'cancel' },
                {
                  text: 'Switch',
                  style: 'destructive',
                  onPress: () => {
                    setOfferingId(c.offeringId);
                    setPickerOpen(false);
                  },
                },
              ]);
              return;
            }
            setOfferingId(c.offeringId);
            setPickerOpen(false);
          }}
        />
      )}

      {card && g.isLoading && <ActivityIndicator style={{ marginVertical: 24 }} color={t.primary} />}
      {card && !g.isLoading && !!g.error && (
        <DashedEmpty icon="alert-circle-outline" title="Could not load the scoresheet." subtitle={apiErrorMessage(g.error)} />
      )}

      {card && g.sheet && (
        <View style={{ marginTop: 10, gap: 8 }}>
          {g.isRedacted && (
            <View style={[styles.note, { backgroundColor: t.warningTint }]}>
              <Text style={{ color: t.warning, fontSize: 13, fontWeight: '600' }}>
                You are not the subject teacher of this class. Only final grades are shown.
              </Text>
            </View>
          )}
          <SheetBadges
            hasSheet
            status={g.sheet.submissionStatus}
            editable={g.editable}
            isGpOpen={g.isGpOpen}
            isSyActive={g.syActive}
            isLate={g.sheet.isLate}
            submittedAt={g.sheet.submittedAt}
            isDirty={g.isDirty}
            justSaved={g.justSaved}
            overMaxCount={g.overMaxCount}
            blankCount={g.blankCount}
            isSubmitted={!!g.sheet.classRecordSubmissionId && g.sheet.submissionStatus !== ClassRecordStatus.Draft}
          />
          <SearchInput placeholder="Search student name..." onSearch={onSearch} />
          <Text style={[styles.count, { color: t.muted }]}>
            {visibleRows.length} student{visibleRows.length === 1 ? '' : 's'}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={[]}>
      <FlatList
        data={card && g.sheet ? visibleRows : []}
        keyExtractor={(r) => r.enrollmentId}
        renderItem={renderRow}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={4}
        windowSize={5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        ItemSeparatorComponent={RowSeparator}
        ListEmptyComponent={
          card && g.sheet ? (
            <DashedEmpty icon="people-outline" title={tokens.length ? 'No students match your search.' : 'No students enrolled in this class.'} />
          ) : undefined
        }
      />

      {showActions && (
        <View style={[styles.bar, { backgroundColor: t.card, borderTopColor: t.border }]}>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: t.border }, !sgsId && { opacity: 0.35 }]}
            disabled={!sgsId}
            onPress={() => setActivityOpen(true)}
          >
            <Ionicons name="chatbubbles-outline" size={20} color={t.primary} />
          </TouchableOpacity>
          {g.isDirty && (
            <TouchableOpacity style={[styles.iconBtn, { borderColor: t.border }]} onPress={confirmReset} disabled={!!busy}>
              <Ionicons name="arrow-undo-outline" size={20} color={t.muted} />
            </TouchableOpacity>
          )}
          {canWithdraw ? (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: t.warning }, busy === 'withdraw' && { opacity: 0.6 }]}
              onPress={confirmWithdraw}
              disabled={!!busy}
            >
              {busy === 'withdraw' ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Withdraw</Text>}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.btn, styles.btnOutline, { borderColor: t.primary }, (g.gates.blocksSave || !g.isDirty || !!busy) && { opacity: 0.4 }]}
                disabled={g.gates.blocksSave || !g.isDirty || !!busy}
                onPress={() => run('save', g.save, '')}
              >
                {busy === 'save' ? <ActivityIndicator color={t.primary} /> : <Text style={[styles.btnText, { color: t.primary }]}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: t.primary }, (g.gates.blocksSubmit || !!busy) && { opacity: 0.4 }]}
                disabled={g.gates.blocksSubmit || !!busy}
                onPress={confirmSubmit}
              >
                {busy === 'submit' ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <ActivitySheet
        target={
          activityOpen && sgsId
            ? {
                sectionGradeSubmissionId: sgsId,
                classRecordSubmissionId: g.sheet?.classRecordSubmissionId || undefined,
                title: `${card?.subjectName ?? ''} · ${card?.gradeLevelName ?? ''} - ${card?.sectionName ?? ''} · ${periodLabel}`,
              }
            : null
        }
        onClose={() => setActivityOpen(false)}
      />
    </SafeAreaView>
  );
}

// keep the keys export reachable for other screens invalidating the sheet
export { classRecordKeys };

// Module-level so the list keeps the same component type between renders (an inline one remounts every separator on each keystroke)
const RowSeparator = () => <View style={{ height: 8 }} />;


const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 3, marginBottom: 14, fontSize: 13 },
  periods: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  period: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: 999, paddingVertical: 6 },
  periodText: { fontSize: 12.5, fontWeight: '700' },
  selected: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  selectedTitle: { fontSize: 15.5, fontWeight: '700' },
  selectedMeta: { fontSize: 12.5, marginTop: 2 },
  change: { fontSize: 13.5, fontWeight: '700' },
  note: { borderRadius: 12, padding: 12 },
  count: { fontSize: 12.5, fontWeight: '600' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1 },
  iconBtn: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { borderWidth: 1.5, backgroundColor: 'transparent' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
