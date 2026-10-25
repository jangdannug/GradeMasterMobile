import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { GradingComponent, gradingSchemesApi, GradingScheme } from '../api/gradingSchemes';
import { gradingDescriptorsApi } from '../api/gradingDescriptors';
import { transmutationApi } from '../api/transmutation';
import { confirmDestructive, Field, FormActions, FormModal, SelectField } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useAcademicSetup } from './AcademicSetupContext';
import { academicKeys } from './keys';
import { formatWeightTotal, isWeightTotalComplete, sumItemWeights } from './weights';

const SYSTEM_MESSAGE = 'System-defined grading schemes cannot be modified. Duplicate it instead.';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------------------------
// Expanded body of a scheme: conversion rules + components
// ---------------------------------------------------------------------------------------------

export default function SchemeDetail({ scheme }: { scheme: GradingScheme }) {
  const { isReadOnly } = useAcademicSetup();
  const locked = isReadOnly || scheme.isSystemDefined || scheme.isLocked;

  return (
    <View style={styles.detail}>
      <ConversionRules scheme={scheme} disabled={locked} />
      <ComponentsSection scheme={scheme} disabled={locked} />
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  const t = useDashboardTheme();
  return <Text style={[styles.sectionLabel, { color: t.primary }]}>{children}</Text>;
}

// ---- Conversion rules -------------------------------------------------------------------------

function ConversionRules({ scheme, disabled }: { scheme: GradingScheme; disabled: boolean }) {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { schoolYear } = useAcademicSetup();

  const tables = useQuery({ queryKey: academicKeys.transmutationTables, queryFn: transmutationApi.list });
  const descriptors = useQuery({ queryKey: academicKeys.descriptorSets, queryFn: gradingDescriptorsApi.list });

  const link = useMutation({
    mutationFn: async (patch: { transmutationTableId?: string; gradingDescriptorId?: string }) => {
      // PUT is a full replacement: re-read the scheme and echo back whatever is not being changed
      const fresh = await gradingSchemesApi.get(scheme.id);
      await gradingSchemesApi.update(scheme.id, {
        code: fresh.code,
        name: fresh.name,
        description: fresh.description,
        transmutationTableId: patch.transmutationTableId ?? fresh.transmutationTableId,
        gradingDescriptorId: patch.gradingDescriptorId ?? fresh.gradingDescriptorId,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: academicKeys.schemes(schoolYear.id) }),
    onError: (e) => Alert.alert('Could not save conversion rules', apiErrorMessage(e)),
  });

  const tryChange = (patch: { transmutationTableId?: string; gradingDescriptorId?: string }) => {
    if (scheme.isSystemDefined) return Alert.alert('System scheme', SYSTEM_MESSAGE);
    link.mutate(patch);
  };

  const label = (name: string, code: string) => (code ? `${name} (${code})` : name);

  return (
    <View style={styles.block}>
      <SectionLabel>Conversion Rules</SectionLabel>
      <SelectField
        label="Transmutation Table"
        value={scheme.transmutationTableId}
        options={(tables.data ?? []).map((x) => ({ value: x.id, label: label(x.name, x.code) }))}
        placeholder={tables.isLoading ? 'Loading...' : 'None selected'}
        disabled={disabled || link.isPending}
        onChange={(v) => tryChange({ transmutationTableId: v })}
      />
      <SelectField
        label="Descriptor"
        value={scheme.gradingDescriptorId}
        options={(descriptors.data ?? []).map((x) => ({ value: x.id, label: label(x.name, x.code) }))}
        placeholder={descriptors.isLoading ? 'Loading...' : 'None selected'}
        disabled={disabled || link.isPending}
        onChange={(v) => tryChange({ gradingDescriptorId: v })}
      />
      {link.isPending && <ActivityIndicator size="small" color={t.primary} />}
    </View>
  );
}

// ---- Components and items ---------------------------------------------------------------------

type FormTarget =
  | { kind: 'component-add' }
  | { kind: 'component-edit'; component: GradingComponent }
  | { kind: 'item-add'; component: GradingComponent; nextSequence: number }
  | { kind: 'item-edit'; component: GradingComponent; item: { id: string; name: string; weightPercent: number; maxScore: number; sequenceNo: number } };

function ComponentsSection({ scheme, disabled }: { scheme: GradingScheme; disabled: boolean }) {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { schemeWeightTotals } = useAcademicSetup();
  const { data: components = [], isLoading } = useQuery({
    queryKey: academicKeys.components(scheme.id),
    queryFn: () => gradingSchemesApi.components(scheme.id),
  });
  const [target, setTarget] = useState<FormTarget | null>(null);

  const refreshComponents = () => queryClient.invalidateQueries({ queryKey: academicKeys.components(scheme.id) });
  const refreshItems = (componentId: string) =>
    queryClient.invalidateQueries({ queryKey: academicKeys.items(scheme.id, componentId) });

  const save = useMutation({
    mutationFn: async (v: { name: string; weight: number; maxScore: number }) => {
      if (!target) return;
      if (target.kind === 'component-add') {
        const next = components.reduce((max, c) => Math.max(max, c.sequenceNo), 0) + 1;
        await gradingSchemesApi.createComponent(scheme.id, { name: v.name, weightPercent: v.weight, sequenceNo: next });
      } else if (target.kind === 'component-edit') {
        // The list endpoint REPLACES everything: send every sibling back with the edited one patched
        await gradingSchemesApi.replaceComponents(
          scheme.id,
          components.map((c) =>
            c.id === target.component.id ? { ...c, name: v.name, weightPercent: v.weight } : c
          )
        );
      } else if (target.kind === 'item-add') {
        await gradingSchemesApi.createItem(scheme.id, target.component.id, {
          name: v.name,
          weightPercent: v.weight,
          maxScore: v.maxScore,
          sequenceNo: target.nextSequence,
        });
      } else {
        await gradingSchemesApi.updateItem(scheme.id, target.component.id, target.item.id, {
          name: v.name,
          weightPercent: v.weight,
          maxScore: v.maxScore,
          sequenceNo: target.item.sequenceNo,
        });
      }
    },
    onSuccess: () => {
      if (target?.kind === 'component-add' || target?.kind === 'component-edit') refreshComponents();
      if (target && (target.kind === 'item-add' || target.kind === 'item-edit')) refreshItems(target.component.id);
      setTarget(null);
    },
    onError: (e) => Alert.alert('Could not save', apiErrorMessage(e)),
  });

  const removeComponent = useMutation({
    mutationFn: (componentId: string) => gradingSchemesApi.removeComponent(scheme.id, componentId),
    onSuccess: refreshComponents,
    onError: (e) => Alert.alert('Could not delete component', apiErrorMessage(e)),
  });

  const total = schemeWeightTotals.get(scheme.id);

  return (
    <View style={styles.block}>
      <View style={styles.sectionHeader}>
        <SectionLabel>Grading Components</SectionLabel>
        <TouchableOpacity
          style={[styles.smallButton, { borderColor: t.border }, disabled && { opacity: 0.4 }]}
          disabled={disabled}
          onPress={() => setTarget({ kind: 'component-add' })}
        >
          <Ionicons name="add" size={16} color={t.primary} />
          <Text style={[styles.smallButtonText, { color: t.primary }]}>Add Component</Text>
        </TouchableOpacity>
      </View>

      {scheme.isSystemDefined && (
        <Text style={[styles.note, { color: t.muted }]}>System-defined scheme: components are read-only.</Text>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginVertical: 12 }} color={t.primary} />
      ) : components.length === 0 ? (
        <Text style={[styles.note, { color: t.muted }]}>No grading components defined.</Text>
      ) : (
        components.map((component) => (
          <ComponentCard
            key={component.id}
            scheme={scheme}
            component={component}
            disabled={disabled}
            onEdit={() => setTarget({ kind: 'component-edit', component })}
            onDelete={() =>
              confirmDestructive('Delete component', `Delete ${component.name} and its items?`, () =>
                removeComponent.mutate(component.id)
              )
            }
            onAddItem={(nextSequence) => setTarget({ kind: 'item-add', component, nextSequence })}
            onEditItem={(item) => setTarget({ kind: 'item-edit', component, item })}
            onItemsChanged={() => refreshItems(component.id)}
          />
        ))
      )}

      {total !== undefined && components.length > 0 && (
        <Text style={[styles.schemeTotal, { color: isWeightTotalComplete(total) ? t.success : t.destructive }]}>
          Scheme total: {formatWeightTotal(total)}%
          {isWeightTotalComplete(total) ? '' : ' — components and items must total 100%'}
        </Text>
      )}

      <WeightFormModal
        target={target}
        saving={save.isPending}
        onClose={() => setTarget(null)}
        onSubmit={(v) => save.mutate(v)}
      />
    </View>
  );
}

function ComponentCard({
  scheme,
  component,
  disabled,
  onEdit,
  onDelete,
  onAddItem,
  onEditItem,
  onItemsChanged,
}: {
  scheme: GradingScheme;
  component: GradingComponent;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: (nextSequence: number) => void;
  onEditItem: (item: { id: string; name: string; weightPercent: number; maxScore: number; sequenceNo: number }) => void;
  onItemsChanged: () => void;
}) {
  const t = useDashboardTheme();
  const { data: items = [], isLoading } = useQuery({
    queryKey: academicKeys.items(scheme.id, component.id),
    queryFn: () => gradingSchemesApi.items(scheme.id, component.id),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => gradingSchemesApi.removeItem(scheme.id, component.id, itemId),
    onSuccess: onItemsChanged,
    onError: (e) => Alert.alert('Could not delete item', apiErrorMessage(e)),
  });

  const itemTotal = sumItemWeights(items);
  const itemsOk = isWeightTotalComplete(itemTotal);
  const nextSequence = items.reduce((max, i) => Math.max(max, i.sequenceNo), 0) + 1;

  return (
    <View style={[styles.component, { borderColor: t.border, backgroundColor: t.card }]}>
      <View style={styles.componentHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.componentName, { color: t.foreground }]}>
            {component.name} · {formatWeightTotal(component.weightPercent)}%
          </Text>
          <Text style={[styles.note, { color: itemsOk ? t.success : t.destructive, marginTop: 2 }]}>
            Items total {formatWeightTotal(itemTotal)}%{itemsOk ? '' : ' (must be 100%)'}
          </Text>
        </View>
        {!disabled && (
          <>
            <RowIcon icon="create-outline" color={t.muted} onPress={onEdit} />
            <RowIcon icon="trash-outline" color={t.destructive} onPress={onDelete} />
          </>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color={t.primary} />
      ) : (
        items.map((item) => (
          <View key={item.id} style={[styles.itemRow, { borderTopColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: t.foreground }]}>{item.name}</Text>
              <Text style={[styles.note, { color: t.muted, marginTop: 1 }]}>
                {formatWeightTotal(item.weightPercent)}% · max score {item.maxScore}
              </Text>
            </View>
            {!disabled && (
              <>
                <RowIcon icon="create-outline" color={t.muted} onPress={() => onEditItem(item)} />
                <RowIcon
                  icon="trash-outline"
                  color={t.destructive}
                  onPress={() =>
                    confirmDestructive('Delete item', `Delete ${item.name}?`, () => removeItem.mutate(item.id))
                  }
                />
              </>
            )}
          </View>
        ))
      )}

      {!disabled && (
        <TouchableOpacity style={styles.addItem} onPress={() => onAddItem(nextSequence)}>
          <Ionicons name="add" size={16} color={t.primary} />
          <Text style={[styles.smallButtonText, { color: t.primary }]}>Add Item</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function RowIcon({ icon, color, onPress }: { icon: IconName; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.rowIcon} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}>
      <Ionicons name={icon} size={19} color={color} />
    </TouchableOpacity>
  );
}

// ---- Component / item form --------------------------------------------------------------------

function WeightFormModal({
  target,
  saving,
  onClose,
  onSubmit,
}: {
  target: FormTarget | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; weight: number; maxScore: number }) => void;
}) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [maxScore, setMaxScore] = useState('');

  useEffect(() => {
    if (!target) return;
    if (target.kind === 'component-edit') {
      setName(target.component.name);
      setWeight(String(target.component.weightPercent));
      setMaxScore('');
    } else if (target.kind === 'item-edit') {
      setName(target.item.name);
      setWeight(String(target.item.weightPercent));
      setMaxScore(String(target.item.maxScore));
    } else {
      setName('');
      setWeight('');
      setMaxScore('');
    }
  }, [target]);

  if (!target) return null;

  const isItem = target.kind === 'item-add' || target.kind === 'item-edit';
  const editing = target.kind === 'component-edit' || target.kind === 'item-edit';
  const title = `${editing ? 'Edit' : 'Add'} ${isItem ? 'Item' : 'Component'}`;

  const submit = () => {
    const fail = (message: string) => Alert.alert('Check the form', message);
    const weightValue = Number(weight);
    const maxValue = Number(maxScore);
    if (!name.trim()) return fail('Please enter a name');
    if (!weight.trim() || Number.isNaN(weightValue) || weightValue < 1 || weightValue > 100)
      return fail('Weight must be between 1 and 100');
    if (isItem && (!maxScore.trim() || Number.isNaN(maxValue) || maxValue < 0))
      return fail('Max score must be 0 or greater');
    onSubmit({ name: name.trim(), weight: weightValue, maxScore: isItem ? maxValue : 0 });
  };

  return (
    <FormModal visible title={title} onClose={onClose}>
      <Field label="Name" value={name} onChangeText={setName} maxLength={100} />
      <Field
        label="Weight %"
        value={weight}
        onChangeText={(v) => setWeight(v.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="1 – 100"
      />
      {isItem && (
        <Field
          label="Max Score"
          value={maxScore}
          onChangeText={(v) => setMaxScore(v.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
        />
      )}
      <FormActions confirmLabel={editing ? 'Update' : 'Add'} saving={saving} onCancel={onClose} onConfirm={submit} />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  detail: { marginTop: 12, marginLeft: 6, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: 'rgba(148,163,184,0.5)' },
  block: { marginBottom: 14 },
  sectionLabel: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  smallButtonText: { fontSize: 12.5, fontWeight: '700' },
  note: { fontSize: 12.5, lineHeight: 18 },
  component: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  componentHeader: { flexDirection: 'row', alignItems: 'center' },
  componentName: { fontSize: 14.5, fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  itemName: { fontSize: 13.5, fontWeight: '600' },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6, alignSelf: 'flex-start' },
  rowIcon: { padding: 6 },
  schemeTotal: { fontSize: 13, fontWeight: '700', marginTop: 2 },
});
