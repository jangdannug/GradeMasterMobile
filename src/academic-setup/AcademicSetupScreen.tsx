import React, { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SelectField } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useSchoolYears } from '../school-setup/hooks';
import { AcademicSetupProvider, useAcademicSetup } from './AcademicSetupContext';
import AssignSchemesStep from './AssignSchemesStep';
import GradeLevelsSubjectsStep from './GradeLevelsSubjectsStep';
import GradingSchemesStep from './GradingSchemesStep';
import ReviewActivateStep from './ReviewActivateStep';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const STEPS: { label: string; icon: IconName }[] = [
  { label: 'Grade Levels & Subjects', icon: 'school' },
  { label: 'Grading Schemes', icon: 'clipboard' },
  { label: 'Assign Schemes', icon: 'swap-horizontal' },
  { label: 'Review & Activate', icon: 'checkmark-circle' },
];

type StepStatus = 'complete' | 'current' | 'locked';

// Every query Academic Setup reads; pull-to-refresh refetches all of them
const REFRESH_ROOTS = new Set([
  'school-years',
  'grade-levels',
  'grade-level-subjects',
  'subjects',
  'grading-schemes',
  'scheme-subjects',
  'grading-components',
  'grading-items',
  'transmutation-tables',
  'transmutation-entries',
  'grading-descriptors',
  'descriptor-entries',
]);

export default function AcademicSetupScreen() {
  const t = useDashboardTheme();
  const { data: schoolYears = [] } = useSchoolYears();
  const [selectedId, setSelectedId] = useState('');

  // Auto-select the active school year (else the first one)
  useEffect(() => {
    if (selectedId || schoolYears.length === 0) return;
    const active = schoolYears.find((sy) => sy.isActive && !sy.isDraft) ?? schoolYears[0];
    setSelectedId(active.id);
  }, [schoolYears, selectedId]);

  const selected = schoolYears.find((sy) => sy.id === selectedId);
  const options = schoolYears.map((sy) => ({
    value: sy.id,
    label: `${sy.name}${sy.isActive && !sy.isDraft ? ' (Active)' : sy.isDraft ? ' (Draft)' : ''}`,
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.primary }]}>Academic Setup</Text>
        <Text style={[styles.subtitle, { color: t.muted }]}>
          Build grade levels and subjects, define grading schemes, assign schemes to subjects, then review and activate
          — in that order
        </Text>
      </View>

      <View style={styles.selector}>
        <SelectField
          label="School Year"
          value={selectedId}
          options={options}
          placeholder="Select a school year"
          onChange={setSelectedId}
        />
      </View>

      {selected ? (
        // Keyed so every school year gets fresh wizard state (and re-runs the resume logic)
        <AcademicSetupProvider key={selected.id} schoolYear={selected}>
          <Wizard />
        </AcademicSetupProvider>
      ) : (
        <View style={styles.emptyWrap}>
          <Ionicons name="school-outline" size={44} color={t.muted} />
          <Text style={[styles.emptyTitle, { color: t.foreground }]}>
            Select a school year above to start the setup wizard
          </Text>
          <Text style={[styles.emptyHint, { color: t.muted }]}>
            Steps: Grade Levels & Subjects → Grading Schemes → Assign Schemes → Review & Activate
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function Wizard() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { completion, hints, isLoading, schoolYear, isReadOnly } = useAcademicSetup();
  const [step, setStep] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const resumed = useRef(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Resume: once the data is first available, jump to the first incomplete step (or step 1 if all
  // are done). After that the wizard never moves on its own; only Back/Next or the stepper do.
  useEffect(() => {
    if (isLoading || resumed.current) return;
    resumed.current = true;
    const firstIncomplete = completion.findIndex((done) => !done);
    setStep(firstIncomplete === -1 ? 0 : firstIncomplete);
  }, [isLoading, completion]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  // A step is locked when any earlier step is incomplete
  const status = (index: number): StepStatus => {
    if (completion[index]) return 'complete';
    return completion.slice(0, index).every(Boolean) ? 'current' : 'locked';
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ predicate: (q) => REFRESH_ROOTS.has(String(q.queryKey[0])) });
    } finally {
      setRefreshing(false);
    }
  };

  const last = step === STEPS.length - 1;
  const stepDone = completion[step];
  const hint = stepDone
    ? last
      ? 'Setup complete — the active scheme is now in effect.'
      : 'Step complete.'
    : hints[step];

  return (
    <View style={styles.wizard}>
      {isReadOnly && (
        <View style={[styles.pill, { backgroundColor: t.secondaryTint, borderColor: t.border }]}>
          <Ionicons name="eye" size={15} color={t.muted} />
          <Text style={[styles.pillText, { color: t.muted }]}>
            {schoolYear.isLocked ? 'School year is locked — view only' : 'School year is not an active draft — view only'}
          </Text>
        </View>
      )}

      {/* Stepper */}
      <View style={[styles.stepperWrap, { borderBottomColor: t.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepper}>
          {STEPS.map((s, i) => {
            const st = status(i);
            const selected = i === step;
            const locked = st === 'locked';
            const tint = st === 'complete' ? t.success : selected ? t.primary : t.muted;
            return (
              <TouchableOpacity
                key={s.label}
                disabled={locked}
                onPress={() => setStep(i)}
                activeOpacity={0.7}
                style={[
                  styles.stepChip,
                  { borderColor: selected ? t.primary : t.border, backgroundColor: selected ? t.primaryTint : t.card },
                  locked && { opacity: 0.45 },
                ]}
              >
                <View style={[styles.stepIcon, { backgroundColor: st === 'complete' ? t.successTint : t.secondaryTint }]}>
                  {st === 'complete' ? (
                    <Ionicons name="checkmark" size={14} color={t.success} />
                  ) : locked ? (
                    <Ionicons name="lock-closed" size={12} color={t.muted} />
                  ) : (
                    <Text style={[styles.stepNumber, { color: tint }]}>{i + 1}</Text>
                  )}
                </View>
                <View>
                  <Text style={[styles.stepLabel, { color: selected ? t.primary : t.foreground }]}>{s.label}</Text>
                  <Text style={[styles.stepSub, { color: tint }]}>
                    Step {i + 1} of {STEPS.length}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        {step === 0 && <GradeLevelsSubjectsStep />}
        {step === 1 && <GradingSchemesStep />}
        {step === 2 && <AssignSchemesStep />}
        {step === 3 && <ReviewActivateStep />}
      </ScrollView>

      {/* Sticky footer */}
      <View style={[styles.footer, { backgroundColor: t.card, borderTopColor: t.border }]}>
        <Text style={[styles.hint, { color: stepDone ? t.success : t.warning }]} numberOfLines={3}>
          {hint}
        </Text>
        <View style={styles.footerButtons}>
          <TouchableOpacity
            style={[styles.back, { borderColor: t.border }, step === 0 && { opacity: 0.4 }]}
            disabled={step === 0}
            onPress={() => setStep(step - 1)}
          >
            <Ionicons name="arrow-back" size={16} color={t.foreground} />
            <Text style={[styles.backText, { color: t.foreground }]}>Back</Text>
          </TouchableOpacity>
          {!last && (
            <TouchableOpacity
              style={[styles.next, { backgroundColor: t.primary }, !stepDone && { opacity: 0.4 }]}
              disabled={!stepDone}
              onPress={() => setStep(step + 1)}
              activeOpacity={0.85}
            >
              <Text style={styles.nextText} numberOfLines={1}>
                Next: {STEPS[step + 1].label}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  selector: { paddingHorizontal: 20, paddingTop: 6 },
  wizard: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12.5, fontWeight: '600' },
  stepperWrap: { borderBottomWidth: 1 },
  stepper: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  stepIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { fontSize: 12.5, fontWeight: '800' },
  stepLabel: { fontSize: 13, fontWeight: '700' },
  stepSub: { fontSize: 11, marginTop: 1 },
  content: { padding: 16, paddingBottom: 28 },
  footer: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 10 },
  hint: { fontSize: 12.5, fontWeight: '600' },
  footerButtons: { flexDirection: 'row', gap: 10 },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  backText: { fontSize: 14.5, fontWeight: '700' },
  next: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  nextText: { color: '#fff', fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', textAlign: 'center' },
  emptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
