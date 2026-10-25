import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import {
  TransmutationEntry,
  TransmutationTable,
  transmutationApi,
} from '../api/transmutation';
import { Badge, confirmDestructive, DashedEmpty, Field, FormActions, FormModal, showRowMenu } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { MoreButton, TabHeader } from '../school-setup/SetupParts';
import { useAcademicSetup } from './AcademicSetupContext';
import { parseGrade, rangesOverlap, SetFormModal } from './GradingSetParts';
import { academicKeys } from './keys';

const READ_ONLY_MESSAGE = 'School year must be an active, unlocked draft to change transmutation tables';

export default function TransmutationsTab() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { isReadOnly } = useAcademicSetup();
  const { data: tables = [], isLoading } = useQuery({
    queryKey: academicKeys.transmutationTables,
    queryFn: transmutationApi.list,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransmutationTable | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: academicKeys.transmutationTables });

  const save = useMutation({
    mutationFn: (v: { code: string; name: string }) =>
      editing ? transmutationApi.update(editing.id, v) : transmutationApi.create(v),
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      refresh();
    },
    onError: (e) => Alert.alert('Could not save transmutation table', apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => transmutationApi.remove(id),
    onSuccess: refresh,
    onError: (e) => Alert.alert('Could not delete transmutation table', apiErrorMessage(e)),
  });

  const blocked = () => {
    if (!isReadOnly) return false;
    Alert.alert('View only', READ_ONLY_MESSAGE);
    return true;
  };

  const openMenu = (table: TransmutationTable) =>
    showRowMenu(table.name, [
      {
        label: 'Edit',
        onPress: () => {
          if (blocked()) return;
          if (table.isLocked) return Alert.alert('Locked', 'Cannot edit a locked transmutation table');
          setEditing(table);
          setFormOpen(true);
        },
      },
      {
        label: 'Delete',
        destructive: true,
        onPress: () => {
          if (blocked()) return;
          if (table.isLocked) return Alert.alert('Locked', 'Cannot delete a locked transmutation table');
          confirmDestructive('Delete transmutation table', `Delete ${table.name}?`, () => remove.mutate(table.id));
        },
      },
    ]);

  return (
    <View>
      <TabHeader
        icon="swap-vertical"
        title="Transmutation Tables"
        addLabel="Add Table"
        onAdd={() => {
          if (blocked()) return;
          setEditing(null);
          setFormOpen(true);
        }}
      />

      {isLoading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color={t.primary} />
      ) : tables.length === 0 ? (
        <DashedEmpty icon="swap-vertical-outline" title="No transmutation tables yet." subtitle="Add a table to convert initial grades." />
      ) : (
        tables.map((table) => {
          const expanded = expandedId === table.id;
          return (
            <View key={table.id} style={[styles.row, { borderColor: t.border, backgroundColor: t.card }]}>
              <View style={styles.rowTop}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.7}
                  onPress={() => setExpandedId(expanded ? null : table.id)}
                >
                  <View style={styles.nameRow}>
                    <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color={t.muted} />
                    <Text style={[styles.name, { color: t.foreground }]}>{table.name}</Text>
                    {table.isLocked && <Badge label="Locked" tone="danger" />}
                  </View>
                  <Text style={[styles.meta, { color: t.muted }]}>{table.code}</Text>
                </TouchableOpacity>
                <MoreButton disabled={isReadOnly || table.isLocked} onPress={() => openMenu(table)} />
              </View>
              {expanded && <EntriesList table={table} />}
            </View>
          );
        })
      )}

      <SetFormModal
        visible={formOpen}
        title={editing ? 'Edit Transmutation Table' : 'Add Transmutation Table'}
        initial={editing ? { code: editing.code, name: editing.name } : null}
        existingCodes={tables.filter((x) => x.id !== editing?.id).map((x) => x.code.toLowerCase())}
        duplicateMessage="A transmutation table with this code already exists"
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

function EntriesList({ table }: { table: TransmutationTable }) {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { isReadOnly } = useAcademicSetup();
  const viewOnly = isReadOnly || table.isLocked;
  const { data: entries = [], isLoading } = useQuery({
    queryKey: academicKeys.transmutationEntries(table.id),
    queryFn: () => transmutationApi.entries(table.id),
  });
  const [form, setForm] = useState<{ entry: TransmutationEntry | null } | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: academicKeys.transmutationEntries(table.id) });

  const save = useMutation({
    mutationFn: (v: { initialGrade: number; maxInitialGrade: number; transmutedGrade: number }) =>
      form?.entry ? transmutationApi.updateEntry(form.entry.id, v) : transmutationApi.createEntry(table.id, v),
    onSuccess: () => {
      setForm(null);
      refresh();
    },
    onError: (e) => Alert.alert('Could not save entry', apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => transmutationApi.removeEntry(id),
    onSuccess: refresh,
    onError: (e) => Alert.alert('Could not delete entry', apiErrorMessage(e)),
  });

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
      {table.isLocked && <Text style={[styles.meta, { color: t.muted }]}>Locked table: view only.</Text>}

      {isLoading ? (
        <ActivityIndicator color={t.primary} />
      ) : entries.length === 0 ? (
        <Text style={[styles.meta, { color: t.muted }]}>No entries defined.</Text>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={[styles.entry, { borderTopColor: t.border }]}>
            <View style={styles.cells}>
              <Cell label="Initial Grade" value={String(entry.initialGrade)} />
              <Cell label="Max Initial" value={String(entry.maxInitialGrade)} />
              <Cell label="Transmuted" value={String(entry.transmutedGrade)} strong />
            </View>
            {!viewOnly && (
              <>
                <TouchableOpacity style={styles.rowIcon} onPress={() => setForm({ entry })}>
                  <Ionicons name="create-outline" size={19} color={t.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rowIcon}
                  onPress={() =>
                    confirmDestructive('Delete entry', 'Delete this entry?', () => remove.mutate(entry.id))
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

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const t = useDashboardTheme();
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.cellValue, { color: t.foreground }, strong && { color: t.primary }]}>{value}</Text>
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
  state: { entry: TransmutationEntry | null } | null;
  entries: TransmutationEntry[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (v: { initialGrade: number; maxInitialGrade: number; transmutedGrade: number }) => void;
}) {
  const [initial, setInitial] = useState('');
  const [max, setMax] = useState('');
  const [transmuted, setTransmuted] = useState('');

  useEffect(() => {
    if (!state) return;
    setInitial(state.entry ? String(state.entry.initialGrade) : '');
    setMax(state.entry ? String(state.entry.maxInitialGrade) : '');
    setTransmuted(state.entry ? String(state.entry.transmutedGrade) : '');
  }, [state]);

  if (!state) return null;

  const submit = () => {
    const a = parseGrade('Initial Grade', initial);
    const b = parseGrade('Max Initial Grade', max);
    const c = parseGrade('Transmuted Grade', transmuted);
    for (const v of [a, b, c]) if (typeof v === 'string') return Alert.alert('Check the form', v);
    const [lo, hi, out] = [a, b, c] as number[];
    if (lo > hi) return Alert.alert('Check the form', 'Initial Grade cannot be greater than Max Initial Grade');
    const clash = entries.some(
      (e) => e.id !== state.entry?.id && rangesOverlap(lo, hi, e.initialGrade, e.maxInitialGrade)
    );
    if (clash) return Alert.alert('Check the form', 'Another entry already covers this grade range');
    onSubmit({ initialGrade: lo, maxInitialGrade: hi, transmutedGrade: out });
  };

  const num = (setter: (v: string) => void) => (v: string) => setter(v.replace(/[^0-9.]/g, ''));

  return (
    <FormModal visible title={state.entry ? 'Edit Entry' : 'Add Entry'} onClose={onClose}>
      <Field label="Initial Grade (min)" value={initial} onChangeText={num(setInitial)} keyboardType="decimal-pad" />
      <Field label="Max Initial Grade" value={max} onChangeText={num(setMax)} keyboardType="decimal-pad" />
      <Field label="Transmuted Grade" value={transmuted} onChangeText={num(setTransmuted)} keyboardType="decimal-pad" />
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
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  cells: { flex: 1, flexDirection: 'row', gap: 8 },
  cell: { flex: 1 },
  cellLabel: { fontSize: 10.5, fontWeight: '600' },
  cellValue: { fontSize: 15, fontWeight: '700', marginTop: 1 },
  rowIcon: { padding: 6 },
});
