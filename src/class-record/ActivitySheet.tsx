import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { Activity, CommentThread, submissionActivityApi } from '../api/submissionActivity';
import { DashedEmpty, showRowMenu } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { ActivityCategory, ActivityFilter, SUBMISSION_ACTIVITY_LABELS } from './logic';
import { formatDateTime } from './StatusBadges';

export interface ActivityTarget {
  sectionGradeSubmissionId: string;
  classRecordSubmissionId?: string;
  title: string;
}

type Tab = 'all' | 'decisions' | 'comments';

interface Composer {
  mode: 'new' | 'reply' | 'edit';
  commentId?: string;
  replyToName?: string;
  replyToProfileId?: string;
  parentCommentId?: string;
  /** Prefill when editing */
  body?: string;
}

/** Bottom sheet "Activity": decisions and comments of a section's submission, with a comment composer */
export default function ActivitySheet({ target, onClose }: { target: ActivityTarget | null; onClose: () => void }) {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [composer, setComposer] = useState<Composer>({ mode: 'new' });
  const typed = useRef('');
  const [hasText, setHasText] = useState(false);
  const [composerKey, setComposerKey] = useState(0);

  const sgsId = target?.sectionGradeSubmissionId ?? '';
  const open = !!target;

  const useFeed = (filter: number) =>
    useInfiniteQuery({
      queryKey: ['activities', sgsId, filter],
      queryFn: ({ pageParam }) => submissionActivityApi.activities(sgsId, filter, pageParam, 20),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.hasNextPage ? last.pageNumber + 1 : undefined),
      enabled: open && !!sgsId,
    });
  const allFeed = useFeed(ActivityFilter.All);
  const decisionFeed = useFeed(ActivityFilter.Decisions);
  const commentFeed = useFeed(ActivityFilter.Comments);

  const threadsQuery = useQuery({
    queryKey: ['comments', sgsId],
    queryFn: () => submissionActivityApi.comments(sgsId, target?.classRecordSubmissionId),
    enabled: open && !!sgsId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['activities', sgsId] });
    queryClient.invalidateQueries({ queryKey: ['comments', sgsId] });
  };

  const resetComposer = () => {
    setComposer({ mode: 'new' });
    typed.current = '';
    setHasText(false);
    setComposerKey((k) => k + 1);
  };

  const send = useMutation({
    mutationFn: async () => {
      const body = typed.current.trim();
      if (composer.mode === 'edit' && composer.commentId) {
        await submissionActivityApi.editComment(sgsId, composer.commentId, body);
      } else {
        await submissionActivityApi.postComment(sgsId, {
          body,
          classRecordSubmissionId: target?.classRecordSubmissionId,
          parentCommentId: composer.parentCommentId,
          replyToProfileId: composer.replyToProfileId,
        });
      }
    },
    onSuccess: () => {
      resetComposer();
      refresh();
    },
    onError: (e) => Alert.alert('Could not send comment', apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (commentId: string) => submissionActivityApi.deleteComment(sgsId, commentId),
    onSuccess: refresh,
    onError: (e) => Alert.alert('Could not delete comment', apiErrorMessage(e)),
  });

  if (!target) return null;

  const close = () => {
    resetComposer();
    setTab('all');
    onClose();
  };

  const decisions = decisionFeed.data?.pages[0]?.totalCount ?? 0;
  const comments = commentFeed.data?.pages[0]?.totalCount ?? 0;

  // Filter client-side by category as well, in case the server ignores the filter
  const activeFeed = tab === 'all' ? allFeed : tab === 'decisions' ? decisionFeed : commentFeed;
  const activities: Activity[] = (activeFeed.data?.pages.flatMap((p) => p.items) ?? []).filter((a) =>
    tab === 'decisions'
      ? a.category === ActivityCategory.Decision
      : tab === 'comments'
        ? a.category === ActivityCategory.Comment
        : true
  );

  const askDelete = (comment: CommentThread) =>
    Alert.alert('Delete comment', 'This comment will be removed from the activity feed. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(comment.id) },
    ]);

  const commentMenu = (comment: CommentThread) =>
    showRowMenu('Comment', [
      {
        label: 'Reply',
        onPress: () => {
          setComposer({
            mode: 'reply',
            parentCommentId: comment.parentCommentId || comment.id,
            replyToProfileId: comment.authorProfileId,
            replyToName: comment.authorName,
          });
          setComposerKey((k) => k + 1);
          typed.current = '';
          setHasText(false);
        },
      },
      {
        label: 'Edit',
        onPress: () => {
          setComposer({ mode: 'edit', commentId: comment.id, body: comment.body });
          typed.current = comment.body;
          setHasText(comment.body.length > 0);
          setComposerKey((k) => k + 1);
        },
      },
      { label: 'Delete', destructive: true, onPress: () => askDelete(comment) },
    ]);

  const showComposer = tab !== 'decisions';
  const loadingFeed = activeFeed.isLoading;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView
        style={[styles.modal, { backgroundColor: t.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: t.primary }]}>Activity</Text>
            <Text style={[styles.subtitle, { color: t.muted }]} numberOfLines={1}>
              {target.title}
            </Text>
          </View>
          <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color={t.muted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.tabs, { backgroundColor: t.secondaryTint }]}>
          {(
            [
              ['all', 'All'],
              ['decisions', `Decisions (${decisions})`],
              ['comments', `Comments (${comments})`],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <TouchableOpacity
              key={id}
              style={[styles.tab, tab === id && { backgroundColor: t.card }]}
              onPress={() => setTab(id)}
            >
              <Text style={[styles.tabText, { color: tab === id ? t.primary : t.muted }]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'comments' ? (
          <FlatList
            data={threadsQuery.data ?? []}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              threadsQuery.isLoading ? (
                <ActivityIndicator style={{ marginTop: 28 }} color={t.primary} />
              ) : (
                <DashedEmpty icon="chatbubbles-outline" title="No comments found." />
              )
            }
            renderItem={({ item }) => (
              <View>
                <CommentRow comment={item} onMenu={() => commentMenu(item)} />
                {item.replies.map((reply) => (
                  <View key={reply.id} style={[styles.reply, { borderLeftColor: t.border }]}>
                    <CommentRow comment={reply} onMenu={() => commentMenu(reply)} />
                  </View>
                ))}
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        ) : (
          <FlatList
            data={activities}
            keyExtractor={(a) => a.id}
            contentContainerStyle={styles.list}
            onEndReached={() => activeFeed.hasNextPage && !activeFeed.isFetchingNextPage && activeFeed.fetchNextPage()}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              loadingFeed ? (
                <ActivityIndicator style={{ marginTop: 28 }} color={t.primary} />
              ) : (
                <DashedEmpty
                  icon="pulse-outline"
                  title="No activity yet"
                  subtitle="Decisions and comments for this grading sheet will appear here."
                />
              )
            }
            ListFooterComponent={
              activeFeed.isFetchingNextPage ? <ActivityIndicator style={{ margin: 12 }} color={t.primary} /> : undefined
            }
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => <ActivityRow activity={item} />}
          />
        )}

        {showComposer && (
          <View style={[styles.composer, { backgroundColor: t.card, borderTopColor: t.border }]}>
            {composer.mode !== 'new' && (
              <View style={[styles.chip, { backgroundColor: t.primaryTint }]}>
                <Text style={[styles.chipText, { color: t.primary }]} numberOfLines={1}>
                  {composer.mode === 'reply' ? `Replying to ${composer.replyToName || 'comment'}` : 'Editing comment'}
                </Text>
                <TouchableOpacity onPress={resetComposer} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={t.primary} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.composerRow}>
              {/* Uncontrolled; remounted (via the key) to prefill an edit or clear after sending */}
              <TextInput
                key={composerKey}
                style={[styles.composerInput, { color: t.foreground, borderColor: t.border, backgroundColor: t.background }]}
                placeholder={composer.mode === 'reply' ? 'Write a reply' : 'Write a comment'}
                placeholderTextColor="#94A3B8"
                defaultValue={composer.body ?? ''}
                multiline
                onChangeText={(v) => {
                  typed.current = v;
                  setHasText(v.trim().length > 0);
                }}
              />
              <TouchableOpacity
                style={[styles.send, { backgroundColor: t.primary }, (!hasText || send.isPending) && { opacity: 0.4 }]}
                disabled={!hasText || send.isPending}
                onPress={() => send.mutate()}
              >
                {send.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  const t = useDashboardTheme();
  const isComment = activity.category === ActivityCategory.Comment;
  const label = SUBMISSION_ACTIVITY_LABELS[activity.type] ?? 'Activity';
  const decisionTone =
    activity.type === 3 ? t.success : activity.type === 4 || activity.type === 5 ? t.destructive : t.primary;
  const detail = activity.comment || activity.remarks;
  return (
    <View style={[styles.activity, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[styles.dot, { backgroundColor: isComment ? t.muted : decisionTone }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.activityTitle, { color: t.foreground }]}>
          {label}
          {activity.subjectName ? ` · ${activity.subjectName}` : ''}
        </Text>
        <Text style={[styles.meta, { color: t.muted }]}>
          {activity.actorName || 'System'}
          {activity.createdDate ? ` · ${formatDateTime(activity.createdDate)}` : ''}
        </Text>
        {!!detail && <Text style={[styles.body, { color: t.foreground }]}>{detail}</Text>}
      </View>
    </View>
  );
}

function CommentRow({ comment, onMenu }: { comment: CommentThread; onMenu: () => void }) {
  const t = useDashboardTheme();
  return (
    <View style={[styles.activity, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.activityTitle, { color: t.foreground }]}>{comment.authorName || 'Unknown'}</Text>
        <Text style={[styles.meta, { color: t.muted }]}>
          {comment.createdDate ? formatDateTime(comment.createdDate) : ''}
          {comment.editedAt && !comment.isDeleted ? ' · (edited)' : ''}
        </Text>
        {comment.isDeleted ? (
          <Text style={[styles.body, { color: t.muted, fontStyle: 'italic' }]}>This comment was removed.</Text>
        ) : (
          <Text style={[styles.body, { color: t.foreground }]}>
            {!!comment.replyToName && <Text style={{ color: t.primary, fontWeight: '700' }}>@{comment.replyToName} </Text>}
            {comment.body}
          </Text>
        )}
      </View>
      {!comment.isDeleted && (
        <TouchableOpacity onPress={onMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={t.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 10 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { marginTop: 2, fontSize: 12.5 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, padding: 4, borderRadius: 12, gap: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabText: { fontSize: 12.5, fontWeight: '700' },
  list: { padding: 20, paddingBottom: 24 },
  activity: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  activityTitle: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  body: { fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  reply: { marginTop: 8, marginLeft: 14, paddingLeft: 10, borderLeftWidth: 2 },
  composer: { borderTopWidth: 1, padding: 12, paddingBottom: 24, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  chipText: { fontSize: 12.5, fontWeight: '700', maxWidth: 240 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  composerInput: { flex: 1, minHeight: 44, maxHeight: 110, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 11, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
