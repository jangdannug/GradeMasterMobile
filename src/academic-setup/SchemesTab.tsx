import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { GradingScheme, gradingSchemesApi } from '../api/gradingSchemes';
import { Badge, confirmDestructive, DashedEmpty, Field, FormActions, FormModal, showRowMenu } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { MoreButton, TabHeader } from '../school-setup/SetupParts';
import { useAcademicSetup } from './AcademicSetupContext';
import { academicKeys } from './keys';
import SchemeDetail from './SchemeDetail';
import { formatWeightTotal } from './weights';

const READ_ONLY_MESSAGE = 'School year must be an active, unlocked draft to change grading schemes';
const SYSTEM_MESSAGE = 'System-defined grading schemes cannot be modified. Duplicate it instead.';

type FormMode = { kind: 'add' } | { kind: 'edit'; scheme: GradingScheme } | { kind: 'duplicate'; scheme: GradingScheme };

export default function SchemesTab() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { schemes, schoolYear, isReadOnly, schemeWeightTotals, incompleteSchemeIds, isLoading } = useAcademicSetup();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: academicKeys.schemes(schoolYear.id) });

  const save = useMutation({
    mutationFn: async (v: { code: string; name: string; description: string }) => {
      if (!mode) return;
      if (mode.kind === 'add') {
        await gradingSchemesApi.create(v);
      } else if (mode.kind === 'duplicate') {
        await gradingSchemesApi.duplicate(mode.scheme.id, v);
      } else {
        // PUT is a full replacement: re-read the scheme and echo back its conversion-rule links
        const fresh = await gradingSchemesApi.get(mode.scheme.id);
        await gradingSchemesApi.update(mode.scheme.id, {
          ...v,
          transmutationTableId: fresh.transmutationTableId,
          gradingDescriptorId: fresh.gradingDescriptorId,
        });
      }
    },
    onSuccess: () => {
      setMode(null);
      refresh();
    },
    onError: (e) => Alert.alert('Could not save grading scheme', apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => gradingSchemesApi.remove(id),
    onSuccess: (_, id) => {
      if (expandedId === id) setExpandedId(null);
      queryClient.removeQueries({ queryKey: academicKeys.schemeSubjects(id) });
      refresh();
    },
    onError: (e) => Alert.alert('Could not delete grading scheme', apiErrorMessage(e)),
  });

  const blockedByReadOnly = () => {
    if (!isReadOnly) return false;
    Alert.alert('View only', READ_ONLY_MESSAGE);
    return true;
  };

  const openMenu = (scheme: GradingScheme) => {
    if (scheme.isSystemDefined) {
      showRowMenu(scheme.name, [
        {
          label: 'Duplicate',
          onPress: () => {
            if (!blockedByReadOnly()) setMode({ kind: 'duplicate', scheme });
          },
        },
      ]);
      return;
    }
    showRowMenu(scheme.name, [
      {
        label: 'Edit',
        onPress: () => {
          if (!blockedByReadOnly()) setMode({ kind: 'edit', scheme });
        },
      },
      {
        label: 'Delete',
        destructive: true,
        onPress: () => {
          if (blockedByReadOnly()) return;
          confirmDestructive('Delete grading scheme', `Delete ${scheme.name}?`, () => remove.mutate(scheme.id));
        },
      },
    ]);
  };

  return (
    <View>
      <TabHeader
        icon="clipboard"
        title="Grading Schemes"
        addLabel="Add Scheme"
        onAdd={() => {
          if (!blockedByReadOnly()) setMode({ kind: 'add' });
        }}
      />

      {isLoading && schemes.length === 0 ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color={t.primary} />
      ) : schemes.length === 0 ? (
        <DashedEmpty
          icon="clipboard-outline"
          title="No grading schemes yet."
          subtitle="Add a scheme to define how grades are computed."
        />
      ) : (
        schemes.map((scheme) => {
          const expanded = expandedId === scheme.id;
          const incomplete = incompleteSchemeIds.has(scheme.id);
          const active = scheme.isActive && !scheme.isSystemDefined;
          return (
            <View
              key={scheme.id}
              style={[
                styles.row,
                {
                  borderColor: active ? t.primary : t.border,
                  backgroundColor: active ? t.primaryTint : t.card,
                },
              ]}
            >
              <View style={styles.rowTop}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.7}
                  onPress={() => setExpandedId(expanded ? null : scheme.id)}
                >
                  <View style={styles.nameRow}>
                    <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color={t.muted} />
                    <Text style={[styles.name, { color: t.foreground }]}>{scheme.name}</Text>
                  </View>
                  <Text style={[styles.meta, { color: t.muted }]}>
                    {[scheme.code, scheme.description].filter(Boolean).join(' · ')}
                  </Text>
                  <View style={styles.badges}>
                    {scheme.isSystemDefined && <Badge label="System" tone="primary" />}
                    {active && <Badge label="Active" tone="success" />}
                    {incomplete && (
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert(
                            'Incomplete scheme',
                            `The components and their items total ${formatWeightTotal(
                              schemeWeightTotals.get(scheme.id) ?? 0
                            )}% — they must total 100%`
                          )
                        }
                      >
                        <Badge label="Incomplete" tone="warning" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
                <MoreButton disabled={isReadOnly} onPress={() => openMenu(scheme)} />
              </View>
              {expanded && <SchemeDetail scheme={scheme} />}
            </View>
          );
        })
      )}

      <SchemeFormModal
        mode={mode}
        existingCodes={schemes.map((s) => s.code)}
        saving={save.isPending}
        onClose={() => setMode(null)}
        onSubmit={(v) => save.mutate(v)}
        onSystemEditAttempt={() => Alert.alert('System scheme', SYSTEM_MESSAGE)}
      />
    </View>
  );
}

function SchemeFormModal({
  mode,
  existingCodes,
  saving,
  onClose,
  onSubmit,
  onSystemEditAttempt,
}: {
  mode: FormMode | null;
  existingCodes: string[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (v: { code: string; name: string; description: string }) => void;
  onSystemEditAttempt: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!mode) return;
    if (mode.kind === 'add') {
      setName('');
      setCode('');
      setDescription('');
    } else if (mode.kind === 'duplicate') {
      setName(`Copy of ${mode.scheme.name}`.slice(0, 200));
      setCode('');
      setDescription(mode.scheme.description);
    } else {
      setName(mode.scheme.name);
      setCode(mode.scheme.code);
      setDescription(mode.scheme.description);
    }
  }, [mode]);

  if (!mode) return null;

  const title = mode.kind === 'add' ? 'Add Grading Scheme' : mode.kind === 'edit' ? 'Edit Grading Scheme' : 'Duplicate Grading Scheme';

  const submit = () => {
    if (mode.kind === 'edit' && mode.scheme.isSystemDefined) return onSystemEditAttempt();
    const cleanCode = code.trim();
    if (!name.trim() || !cleanCode) return Alert.alert('Check the form', 'Please enter both name and code');
    const clash = existingCodes.some(
      (c) =>
        c.toLowerCase() === cleanCode.toLowerCase() &&
        !(mode.kind === 'edit' && c.toLowerCase() === mode.scheme.code.toLowerCase())
    );
    if (clash) return Alert.alert('Check the form', 'A scheme with this code already exists');
    onSubmit({ code: cleanCode, name: name.trim(), description: description.trim() });
  };

  return (
    <FormModal visible title={title} onClose={onClose}>
      <Field label="Name" value={name} onChangeText={setName} maxLength={200} />
      <Field label="Code" value={code} onChangeText={setCode} maxLength={50} autoCapitalize="characters" />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} maxLength={500} />
      <FormActions
        confirmLabel={mode.kind === 'edit' ? 'Update' : mode.kind === 'duplicate' ? 'Duplicate' : 'Add'}
        saving={saving}
        onCancel={onClose}
        onConfirm={submit}
      />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15.5, fontWeight: '700', flexShrink: 1 },
  meta: { marginTop: 3, fontSize: 12.5, lineHeight: 18 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
});
