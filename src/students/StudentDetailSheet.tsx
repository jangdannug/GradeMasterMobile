import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GuardianRecord, formatStudentName, StudentRecord } from '../api/students';
import { Badge, SectionHeader } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { formatDate } from '../school-setup/dates';

const dash = (value: string | number | null | undefined) =>
  value === null || value === undefined || String(value).trim() === '' ? '—' : String(value);

/** "Last, First Middle, Extension" */
const relativeName = (g: GuardianRecord | undefined) =>
  g ? [g.lastName, [g.firstName, g.middleName].filter(Boolean).join(' '), g.extensionName].filter(Boolean).join(', ') : '';

const REASONS: Record<string, string> = { NoMother: 'Mother deceased', NotDisclosed: 'Not disclosed' };

export default function StudentDetailSheet({
  student,
  canManage,
  onClose,
  onEdit,
}: {
  student: StudentRecord | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (student: StudentRecord) => void;
}) {
  const t = useDashboardTheme();
  if (!student) return null;

  const byType = (type: string) => student.guardians.find((g) => g.relationshipType.toLowerCase() === type);
  const father = byType('father');
  const mother = byType('mother');
  const guardian = byType('guardian');

  const permanent = student.isPermanentSameAsCurrent
    ? 'Same as current'
    : [
        student.permanentHouseNo,
        student.permanentStreet,
        student.permanentBarangay,
        student.permanentCityMunicipality,
        student.permanentProvince,
        student.permanentZipCode,
      ]
        .filter(Boolean)
        .join(', ');

  const date = (value: string) => (value ? formatDate(value.slice(0, 10)) : '');
  const stamp = (value: string) => (value ? formatDate(value.slice(0, 10)) : '');
  const names = (list: { name: string }[]) => list.map((x) => x.name).join(', ');

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { backgroundColor: t.background }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: t.primary }]}>{formatStudentName(student)}</Text>
            <Text style={[styles.subtitle, { color: t.muted }]}>
              {student.lrn ? `LRN ${student.lrn}` : 'Student details'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color={t.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Section title="Personal Information">
            <Row label="PSA Birth Certificate No." value={dash(student.psaBirthCertNo)} />
            <Row label="LRN" value={dash(student.lrn)} mono />
            <Row label="First Name" value={dash(student.firstName)} />
            <Row label="Middle Name" value={dash(student.middleName)} />
            <Row label="Last Name" value={dash(student.lastName)} />
            <Row label="Suffix" value={dash(student.suffix)} />
            <Row label="Birth Date" value={dash(date(student.birthDate))} />
            <Row label="Age" value={dash(student.age)} />
            <Row label="Sex" value={dash(student.sex)} />
            <Row label="Place of Birth" value={dash(student.placeOfBirth)} />
            <Row label="Email Address" value={dash(student.emailAddress)} />
            <Row label="Country of Citizenship" value={dash(student.countryOfCitizenship)} />
          </Section>

          <Section title="Address">
            <Row label="House No." value={dash(student.houseNo)} />
            <Row label="Street" value={dash(student.street)} />
            <Row label="Barangay" value={dash(student.barangay)} />
            <Row label="City / Municipality" value={dash(student.cityMunicipality)} />
            <Row label="Province" value={dash(student.province)} />
            <Row label="ZIP Code" value={dash(student.zipCode)} />
            <Row label="Permanent Address" value={dash(permanent)} />
          </Section>

          <Section title="Family Background">
            <Row label="Mother Tongue" value={dash(student.motherTongue)} />
            <Row label="Religion" value={dash(student.religion)} />
            <Row label="Spoken Languages" value={dash(names(student.spokenLanguages))} />
            <FlagRow label="Indigenous People" on={student.isIndigenousPeople} />
            {student.isIndigenousPeople && <Row label="Ethnicities" value={dash(names(student.ethnicities))} />}
            <FlagRow label="CCT Beneficiary" on={student.isCctBeneficiary} />
            {student.isCctBeneficiary && <Row label="CCT Household ID" value={dash(student.cctHouseholdId)} />}
            <FlagRow label="Special Educational Needs" on={student.hasSpecialEducationalNeeds} />
            {student.hasSpecialEducationalNeeds && <Row label="LSEN Types" value={dash(names(student.lsenTypes))} />}
            <FlagRow label="COVID Vaccinated" on={student.isCovidVaccinated} />
            {student.isCovidVaccinated && (
              <>
                <Row label="First Shot" value={dash(date(student.covidFirstShotDate))} />
                <Row label="Full Vaccination" value={dash(date(student.covidFullVaccinationDate))} />
              </>
            )}
          </Section>

          <Section title="Parents & Guardian">
            <Row label="Father" value={dash(relativeName(father))} />
            <Row label="Mother" value={dash(relativeName(mother))} />
            <Row
              label="Guardian"
              value={dash(
                guardian ? `${relativeName(guardian)}${guardian.relationship ? ` (${guardian.relationship})` : ''}` : ''
              )}
            />
            <Row
              label="Mother Name Not Specified"
              value={dash(REASONS[mother?.motherNameNotSpecifiedReason ?? ''] ?? mother?.motherNameNotSpecifiedReason)}
            />
          </Section>

          <Section title="Record">
            <Row label="Created" value={dash(stamp(student.createdDate))} />
            <Row label="Modified" value={dash(stamp(student.modifiedDate))} />
          </Section>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: t.card, borderTopColor: t.border }]}>
          <TouchableOpacity style={[styles.close, { borderColor: t.border }]} onPress={onClose}>
            <Text style={[styles.closeText, { color: t.foreground }]}>Close</Text>
          </TouchableOpacity>
          {canManage && (
            <TouchableOpacity
              style={[styles.edit, { backgroundColor: t.primary }]}
              onPress={() => onEdit(student)}
              activeOpacity={0.85}
            >
              <Text style={styles.editText}>Edit Student</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useDashboardTheme();
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>{children}</View>
    </View>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const t = useDashboardTheme();
  return (
    <View style={[styles.row, { borderBottomColor: t.border }]}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: t.foreground }, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

function FlagRow({ label, on }: { label: string; on: boolean }) {
  const t = useDashboardTheme();
  return (
    <View style={[styles.row, { borderBottomColor: t.border }]}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <Badge label={on ? 'Yes' : 'No'} tone={on ? 'primary' : 'muted'} />
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 20, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { marginTop: 3, fontSize: 13 },
  body: { padding: 20, paddingTop: 8, paddingBottom: 32 },
  section: { marginBottom: 6 },
  card: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flexBasis: '42%', fontSize: 12.5, fontWeight: '600' },
  value: { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  mono: { fontFamily: 'Menlo' },
  footer: { flexDirection: 'row', gap: 12, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  close: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 15.5, fontWeight: '700' },
  edit: { flex: 1.4, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  editText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
});
