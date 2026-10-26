import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { schoolsApi } from '../api/schools';
import {
  EMPLOYMENT_STATUSES,
  fullName,
  UserProfile,
  UserProfileInput,
  userManagementApi,
} from '../api/userProfiles';
import { DateField, FormActions, MultiSelectField, SelectField } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useAuthStore } from '../stores/authStore';

export type UserFormTarget = { kind: 'create' } | { kind: 'edit'; user: UserProfile };

const LONG_CACHE = { staleTime: 60 * 60 * 1000, gcTime: 2 * 60 * 60 * 1000, refetchOnWindowFocus: false } as const;

type Errors = Partial<Record<'firstName' | 'lastName' | 'email' | 'employeeNumber' | 'hireDate' | 'positionId' | 'schoolId', string>>;

const empty = (schoolId: string): UserProfileInput => ({
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  employeeNumber: '',
  licenseNumber: '',
  hireDate: '',
  employmentStatus: 'Permanent',
  positionId: '',
  designationIds: [],
  schoolId,
});

const formFor = (target: UserFormTarget, defaultSchool: string): UserProfileInput => {
  if (target.kind === 'create') return empty(defaultSchool);
  const u = target.user;
  return {
    firstName: u.firstName,
    middleName: u.middleName,
    lastName: u.lastName,
    email: u.email,
    employeeNumber: u.employeeNumber,
    licenseNumber: u.licenseNumber,
    hireDate: u.hireDate.slice(0, 10),
    employmentStatus: u.employmentStatus || 'Permanent',
    positionId: u.positionId,
    // The API never returns a profile's designations, so the picker starts empty
    designationIds: [],
  };
};

/** Remounted per target (key), so the form always starts from that user's values */
export default function UserFormSheet({ target, onClose }: { target: UserFormTarget | null; onClose: () => void }) {
  if (!target) return null;
  const key = target.kind === 'edit' ? target.user.userProfileId : 'create';
  return <UserFormBody key={key} target={target} onClose={onClose} />;
}

function UserFormBody({ target, onClose }: { target: UserFormTarget; onClose: () => void }) {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const defaultSchool = authUser?.schoolId || '';
  const [form, setForm] = useState<UserProfileInput>(() => formFor(target, defaultSchool));
  const [errors, setErrors] = useState<Errors>({});

  const open = true;
  const positions = useQuery({ queryKey: ['positions'], queryFn: userManagementApi.positions, enabled: open, ...LONG_CACHE });
  const designations = useQuery({ queryKey: ['designations'], queryFn: userManagementApi.designations, enabled: open, ...LONG_CACHE });
  const schools = useQuery({ queryKey: ['schools'], queryFn: schoolsApi.list, enabled: open, ...LONG_CACHE });

  const editing = target.kind === 'edit';
  const display = fullName(form);

  const save = useMutation({
    mutationFn: () =>
      target.kind === 'edit' ? userManagementApi.update(target.user.userProfileId, form) : userManagementApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-paged'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-all'] });
      Alert.alert(`User "${[form.firstName, form.lastName].filter(Boolean).join(' ')}" ${editing ? 'updated' : 'created'}`);
      onClose();
    },
    // The sheet stays open on failure so nothing typed is lost
    onError: (e) => Alert.alert(`Could not ${editing ? 'update' : 'create'} user`, apiErrorMessage(e)),
  });

  const positionOptions = useMemo(
    () => (positions.data ?? []).map((p) => ({ value: p.positionId, label: p.name })),
    [positions.data]
  );
  const designationOptions = useMemo(
    () => (designations.data ?? []).map((d) => ({ value: d.userDesignationId, label: d.name })),
    [designations.data]
  );
  const schoolOptions = useMemo(
    () => (schools.data ?? []).map((s) => ({ value: s.schoolId, label: s.name })),
    [schools.data]
  );

  const set = <K extends keyof UserProfileInput>(key: K, value: UserProfileInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = () => {
    const e: Errors = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    if (!form.email.trim()) e.email = 'Email address is required';
    if (!form.employeeNumber.trim()) e.employeeNumber = 'Employee number is required';
    if (!form.hireDate) e.hireDate = 'Hire date is required';
    if (!form.positionId) e.positionId = 'Position is required';
    if (!editing && !form.schoolId) e.schoolId = 'School is required';
    setErrors(e);
    if (Object.keys(e).length === 0) save.mutate();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: t.primary }]}>{editing ? 'Edit User' : 'Add User'}</Text>
            {editing && !!display && <Text style={[styles.sub, { color: t.muted }]}>{display}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color={t.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextRow label="First name *" value={form.firstName} error={errors.firstName} onChangeText={(v) => set('firstName', v)} autoCapitalize="words" />
          <TextRow label="Middle name" value={form.middleName} onChangeText={(v) => set('middleName', v)} autoCapitalize="words" />
          <TextRow label="Last name *" value={form.lastName} error={errors.lastName} onChangeText={(v) => set('lastName', v)} autoCapitalize="words" />
          <TextRow
            label="Email *"
            value={form.email}
            error={errors.email}
            onChangeText={(v) => set('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextRow label="Employee number *" value={form.employeeNumber} error={errors.employeeNumber} onChangeText={(v) => set('employeeNumber', v)} autoCapitalize="characters" />
          <TextRow label="License number" value={form.licenseNumber} onChangeText={(v) => set('licenseNumber', v)} autoCapitalize="characters" />
          <DateField label="Hire date *" value={form.hireDate} onChange={(v) => set('hireDate', v)} error={errors.hireDate} />
          <SelectField
            label="Employment status"
            value={form.employmentStatus}
            options={EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: s }))}
            onChange={(v) => set('employmentStatus', v)}
          />
          <SelectField
            label="Position *"
            value={form.positionId}
            options={positionOptions}
            onChange={(v) => set('positionId', v)}
            placeholder={positions.isLoading ? 'Loading positions...' : 'Select a position'}
            error={errors.positionId}
          />
          <MultiSelectField
            label="Designations"
            values={form.designationIds}
            options={designationOptions}
            onChange={(v) => set('designationIds', v)}
            placeholder={designations.isLoading ? 'Loading designations...' : 'Optional'}
          />
          {editing && (
            <Text style={[styles.note, { color: t.muted }]}>
              {"Existing designations aren't shown. Select to replace them."}
            </Text>
          )}
          {!editing && (
            <SelectField
              label="School *"
              value={form.schoolId ?? ''}
              options={schoolOptions}
              onChange={(v) => set('schoolId', v)}
              disabled={schoolOptions.length <= 1 && !!form.schoolId}
              placeholder={schools.isLoading ? 'Loading schools...' : 'Select a school'}
              error={errors.schoolId}
            />
          )}

          <FormActions confirmLabel={editing ? 'Save changes' : 'Create user'} saving={save.isPending} onCancel={onClose} onConfirm={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TextRow({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const t = useDashboardTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        {...props}
        style={[
          styles.input,
          { color: t.foreground, backgroundColor: t.card, borderColor: error ? t.destructive : t.border },
        ]}
      />
      {!!error && <Text style={[styles.error, { color: t.destructive }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12.5, marginTop: 2 },
  body: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { height: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  error: { marginTop: 4, fontSize: 11.5 },
  note: { marginTop: -8, marginBottom: 14, fontSize: 12 },
});
