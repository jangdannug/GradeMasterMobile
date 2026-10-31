import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  Easing,
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
import { useSchoolStore } from '../../stores/schoolStore';
import ChangePasswordScreen from './ChangePasswordScreen';

// Palette mirrors GradeMasterFrontend (slate-900 / primary-950 / blue-300 / indigo-300)
const colors = {
  blue300: '#93C5FD',
  blue400: '#60A5FA',
  indigo300: '#A5B4FC',
  indigo500: '#6366F1',
  danger: '#FCA5A5',
};

const features = [
  { icon: 'book-outline', label: 'Grade Management' },
  { icon: 'bar-chart-outline', label: 'Analytics' },
  { icon: 'people-outline', label: 'Student Insights' },
] as const;

type FieldErrors = { email?: string; password?: string };

export default function AuthScreen() {
  const { isLoading, login, loginAsDemo, passwordChangeToken } = useAuthStore();
  const school = useSchoolStore((s) => s.school);
  const changeSchool = useSchoolStore((s) => s.changeSchool);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const slideUp = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
  };

  const validate = () => {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Please enter a valid email';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // AppNavigator switches screens once isLoggedIn is set
  const handleLogin = async () => {
    if (!validate()) return;
    try {
      await login(email.trim(), password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    }
  };

  if (passwordChangeToken) return <ChangePasswordScreen />;

  const handleDemo = async () => {
    try {
      await loginAsDemo();
    } catch (error: any) {
      Alert.alert('Demo Sign-in Failed', error.message);
    }
  };

  return (
    <AuthBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Brand */}
            <Animated.View style={[styles.brand, slideUp]}>
              <LinearGradient
                colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
                style={styles.logoBox}
              >
                <Ionicons name="school" size={40} color="#fff" />
              </LinearGradient>
              <Text style={styles.title}>GradeMasterMobile</Text>
              <Text style={styles.tagline}>
                <Text style={styles.taglineAccent}>Simplified</Text> School Administration
              </Text>
            </Animated.View>

            {/* The school this sign-in is for, with a way back to the code screen */}
            {!!school && (
              <View style={styles.schoolBox}>
                <View style={styles.schoolRow}>
                  <Ionicons name="business-outline" size={16} color={colors.blue300} />
                  <Text style={styles.schoolName} numberOfLines={1}>
                    {school.name || 'Your school'}
                  </Text>
                  {!!school.code && <Text style={styles.schoolCode}>{school.code.toUpperCase()}</Text>}
                </View>
                <TouchableOpacity onPress={changeSchool} disabled={isLoading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.changeSchool}>Not your school? Change school</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Glass card */}
            <Animated.View style={[styles.card, slideUp]}>
              <Text style={styles.welcome}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to continue to your school</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Email Address</Text>
                <View
                  style={[
                    styles.inputWrap,
                    focused === 'email' && styles.inputFocused,
                    !!errors.email && styles.inputError,
                  ]}
                >
                  <Ionicons name="mail-outline" size={18} color={colors.blue300} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor="rgba(147,197,253,0.45)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    value={email}
                    editable={!isLoading}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errors.email) setErrors({ ...errors, email: undefined });
                    }}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>
                {!!errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View
                  style={[
                    styles.inputWrap,
                    focused === 'password' && styles.inputFocused,
                    !!errors.password && styles.inputError,
                  ]}
                >
                  <Ionicons name="lock-closed-outline" size={18} color={colors.blue300} />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(147,197,253,0.45)"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    textContentType="password"
                    returnKeyType="go"
                    value={password}
                    editable={!isLoading}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errors.password) setErrors({ ...errors, password: undefined });
                    }}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.blue300}
                    />
                  </TouchableOpacity>
                </View>
                {!!errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleLogin}
                disabled={isLoading}
                style={styles.buttonShadow}
              >
                <LinearGradient
                  colors={[colors.blue400, colors.indigo500]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Sign In</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {__DEV__ && (
                <>
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>Quick Access</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleDemo}
                    disabled={isLoading}
                    style={styles.demoButton}
                  >
                    <Ionicons name="flash-outline" size={17} color={colors.blue300} />
                    <Text style={styles.demoText}>Demo Account</Text>
                  </TouchableOpacity>
                </>
              )}

              <Text style={styles.help}>
                Having trouble signing in? Contact your school administrator.
              </Text>
            </Animated.View>

            {/* Features */}
            <Animated.View style={[styles.features, slideUp]}>
              {features.map((f) => (
                <View key={f.label} style={styles.feature}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={f.icon} size={18} color={colors.blue300} />
                  </View>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                </View>
              ))}
            </Animated.View>

            <Text style={styles.footer}>
              © {new Date().getFullYear()} Grade Master. All rights reserved.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const glassBg = 'rgba(255,255,255,0.07)';
const glassBorder = 'rgba(255,255,255,0.14)';

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },

  brand: { alignItems: 'center', marginBottom: 28 },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: glassBorder,
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  tagline: { marginTop: 6, fontSize: 14, color: 'rgba(191,219,254,0.8)' },
  taglineAccent: { color: colors.indigo300, fontWeight: '700' },

  schoolBox: { alignItems: 'center', marginBottom: 14, gap: 6 },
  schoolRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  schoolName: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: '#fff' },
  schoolCode: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.indigo300,
    borderWidth: 1,
    borderColor: 'rgba(165,180,252,0.5)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  changeSchool: { fontSize: 12.5, color: colors.blue300, textDecorationLine: 'underline' },

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
  welcome: { fontSize: 22, fontWeight: '700', color: '#fff' },
  subtitle: { marginTop: 4, marginBottom: 20, fontSize: 13, color: 'rgba(191,219,254,0.7)' },

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
  inputFocused: { borderColor: colors.blue400, backgroundColor: 'rgba(15,23,42,0.8)' },
  inputError: { borderColor: colors.danger },
  input: { flex: 1, fontSize: 15, color: '#fff', height: '100%' },
  errorText: { marginTop: 5, fontSize: 11.5, color: colors.danger },

  buttonShadow: {
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: colors.indigo500,
    shadowColor: colors.indigo500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  button: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  dividerText: { fontSize: 11, color: 'rgba(191,219,254,0.55)' },
  demoButton: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  demoText: { fontSize: 14.5, fontWeight: '600', color: '#DBEAFE' },
  help: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 11.5,
    lineHeight: 17,
    color: 'rgba(191,219,254,0.55)',
  },

  features: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
    marginTop: 28,
  },
  feature: { alignItems: 'center', width: 84 },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glassBg,
    borderWidth: 1,
    borderColor: glassBorder,
    marginBottom: 6,
  },
  featureLabel: { fontSize: 10.5, textAlign: 'center', color: 'rgba(191,219,254,0.7)' },

  footer: {
    marginTop: 26,
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(147,197,253,0.4)',
  },
});
