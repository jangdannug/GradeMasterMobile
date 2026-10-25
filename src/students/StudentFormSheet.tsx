import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { StudentRecord, studentsApi } from '../api/students';
import {
  CheckRow,
  DateField,
  Field,
  FormActions,
  MultiSelectField,
  Option,
  SectionHeader,
  SelectField,
  Segmented,
} from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import {
  buildStudentPayload,
  emptyStudentForm,
  formFromStudent,
  NOT_SPECIFIED_REASONS,
  RelativeForm,
  StudentFormState,
  SUFFIXES,
  validateStudentForm,
} from './studentForm';
import { useLookup } from './useLookup';

export type StudentFormTarget = { kind: 'create' } | { kind: 'edit'; student: StudentRecord };

const TABS = ['Personal Info', 'Address', 'Family Background', 'Parents & Guardian'] as const;

const toOptions = (list: { id: number; name: string }[] | undefined): Option[] =>
  (list ?? []).map((x) => ({ value: String(x.id), label: x.name }));

export default function StudentFormSheet({
  target,
  onClose,
}: {
  target: StudentFormTarget | null;
  onClose: () => void;
}) {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<StudentFormState>(emptyStudentForm);

  // Load the form whenever the sheet opens for a different target
  useEffect(() => {
    if (!target) return;
    setTab(0);
    setForm(target.kind === 'edit' ? formFromStudent(target.student) : emptyStudentForm());
  }, [target]);

  const languages = useLookup('languages');
  const religions = useLookup('religions');
  const ethnicities = useLookup('ethnicities');
  const lsenTypes = useLookup('lsenTypes');

  const save = useMutation({
    mutationFn: () => {
      const payload = buildStudentPayload(form);
      return target?.kind === 'edit'
        ? studentsApi.update(target.student.studentId, payload)
        : studentsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students-all'] });
      Alert.alert('Saved', target?.kind === 'edit' ? 'Student updated' : 'Student registered');
      onClose();
    },
    // The sheet stays open on failure so nothing typed is lost
    onError: (e) => Alert.alert('Could not save student', apiErrorMessage(e)),
  });

  if (!target) return null;

  const editing = target.kind === 'edit';
  const set = <K extends keyof StudentFormState>(key: K, value: StudentFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setRelative = (key: 'father' | 'mother' | 'guardian') => (patch: Partial<RelativeForm>) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  const submit = () => {
    const problem = validateStudentForm(form);
    if (problem) return Alert.alert('Check the form', problem);
    save.mutate();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modal, { backgroundColor: t.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.primary }]}>{editing ? 'Edit Student' : 'Register Student'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color={t.muted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.tabBar, { borderBottomColor: t.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
            {TABS.map((label, i) => (
              <TouchableOpacity
                key={label}
                style={[styles.tab, i === tab && { borderBottomColor: t.primary }]}
                onPress={() => setTab(i)}
              >
                <Text style={[styles.tabLabel, { color: i === tab ? t.primary : t.muted }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {tab === 0 && (
            <>
              <Field label="PSA Birth Certificate No." value={form.psaBirthCertNo} onChangeText={(v) => set('psaBirthCertNo', v)} />
              <Field label="LRN" value={form.lrn} onChangeText={(v) => set('lrn', v)} keyboardType="number-pad" />
              <Field label="First Name *" value={form.firstName} onChangeText={(v) => set('firstName', v)} />
              <Field label="Middle Name" value={form.middleName} onChangeText={(v) => set('middleName', v)} />
              <Field label="Last Name *" value={form.lastName} onChangeText={(v) => set('lastName', v)} />
              <SelectField
                label="Suffix"
                value={form.suffix}
                options={[{ value: '', label: 'None' }, ...SUFFIXES.map((s) => ({ value: s, label: s }))]}
                placeholder="None"
                onChange={(v) => set('suffix', v)}
              />
              <DateField label="Birth Date" value={form.birthDate} onChange={(v) => set('birthDate', v)} />
              <Segmented label="Sex" options={['Male', 'Female'] as const} value={form.sex} onChange={(v) => set('sex', v)} />
              <Field label="Place of Birth" value={form.placeOfBirth} onChangeText={(v) => set('placeOfBirth', v)} />
              <Field
                label="Email Address"
                value={form.emailAddress}
                onChangeText={(v) => set('emailAddress', v)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field
                label="Country of Citizenship *"
                value={form.countryOfCitizenship}
                onChangeText={(v) => set('countryOfCitizenship', v)}
              />
            </>
          )}

          {tab === 1 && (
            <>
              <SectionHeader title="Current Address" />
              <Field label="House No." value={form.houseNo} onChangeText={(v) => set('houseNo', v)} />
              <Field label="Street" value={form.street} onChangeText={(v) => set('street', v)} />
              <Field label="Barangay" value={form.barangay} onChangeText={(v) => set('barangay', v)} />
              <Field label="City / Municipality *" value={form.cityMunicipality} onChangeText={(v) => set('cityMunicipality', v)} />
              <Field label="Province *" value={form.province} onChangeText={(v) => set('province', v)} />
              <Field label="ZIP Code" value={form.zipCode} onChangeText={(v) => set('zipCode', v)} keyboardType="number-pad" />
              <CheckRow
                label="Permanent address is the same as current"
                checked={form.permanentSame}
                onChange={(v) => set('permanentSame', v)}
              />
              {!form.permanentSame && (
                <>
                  <SectionHeader title="Permanent Address" />
                  <Field label="House No." value={form.permanentHouseNo} onChangeText={(v) => set('permanentHouseNo', v)} />
                  <Field label="Street" value={form.permanentStreet} onChangeText={(v) => set('permanentStreet', v)} />
                  <Field label="Barangay" value={form.permanentBarangay} onChangeText={(v) => set('permanentBarangay', v)} />
                  <Field
                    label="City / Municipality *"
                    value={form.permanentCityMunicipality}
                    onChangeText={(v) => set('permanentCityMunicipality', v)}
                  />
                  <Field label="Province *" value={form.permanentProvince} onChangeText={(v) => set('permanentProvince', v)} />
                  <Field
                    label="ZIP Code"
                    value={form.permanentZipCode}
                    onChangeText={(v) => set('permanentZipCode', v)}
                    keyboardType="number-pad"
                  />
                </>
              )}
            </>
          )}

          {tab === 2 && (
            <>
              <SelectField
                label="Mother Tongue"
                value={form.motherTongueId}
                options={toOptions(languages.data)}
                placeholder={languages.isLoading ? 'Loading...' : 'Select mother tongue'}
                clearable
                onChange={(v) => set('motherTongueId', v)}
              />
              <SelectField
                label="Religion"
                value={form.religionId}
                options={toOptions(religions.data)}
                placeholder={religions.isLoading ? 'Loading...' : 'Select religion'}
                clearable
                onChange={(v) => set('religionId', v)}
              />
              <MultiSelectField
                label="Other Spoken Languages"
                values={form.spokenLanguageIds}
                options={toOptions(languages.data)}
                placeholder={languages.isLoading ? 'Loading...' : 'Select languages'}
                onChange={(v) => set('spokenLanguageIds', v)}
              />

              <CheckRow label="Member of an indigenous people group" checked={form.isIndigenous} onChange={(v) => set('isIndigenous', v)} />
              {form.isIndigenous && (
                <MultiSelectField
                  label="Ethnicities"
                  values={form.ethnicityIds}
                  options={toOptions(ethnicities.data)}
                  placeholder={ethnicities.isLoading ? 'Loading...' : 'Select ethnicities'}
                  onChange={(v) => set('ethnicityIds', v)}
                />
              )}

              <CheckRow label="CCT beneficiary" checked={form.isCct} onChange={(v) => set('isCct', v)} />
              {form.isCct && (
                <Field label="CCT Household ID" value={form.cctHouseholdId} onChangeText={(v) => set('cctHouseholdId', v)} />
              )}

              <CheckRow label="Has special educational needs" checked={form.hasSen} onChange={(v) => set('hasSen', v)} />
              {form.hasSen && (
                <MultiSelectField
                  label="LSEN Types"
                  values={form.lsenTypeIds}
                  options={toOptions(lsenTypes.data)}
                  placeholder={lsenTypes.isLoading ? 'Loading...' : 'Select LSEN types'}
                  onChange={(v) => set('lsenTypeIds', v)}
                />
              )}

              <CheckRow label="COVID-19 vaccinated" checked={form.isCovidVaccinated} onChange={(v) => set('isCovidVaccinated', v)} />
              {form.isCovidVaccinated && (
                <>
                  <DateField label="First Shot Date" value={form.covidFirstShotDate} clearable onChange={(v) => set('covidFirstShotDate', v)} />
                  <DateField
                    label="Full Vaccination Date"
                    value={form.covidFullVaccinationDate}
                    clearable
                    onChange={(v) => set('covidFullVaccinationDate', v)}
                  />
                </>
              )}
            </>
          )}

          {tab === 3 && (
            <>
              <Text style={[styles.hint, { color: t.muted }]}>At least one of father, mother, or guardian is required.</Text>
              <RelativeBlock title="Father" value={form.father} onChange={setRelative('father')} />
              <RelativeBlock title="Mother" value={form.mother} onChange={setRelative('mother')} mother />
              <RelativeBlock title="Guardian" value={form.guardian} onChange={setRelative('guardian')} guardian />
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: t.card, borderTopColor: t.border }]}>
          <FormActions
            confirmLabel={editing ? 'Update Student' : 'Register Student'}
            saving={save.isPending}
            onCancel={onClose}
            onConfirm={submit}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RelativeBlock({
  title,
  value,
  onChange,
  mother,
  guardian,
}: {
  title: string;
  value: RelativeForm;
  onChange: (patch: Partial<RelativeForm>) => void;
  mother?: boolean;
  guardian?: boolean;
}) {
  const t = useDashboardTheme();
  return (
    <View style={[styles.block, { backgroundColor: t.card, borderColor: t.border }]}>
      <SectionHeader title={title} />
      <Field label="Last Name" value={value.lastName} onChangeText={(v) => onChange({ lastName: v })} />
      <Field label="First Name" value={value.firstName} onChangeText={(v) => onChange({ firstName: v })} />
      <Field
        label="Middle Name"
        value={value.noMiddleName ? '' : value.middleName}
        onChangeText={(v) => onChange({ middleName: v })}
        editable={!value.noMiddleName}
        style={value.noMiddleName ? { opacity: 0.5 } : undefined}
      />
      <CheckRow
        label="No middle name"
        checked={value.noMiddleName}
        onChange={(v) => onChange({ noMiddleName: v, middleName: v ? '' : value.middleName })}
      />
      <Field
        label="Extension (e.g. Jr., III)"
        value={value.extensionName}
        onChangeText={(v) => onChange({ extensionName: v })}
      />
      {guardian && (
        <Field
          label="Relationship to learner"
          value={value.relationship}
          onChangeText={(v) => onChange({ relationship: v })}
          placeholder="e.g. Aunt, Grandmother"
        />
      )}
      {mother && !value.lastName.trim() && (
        <SelectField
          label="Reason maiden name is not specified"
          value={value.notSpecifiedReason}
          options={NOT_SPECIFIED_REASONS}
          placeholder="Not specified (none)"
          onChange={(v) => onChange({ notSpecifiedReason: v })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '800' },
  tabBar: { borderBottomWidth: 1 },
  tabBarContent: { paddingHorizontal: 12 },
  tab: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 13.5, fontWeight: '700' },
  body: { padding: 20, paddingBottom: 32 },
  hint: { fontSize: 13, marginBottom: 14 },
  block: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  footer: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
});
