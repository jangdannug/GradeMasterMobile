import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { gradingSchemesApi } from '../api/gradingSchemes';
import { Badge, DashedEmpty } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useAcademicSetup } from './AcademicSetupContext';
import { academicKeys } from './keys';
import { SubjectEntry } from './useAcademicSetupData';

type Overrides = Record<string, Record<string, boolean>>;
type CheckState = 'all' | 'some' | 'none';

const MAX_UNASSIGNED_CHIPS = 24;

export default function AssignSchemesStep() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { schemes, byScheme, groups, assignedIds, subjectCount, unassignedCount, incompleteSchemeIds, isReadOnly, isLoading } =
    useAcademicSetup();

  const [pickedId, setPickedId] = useState('');
  const [overrides, setOverrides] = useState<Overrides>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Only user-created schemes whose weights total 100% can be assigned
  const nonSystem = schemes.filter((s) => !s.isSystemDefined);
  const assignable = nonSystem.filter((s) => !incompleteSchemeIds.has(s.id));
  const hiddenCount = nonSystem.filter((s) => incompleteSchemeIds.has(s.id)).length;
  const scheme = assignable.find((s) => s.id === pickedId) ?? assignable[0];

  const populatedGroups = groups.filter((g) => g.subjects.length > 0);
  const serverSet = (schemeId: string) => new Set(byScheme.get(schemeId) ?? []);

  const isChecked = (schemeId: string, subjectId: string) =>
    overrides[schemeId]?.[subjectId] ?? serverSet(schemeId).has(subjectId);

  /** Stage a change, dropping overrides that equal the server state */
  const setChecked = (schemeId: string, subjectIds: string[], value: boolean) => {
    if (isReadOnly) return;
    const server = serverSet(schemeId);
    setOverrides((prev) => {
      const forScheme = { ...(prev[schemeId] ?? {}) };
      subjectIds.forEach((id) => {
        if (server.has(id) === value) delete forScheme[id];
        else forScheme[id] = value;
      });
      const next = { ...prev };
      if (Object.keys(forScheme).length === 0) delete next[schemeId];
      else next[schemeId] = forScheme;
      return next;
    });
  };

  const stateOf = (schemeId: string, ids: string[]): CheckState => {
    if (ids.length === 0) return 'none';
    const checked = ids.filter((id) => isChecked(schemeId, id)).length;
    return checked === 0 ? 'none' : checked === ids.length ? 'all' : 'some';
  };

  const pendingCount = Object.values(overrides).reduce((n, o) => n + Object.keys(o).length, 0);
  const touchedSchemes = Object.keys(overrides).length;

  const save = useMutation({
    mutationFn: async () => {
      // One PUT per touched scheme whose final list really differs; the body is the COMPLETE list
      for (const schemeId of Object.keys(overrides)) {
        const server = serverSet(schemeId);
        const final = new Set(server);
        Object.entries(overrides[schemeId]).forEach(([subjectId, on]) => (on ? final.add(subjectId) : final.delete(subjectId)));
        const changed = final.size !== server.size || [...final].some((id) => !server.has(id));
        if (changed) await gradingSchemesApi.replaceSubjects(schemeId, [...final]);
      }
    },
    onSuccess: () => {
      Object.keys(overrides).forEach((schemeId) =>
        queryClient.invalidateQueries({ queryKey: academicKeys.schemeSubjects(schemeId) })
      );
      Alert.alert('Saved', `Saved ${pendingCount} change(s) across ${touchedSchemes} scheme(s)`);
      setOverrides({});
    },
    onError: (e) => Alert.alert('Could not save assignments', apiErrorMessage(e)),
  });

  const unassigned = useMemo(() => {
    const seen = new Map<string, SubjectEntry>();
    groups.forEach((g) => g.subjects.forEach((s) => !assignedIds.has(s.subjectId) && seen.set(s.subjectId, s)));
    return [...seen.values()];
  }, [groups, assignedIds]);

  if (isLoading && schemes.length === 0) return <ActivityIndicator style={styles.loading} color={t.primary} />;

  // ---- Empty states ---------------------------------------------------------------------------
  if (assignable.length === 0) {
    return (
      <DashedEmpty
        icon="swap-horizontal-outline"
        title="No assignable grading schemes yet."
        subtitle="Create your own scheme in Step 2 — system schemes and schemes whose components and items do not total 100% cannot be assigned."
      />
    );
  }
  if (subjectCount === 0) {
    return (
      <DashedEmpty
        icon="book-outline"
        title="No subjects found for this school year."
        subtitle="Add subjects in Step 1 before assigning schemes."
      />
    );
  }

  const allIds = [...new Set(populatedGroups.flatMap((g) => g.subjects.map((s) => s.subjectId)))];
  const allState = stateOf(scheme.id, allIds);

  const otherSchemesFor = (subjectId: string) =>
    schemes.filter((s) => s.id !== scheme.id && serverSet(s.id).has(subjectId));

  return (
    <View>
      {/* Header badges */}
      <View style={styles.headerRow}>
        {unassignedCount === 0 ? (
          <Badge label="All subjects assigned" tone="success" />
        ) : (
          <Badge label={`${unassignedCount} unassigned`} tone="warning" />
        )}
        <Badge label={`${subjectCount} subject(s)`} tone="muted" />
      </View>

      {/* Scheme picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
        {assignable.map((s) => {
          const selected = s.id === scheme.id;
          return (
            <TouchableOpacity
              key={s.id}
              onPress={() => setPickedId(s.id)}
              style={[
                styles.schemeChip,
                { borderColor: selected ? t.primary : t.border, backgroundColor: selected ? t.primaryTint : t.card },
              ]}
            >
              <View style={styles.chipTop}>
                <Text style={[styles.schemeName, { color: t.foreground }]} numberOfLines={1}>
                  {s.name}
                </Text>
                {s.isActive && <Badge label="Active" tone="success" />}
              </View>
              <Text style={[styles.meta, { color: t.muted }]}>
                {s.code} · {(byScheme.get(s.id) ?? []).length} subject(s)
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {hiddenCount > 0 && (
        <Text style={[styles.hidden, { color: t.warning }]}>
          {hiddenCount} scheme(s) hidden — the components and their items must total 100%.
        </Text>
      )}

      {/* Checklist */}
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <TouchableOpacity
          style={styles.selectAll}
          disabled={isReadOnly}
          onPress={() => setChecked(scheme.id, allIds, allState !== 'all')}
        >
          <Checkbox state={allState} disabled={isReadOnly} />
          <Text style={[styles.selectAllText, { color: t.foreground }]}>Select all</Text>
        </TouchableOpacity>

        {populatedGroups.map(({ level, subjects }) => {
          const ids = subjects.map((s) => s.subjectId);
          const levelState = stateOf(scheme.id, ids);
          const selectedCount = ids.filter((id) => isChecked(scheme.id, id)).length;
          const isCollapsed = collapsed.has(level.id);
          const roots = subjects.filter((s) => !s.parentSubjectId);
          return (
            <View key={level.id} style={[styles.level, { borderTopColor: t.border }]}>
              <View style={styles.levelHeader}>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                  disabled={isReadOnly}
                  onPress={() => setChecked(scheme.id, ids, levelState !== 'all')}
                >
                  <Checkbox state={levelState} disabled={isReadOnly} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.levelTitle}
                  onPress={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(level.id)) next.delete(level.id);
                      else next.add(level.id);
                      return next;
                    })
                  }
                >
                  <Text style={[styles.levelName, { color: t.foreground }]}>{level.name}</Text>
                  <Text style={[styles.meta, { color: t.muted }]}>
                    {selectedCount}/{ids.length}
                  </Text>
                  <Ionicons name={isCollapsed ? 'chevron-forward' : 'chevron-down'} size={18} color={t.muted} />
                </TouchableOpacity>
              </View>

              {!isCollapsed &&
                roots.map((root) => (
                  <View key={root.subjectId}>
                    <SubjectRow
                      entry={root}
                      checked={isChecked(scheme.id, root.subjectId)}
                      changed={overrides[scheme.id]?.[root.subjectId] !== undefined}
                      others={otherSchemesFor(root.subjectId).map((s) => s.code)}
                      disabled={isReadOnly}
                      onToggle={() => setChecked(scheme.id, [root.subjectId], !isChecked(scheme.id, root.subjectId))}
                    />
                    {subjects
                      .filter((s) => s.parentSubjectId === root.subjectId)
                      .map((child) => (
                        <SubjectRow
                          key={child.subjectId}
                          nested
                          entry={child}
                          checked={isChecked(scheme.id, child.subjectId)}
                          changed={overrides[scheme.id]?.[child.subjectId] !== undefined}
                          others={otherSchemesFor(child.subjectId).map((s) => s.code)}
                          disabled={isReadOnly}
                          onToggle={() =>
                            setChecked(scheme.id, [child.subjectId], !isChecked(scheme.id, child.subjectId))
                          }
                        />
                      ))}
                  </View>
                ))}
            </View>
          );
        })}
      </View>

      {/* Pending changes */}
      <View style={[styles.saveBar, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.pending, { color: pendingCount > 0 ? t.warning : t.muted }]}>
          {pendingCount > 0 ? `${pendingCount} unsaved change(s)` : 'No pending changes'}
        </Text>
        <View style={styles.saveButtons}>
          <TouchableOpacity
            style={[styles.discard, { borderColor: t.border }, (pendingCount === 0 || isReadOnly) && { opacity: 0.4 }]}
            disabled={pendingCount === 0 || isReadOnly || save.isPending}
            onPress={() => setOverrides({})}
          >
            <Text style={[styles.discardText, { color: t.foreground }]}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.save, { backgroundColor: t.primary }, (pendingCount === 0 || isReadOnly) && { opacity: 0.4 }]}
            disabled={pendingCount === 0 || isReadOnly || save.isPending}
            onPress={() => save.mutate()}
            activeOpacity={0.85}
          >
            {save.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Subjects still without any scheme */}
      {unassigned.length > 0 && (
        <View style={[styles.unassigned, { backgroundColor: t.warningTint, borderColor: t.warning }]}>
          <Text style={[styles.unassignedTitle, { color: t.foreground }]}>
            {unassigned.length} subject(s) still assigned to no grading scheme
          </Text>
          <View style={styles.chips}>
            {unassigned.slice(0, MAX_UNASSIGNED_CHIPS).map((s) => (
              <View key={s.subjectId} style={[styles.chip, { backgroundColor: t.card, borderColor: t.border }]}>
                <Text style={[styles.chipText, { color: t.foreground }]}>
                  {s.subjectCode} · {s.subjectName}
                </Text>
              </View>
            ))}
            {unassigned.length > MAX_UNASSIGNED_CHIPS && (
              <Text style={[styles.meta, { color: t.muted, alignSelf: 'center' }]}>
                +{unassigned.length - MAX_UNASSIGNED_CHIPS} more
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function Checkbox({ state, disabled }: { state: CheckState; disabled?: boolean }) {
  const t = useDashboardTheme();
  const name = state === 'all' ? 'checkbox' : state === 'some' ? 'remove-circle' : 'square-outline';
  return (
    <View style={disabled && { opacity: 0.45 }}>
      <Ionicons name={name} size={24} color={state === 'none' ? t.muted : t.primary} />
    </View>
  );
}

function SubjectRow({
  entry,
  checked,
  changed,
  others,
  nested,
  disabled,
  onToggle,
}: {
  entry: SubjectEntry;
  checked: boolean;
  changed: boolean;
  others: string[];
  nested?: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const t = useDashboardTheme();
  return (
    <TouchableOpacity
      style={[styles.subjectRow, nested && styles.nested]}
      disabled={disabled}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Checkbox state={checked ? 'all' : 'none'} disabled={disabled} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.subjectName, { color: t.foreground }]}>{entry.subjectName}</Text>
        <View style={styles.subjectMeta}>
          <Text style={[styles.meta, { color: t.muted }]}>{entry.subjectCode}</Text>
          {changed && <Badge label="changed" tone="warning" />}
          {others.slice(0, 2).map((code) => (
            <Badge key={code} label={`in ${code}`} tone="muted" />
          ))}
          {others.length > 2 && <Badge label={`+${others.length - 2}`} tone="muted" />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 40 },
  headerRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pickerRow: { gap: 10, paddingBottom: 8 },
  schemeChip: { width: 210, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  chipTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  schemeName: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  meta: { fontSize: 12, marginTop: 2 },
  hidden: { fontSize: 12.5, fontWeight: '600', marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 6 },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  selectAllText: { fontSize: 14.5, fontWeight: '800' },
  level: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 8 },
  levelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelName: { flex: 1, fontSize: 14.5, fontWeight: '700' },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingLeft: 4 },
  nested: { paddingLeft: 34 },
  subjectName: { fontSize: 14, fontWeight: '600' },
  subjectMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  saveBar: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 14, gap: 10 },
  pending: { fontSize: 13, fontWeight: '700' },
  saveButtons: { flexDirection: 'row', gap: 10 },
  discard: { height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  discardText: { fontSize: 14, fontWeight: '700' },
  save: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  unassigned: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 14 },
  unassignedTitle: { fontSize: 13.5, fontWeight: '700', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  chipText: { fontSize: 11.5, fontWeight: '600' },
});
