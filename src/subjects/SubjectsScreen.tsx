import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Field, FormModal, ListHeader, PrimaryButton, theme } from '../components/forms';
import { apiErrorMessage } from '../api';
import { schoolYearsApi } from '../api/schoolYears';
import { Subject, subjectsApi } from '../api/subjects';

export default function SubjectsScreen() {
  const [items, setItems] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [units, setUnits] = useState('');
  const [description, setDescription] = useState('');
  const [isCore, setIsCore] = useState(true);
  const [errors, setErrors] = useState<{ code?: string; name?: string; units?: string }>({});

  const load = useCallback(async () => {
    try {
      setItems(await subjectsApi.list());
    } catch (e) {
      Alert.alert('Could not load subjects', apiErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setCode('');
    setName('');
    setUnits('');
    setDescription('');
    setIsCore(true);
    setErrors({});
  };

  const save = async () => {
    const next: typeof errors = {};
    if (!code.trim()) next.code = 'Code is required';
    if (!name.trim()) next.name = 'Name is required';
    if (units && Number.isNaN(Number(units))) next.units = 'Units must be a number';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      // New subjects belong to the active school year
      const years = await schoolYearsApi.list();
      const year = years.find((y) => y.isActive) ?? years[0];
      if (!year) throw new Error('Create a school year first.');
      await subjectsApi.create({
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        units: units ? Number(units) : undefined,
        isCore,
        schoolYearId: year.schoolYearId,
      });
      setAdding(false);
      reset();
      load();
    } catch (e) {
      Alert.alert('Could not save subject', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (s: Subject) =>
    Alert.alert('Delete subject', `Delete ${s.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await subjectsApi.remove(s.subjectId);
            load();
          } catch (e) {
            Alert.alert('Could not delete subject', apiErrorMessage(e));
          }
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ListHeader
        title="Subjects"
        subtitle={`${items.length} subject${items.length === 1 ? '' : 's'}`}
        onAdd={() => setAdding(true)}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.subjectId}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={<EmptyState icon="book-outline" text="No subjects yet. Tap + to add one." />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Text style={styles.code}>{item.code}</Text>
                  {item.isCore && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Core</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.name}>{item.name}</Text>
                {!!item.description && <Text style={styles.muted}>{item.description}</Text>}
                {item.units != null && <Text style={styles.muted}>{item.units} unit(s)</Text>}
              </View>
              <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="trash-outline" size={20} color={theme.danger} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <FormModal
        visible={adding}
        title="Add Subject"
        onClose={() => {
          setAdding(false);
          reset();
        }}
      >
        <Field label="Code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="e.g. MATH7" error={errors.code} />
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Mathematics 7" error={errors.name} />
        <Field label="Description (optional)" value={description} onChangeText={setDescription} />
        <Field label="Units (optional)" value={units} onChangeText={setUnits} keyboardType="decimal-pad" error={errors.units} />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Core subject</Text>
          <Switch value={isCore} onValueChange={setIsCore} />
        </View>
        <PrimaryButton title="Save Subject" onPress={save} loading={saving} />
      </FormModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  list: { padding: 20, paddingTop: 4, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontSize: 12, fontWeight: '700', color: theme.accent },
  name: { marginTop: 2, fontSize: 17, fontWeight: '700', color: theme.text },
  muted: { marginTop: 2, fontSize: 12.5, color: theme.muted },
  badge: { backgroundColor: '#DBEAFE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700', color: theme.accent },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  switchLabel: { fontSize: 15, color: theme.text, fontWeight: '600' },
});
