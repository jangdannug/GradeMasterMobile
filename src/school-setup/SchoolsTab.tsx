import React, { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { CreateSchoolInput, School, schoolsApi } from '../api/schools';
import {
  Badge,
  confirmDestructive,
  DashedEmpty,
  Field,
  FormActions,
  FormModal,
  SelectField,
  showRowMenu,
} from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import {
  getMunicipalities,
  getMunicipalityByName,
  getProvinceByName,
  getProvinces,
  getRegionByName,
  getRegions,
  lookupByZip,
  NCR_CITIES,
  NCR_REGION_CODE,
} from '../data/ph-address';
import { setupKeys, useDistricts, useRefresh, useSchools } from './hooks';
import { joinParts, MoreButton, RowCard, SectionTitle, TabHeader } from './SetupParts';

interface Form {
  districtId: string;
  schoolHeadId: string;
  depEdSchoolId: string;
  name: string;
  code: string;
  description: string;
  postalCode: string;
  region: string;
  province: string;
  cityMunicipality: string;
  addressLine1: string;
  addressLine2: string;
}

const emptyForm: Form = {
  districtId: '',
  schoolHeadId: '',
  depEdSchoolId: '',
  name: '',
  code: '',
  description: '',
  postalCode: '',
  region: '',
  province: '',
  cityMunicipality: '',
  addressLine1: '',
  addressLine2: '',
};

const toOptions = (names: string[]) => names.map((n) => ({ value: n, label: n }));
const regionOptions = toOptions(getRegions().map((r) => r.name));

export default function SchoolsTab() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { data: schools = [], isLoading, refetch } = useSchools();
  const { data: districts = [] } = useDistricts();
  const { refreshing, onRefresh } = useRefresh(refetch);

  const [editing, setEditing] = useState<School | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  // Only one school can be active; this is local state (the backend has no such concept)
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
  const zipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Option lists ---------------------------------------------------------------------------
  const districtOptions = useMemo(
    () => districts.map((d) => ({ value: d.districtId, label: d.name })),
    [districts]
  );

  // Distinct school-head profiles found across schools, labelled by employee/license number
  const headOptions = useMemo(() => {
    const seen = new Map<string, string>();
    schools.forEach((s) => {
      if (s.schoolHead && !seen.has(s.schoolHead.userProfileId)) {
        seen.set(
          s.schoolHead.userProfileId,
          s.schoolHead.employeeNumber || s.schoolHead.licenseNumber || s.schoolHead.userProfileId
        );
      }
    });
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [schools]);

  const region = useMemo(() => getRegionByName(form.region), [form.region]);
  const isNcr = region?.code === NCR_REGION_CODE;
  const province = useMemo(
    () => (region ? getProvinceByName(region.code, form.province) : undefined),
    [region, form.province]
  );
  const provinceOptions = useMemo(
    () => (region && !isNcr ? toOptions(getProvinces(region.code).map((p) => p.name)) : []),
    [region, isNcr]
  );
  // NCR has no provinces, so its cities load directly
  const municipalities = useMemo(
    () => (isNcr ? NCR_CITIES : province ? getMunicipalities(province.code) : []),
    [isNcr, province]
  );
  const cityOptions = useMemo(() => toOptions(municipalities.map((m) => m.name)), [municipalities]);

  // ---- Mutations ------------------------------------------------------------------------------
  const create = useMutation({
    mutationFn: (input: CreateSchoolInput) => schoolsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: setupKeys.schools });
      Alert.alert('Saved', 'School added.');
      close();
    },
    onError: (e) => Alert.alert('Could not save school', apiErrorMessage(e)),
  });

  // ---- Form handling --------------------------------------------------------------------------
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (s: School) => {
    setEditing(s);
    const matchedRegion = getRegionByName(s.region);
    const matchedProvince = matchedRegion ? getProvinceByName(matchedRegion.code, s.province) : undefined;
    setForm({
      districtId: s.districtId ?? '',
      schoolHeadId: s.schoolHeadId ?? '',
      depEdSchoolId: s.depEdSchoolId,
      name: s.name,
      code: s.code,
      description: s.description,
      postalCode: s.postalCode,
      region: matchedRegion?.name ?? s.region,
      province: matchedProvince?.name ?? s.province,
      cityMunicipality: s.cityMunicipality,
      addressLine1: s.addressLine1,
      addressLine2: s.addressLine2,
    });
    setOpen(true);
  };

  const close = () => {
    if (zipTimer.current) clearTimeout(zipTimer.current);
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  // Postal code: a 4-digit code (debounced 400ms) fills region/province/city; clearing it clears
  // the cascade, but only when adding
  const onPostalChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    set({ postalCode: digits });
    if (zipTimer.current) clearTimeout(zipTimer.current);
    if (!digits) {
      if (!editing) set({ region: '', province: '', cityMunicipality: '' });
      return;
    }
    if (digits.length === 4) {
      zipTimer.current = setTimeout(() => {
        const hit = lookupByZip(digits);
        if (hit) {
          set({
            region: hit.region.name,
            province: hit.province?.name ?? '',
            cityMunicipality: hit.municipality.name,
          });
        }
      }, 400);
    }
  };

  const onRegionChange = (name: string) => set({ region: name, province: '', cityMunicipality: '' });
  const onProvinceChange = (name: string) => set({ province: name, cityMunicipality: '' });
  const onCityChange = (name: string) => {
    const match = getMunicipalityByName(municipalities, name);
    // Fill the postal code only if it is still empty
    set({
      cityMunicipality: name,
      ...(match?.zipCodes[0] && !form.postalCode ? { postalCode: match.zipCodes[0] } : {}),
    });
  };

  const submit = () => {
    const f = form;
    if (!f.name.trim() || !f.depEdSchoolId.trim()) {
      Alert.alert('Missing information', 'Please enter school name and DepEd School ID');
      return;
    }

    if (editing) {
      // TODO: no update endpoint yet; this edits the react-query cache only (as the web app does)
      const district = districts.find((d) => d.districtId === f.districtId);
      const head = headOptions.find((h) => h.value === f.schoolHeadId);
      queryClient.setQueryData<School[]>(setupKeys.schools, (old = []) =>
        old.map((s) =>
          s.schoolId === editing.schoolId
            ? {
                ...s,
                name: f.name.trim(),
                depEdSchoolId: f.depEdSchoolId.trim(),
                code: f.code.trim(),
                description: f.description.trim(),
                addressLine1: f.addressLine1.trim(),
                addressLine2: f.addressLine2.trim(),
                postalCode: f.postalCode,
                cityMunicipality: f.cityMunicipality,
                province: f.province,
                region: f.region,
                districtId: f.districtId || null,
                district: district
                  ? {
                      districtId: district.districtId,
                      name: district.name,
                      code: district.code,
                      regionName: district.regionName,
                      divisionName: district.divisionName,
                    }
                  : null,
                schoolHeadId: f.schoolHeadId || null,
                schoolHead: head
                  ? { userProfileId: head.value, employeeNumber: head.label, licenseNumber: '' }
                  : null,
              }
            : s
        )
      );
      Alert.alert('Saved', 'School updated locally (the server has no update endpoint yet).');
      close();
      return;
    }

    // The backend requires a district, code and description when creating a school
    if (!f.districtId || !f.code.trim() || !f.description.trim()) {
      Alert.alert('Missing information', 'Please select a district and enter the school code and description');
      return;
    }

    create.mutate({
      name: f.name.trim(),
      depEdSchoolId: f.depEdSchoolId.trim(),
      code: f.code.trim(),
      description: f.description.trim(),
      addressLine1: f.addressLine1.trim(),
      addressLine2: f.addressLine2.trim(),
      postalCode: f.postalCode,
      cityMunicipality: f.cityMunicipality,
      province: f.province,
      districtId: f.districtId || null,
      schoolHeadId: f.schoolHeadId || null,
    });
  };

  const removeLocal = (s: School) => {
    // TODO: no delete endpoint yet; removes from the react-query cache only (as the web app does)
    queryClient.setQueryData<School[]>(setupKeys.schools, (old = []) => old.filter((x) => x.schoolId !== s.schoolId));
    if (activeSchoolId === s.schoolId) setActiveSchoolId(null);
  };

  const districtName = (s: School) => s.district?.name || districts.find((d) => d.districtId === s.districtId)?.name || '';

  return (
    <View style={styles.container}>
      <FlatList
        data={schools}
        keyExtractor={(s) => s.schoolId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        ListHeaderComponent={<TabHeader icon="school" title="Schools" addLabel="Add School" onAdd={openAdd} />}
        ListEmptyComponent={
          isLoading ? undefined : (
            <DashedEmpty
              icon="school-outline"
              title="No schools defined yet."
              subtitle="Add your first school to get started."
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const active = item.schoolId === activeSchoolId;
          const address = joinParts(
            [item.addressLine1, item.addressLine2, item.cityMunicipality, item.province, item.region, item.postalCode],
            ', '
          );
          return (
            <RowCard highlighted={active}>
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: t.foreground }]}>{item.name}</Text>
                    {!!item.type && <Badge label={item.type} outline />}
                    {active && <Badge label="Active" tone="success" />}
                  </View>
                  <Text style={[styles.meta, { color: t.muted }]}>
                    {joinParts([item.depEdSchoolId, item.code], ' · ')}
                  </Text>
                  {!!address && <Text style={[styles.meta, { color: t.muted }]}>{address}</Text>}
                  {!!districtName(item) && (
                    <Text style={[styles.meta, { color: t.muted }]}>District: {districtName(item)}</Text>
                  )}
                </View>
                <MoreButton
                  onPress={() =>
                    showRowMenu(item.name, [
                      { label: 'Edit', onPress: () => openEdit(item) },
                      {
                        label: 'Remove',
                        destructive: true,
                        onPress: () =>
                          confirmDestructive(
                            'Remove school',
                            `Remove ${item.name} from the list? (Local only: the server has no delete endpoint yet.)`,
                            () => removeLocal(item),
                            'Remove'
                          ),
                      },
                    ])
                  }
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.activeButton,
                  { borderColor: active ? t.success : t.border, backgroundColor: active ? t.successTint : 'transparent' },
                ]}
                disabled={active}
                onPress={() => setActiveSchoolId(item.schoolId)}
              >
                <Text style={[styles.activeButtonText, { color: active ? t.success : t.primary }]}>
                  {active ? 'Active' : 'Set Active'}
                </Text>
              </TouchableOpacity>
            </RowCard>
          );
        }}
      />

      <FormModal visible={open} title={editing ? 'Edit School' : 'Add School'} onClose={close}>
        <SectionTitle>School Details</SectionTitle>
        <SelectField
          label="District"
          value={form.districtId}
          options={districtOptions}
          placeholder="Select district"
          onChange={(v) => set({ districtId: v })}
        />
        <SelectField
          label="School Head"
          value={form.schoolHeadId}
          options={headOptions}
          placeholder="Select school head"
          clearable
          onChange={(v) => set({ schoolHeadId: v })}
        />
        <Field
          label="DepEd School ID"
          value={form.depEdSchoolId}
          onChangeText={(v) => set({ depEdSchoolId: v })}
          keyboardType="number-pad"
        />
        <Field label="Name" value={form.name} onChangeText={(v) => set({ name: v })} />
        <Field label="Code" value={form.code} onChangeText={(v) => set({ code: v })} autoCapitalize="characters" />
        <Field
          label="Description"
          value={form.description}
          onChangeText={(v) => set({ description: v })}
        />

        <SectionTitle>Address</SectionTitle>
        <Field
          label="Postal Code"
          value={form.postalCode}
          onChangeText={onPostalChange}
          keyboardType="number-pad"
          maxLength={4}
        />
        <SelectField
          label="Region"
          value={form.region}
          options={regionOptions}
          placeholder="Select region"
          onChange={onRegionChange}
        />
        <SelectField
          label="Province"
          value={form.province}
          options={provinceOptions}
          placeholder={isNcr ? 'Not applicable (NCR)' : region ? 'Select province' : 'Select a region first'}
          disabled={!region || isNcr}
          allowCustom
          onChange={onProvinceChange}
        />
        <SelectField
          label="City / Municipality"
          value={form.cityMunicipality}
          options={cityOptions}
          placeholder={region ? 'Select city / municipality' : 'Select a region first'}
          disabled={!region}
          allowCustom
          onChange={onCityChange}
        />
        <Field
          label="Address Line 1"
          value={form.addressLine1}
          onChangeText={(v) => set({ addressLine1: v })}
        />
        <Field
          label="Address Line 2 (optional)"
          value={form.addressLine2}
          onChangeText={(v) => set({ addressLine2: v })}
        />

        <FormActions
          confirmLabel={editing ? 'Update' : 'Add'}
          saving={create.isPending}
          onCancel={close}
          onConfirm={submit}
        />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowMain: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 4, fontSize: 12.5, lineHeight: 18 },
  activeButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  activeButtonText: { fontSize: 13, fontWeight: '700' },
});
