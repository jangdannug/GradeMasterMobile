import React, { useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { District, DistrictInput, districtsApi } from '../api/districts';
import {
  confirmDestructive,
  DashedEmpty,
  Field,
  FormActions,
  FormModal,
  SelectField,
  showRowMenu,
} from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { getProvinces, getRegionByName, getRegions, NCR_CITIES, NCR_REGION_CODE } from '../data/ph-address';
import { setupKeys, useDistricts, useRefresh } from './hooks';
import { joinParts, MoreButton, RowCard, TabHeader } from './SetupParts';

interface Form {
  code: string;
  name: string;
  website: string;
  regionName: string;
  divisionName: string;
}

const emptyForm: Form = { code: '', name: '', website: '', regionName: '', divisionName: '' };

const regionOptions = getRegions().map((r) => ({ value: r.name, label: r.name }));

// Division = the region's provinces; NCR has none, so it lists its cities instead
const divisionOptionsFor = (regionName: string) => {
  const region = getRegionByName(regionName);
  if (!region) return [];
  const names =
    region.code === NCR_REGION_CODE ? NCR_CITIES.map((c) => c.name) : getProvinces(region.code).map((p) => p.name);
  return names.map((n) => ({ value: n, label: n }));
};

export default function DistrictsTab() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { data: districts = [], isLoading, refetch } = useDistricts();
  const { refreshing, onRefresh } = useRefresh(refetch);

  const [editing, setEditing] = useState<District | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);

  const divisionOptions = useMemo(() => divisionOptionsFor(form.regionName), [form.regionName]);

  const save = useMutation({
    mutationFn: (input: DistrictInput) =>
      editing ? districtsApi.update(editing.districtId, input) : districtsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: setupKeys.districts });
      Alert.alert('Saved', editing ? 'District updated.' : 'District added.');
      close();
    },
    onError: (e) => Alert.alert('Could not save district', apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (districtId: string) => districtsApi.remove(districtId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: setupKeys.districts });
      Alert.alert('Deleted', 'District deleted.');
    },
    onError: (e) => Alert.alert('Could not delete district', apiErrorMessage(e)),
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (d: District) => {
    setEditing(d);
    // Resolve the region so its divisions repopulate
    const region = getRegionByName(d.regionName);
    setForm({
      code: d.code,
      name: d.name,
      website: d.website,
      regionName: region?.name ?? d.regionName,
      divisionName: d.divisionName,
    });
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const submit = () => {
    const f = form;
    if (!f.code.trim() || !f.name.trim() || !f.website.trim() || !f.regionName || !f.divisionName) {
      Alert.alert('Missing information', 'Please fill in code, name, website, region, and division');
      return;
    }
    save.mutate({
      code: f.code.trim(),
      name: f.name.trim(),
      website: f.website.trim(),
      regionName: f.regionName,
      divisionName: f.divisionName,
      psdsUserProfileId: editing?.psdsUserProfileId ?? null,
    });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={districts}
        keyExtractor={(d) => d.districtId}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        ListHeaderComponent={
          <TabHeader icon="flag" title="Districts" addLabel="Add District" onAdd={openAdd} />
        }
        ListEmptyComponent={
          isLoading ? undefined : (
            <DashedEmpty
              icon="flag-outline"
              title="No districts defined yet."
              subtitle="Add your first district to get started."
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <RowCard>
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={[styles.name, { color: t.foreground }]}>{item.name}</Text>
                <Text style={[styles.meta, { color: t.muted }]}>
                  {joinParts([item.code, item.website, item.divisionName, item.regionName], ' · ')}
                </Text>
              </View>
              <MoreButton
                onPress={() =>
                  showRowMenu(item.name, [
                    { label: 'Edit', onPress: () => openEdit(item) },
                    {
                      label: 'Delete',
                      destructive: true,
                      onPress: () =>
                        confirmDestructive('Delete district', `Delete ${item.name}?`, () =>
                          remove.mutate(item.districtId)
                        ),
                    },
                  ])
                }
              />
            </View>
          </RowCard>
        )}
      />

      <FormModal visible={open} title={editing ? 'Edit District' : 'Add District'} onClose={close}>
        <Field label="Code" value={form.code} onChangeText={(v) => setForm({ ...form, code: v })} autoCapitalize="characters" />
        <Field label="Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
        <Field
          label="Website"
          value={form.website}
          onChangeText={(v) => setForm({ ...form, website: v })}
          autoCapitalize="none"
          keyboardType="url"
        />
        <SelectField
          label="Region"
          value={form.regionName}
          options={regionOptions}
          placeholder="Select region"
          // Changing the region invalidates the division
          onChange={(v) => setForm({ ...form, regionName: v, divisionName: '' })}
        />
        <SelectField
          label="Division"
          value={form.divisionName}
          options={divisionOptions}
          placeholder={form.regionName ? 'Select division' : 'Select a region first'}
          disabled={!form.regionName}
          allowCustom
          onChange={(v) => setForm({ ...form, divisionName: v })}
        />
        <FormActions
          confirmLabel={editing ? 'Update' : 'Add'}
          saving={save.isPending}
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
  name: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 4, fontSize: 12.5, lineHeight: 18 },
});
