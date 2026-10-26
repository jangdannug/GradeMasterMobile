import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SchoolLookupError, SCHOOL_CODE_PATTERN } from '../../api/schools';
import { useDashboardTheme } from '../../dashboard/theme';
import { useSchoolStore } from '../../stores/schoolStore';

/** First step when no school is saved: the code that the web uses in its URL (e.g. /tis/login) */
export default function SchoolCodeScreen() {
  const t = useDashboardTheme();
  const selectSchool = useSchoolStore((s) => s.selectSchool);
  const [code, setCode] = useState('');
  const [error, setError] = useState<SchoolLookupError | null>(null);
  const [loading, setLoading] = useState(false);

  const trimmed = code.trim();
  const canSubmit = SCHOOL_CODE_PATTERN.test(trimmed) && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      // The navigator moves on to the login as soon as the school is saved
      await selectSchool(trimmed);
    } catch (e) {
      setError(e instanceof SchoolLookupError ? e : new SchoolLookupError('unknown', 'Something went wrong. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.logo, { backgroundColor: t.primary }]}>
            <Ionicons name="school" size={38} color={t.primaryForeground} />
          </View>
          <Text style={[styles.title, { color: t.foreground }]}>Find your school</Text>
          <Text style={[styles.subtitle, { color: t.muted }]}>Enter the school code from your school administrator.</Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: t.muted }]}>School code</Text>
            <View style={[styles.inputWrap, { backgroundColor: t.card, borderColor: error ? t.destructive : t.input }]}>
              <Ionicons name="business-outline" size={18} color={t.muted} />
              <TextInput
                style={[styles.input, { color: t.foreground }]}
                placeholder="e.g. tis"
                placeholderTextColor={t.muted}
                value={code}
                onChangeText={(text) => {
                  setCode(text);
                  if (error) setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                maxLength={20}
                editable={!loading}
                onSubmitEditing={submit}
              />
            </View>
            {!!error && (
              <View style={styles.errorRow}>
                <Text style={[styles.error, { color: t.destructive }]}>{error.message}</Text>
                {error.kind === 'network' && (
                  <TouchableOpacity onPress={submit} disabled={loading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={[styles.retry, { color: t.primary }]}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.button, { backgroundColor: t.primary }, !canSubmit && { opacity: 0.45 }]}
          >
            {loading ? (
              <ActivityIndicator color={t.primaryForeground} />
            ) : (
              <Text style={[styles.buttonText, { color: t.primaryForeground }]}>Continue</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 6 },
  logo: { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 22 },
  field: { marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  input: { flex: 1, fontSize: 16, height: '100%' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  error: { flexShrink: 1, fontSize: 12.5 },
  retry: { fontSize: 13, fontWeight: '700' },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
