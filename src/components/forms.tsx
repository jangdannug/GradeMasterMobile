import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useDashboardTheme } from '../dashboard/theme';
import { formatDate, fromDateString, toDateString } from '../school-setup/dates';

export const theme = {
  bg: '#F5F7FA',
  card: '#FFFFFF',
  primary: '#1E3A5F',
  accent: '#3B82F6',
  text: '#1E293B',
  muted: '#64748B',
  border: '#E2E8F0',
  danger: '#DC2626',
  success: '#059669',
};

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#94A3B8"
        {...props}
        style={[styles.input, !!error && styles.inputError, props.style]}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segments}>
        {options.map((o) => (
          <TouchableOpacity
            key={o}
            style={[styles.segment, value === o && styles.segmentActive]}
            onPress={() => onChange(o)}
          >
            <Text style={[styles.segmentText, value === o && styles.segmentTextActive]}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.button, (disabled || loading) && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function FormModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color={theme.muted} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ListHeader({
  title,
  subtitle,
  onAdd,
}: {
  title: string;
  subtitle?: string;
  onAdd?: () => void;
}) {
  return (
    <View style={styles.listHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.listSubtitle}>{subtitle}</Text>}
      </View>
      {onAdd && (
        <TouchableOpacity style={styles.addButton} onPress={onAdd} activeOpacity={0.85}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color="#CBD5E1" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

// ---- Setup form primitives (light/dark aware via the dashboard palette) ---------------------------

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  /** Offer "Use <typed text>" when the typed text is not in the list */
  allowCustom?: boolean;
  error?: string;
}

/** Tap to open a searchable list. The shown text is the matching option's label, else the raw value. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select...',
  disabled,
  clearable,
  allowCustom,
  error,
}: SelectFieldProps) {
  const t = useDashboardTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const shown = options.find((o) => o.value === value)?.label ?? value;
  const wanted = normalize(query.trim());
  const filtered = wanted ? options.filter((o) => normalize(o.label).includes(wanted)) : options;
  const typed = query.trim();
  const canUseTyped = !!allowCustom && !!typed && !options.some((o) => normalize(o.label) === wanted);

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const choose = (v: string) => {
    onChange(v);
    close();
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.input,
          styles.selectBox,
          { backgroundColor: t.card, borderColor: error ? t.destructive : t.border },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Text style={[styles.selectText, { color: shown ? t.foreground : '#94A3B8' }]} numberOfLines={1}>
          {shown || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={t.muted} />
      </TouchableOpacity>
      {!!error && <Text style={[styles.error, { color: t.destructive }]}>{error}</Text>}

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <View style={[styles.modal, { backgroundColor: t.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: t.primary }]}>{label}</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color={t.muted} />
            </TouchableOpacity>
          </View>
          <View style={[styles.pickerSearch, { backgroundColor: t.card, borderColor: t.border }]}>
            <Ionicons name="search" size={18} color={t.muted} />
            {/* Uncontrolled on purpose (see StudentsScreen SearchBar) */}
            <TextInput
              style={[styles.pickerSearchInput, { color: t.foreground }]}
              placeholder="Search"
              placeholderTextColor="#94A3B8"
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.pickerList}
            ListHeaderComponent={
              <View>
                {clearable && !!value && (
                  <TouchableOpacity style={styles.pickerRow} onPress={() => choose('')}>
                    <Text style={[styles.pickerRowText, { color: t.destructive }]}>Clear selection</Text>
                  </TouchableOpacity>
                )}
                {canUseTyped && (
                  <TouchableOpacity style={styles.pickerRow} onPress={() => choose(typed)}>
                    <Text style={[styles.pickerRowText, { color: t.primary }]}>Use “{typed}”</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            ListEmptyComponent={
              !canUseTyped ? (
                <Text style={[styles.pickerEmpty, { color: t.muted }]}>No matches</Text>
              ) : undefined
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerRow, { borderBottomColor: t.border }]}
                onPress={() => choose(item.value)}
              >
                <Text style={[styles.pickerRowText, { color: t.foreground }]}>{item.label}</Text>
                {item.value === value && <Ionicons name="checkmark" size={20} color={t.primary} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

interface DateFieldProps {
  label: string;
  /** "yyyy-MM-dd" or "" */
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
  disabled?: boolean;
  error?: string;
}

/** Native date picker: a dialog on Android, an inline calendar sheet on iOS. */
export function DateField({ label, value, onChange, clearable, disabled, error }: DateFieldProps) {
  const t = useDashboardTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());

  const start = () => {
    const current = value ? fromDateString(value) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toDateString(date));
        },
      });
      return;
    }
    setDraft(current);
    setOpen(true);
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={disabled}
        onPress={start}
        style={[
          styles.input,
          styles.selectBox,
          { backgroundColor: t.card, borderColor: error ? t.destructive : t.border },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Text style={[styles.selectText, { color: value ? t.foreground : '#94A3B8' }]}>
          {value ? formatDate(value) : 'Select date'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={t.muted} />
      </TouchableOpacity>
      {!!error && <Text style={[styles.error, { color: t.destructive }]}>{error}</Text>}

      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={styles.dateBackdrop}>
            <View style={[styles.dateSheet, { backgroundColor: t.card }]}>
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                themeVariant={t.isDark ? 'dark' : 'light'}
                onChange={(_, date) => date && setDraft(date)}
              />
              <View style={styles.dateActions}>
                {clearable && !!value ? (
                  <TouchableOpacity
                    onPress={() => {
                      onChange('');
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.dateAction, { color: t.destructive }]}>Clear</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setOpen(false)}>
                    <Text style={[styles.dateAction, { color: t.muted }]}>Cancel</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    onChange(toDateString(draft));
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.dateAction, { color: t.primary }]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

/**
 * Debounced search box. Uncontrolled on purpose: pushing `value` back into the native field while
 * the list re-renders crashes Fabric (see StudentsScreen); it only reports the trimmed term.
 */
export const SearchInput = React.memo(function SearchInput({
  placeholder = 'Search',
  onSearch,
}: {
  placeholder?: string;
  onSearch: (term: string) => void;
}) {
  const t = useDashboardTheme();
  const [text, setText] = useState('');
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const timer = setTimeout(() => onSearch(text.trim()), text ? 350 : 0);
    return () => clearTimeout(timer);
  }, [text, onSearch]);

  return (
    <View style={[styles.pickerSearch, { backgroundColor: t.card, borderColor: t.border, marginHorizontal: 0 }]}>
      <Ionicons name="search" size={18} color={t.muted} />
      <TextInput
        ref={inputRef}
        style={[styles.pickerSearchInput, { color: t.foreground }]}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        onChangeText={setText}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {/* Always mounted (just hidden) so views are not added or removed while typing */}
      <TouchableOpacity
        style={{ opacity: text ? 1 : 0 }}
        disabled={!text}
        onPress={() => {
          inputRef.current?.clear();
          setText('');
        }}
      >
        <Ionicons name="close-circle" size={18} color="#94A3B8" />
      </TouchableOpacity>
    </View>
  );
});

interface MultiSelectFieldProps {
  label: string;
  values: string[];
  options: Option[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Searchable multi-select; the field shows the chosen labels (or a count when there are many) */
export function MultiSelectField({
  label,
  values,
  options,
  onChange,
  placeholder = 'Select...',
  disabled,
}: MultiSelectFieldProps) {
  const t = useDashboardTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const chosen = options.filter((o) => values.includes(o.value));
  const shown =
    chosen.length === 0 ? '' : chosen.length <= 2 ? chosen.map((o) => o.label).join(', ') : `${chosen.length} selected`;
  const wanted = normalize(query.trim());
  const filtered = wanted ? options.filter((o) => normalize(o.label).includes(wanted)) : options;

  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.input, styles.selectBox, { backgroundColor: t.card, borderColor: t.border }, disabled && { opacity: 0.5 }]}
      >
        <Text style={[styles.selectText, { color: shown ? t.foreground : '#94A3B8' }]} numberOfLines={1}>
          {shown || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={t.muted} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <View style={[styles.modal, { backgroundColor: t.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: t.primary }]}>{label}</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.doneText, { color: t.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.pickerSearch, { backgroundColor: t.card, borderColor: t.border }]}>
            <Ionicons name="search" size={18} color={t.muted} />
            <TextInput
              style={[styles.pickerSearchInput, { color: t.foreground }]}
              placeholder="Search"
              placeholderTextColor="#94A3B8"
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.pickerList}
            extraData={values}
            ListHeaderComponent={
              values.length > 0 ? (
                <TouchableOpacity style={styles.pickerRow} onPress={() => onChange([])}>
                  <Text style={[styles.pickerRowText, { color: t.destructive }]}>Clear all ({values.length})</Text>
                </TouchableOpacity>
              ) : undefined
            }
            ListEmptyComponent={<Text style={[styles.pickerEmpty, { color: t.muted }]}>No matches</Text>}
            renderItem={({ item }) => {
              const on = values.includes(item.value);
              return (
                <TouchableOpacity
                  style={[styles.pickerRow, { borderBottomColor: t.border }]}
                  onPress={() => toggle(item.value)}
                >
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? t.primary : t.muted} />
                  <Text style={[styles.pickerRowText, { color: t.foreground, marginLeft: 12 }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

/** Checkbox with a label */
export function CheckRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const t = useDashboardTheme();
  return (
    <TouchableOpacity
      style={[styles.checkRow, disabled && { opacity: 0.5 }]}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={() => onChange(!checked)}
    >
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? t.primary : t.muted} />
      <Text style={[styles.checkText, { color: t.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SectionHeader({ title }: { title: string }) {
  const t = useDashboardTheme();
  return <Text style={[styles.sectionHeader, { color: t.primary }]}>{title}</Text>;
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'muted' | 'primary';

export function Badge({ label, tone = 'muted', outline }: { label: string; tone?: BadgeTone; outline?: boolean }) {
  const t = useDashboardTheme();
  const palette: Record<BadgeTone, { bg: string; fg: string }> = {
    success: { bg: t.successTint, fg: t.success },
    warning: { bg: t.warningTint, fg: t.warning },
    danger: { bg: t.destructiveTint, fg: t.destructive },
    muted: { bg: t.secondaryTint, fg: t.muted },
    primary: { bg: t.primaryTint, fg: t.primary },
  };
  const c = palette[tone];
  return (
    <View
      style={[
        styles.badge,
        outline ? { borderWidth: 1, borderColor: c.fg, backgroundColor: 'transparent' } : { backgroundColor: c.bg },
      ]}
    >
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

/** Cancel + primary buttons; the primary shows a spinner and "Saving..." while saving. */
export function FormActions({
  confirmLabel,
  saving,
  onCancel,
  onConfirm,
}: {
  confirmLabel: string;
  saving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useDashboardTheme();
  return (
    <View style={styles.formActions}>
      <TouchableOpacity
        style={[styles.formCancel, { borderColor: t.border, backgroundColor: t.card }]}
        onPress={onCancel}
        disabled={saving}
      >
        <Text style={[styles.formCancelText, { color: t.foreground }]}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.formConfirm, { backgroundColor: t.primary }, saving && { opacity: 0.6 }]}
        onPress={onConfirm}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <View style={styles.savingRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.formConfirmText}>Saving...</Text>
          </View>
        ) : (
          <Text style={styles.formConfirmText}>{confirmLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

/** Dashed empty state: "No districts defined yet. / Add your first district to get started." */
export function DashedEmpty({
  icon,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
}) {
  const t = useDashboardTheme();
  return (
    <View style={[styles.dashed, { borderColor: t.border }]}>
      <Ionicons name={icon} size={32} color={t.muted} />
      <Text style={[styles.dashedTitle, { color: t.foreground }]}>{title}</Text>
      {!!subtitle && <Text style={[styles.dashedSub, { color: t.muted }]}>{subtitle}</Text>}
    </View>
  );
}

export function confirmDestructive(title: string, message: string, onConfirm: () => void, confirmLabel = 'Delete') {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/** Row action menu (Edit / Delete) as an alert sheet; avoids tiny inline buttons. */
export function showRowMenu(
  title: string,
  actions: { label: string; destructive?: boolean; onPress: () => void }[]
) {
  Alert.alert(title, undefined, [
    ...actions.map((a) => ({
      text: a.label,
      style: a.destructive ? ('destructive' as const) : ('default' as const),
      onPress: a.onPress,
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: theme.muted, marginBottom: 6 },
  input: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: '#fff',
    fontSize: 15,
    color: theme.text,
  },
  inputError: { borderColor: theme.danger },
  error: { marginTop: 4, fontSize: 11.5, color: theme.danger },

  segments: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  segmentText: { fontSize: 14, color: theme.text, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },

  button: {
    height: 50,
    borderRadius: 14,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modal: { flex: 1, backgroundColor: theme.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: theme.primary },
  modalBody: { padding: 20, paddingBottom: 48 },

  listHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  listTitle: { fontSize: 24, fontWeight: '800', color: theme.primary },
  listSubtitle: { marginTop: 2, fontSize: 13, color: theme.muted },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  doneText: { fontSize: 16, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  checkText: { flex: 1, fontSize: 15, fontWeight: '600' },
  sectionHeader: { fontSize: 14, fontWeight: '800', marginTop: 8, marginBottom: 12 },
  selectBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectText: { flex: 1, fontSize: 15 },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  pickerSearchInput: { flex: 1, fontSize: 15 },
  pickerList: { paddingHorizontal: 20, paddingBottom: 40 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerRowText: { flex: 1, fontSize: 15.5 },
  pickerEmpty: { textAlign: 'center', paddingVertical: 32, fontSize: 14 },
  dateBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  dateSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 },
  dateActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 8 },
  dateAction: { fontSize: 16, fontWeight: '700' },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  formCancel: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  formCancelText: { fontSize: 15.5, fontWeight: '700' },
  formConfirm: { flex: 1.4, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  formConfirmText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dashed: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  dashedTitle: { fontSize: 14.5, fontWeight: '600', textAlign: 'center' },
  dashedSub: { fontSize: 13, textAlign: 'center' },
  emptyText: { fontSize: 14, color: theme.muted },
});
