import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, confirmDestructive } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useAuthStore } from '../stores/authStore';
import { THEMES } from '../theme/themes';
import ChangePasswordSheet from './ChangePasswordSheet';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ROLE_LABELS: Record<string, string> = { Teacher: 'Teacher', SchoolHead: 'School Head', Admin: 'Administrator' };

export default function SettingsScreen() {
  const t = useDashboardTheme();
  const { user, theme, setTheme, logout } = useAuthStore();
  const [passwordOpen, setPasswordOpen] = useState(false);

  const initials =
    (user?.name ?? user?.email ?? '?')
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';

  const askSignOut = () => confirmDestructive('Sign out', 'Sign out of GradeMaster?', () => logout(), 'Sign out');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={[]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.account, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={[styles.avatar, { backgroundColor: t.primaryTint }]}>
            <Text style={[styles.avatarText, { color: t.primary }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.name, { color: t.foreground }]} numberOfLines={1}>
              {user?.name || 'Signed in'}
            </Text>
            {!!user?.email && (
              <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
                {user.email}
              </Text>
            )}
            {!!user?.schoolName && (
              <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
                {user.schoolName}
              </Text>
            )}
          </View>
          <Badge label={ROLE_LABELS[user?.role ?? ''] ?? 'User'} tone="primary" />
        </View>

        <Group title="Appearance">
          {THEMES.map((option, index) => {
            const selected = option.id === theme;
            const [page, card, sidebar] = option.swatch;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}
                onPress={() => setTheme(option.id)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={[styles.swatch, { borderColor: t.border }]}>
                  <View style={{ flex: 1, backgroundColor: sidebar }} />
                  <View style={{ flex: 1, backgroundColor: page }} />
                  <View style={{ flex: 1, backgroundColor: card }} />
                </View>
                <Text style={[styles.rowLabel, { color: t.foreground }]}>{option.label}</Text>
                {selected && <Ionicons name="checkmark-circle" size={22} color={t.primary} />}
              </TouchableOpacity>
            );
          })}
        </Group>

        <Group title="Security">
          <NavRow icon="key-outline" label="Change password" onPress={() => setPasswordOpen(true)} />
        </Group>

        <Group>
          <TouchableOpacity style={styles.row} onPress={askSignOut} activeOpacity={0.7}>
            <RowIcon name="log-out-outline" color={t.destructive} />
            <Text style={[styles.rowLabel, { color: t.destructive }]}>Sign out</Text>
          </TouchableOpacity>
        </Group>

        <Text style={[styles.version, { color: t.muted }]}>
          GradeMasterMobile v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>

      <ChangePasswordSheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </SafeAreaView>
  );
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  const t = useDashboardTheme();
  return (
    <View style={{ gap: 8 }}>
      {!!title && <Text style={[styles.groupTitle, { color: t.muted }]}>{title.toUpperCase()}</Text>}
      <View style={[styles.group, { backgroundColor: t.card, borderColor: t.border }]}>{children}</View>
    </View>
  );
}

function RowIcon({ name, color }: { name: IconName; color?: string }) {
  const t = useDashboardTheme();
  return (
    <View style={[styles.rowIcon, { backgroundColor: t.secondaryTint }]}>
      <Ionicons name={name} size={18} color={color ?? t.primary} />
    </View>
  );
}

function NavRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useDashboardTheme();
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <RowIcon name={icon} />
      <Text style={[styles.rowLabel, { color: t.foreground }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={t.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16, paddingBottom: 40, gap: 18 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  name: { fontSize: 16.5, fontWeight: '800' },
  meta: { fontSize: 12.5 },
  groupTitle: { fontSize: 12, fontWeight: '700', marginLeft: 4 },
  group: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  swatch: { width: 54, height: 34, flexDirection: 'row', borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15.5, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 12.5 },
});
