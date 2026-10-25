import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { GradeLevel } from '../api/gradeLevels';
import { Section } from '../api/sections';
import { Field, FormActions, FormModal, SelectField } from '../components/forms';

export interface SectionFormValues {
  name: string;
  description: string;
  gradeLevelId: string;
}

export type SectionFormTarget = { kind: 'add' } | { kind: 'edit'; section: Section };

export default function SectionFormModal({
  target,
  levels,
  defaultLevelId,
  saving,
  onClose,
  onSubmit,
}: {
  target: SectionFormTarget | null;
  levels: GradeLevel[];
  defaultLevelId: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: SectionFormValues) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gradeLevelId, setGradeLevelId] = useState('');

  useEffect(() => {
    if (!target) return;
    if (target.kind === 'edit') {
      setName(target.section.name);
      setDescription(target.section.description);
      setGradeLevelId(target.section.gradeLevelId);
    } else {
      setName('');
      setDescription('');
      setGradeLevelId(defaultLevelId);
    }
  }, [target, defaultLevelId]);

  if (!target) return null;

  const submit = () => {
    if (!name.trim()) return Alert.alert('Check the form', 'Please enter a section name');
    if (!gradeLevelId) return Alert.alert('Check the form', 'Please select a grade level');
    onSubmit({ name: name.trim(), description: description.trim(), gradeLevelId });
  };

  return (
    <FormModal visible title={target.kind === 'add' ? 'Add Section' : 'Edit Section'} onClose={onClose}>
      <Field label="Name" value={name} onChangeText={setName} placeholder='e.g. "Section A", "St. John"' />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} />
      <SelectField
        label="Grade Level"
        value={gradeLevelId}
        options={levels.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` }))}
        placeholder="Select a grade level"
        onChange={setGradeLevelId}
      />
      <FormActions
        confirmLabel={target.kind === 'add' ? 'Add' : 'Update'}
        saving={saving}
        onCancel={onClose}
        onConfirm={submit}
      />
    </FormModal>
  );
}
