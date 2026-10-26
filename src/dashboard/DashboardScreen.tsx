import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from './components/Card';
import GradeBarChart from './components/GradeBarChart';
import StatCard from './components/StatCard';
import SubjectDonut from './components/SubjectDonut';
import SubmissionCard from './components/SubmissionCard';
import TopStudentRow from './components/TopStudentRow';
import TrendChart from './components/TrendChart';
import { useDashboardTheme } from './theme';
import { useDashboardData } from './useDashboardData';

const GUTTER = 16;
const CARD_PADDING = 16;

export default function DashboardScreen() {
  const t = useDashboardTheme();
  const { width } = useWindowDimensions();
  const { data, isLoading, isRefetching, refetch } = useDashboardData();

  // Inner width of a card, for the charts
  const chartWidth = width - GUTTER * 2 - CARD_PADDING * 2 - 2;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.primary} />}
      >
        {/* Stat cards */}
        {isLoading ? (
          <View style={styles.statGrid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.skeleton, { backgroundColor: t.card, borderColor: t.border }]} />
            ))}
          </View>
        ) : (
          <View style={styles.statGrid}>
            {(data?.stats ?? []).map((stat) => (
              <StatCard key={stat.title} stat={stat} />
            ))}
          </View>
        )}

        <Card title="Enrollment Trend" loading={isLoading} empty={!data?.enrollmentTrend.length}>
          <TrendChart data={data?.enrollmentTrend ?? []} width={chartWidth} />
        </Card>

        <Card title="Subject Performance" loading={isLoading} empty={!data?.subjectPerformance.length}>
          <SubjectDonut data={data?.subjectPerformance ?? []} />
        </Card>

        <Card title="Grade Level Distribution" loading={isLoading} empty={!data?.gradeDistribution.length}>
          <GradeBarChart data={data?.gradeDistribution ?? []} width={chartWidth} />
        </Card>

        <Card title="Top Performing Students" icon="trophy" loading={isLoading} empty={!data?.topStudents.length}>
          <View>
            {(data?.topStudents ?? []).map((s, i, all) => (
              <TopStudentRow key={s.id} student={s} last={i === all.length - 1} />
            ))}
          </View>
        </Card>

        <Card title="Recent Grade Submissions" loading={isLoading} empty={!data?.recentSubmissions.length}>
          <View style={styles.submissions}>
            {(data?.recentSubmissions ?? []).map((s) => (
              <SubmissionCard key={s.id} submission={s} />
            ))}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: GUTTER, paddingBottom: 32, gap: GUTTER },
  header: { paddingTop: 4 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 2, fontSize: 14 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  skeleton: { flexBasis: '47%', flexGrow: 1, height: 112, borderRadius: 16, borderWidth: 1 },
  submissions: { gap: 10 },
});
