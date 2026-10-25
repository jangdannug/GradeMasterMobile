import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { FormActions } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useAuthStore } from '../stores/authStore';

type Errors = { current?: string; next?: string; confirm?: string };

/** Voluntary password change from Settings (same rules as the forced flow) */
export default function ChangePasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useDashboardTheme();
  const changePassword = useAuthStore((s) => s.changePasswordInSession);
  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [show, setShow] = useState(false);
  const nextRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const close = () => {
    setValues({ current: '', next: '', confirm: '' });
    setErrors({});
    setShow(false);
    onClose();
  };

  const save = useMutation({
    mutationFn: () => changePassword(values.current, values.next, values.confirm),
    onSuccess: () => {
      close();
      Alert.alert('Password changed successfully');
    },
    onError: (e) => Alert.alert('Could not change password', apiErrorMessage(e)),
  });

  const submit = () => {
    const e: Errors = {};
    if (!values.current) e.current = 'Current password is required';
    if (values.next.length < 8 || !/[A-Z]/.test(values.next) || !/[a-z]/.test(values.next) || !/\d/.test(values.next))
      e.next = 'At least 8 characters with upper case, lower case and a number';
    else if (values.next === values.current) e.next = 'New password must be different';
    if (values.confirm !== values.next) e.confirm = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length === 0) save.mutate();
  };

  const change = (key: 'current' | 'next' | 'confirm', v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.primary }]}>Change password</Text>
          <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color={t.muted} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <PasswordField
            label="Current password"
            value={values.current}
            error={errors.current}
            show={show}
            onToggle={() => setShow((v) => !v)}
            editable={!save.isPending}
            onChangeText={(v) => change('current', v)}
            onSubmit={() => nextRef.current?.focus()}
          />
          <PasswordField
            label="New password"
            inputRef={nextRef}
            value={values.next}
            error={errors.next}
            show={show}
            onToggle={() => setShow((v) => !v)}
            editable={!save.isPending}
            onChangeText={(v) => change('next', v)}
            onSubmit={() => confirmRef.current?.focus()}
          />
          <PasswordField
            label="Confirm new password"
            inputRef={confirmRef}
            value={values.confirm}
            error={errors.confirm}
            show={show}
            onToggle={() => setShow((v) => !v)}
            editable={!save.isPending}
            last
            onChangeText={(v) => change('confirm', v)}
            onSubmit={submit}
          />
          <FormActions confirmLabel="Change password" saving={save.isPending} onCancel={close} onConfirm={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PasswordField({
  label,
  value,
  error,
  show,
  onToggle,
  editable,
  last,
  inputRef,
  onChangeText,
  onSubmit,
}: {
  label: string;
  value: string;
  error?: string;
  show: boolean;
  onToggle: () => void;
  editable: boolean;
  last?: boolean;
  inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
}) {
  const t = useDashboardTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <View style={[styles.inputWrap, { backgroundColor: t.card, borderColor: error ? t.destructive : t.border }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: t.foreground }]}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={last ? 'done' : 'next'}
          value={value}
          editable={editable}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
        />
        <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={t.muted} />
        </TouchableOpacity>
      </View>
      {!!error && <Text style={[styles.error, { color: t.destructive }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '800' },
  body: { padding: 20, gap: 4 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  input: { flex: 1, fontSize: 15 },
  error: { marginTop: 4, fontSize: 11.5 },
});
