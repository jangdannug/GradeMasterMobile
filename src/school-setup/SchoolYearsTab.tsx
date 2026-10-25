import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { GradingPeriod, gradingPeriodsApi } from '../api/gradingPeriods';
import { SchoolYearInput, SetupSchoolYear, setupSchoolYearsApi } from '../api/schoolYears';
import {
  Badge,
  confirmDestructive,
  DashedEmpty,
  DateField,
  Field,
  FormActions,
  FormModal,
  showRowMenu,
} from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { formatDate, todayString } from './dates';
import { setupKeys, useGradingPeriods, useRefresh, useSchoolYears } from './hooks';
import { MoreButton, RowCard, TabHeader } from './SetupParts';

const inRange = (start: string, end: string, today = todayString()) => !!start && !!end && today >= start && today <= end;

// ---------------------------------------------------------------------------------------------
// School years
// ---------------------------------------------------------------------------------------------

interface YearForm {
  name: string;
  startDate: string;
  endDate: string;
  enrollmentStartDate: string;
  enrollmentEndDate: string;
  isDraft: boolean;
  activateOnStart: boolean;
}

const emptyYearForm: YearForm = {
  name: '',
  startDate: '',
  endDate: '',
  enrollmentStartDate: '',
  enrollmentEndDate: '',
  isDraft: true, // new school years default to Draft
  activateOnStart: false,
};

export default function SchoolYearsTab() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { data: schoolYears = [], isLoading, refetch } = useSchoolYears();
  const { refreshing, onRefresh } = useRefresh(refetch);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SetupSchoolYear | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<YearForm>(emptyYearForm);

  // On focus, a draft marked "activate on start" whose start date has arrived becomes active
  // (cache only, same as the web app)
  useFocusEffect(
    useCallback(() => {
      const today = todayString();
      queryClient.setQueryData<SetupSchoolYear[]>(setupKeys.schoolYears, (old) =>
        old?.map((sy) =>
          sy.activateOnStart && sy.isDraft && sy.startDate && sy.startDate <= today
            ? { ...sy, isDraft: false, isActive: true, activateOnStart: false }
            : sy
        )
      );
    }, [queryClient])
  );

  const save = useMutation({
    mutationFn: (input: SchoolYearInput) =>
      editing ? setupSchoolYearsApi.update(editing.id, input) : setupSchoolYearsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: setupKeys.schoolYears });
      Alert.alert('Saved', editing ? 'School year updated.' : 'School year added.');
      close();
    },
    onError: (e) => Alert.alert('Could not save school year', apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => setupSchoolYearsApi.remove(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<SetupSchoolYear[]>(setupKeys.schoolYears, (old = []) => old.filter((s) => s.id !== id));
      queryClient.removeQueries({ queryKey: setupKeys.gradingPeriods(id) });
      if (expandedId === id) setExpandedId(null);
      Alert.alert('Deleted', 'School year deleted.');
    },
    onError: (e) => Alert.alert('Could not delete school year', apiErrorMessage(e)),
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyYearForm);
    setOpen(true);
  };

  const openEdit = (sy: SetupSchoolYear) => {
    setEditing(sy);
    setForm({
      name: sy.name,
      startDate: sy.startDate,
      endDate: sy.endDate,
      enrollmentStartDate: sy.enrollmentStartDate,
      enrollmentEndDate: sy.enrollmentEndDate,
      isDraft: sy.isDraft,
      activateOnStart: sy.activateOnStart && !sy.isDraft,
    });
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyYearForm);
  };

  const submit = () => {
    const f = form;
    const fail = (message: string) => Alert.alert('Check the form', message);

    if (!f.name.trim() || !f.startDate || !f.endDate) return fail('Please enter name, start date, and end date');
    if (f.startDate >= f.endDate) return fail('Start date must be before end date');
    if (f.enrollmentStartDate && f.enrollmentEndDate && f.enrollmentStartDate >= f.enrollmentEndDate)
      return fail('Enrollment start must be before enrollment end');
    if (f.startDate < todayString()) return fail('Past dates cannot be saved');

    const computedActive = inRange(f.startDate, f.endDate);
    if (f.isDraft && computedActive) return fail('Active school year cannot be saved as Draft');

    save.mutate({
      name: f.name.trim(),
      startDate: f.startDate,
      endDate: f.endDate,
      enrollmentStartDate: f.enrollmentStartDate,
      enrollmentEndDate: f.enrollmentEndDate,
      isActive: computedActive && !f.isDraft,
      isDraft: f.isDraft,
      activateOnStart: f.activateOnStart,
    });
  };

  // "Active school year can NOT be modified or deleted" (and neither can a locked one)
  const guard = (sy: SetupSchoolYear, action: 'modified' | 'deleted') => {
    if (sy.isLocked) {
      Alert.alert('Locked', `A locked school year cannot be ${action}.`);
      return true;
    }
    if (sy.isActive) {
      Alert.alert('Active school year', `An active school year cannot be ${action}.`);
      return true;
    }
    return false;
  };

  const askDelete = (sy: SetupSchoolYear) => {
    if (sy.isLocked) return Alert.alert('Cannot delete', 'Cannot delete a locked school year');
    if (sy.isActive) return Alert.alert('Cannot delete', 'Cannot delete an active school year');
    confirmDestructive('Delete school year', `Delete ${sy.name}?`, () => remove.mutate(sy.id));
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={schoolYears}
        keyExtractor={(sy) => sy.id}
        contentContainerStyle={styles.list}
        extraData={expandedId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        ListHeaderComponent={
          <View>
            <TabHeader icon="calendar" title="School Years" addLabel="Add School Year" onAdd={openAdd} />
            <View style={[styles.banner, { backgroundColor: t.warningTint, borderColor: t.warning }]}>
              <Ionicons name="warning" size={18} color={t.warning} />
              <Text style={[styles.bannerText, { color: t.foreground }]}>
                A school year becomes Active automatically on its start date. Active school year can NOT be modified
                or deleted. Mark it as Draft to prevent accidental activation.
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : (
            <DashedEmpty
              icon="calendar-outline"
              title="No school years defined yet."
              subtitle="Add your first school year to get started."
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item: sy }) => {
          const expanded = expandedId === sy.id;
          const locked = sy.isActive || sy.isLocked;
          const enrollment =
            sy.enrollmentStartDate && sy.enrollmentEndDate
              ? `Enrollment: ${formatDate(sy.enrollmentStartDate)} → ${formatDate(sy.enrollmentEndDate)}`
              : '';
          return (
            <RowCard highlighted={sy.isActive && !sy.isDraft}>
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.rowMain}
                  activeOpacity={0.7}
                  onPress={() => setExpandedId(expanded ? null : sy.id)}
                >
                  <View style={styles.nameRow}>
                    <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color={t.muted} />
                    <Text style={[styles.name, { color: t.foreground }]}>{sy.name}</Text>
                  </View>
                  <Text style={[styles.meta, { color: t.muted }]}>
                    {formatDate(sy.startDate)} → {formatDate(sy.endDate)}
                  </Text>
                  {!!enrollment && <Text style={[styles.meta, { color: t.muted }]}>{enrollment}</Text>}
                  <View style={styles.badges}>
                    {sy.isActive && !sy.isDraft && <Badge label="Active" tone="success" />}
                    {sy.isDraft && <Badge label="Draft" tone="warning" />}
                    {sy.isLocked && <Badge label="Locked" tone="danger" />}
                    {sy.activateOnStart && !sy.isActive && <Badge label="auto-activate" tone="primary" outline />}
                  </View>
                </TouchableOpacity>
                <MoreButton
                  disabled={locked}
                  onPress={() => {
                    if (locked) {
                      guard(sy, 'modified');
                      return;
                    }
                    showRowMenu(sy.name, [
                      { label: 'Edit', onPress: () => openEdit(sy) },
                      { label: 'Delete', destructive: true, onPress: () => askDelete(sy) },
                    ]);
                  }}
                />
              </View>
              {expanded && <GradingPeriodsSection schoolYear={sy} />}
            </RowCard>
          );
        }}
      />

      <FormModal visible={open} title={editing ? 'Edit School Year' : 'Add School Year'} onClose={close}>
        <Field
          label="Name"
          value={form.name}
          onChangeText={(v) => setForm({ ...form, name: v })}
          placeholder="e.g. SY 2025-2026"
        />
        <DateField label="Start Date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
        <DateField label="End Date" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
        <DateField
          label="Enrollment Start (optional)"
          value={form.enrollmentStartDate}
          clearable
          onChange={(v) => setForm({ ...form, enrollmentStartDate: v })}
        />
        <DateField
          label="Enrollment End (optional)"
          value={form.enrollmentEndDate}
          clearable
          onChange={(v) => setForm({ ...form, enrollmentEndDate: v })}
        />

        <Text style={[styles.optionsLabel, { color: t.muted }]}>Options</Text>
        {/* Mutually exclusive, but each can be toggled off again */}
        <OptionCard
          title="Mark as Draft"
          subtitle="Prevent accidental activation"
          selected={form.isDraft}
          onPress={() => setForm({ ...form, isDraft: !form.isDraft, activateOnStart: false })}
        />
        <OptionCard
          title="Activate on Start Date"
          subtitle={
            form.startDate ? `Auto-activates on ${formatDate(form.startDate)}` : 'Auto-activates on the start date'
          }
          selected={form.activateOnStart}
          onPress={() => setForm({ ...form, activateOnStart: !form.activateOnStart, isDraft: false })}
        />

        <FormActions
          confirmLabel={editing ? 'Update' : 'Add'}
          saving={save.isPending}
          onCancel={close}
          onConfirm={submit}
        />
      </FormModal>
    </View>
  );
}

function OptionCard({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useDashboardTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.option,
        {
          borderColor: selected ? t.primary : t.border,
          backgroundColor: selected ? t.primaryTint : t.card,
        },
      ]}
    >
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? t.primary : t.muted} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionTitle, { color: t.foreground }]}>{title}</Text>
        <Text style={[styles.meta, { color: t.muted, marginTop: 2 }]}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------------------------
// Grading periods (shown under an expanded school year)
// ---------------------------------------------------------------------------------------------

interface PeriodForm {
  code: string;
  sequenceNo: string;
  name: string;
  startDate: string;
  endDate: string;
}

function GradingPeriodsSection({ schoolYear }: { schoolYear: SetupSchoolYear }) {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useGradingPeriods(schoolYear.id, true);
  const periods = [...data].sort((a, b) => a.sequenceNo - b.sequenceNo);
  const key = setupKeys.gradingPeriods(schoolYear.id);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GradingPeriod | null>(null);
  const [form, setForm] = useState<PeriodForm>({ code: '', sequenceNo: '1', name: '', startDate: '', endDate: '' });

  const disabled = schoolYear.isActive || schoolYear.isLocked;

  // A saved period that is active today makes the others in the same school year inactive
  const applyToCache = (saved: GradingPeriod, mode: 'add' | 'replace') =>
    queryClient.setQueryData<GradingPeriod[]>(key, (old = []) => {
      const next = mode === 'add' ? [...old, saved] : old.map((p) => (p.id === saved.id ? saved : p));
      return saved.isActive ? next.map((p) => (p.id === saved.id ? p : { ...p, isActive: false })) : next;
    });

  const save = useMutation({
    mutationFn: () => {
      const input = {
        code: form.code.trim(),
        name: form.name.trim(),
        sequenceNo: Number(form.sequenceNo),
        startDate: form.startDate,
        endDate: form.endDate,
      };
      return editing
        ? gradingPeriodsApi.update(editing.id, input)
        : gradingPeriodsApi.create({ ...input, schoolYearId: schoolYear.id });
    },
    onSuccess: (saved) => {
      applyToCache(saved, editing ? 'replace' : 'add');
      Alert.alert('Saved', editing ? 'Grading period updated.' : 'Grading period added.');
      close();
    },
    onError: (e) => Alert.alert('Could not save grading period', apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => gradingPeriodsApi.remove(id),
    onSuccess: (_, id) =>
      queryClient.setQueryData<GradingPeriod[]>(key, (old = []) => old.filter((p) => p.id !== id)),
    onError: (e) => Alert.alert('Could not delete grading period', apiErrorMessage(e)),
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ code: '', sequenceNo: String(periods.length + 1), name: '', startDate: '', endDate: '' });
    setOpen(true);
  };

  const openEdit = (p: GradingPeriod) => {
    setEditing(p);
    setForm({
      code: p.code,
      sequenceNo: String(p.sequenceNo),
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
    });
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  const submit = () => {
    const fail = (message: string) => Alert.alert('Check the form', message);
    const seq = Number(form.sequenceNo);

    if (!form.code.trim() || !form.name.trim()) return fail('Please enter code and name');
    if (!Number.isInteger(seq) || seq < 1) return fail('Sequence number must be 1 or greater');
    if (periods.some((p) => p.sequenceNo === seq && p.id !== editing?.id))
      return fail('Sequence number already exists for this school year');
    if (!form.startDate || !form.endDate) return fail('Please enter start date and end date');
    if (form.startDate >= form.endDate) return fail('Start date must be before end date');

    save.mutate();
  };

  const guardAction = () => {
    Alert.alert(
      schoolYear.isLocked ? 'Locked' : 'Active school year',
      'Grading periods of an active or locked school year cannot be changed.'
    );
  };

  const formActive = inRange(form.startDate, form.endDate);

  return (
    <View style={[styles.periods, { borderLeftColor: t.border }]}>
      <View style={styles.periodsHeader}>
        <Text style={[styles.periodsTitle, { color: t.foreground }]}>Grading Periods</Text>
        <TouchableOpacity
          style={[styles.periodAdd, { borderColor: t.border }, disabled && { opacity: 0.4 }]}
          onPress={disabled ? guardAction : openAdd}
        >
          <Ionicons name="add" size={16} color={t.primary} />
          <Text style={[styles.periodAddText, { color: t.primary }]}>Add Period</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? null : periods.length === 0 ? (
        <Text style={[styles.meta, { color: t.muted }]}>No grading periods defined.</Text>
      ) : (
        periods.map((p) => (
          <View key={p.id} style={[styles.periodRow, { borderTopColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={[styles.periodName, { color: t.foreground }]}>
                  {p.sequenceNo}. {p.name}
                </Text>
                {p.isActive && <Badge label="Active" tone="success" />}
                {p.isLocked && <Badge label="Locked" tone="danger" outline />}
              </View>
              <Text style={[styles.meta, { color: t.muted }]}>
                {p.code} · {formatDate(p.startDate)} → {formatDate(p.endDate)}
              </Text>
            </View>
            <MoreButton
              disabled={disabled}
              onPress={() => {
                if (disabled) return guardAction();
                showRowMenu(p.name, [
                  { label: 'Edit', onPress: () => openEdit(p) },
                  {
                    label: 'Delete',
                    destructive: true,
                    onPress: () =>
                      confirmDestructive('Delete grading period', `Delete ${p.name}?`, () => remove.mutate(p.id)),
                  },
                ]);
              }}
            />
          </View>
        ))
      )}

      <FormModal visible={open} title={editing ? 'Edit Grading Period' : 'Add Grading Period'} onClose={close}>
        <Field
          label="Code"
          value={form.code}
          onChangeText={(v) => setForm({ ...form, code: v })}
          placeholder="e.g. Q1"
          maxLength={30}
          autoCapitalize="characters"
        />
        <Field
          label="Sequence No."
          value={form.sequenceNo}
          onChangeText={(v) => setForm({ ...form, sequenceNo: v.replace(/\D/g, '') })}
          keyboardType="number-pad"
        />
        <Field
          label="Name"
          value={form.name}
          onChangeText={(v) => setForm({ ...form, name: v })}
          placeholder="e.g. First Quarter"
          maxLength={100}
        />
        <DateField label="Start Date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
        <DateField label="End Date" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
        <View style={styles.autoActive}>
          <Badge label={formActive ? 'Auto-active' : 'Inactive'} tone={formActive ? 'success' : 'muted'} />
          <Text style={[styles.meta, { color: t.muted, marginTop: 0 }]}>Based on today's date and the dates above</Text>
        </View>
        <FormActions
          confirmLabel={editing ? 'Update' : 'Add'}
          saving={save.isPending}
          onCancel={close}
          onConfirm={submit}
        />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 32 },
  banner: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  bannerText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowMain: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 4, fontSize: 12.5, lineHeight: 18 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  optionsLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  periods: { marginTop: 14, marginLeft: 8, paddingLeft: 12, borderLeftWidth: 2 },
  periodsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  periodsTitle: { fontSize: 14, fontWeight: '700' },
  periodAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  periodAddText: { fontSize: 12.5, fontWeight: '700' },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  periodName: { fontSize: 14.5, fontWeight: '700' },
  autoActive: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
});
