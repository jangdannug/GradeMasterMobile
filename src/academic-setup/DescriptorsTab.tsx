import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { DescriptorEntry, GradingDescriptorSet, gradingDescriptorsApi } from '../api/gradingDescriptors';
import { Badge, confirmDestructive, DashedEmpty, Field, FormActions, FormModal, showRowMenu } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { MoreButton, TabHeader } from '../school-setup/SetupParts';
import { useAcademicSetup } from './AcademicSetupContext';
import { parseGrade, rangesOverlap, SetFormModal } from './GradingSetParts';
import { academicKeys } from './keys';

const READ_ONLY_MESSAGE = 'School year must be an active, unlocked draft to change grading descriptors';

// Fixed palette for the descriptor color picker
const SWATCHES = ['#16a34a', '#22c55e', '#0ea5e9', '#2563eb', '#8b5cf6', '#f59e0b', '#f97316', '#dc2626', '#64748b'];

export default function DescriptorsTab() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { isReadOnly } = useAcademicSetup();
  const { data: sets = [], isLoading } = useQuery({
    queryKey: academicKeys.descriptorSets,
    queryFn: gradingDescriptorsApi.list,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GradingDescriptorSet | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: academicKeys.descriptorSets });

  const save = useMutation({
    mutationFn: (v: { code: string; name: string }) =>
      editing ? gradingDescriptorsApi.update(editing.id, v) : gradingDescriptorsApi.create(v),
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      refresh();
    },
    onError: (e) => Alert.alert('Could not save descriptor set', apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => gradingDescriptorsApi.remove(id),
    onSuccess: refresh,
    onError: (e) => Alert.alert('Could not delete descriptor set', apiErrorMessage(e)),
  });

  const blocked = () => {
    if (!isReadOnly) return false;
    Alert.alert('View only', READ_ONLY_MESSAGE);
    return true;
  };

  const openMenu = (set: GradingDescriptorSet) =>
    showRowMenu(set.name, [
      {
        label: 'Edit',
        onPress: () => {
          if (blocked()) return;
          if (set.isLocked) return Alert.alert('Locked', 'Cannot edit a locked descriptor set');
          setEditing(set);
          setFormOpen(true);
        },
      },
      {
        label: 'Delete',
        destructive: true,
        onPress: () => {
          if (blocked()) return;
          if (set.isLocked) return Alert.alert('Locked', 'Cannot delete a locked descriptor set');
          confirmDestructive('Delete descriptor set', `Delete ${set.name}?`, () => remove.mutate(set.id));
        },
      },
    ]);

  return (
    <View>
      <TabHeader
        icon="color-palette"
        title="Grading Descriptors"
        addLabel="Add Set"
        onAdd={() => {
          if (blocked()) return;
          setEditing(null);
          setFormOpen(true);
        }}
      />

      {isLoading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color={t.primary} />
      ) : sets.length === 0 ? (
        <DashedEmpty icon="color-palette-outline" title="No descriptor sets yet." subtitle="Add a set to label grade ranges." />
      ) : (
        sets.map((set) => {
          const expanded = expandedId === set.id;
          return (
            <View key={set.id} style={[styles.row, { borderColor: t.border, backgroundColor: t.card }]}>
              <View style={styles.rowTop}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.7}
                  onPress={() => setExpandedId(expanded ? null : set.id)}
                >
                  <View style={styles.nameRow}>
                    <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color={t.muted} />
                    <Text style={[styles.name, { color: t.foreground }]}>{set.name}</Text>
                    {set.isLocked && <Badge label="Locked" tone="danger" />}
                  </View>
                  <Text style={[styles.meta, { color: t.muted }]}>{set.code}</Text>
                </TouchableOpacity>
                <MoreButton disabled={isReadOnly || set.isLocked} onPress={() => openMenu(set)} />
              </View>
              {expanded && <EntriesList set={set} />}
            </View>
          );
        })
      )}

      <SetFormModal
        visible={formOpen}
        title={editing ? 'Edit Descriptor Set' : 'Add Descriptor Set'}
        initial={editing ? { code: editing.code, name: editing.name } : null}
        existingCodes={sets.filter((x) => x.id !== editing?.id).map((x) => x.code.toLowerCase())}
        duplicateMessage="A descriptor set with this code already exists"
        saving={save.isPending}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={(v) => save.mutate(v)}
      />
    </View>
  );
}

// ---- Entries ----------------------------------------------------------------------------------

function EntriesList({ set }: { set: GradingDescriptorSet }) {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { isReadOnly } = useAcademicSetup();
  const viewOnly = isReadOnly || set.isLocked;
  const { data: entries = [], isLoading } = useQuery({
    queryKey: academicKeys.descriptorEntries(set.id),
    queryFn: () => gradingDescriptorsApi.entries(set.id),
  });
  const [form, setForm] = useState<{ entry: DescriptorEntry | null } | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: academicKeys.descriptorEntries(set.id) });

  const save = useMutation({
    mutationFn: (v: { minGrade: number; maxGrade: number; descriptor: string; descriptorColor: string }) => {
      const nextOrder = entries.reduce((max, e) => Math.max(max, e.sortOrder), 0) + 1;
      return form?.entry
        ? gradingDescriptorsApi.updateEntry(form.entry.id, { ...v, sortOrder: form.entry.sortOrder })
        : gradingDescriptorsApi.createEntry(set.id, { ...v, sortOrder: nextOrder });
    },
    onSuccess: () => {
      setForm(null);
      refresh();
    },
    onError: (e) => Alert.alert('Could not save entry', apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => gradingDescriptorsApi.removeEntry(id),
    onSuccess: refresh,
    onError: (e) => Alert.alert('Could not delete entry', apiErrorMessage(e)),
  });

  // Reordering persists immediately with a bulk upsert (entries are always saved, so there are
  // never unsaved rows to worry about)
  const reorder = useMutation({
    mutationFn: (reordered: DescriptorEntry[]) =>
      gradingDescriptorsApi.replaceEntries(
        set.id,
        reordered.map((e, i) => ({ ...e, sortOrder: i + 1 }))
      ),
    onSuccess: refresh,
    onError: (e) => Alert.alert('Could not reorder entries', apiErrorMessage(e)),
  });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= entries.length) return;
    const next = entries.slice();
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next);
  };

  return (
    <View style={[styles.entries, { borderLeftColor: t.border }]}>
      <View style={styles.entriesHeader}>
        <Text style={[styles.entriesTitle, { color: t.primary }]}>Entries</Text>
        {!viewOnly && (
          <TouchableOpacity style={[styles.smallButton, { borderColor: t.border }]} onPress={() => setForm({ entry: null })}>
            <Ionicons name="add" size={16} color={t.primary} />
            <Text style={[styles.smallButtonText, { color: t.primary }]}>Add Entry</Text>
          </TouchableOpacity>
        )}
      </View>
      {set.isLocked && <Text style={[styles.meta, { color: t.muted }]}>Locked set: view only.</Text>}

      {isLoading ? (
        <ActivityIndicator color={t.primary} />
      ) : entries.length === 0 ? (
        <Text style={[styles.meta, { color: t.muted }]}>No entries defined.</Text>
      ) : (
        entries.map((entry, index) => (
          <View key={entry.id} style={[styles.entry, { borderTopColor: t.border }]}>
            <View style={[styles.swatch, { backgroundColor: entry.descriptorColor || t.muted }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.entryName, { color: t.foreground }]}>{entry.descriptor}</Text>
              <Text style={[styles.meta, { color: t.muted, marginTop: 1 }]}>
                {entry.minGrade} – {entry.maxGrade}
              </Text>
            </View>
            {!viewOnly && (
              <>
                <TouchableOpacity
                  style={[styles.rowIcon, (index === 0 || reorder.isPending) && { opacity: 0.3 }]}
                  disabled={index === 0 || reorder.isPending}
                  onPress={() => move(index, -1)}
                >
                  <Ionicons name="arrow-up" size={18} color={t.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rowIcon, (index === entries.length - 1 || reorder.isPending) && { opacity: 0.3 }]}
                  disabled={index === entries.length - 1 || reorder.isPending}
                  onPress={() => move(index, 1)}
                >
                  <Ionicons name="arrow-down" size={18} color={t.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.rowIcon} onPress={() => setForm({ entry })}>
                  <Ionicons name="create-outline" size={19} color={t.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rowIcon}
                  onPress={() =>
                    confirmDestructive('Delete entry', `Delete ${entry.descriptor}?`, () => remove.mutate(entry.id))
                  }
                >
                  <Ionicons name="trash-outline" size={19} color={t.destructive} />
                </TouchableOpacity>
              </>
            )}
          </View>
        ))
      )}

      <EntryFormModal
        state={form}
        entries={entries}
        saving={save.isPending}
        onClose={() => setForm(null)}
        onSubmit={(v) => save.mutate(v)}
      />
    </View>
  );
}

function EntryFormModal({
  state,
  entries,
  saving,
  onClose,
  onSubmit,
}: {
  state: { entry: DescriptorEntry | null } | null;
  entries: DescriptorEntry[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (v: { minGrade: number; maxGrade: number; descriptor: string; descriptorColor: string }) => void;
}) {
  const t = useDashboardTheme();
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);

  useEffect(() => {
    if (!state) return;
    setMin(state.entry ? String(state.entry.minGrade) : '');
    setMax(state.entry ? String(state.entry.maxGrade) : '');
    setLabel(state.entry?.descriptor ?? '');
    setColor(state.entry?.descriptorColor || SWATCHES[0]);
  }, [state]);

  if (!state) return null;

  const submit = () => {
    const a = parseGrade('Min Grade', min);
    const b = parseGrade('Max Grade', max);
    for (const v of [a, b]) if (typeof v === 'string') return Alert.alert('Check the form', v);
    const [lo, hi] = [a, b] as number[];
    if (lo > hi) return Alert.alert('Check the form', 'Min Grade cannot be greater than Max Grade');
    if (!label.trim()) return Alert.alert('Check the form', 'Descriptor is required');
    const clash = entries.some((e) => e.id !== state.entry?.id && rangesOverlap(lo, hi, e.minGrade, e.maxGrade));
    if (clash) return Alert.alert('Check the form', 'Another entry already covers this grade range');
    onSubmit({ minGrade: lo, maxGrade: hi, descriptor: label.trim(), descriptorColor: color });
  };

  const num = (setter: (v: string) => void) => (v: string) => setter(v.replace(/[^0-9.]/g, ''));

  return (
    <FormModal visible title={state.entry ? 'Edit Entry' : 'Add Entry'} onClose={onClose}>
      <Field label="Min Grade" value={min} onChangeText={num(setMin)} keyboardType="decimal-pad" />
      <Field label="Max Grade" value={max} onChangeText={num(setMax)} keyboardType="decimal-pad" />
      <Field label="Descriptor" value={label} onChangeText={setLabel} placeholder="e.g. Outstanding" />
      <Text style={[styles.colorLabel, { color: t.muted }]}>Color</Text>
      <View style={styles.swatches}>
        {SWATCHES.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setColor(c)}
            style={[styles.swatchOption, { backgroundColor: c, borderColor: color === c ? t.foreground : 'transparent' }]}
          >
            {color === c && <Ionicons name="checkmark" size={18} color="#fff" />}
          </TouchableOpacity>
        ))}
      </View>
      <FormActions confirmLabel={state.entry ? 'Update' : 'Add'} saving={saving} onCancel={onClose} onConfirm={submit} />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  name: { fontSize: 15.5, fontWeight: '700' },
  meta: { marginTop: 3, fontSize: 12.5, lineHeight: 18 },
  entries: { marginTop: 12, marginLeft: 6, paddingLeft: 12, borderLeftWidth: 2 },
  entriesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  entriesTitle: { fontSize: 14, fontWeight: '800' },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  smallButtonText: { fontSize: 12.5, fontWeight: '700' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  entryName: { fontSize: 14.5, fontWeight: '700' },
  rowIcon: { padding: 5 },
  colorLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  swatchOption: { width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
});
