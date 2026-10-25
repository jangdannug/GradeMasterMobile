import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Field, FormActions, FormModal } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { ChildSubjectDetail, SubjectDetail } from './useAcademicSetupData';

export type SubjectFormMode =
  | { kind: 'create' }
  | { kind: 'edit'; subject: SubjectDetail }
  | { kind: 'add-child'; parent: SubjectDetail }
  | { kind: 'edit-child'; parent: SubjectDetail; child: ChildSubjectDetail };

export interface ChildDraft {
  code: string;
  name: string;
}

export interface SubjectFormValues {
  code: string;
  name: string;
  description: string;
  units: number;
  isComposite: boolean;
  children: ChildDraft[];
}

interface Props {
  mode: SubjectFormMode | null;
  /** Every subject code in the level (roots and children), to enforce uniqueness */
  levelCodes: { subjectId: string; code: string }[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: SubjectFormValues) => void;
}

const TITLES: Record<SubjectFormMode['kind'], string> = {
  create: 'Add Subject',
  edit: 'Edit Subject',
  'add-child': 'Add Child Subject',
  'edit-child': 'Edit Child Subject',
};

export default function SubjectFormModal({ mode, levelCodes, saving, onClose, onSubmit }: Props) {
  const t = useDashboardTheme();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [units, setUnits] = useState('');
  const [isComposite, setIsComposite] = useState(false);
  const [drafts, setDrafts] = useState<ChildDraft[]>([]);

  // Reset the fields whenever the form is opened for a different target
  useEffect(() => {
    if (!mode) return;
    setDrafts([]);
    if (mode.kind === 'create') {
      setCode('');
      setName('');
      setDescription('');
      setUnits('');
      setIsComposite(false);
    } else if (mode.kind === 'edit') {
      setCode(mode.subject.code);
      setName(mode.subject.name);
      setDescription(mode.subject.description);
      setUnits(mode.subject.units != null ? String(mode.subject.units) : '');
      setIsComposite(mode.subject.isComposite);
    } else if (mode.kind === 'add-child') {
      setCode('');
      setName('');
      setDescription('');
      setUnits('');
      setIsComposite(false);
    } else {
      setCode(mode.child.code);
      setName(mode.child.name);
      setDescription(mode.child.description);
      setUnits(mode.child.units != null ? String(mode.child.units) : '0');
      setIsComposite(false);
    }
  }, [mode]);

  if (!mode) return null;

  const kind = mode.kind;
  const isChildForm = kind === 'add-child' || kind === 'edit-child';
  const showUnits = kind !== 'add-child';
  const showComposite = kind === 'create' || kind === 'edit';

  // Subject ids being edited are exempt from the uniqueness check
  const editedIds = new Set<string>(
    kind === 'edit' ? [mode.subject.subjectId] : kind === 'edit-child' ? [mode.child.subjectId] : []
  );
  const takenCodes = new Set(
    levelCodes.filter((c) => !editedIds.has(c.subjectId)).map((c) => c.code.trim().toLowerCase())
  );

  const submit = () => {
    const fail = (message: string) => Alert.alert('Check the form', message);
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode || !name.trim()) return fail('Please enter both code and name');

    const unitsValue = Number(units);
    if (showUnits) {
      // A child may have 0 units; a root subject needs more than 0
      const invalid =
        !units.trim() || Number.isNaN(unitsValue) || (kind === 'edit-child' ? unitsValue < 0 : unitsValue <= 0);
      if (invalid) return fail('Please enter valid units');
    }

    if (takenCodes.has(cleanCode.toLowerCase())) return fail('Subject code already exists in this level');

    const childCodes = new Set<string>();
    const cleanDrafts: ChildDraft[] = [];
    for (const draft of drafts) {
      const childCode = draft.code.trim().toUpperCase();
      if (!childCode || !draft.name.trim()) return fail('Each child subject needs a code and a name');
      const lower = childCode.toLowerCase();
      if (lower === cleanCode.toLowerCase() || takenCodes.has(lower) || childCodes.has(lower))
        return fail(`Child subject code "${childCode}" already exists in this level`);
      childCodes.add(lower);
      cleanDrafts.push({ code: childCode, name: draft.name.trim() });
    }

    onSubmit({
      code: cleanCode,
      name: name.trim(),
      description: description.trim(),
      units: showUnits ? unitsValue : 0,
      isComposite: showComposite ? isComposite : false,
      children: kind === 'create' && isComposite ? cleanDrafts : [],
    });
  };

  const updateDraft = (index: number, patch: Partial<ChildDraft>) =>
    setDrafts((list) => list.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  return (
    <FormModal visible title={TITLES[kind]} onClose={onClose}>
      {mode.kind === 'add-child' && (
        <Text style={[styles.context, { color: t.muted }]}>Adding to {mode.parent.name}</Text>
      )}
      <Field
        label="Code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        placeholder={isChildForm ? 'e.g. MATH7-A' : 'e.g. MATH7'}
      />
      {showUnits && (
        <Field
          label="Units"
          value={units}
          onChangeText={(v) => setUnits(v.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder={kind === 'edit-child' ? '0' : 'e.g. 1.5'}
        />
      )}
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} />

      {showComposite && (
        <TouchableOpacity
          style={styles.checkRow}
          activeOpacity={0.7}
          onPress={() => setIsComposite((v) => !v)}
        >
          <Ionicons
            name={isComposite ? 'checkbox' : 'square-outline'}
            size={24}
            color={isComposite ? t.primary : t.muted}
          />
          <Text style={[styles.checkText, { color: t.foreground }]}>Composite (can contain subjects)</Text>
        </TouchableOpacity>
      )}

      {kind === 'create' && isComposite && (
        <View style={styles.children}>
          <Text style={[styles.childrenTitle, { color: t.primary }]}>Child subjects (optional)</Text>
          {drafts.map((draft, index) => (
            <View key={index} style={styles.draftRow}>
              <View style={{ width: 110 }}>
                <Field
                  label="Code"
                  value={draft.code}
                  onChangeText={(v) => updateDraft(index, { code: v })}
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Name" value={draft.name} onChangeText={(v) => updateDraft(index, { name: v })} />
              </View>
              <TouchableOpacity
                style={styles.draftRemove}
                onPress={() => setDrafts((list) => list.filter((_, i) => i !== index))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={24} color={t.destructive} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.addChild, { borderColor: t.border }]}
            onPress={() => setDrafts((list) => [...list, { code: '', name: '' }])}
          >
            <Ionicons name="add" size={18} color={t.primary} />
            <Text style={[styles.addChildText, { color: t.primary }]}>Add child subject</Text>
          </TouchableOpacity>
        </View>
      )}

      <FormActions
        confirmLabel={kind === 'create' || kind === 'add-child' ? 'Add' : 'Update'}
        saving={saving}
        onCancel={onClose}
        onConfirm={submit}
      />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  context: { fontSize: 13, marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  checkText: { fontSize: 15, fontWeight: '600' },
  children: { marginBottom: 12 },
  childrenTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  draftRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  draftRemove: { paddingBottom: 14 },
  addChild: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  addChildText: { fontSize: 13.5, fontWeight: '700' },
});
