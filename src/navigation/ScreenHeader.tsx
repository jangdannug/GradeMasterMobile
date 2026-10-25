import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { confirmDestructive, showRowMenu } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useAuthStore } from '../stores/authStore';

/** Top bar of every screen: hamburger, page label, theme toggle and the account menu */
export default function ScreenHeader({
  title,
  onMenu,
  onProfile,
}: {
  title: string;
  onMenu: () => void;
  onProfile: () => void;
}) {
  const t = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const { user, setTheme, logout } = useAuthStore();

  const initials =
    (user?.name ?? user?.email ?? '?')
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';

  const openAccountMenu = () =>
    showRowMenu(user?.name || user?.email || 'Account', [
      { label: 'My Profile', onPress: onProfile },
      {
        label: 'Logout',
        destructive: true,
        onPress: () => confirmDestructive('Logout', 'Sign out of GradeMaster?', () => logout(), 'Logout'),
      },
    ]);

  return (
    <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: t.card, borderBottomColor: t.border }]}>
      <View style={styles.row}>
        <TouchableOpacity onPress={onMenu} style={styles.button} accessibilityLabel="Open menu" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="menu" size={26} color={t.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: t.primary }]} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity
          onPress={() => setTheme(t.isDark ? 'light' : 'dark')}
          style={styles.button}
          accessibilityLabel="Toggle theme"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name={t.isDark ? 'sunny-outline' : 'moon-outline'} size={22} color={t.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={openAccountMenu} accessibilityLabel="Account menu" style={[styles.avatar, { backgroundColor: t.primaryTint }]}>
          <Text style={[styles.avatarText, { color: t.primary }]}>{initials}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12.5, fontWeight: '800' },
});
