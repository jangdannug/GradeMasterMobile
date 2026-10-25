import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Field, FormActions, FormModal } from '../components/forms';

/** Code + name form shared by transmutation tables and descriptor sets */
export function SetFormModal({
  visible,
  title,
  initial,
  existingCodes,
  duplicateMessage,
  saving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  initial: { code: string; name: string } | null;
  /** Lower-cased codes already taken (the edited one excluded) */
  existingCodes: string[];
  duplicateMessage: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (v: { code: string; name: string }) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCode(initial?.code ?? '');
    setName(initial?.name ?? '');
  }, [visible, initial]);

  if (!visible) return null;

  const submit = () => {
    const cleanCode = code.trim();
    if (!cleanCode || !name.trim()) return Alert.alert('Check the form', 'Please enter both code and name');
    if (existingCodes.includes(cleanCode.toLowerCase())) return Alert.alert('Check the form', duplicateMessage);
    onSubmit({ code: cleanCode, name: name.trim() });
  };

  return (
    <FormModal visible title={title} onClose={onClose}>
      <Field label="Code" value={code} onChangeText={setCode} autoCapitalize="characters" />
      <Field label="Name" value={name} onChangeText={setName} />
      <FormActions confirmLabel={initial ? 'Update' : 'Add'} saving={saving} onCancel={onClose} onConfirm={submit} />
    </FormModal>
  );
}

/** Parses a grade field: required, numeric, 0-100. Returns the number or an error message. */
export function parseGrade(label: string, raw: string): number | string {
  if (!raw.trim()) return `${label} is required`;
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0 || value > 100) return `${label} must be a number between 0 and 100`;
  return value;
}

/** True when two inclusive grade ranges overlap (or duplicate each other) */
export const rangesOverlap = (aMin: number, aMax: number, bMin: number, bMax: number) =>
  aMin <= bMax && bMin <= aMax;
