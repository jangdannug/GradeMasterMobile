import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '../api';
import { fullName, UserProfile, userManagementApi } from '../api/userProfiles';
import { confirmDestructive, DashedEmpty, SearchInput, showRowMenu } from '../components/forms';
import { DashboardTheme, useDashboardTheme } from '../dashboard/theme';
import { formatDate } from '../school-setup/dates';
import { MoreButton } from '../school-setup/SetupParts';
import { useAuthStore } from '../stores/authStore';
import UserFormSheet, { UserFormTarget } from './UserFormSheet';

const PAGE_SIZE = 50;

/** Light bg, darker text and matching border per status (translucent variants in dark mode) */
function statusTone(status: string, t: DashboardTheme) {
  const tones: Record<string, [string, string, string]> = t.isDark
    ? {
        Permanent: ['rgba(16,185,129,0.15)', '#6EE7B7', 'rgba(16,185,129,0.4)'],
        Probationary: ['rgba(59,130,246,0.15)', '#93C5FD', 'rgba(59,130,246,0.4)'],
        Contractual: ['rgba(245,158,11,0.15)', '#FCD34D', 'rgba(245,158,11,0.4)'],
        'Part-Time': ['rgba(168,85,247,0.15)', '#D8B4FE', 'rgba(168,85,247,0.4)'],
      }
    : {
        Permanent: ['#ECFDF5', '#047857', '#A7F3D0'],
        Probationary: ['#EFF6FF', '#1D4ED8', '#BFDBFE'],
        Contractual: ['#FFFBEB', '#B45309', '#FDE68A'],
        'Part-Time': ['#FAF5FF', '#7E22CE', '#E9D5FF'],
      };
  const [bg, fg, border] = tones[status] ?? (t.isDark ? ['#1B2536', '#94A3B8', '#2B3A52'] : ['#F1F5F9', '#475569', '#E2E8F0']);
  return { bg, fg, border };
}

export default function UserManagementScreen() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);

  // Search applies on submit, so typing costs no requests
  const [term, setTerm] = useState('');
  const onSearch = useCallback((value: string) => setTerm(value), []);
  const [formTarget, setFormTarget] = useState<UserFormTarget | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const result = useInfiniteQuery({
    queryKey: ['user-profiles', term],
    queryFn: ({ pageParam }) => userManagementApi.paged(pageParam, term, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNextPage ? last.pageNumber + 1 : undefined),
  });

  const users = result.data?.pages.flatMap((p) => p.items) ?? [];
  const total = result.data?.pages[0]?.totalCount;

  const remove = useMutation({
    mutationFn: (u: UserProfile) => userManagementApi.remove(u.userProfileId),
    onSuccess: (_, u) => {
      Alert.alert(`User "${[u.firstName, u.lastName].filter(Boolean).join(' ')}" deleted`);
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-paged'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-all'] });
    },
    onError: (e) => Alert.alert('Could not delete user', apiErrorMessage(e)),
  });

  const isSelf = (u: UserProfile) => !!me?.id && u.userId === me.id;

  const askDelete = (u: UserProfile) => {
    if (isSelf(u)) return Alert.alert('Cannot delete', 'You cannot delete your own account.');
    confirmDestructive('Delete user', `${fullName(u)} (${u.email || 'no email'}) will be removed.`, () => remove.mutate(u));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await result.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={[]}>
      <FlatList
        data={users}
        keyExtractor={(u) => u.userProfileId}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => result.hasNextPage && !result.isFetchingNextPage && result.fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <View style={styles.titleRow}>
              <Text style={[styles.subtitle, { color: t.muted }]}>Manage team members and their roles</Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: t.primary }]}
                onPress={() => setFormTarget({ kind: 'create' })}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addText}>Add user</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tiles}>
              <Tile label="Total Users" value={result.isLoading ? '—' : String(total ?? 0)} />
              <Tile label="Loaded" value={String(users.length)} />
            </View>

            {result.isError && (
              <View style={[styles.errorBanner, { backgroundColor: t.destructiveTint, borderColor: t.destructive }]}>
                <Text style={[styles.errorTitle, { color: t.destructive }]}>Failed to load users</Text>
                <Text style={[styles.errorText, { color: t.destructive }]}>{apiErrorMessage(result.error)}</Text>
              </View>
            )}

            <SearchInput placeholder="Search name or email..." onSearch={onSearch} />
          </View>
        }
        ListEmptyComponent={
          result.isLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={t.primary} />
          ) : result.isError ? undefined : (
            <DashedEmpty icon="people-outline" title="No users found." />
          )
        }
        ListFooterComponent={result.isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} color={t.primary} /> : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <UserCard
            user={item}
            onMenu={() =>
              showRowMenu(fullName(item) || item.email, [
                { label: 'Edit', onPress: () => setFormTarget({ kind: 'edit', user: item }) },
                { label: isSelf(item) ? 'Delete (not your own account)' : 'Delete', destructive: true, onPress: () => askDelete(item) },
              ])
            }
          />
        )}
      />
      <UserFormSheet target={formTarget} onClose={() => setFormTarget(null)} />
    </SafeAreaView>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const t = useDashboardTheme();
  return (
    <View style={[styles.tile, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.tileValue, { color: t.foreground }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

function UserCard({ user, onMenu }: { user: UserProfile; onMenu: () => void }) {
  const t = useDashboardTheme();
  const name = fullName(user);
  const tone = statusTone(user.employmentStatus, t);
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[styles.avatar, { backgroundColor: t.primaryTint }]}>
        <Text style={[styles.avatarText, { color: t.primary }]}>
          {((user.firstName[0] ?? '') + (user.lastName[0] ?? '')).toUpperCase() || '?'}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.name, { color: t.foreground }]} numberOfLines={1}>
          {name || user.email}
        </Text>
        <View style={styles.line}>
          <Ionicons name="mail-outline" size={13} color={t.muted} />
          <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
            {user.email || '—'}
          </Text>
        </View>
        <Text style={[styles.meta, { color: t.muted }]}>Employee # {user.employeeNumber || '—'}</Text>
        <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
          {user.positionName || '—'} · Hired {user.hireDate ? formatDate(user.hireDate) : '—'}
        </Text>
        {!!user.employmentStatus && (
          <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <Text style={[styles.badgeText, { color: tone.fg }]}>{user.employmentStatus}</Text>
          </View>
        )}
      </View>
      <MoreButton onPress={onMenu} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 32 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subtitle: { flex: 1, fontSize: 13 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12 },
  addText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12 },
  tileValue: { fontSize: 22, fontWeight: '800' },
  tileLabel: { fontSize: 12, marginTop: 2 },
  errorBanner: { borderWidth: 1, borderRadius: 12, padding: 12 },
  errorTitle: { fontSize: 14, fontWeight: '800' },
  errorText: { fontSize: 12.5, marginTop: 2 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 46, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  searchButton: { fontSize: 14, fontWeight: '700' },
  applied: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appliedText: { flex: 1, fontSize: 12.5 },
  clear: { fontSize: 13, fontWeight: '700', marginLeft: 12 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  name: { fontSize: 15.5, fontWeight: '700' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 12.5 },
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 10, marginTop: 2 },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
});
