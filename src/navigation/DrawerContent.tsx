import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { schoolsApi } from '../api/schools';
import { confirmDestructive } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useAuthStore } from '../stores/authStore';
import { toMenuRole, visibleMenu } from './menu';

/** The web sidebar: logo, the menu with expandable groups, and the signed-in user with Logout */
export default function DrawerContent({ state, navigation }: DrawerContentComponentProps) {
  const t = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const items = visibleMenu(toMenuRole(user?.role));
  const activeRoute = state.routes[state.index]?.name;

  // Groups open by hand; the one holding the active route is always open. Session only.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const schools = useQuery({ queryKey: ['schools'], queryFn: schoolsApi.list, staleTime: 60 * 60 * 1000 });
  const schoolName =
    schools.data?.find((s) => s.schoolId === user?.schoolId)?.name ?? user?.schoolName ?? 'Grade Master';

  const go = (route: string) => {
    navigation.navigate(route);
    navigation.closeDrawer();
  };

  return (
    <View style={[styles.container, { backgroundColor: t.card, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <View style={[styles.logo, { backgroundColor: t.primary }]}>
          <Ionicons name="school" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.brand, { color: t.foreground }]}>Grade Master</Text>
          <Text style={[styles.school, { color: t.muted }]} numberOfLines={1}>
            {schoolName}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.menu} showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const children = item.children;
          if (!children) {
            const active = item.route === activeRoute;
            return (
              <Row
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={active}
                onPress={() => go(item.route!)}
              />
            );
          }
          const childActive = children.some((c) => c.route === activeRoute);
          const expanded = !!open[item.id] || childActive;
          return (
            <View key={item.id}>
              <Row
                icon={item.icon}
                label={item.label}
                active={childActive}
                onPress={() => setOpen((o) => ({ ...o, [item.id]: !expanded }))}
                chevron={expanded ? 'chevron-up' : 'chevron-down'}
              />
              {expanded && (
                <View style={[styles.children, { borderLeftColor: t.border }]}>
                  {children.map((child) => (
                    <Row
                      key={child.id}
                      child
                      icon={child.icon}
                      label={child.label}
                      active={child.route === activeRoute}
                      onPress={() => go(child.route)}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, { color: t.foreground }]} numberOfLines={1}>
            {user?.name || 'Signed in'}
          </Text>
          <Text style={[styles.userMeta, { color: t.muted }]} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.logout, { backgroundColor: t.destructiveTint }]}
          onPress={() => confirmDestructive('Logout', 'Sign out of GradeMaster?', () => logout(), 'Logout')}
          accessibilityLabel="Logout"
        >
          <Ionicons name="log-out-outline" size={20} color={t.destructive} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  active,
  child,
  chevron,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  active: boolean;
  child?: boolean;
  chevron?: 'chevron-up' | 'chevron-down';
  onPress: () => void;
}) {
  const t = useDashboardTheme();
  const color = active ? t.primary : t.foreground;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.row, child && styles.childRow, active && { backgroundColor: t.primaryTint }]}
    >
      <Ionicons name={icon} size={child ? 16 : 20} color={color} />
      <Text style={[child ? styles.childLabel : styles.label, { color }, active && { fontWeight: '700' }]}>{label}</Text>
      {!!chevron && <Ionicons name={chevron} size={16} color={t.muted} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  logo: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 16.5, fontWeight: '800' },
  school: { fontSize: 12, marginTop: 1 },
  menu: { padding: 10, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  label: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  children: { marginLeft: 16, marginVertical: 2, paddingLeft: 8, borderLeftWidth: 1, gap: 1 },
  childRow: { paddingVertical: 9, gap: 10 },
  childLabel: { flex: 1, fontSize: 12.5, fontWeight: '500' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
  userName: { fontSize: 14, fontWeight: '700' },
  userMeta: { fontSize: 12, marginTop: 1 },
  logout: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
