import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthBackground from '../../components/AuthBackground';
import { useAuthStore } from '../../stores/authStore';

const BLUE_300 = '#93C5FD';
const BLUE_400 = '#60A5FA';
const INDIGO_500 = '#6366F1';
const DANGER = '#FCA5A5';

type Errors = { current?: string; next?: string; confirm?: string };

export default function ChangePasswordScreen() {
  const { isLoading, changePassword, cancelPasswordChange } = useAuthStore();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const nextRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const validate = () => {
    const e: Errors = {};
    if (!current) e.current = 'Current password is required';
    if (next.length < 8 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/\d/.test(next))
      e.next = 'At least 8 characters with upper case, lower case and a number';
    else if (next === current) e.next = 'New password must be different';
    if (confirm !== next) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // AppNavigator switches screens once isLoggedIn is set
  const submit = async () => {
    if (!validate()) return;
    try {
      await changePassword(current, next, confirm);
    } catch (error: any) {
      Alert.alert('Could not change password', error.message);
    }
  };

  const input = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    key: keyof Errors,
    opts: { ref?: React.RefObject<any>; onSubmit: () => void; returnKeyType: 'next' | 'go' }
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, !!errors[key] && styles.inputError]}>
        <Ionicons name="lock-closed-outline" size={18} color={BLUE_300} />
        <TextInput
          ref={opts.ref}
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="rgba(147,197,253,0.45)"
          secureTextEntry={!show}
          autoCapitalize="none"
          returnKeyType={opts.returnKeyType}
          value={value}
          editable={!isLoading}
          onChangeText={(t) => {
            setValue(t);
            if (errors[key]) setErrors({ ...errors, [key]: undefined });
          }}
          onSubmitEditing={opts.onSubmit}
        />
      </View>
      {!!errors[key] && <Text style={styles.errorText}>{errors[key]}</Text>}
    </View>
  );

  return (
    <AuthBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brand}>
              <LinearGradient
                colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
                style={styles.logoBox}
              >
                <Ionicons name="shield-checkmark" size={36} color="#fff" />
              </LinearGradient>
              <Text style={styles.title}>Set a new password</Text>
              <Text style={styles.tagline}>You must change your password before continuing</Text>
            </View>

            <View style={styles.card}>
              {input('Current password', current, setCurrent, 'current', {
                onSubmit: () => nextRef.current?.focus(),
                returnKeyType: 'next',
              })}
              {input('New password', next, setNext, 'next', {
                ref: nextRef,
                onSubmit: () => confirmRef.current?.focus(),
                returnKeyType: 'next',
              })}
              {input('Confirm new password', confirm, setConfirm, 'confirm', {
                ref: confirmRef,
                onSubmit: submit,
                returnKeyType: 'go',
              })}

              <TouchableOpacity style={styles.toggle} onPress={() => setShow((v) => !v)}>
                <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={16} color={BLUE_300} />
                <Text style={styles.toggleText}>{show ? 'Hide passwords' : 'Show passwords'}</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.85} onPress={submit} disabled={isLoading} style={styles.buttonShadow}>
                <LinearGradient
                  colors={[BLUE_400, INDIGO_500]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Update Password</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.back} onPress={cancelPasswordChange} disabled={isLoading}>
                <Text style={styles.backText}>Back to sign in</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const glassBg = 'rgba(255,255,255,0.07)';
const glassBorder = 'rgba(255,255,255,0.14)';

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  brand: { alignItems: 'center', marginBottom: 24 },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: glassBorder,
    marginBottom: 14,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline: { marginTop: 6, fontSize: 13.5, color: 'rgba(191,219,254,0.8)', textAlign: 'center' },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    padding: 22,
    borderRadius: 24,
    backgroundColor: glassBg,
    borderWidth: 1,
    borderColor: glassBorder,
  },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: 'rgba(219,234,254,0.85)', marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  inputError: { borderColor: DANGER },
  input: { flex: 1, fontSize: 15, color: '#fff', height: '100%' },
  errorText: { marginTop: 5, fontSize: 11.5, color: DANGER },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  toggleText: { fontSize: 12.5, color: BLUE_300 },
  buttonShadow: {
    borderRadius: 14,
    shadowColor: INDIGO_500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  back: { marginTop: 16, alignItems: 'center' },
  backText: { fontSize: 13, color: 'rgba(191,219,254,0.7)' },
});
