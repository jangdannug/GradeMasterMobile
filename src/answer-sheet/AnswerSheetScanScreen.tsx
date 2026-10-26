import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { answerSheetsApi } from '../api/answerSheets';
import { gradeSubmissionApi } from '../api/gradeSubmission';
import { classRecordKeys } from '../class-record/useGradingSheet';
import { useDashboardTheme } from '../dashboard/theme';
import { parseAnswerSheetQr, scoreAnswers, type AnswerSheet, type AnswerSheetQr } from './answerSheet';
import { decodePhoto } from './decodePhoto';
import { readSheet, type ItemState } from './readSheet';

type Step = 'scan' | 'reading' | 'review';

interface Reading {
  answers: (number | null)[];
  states: ItemState[];
}

const letter = (i: number) => String.fromCharCode(97 + i);

/**
 * Scores a student's answer sheet from a photo: the QR code says whose sheet it is, the four corner
 * marks straighten the page, the shaded bubbles are read and checked against the answer key, and the
 * score is posted to the bound item of the Grading Sheet. Detected answers can be corrected before saving.
 */
export default function AnswerSheetScanScreen() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const lastRaw = useRef('');

  const [step, setStep] = useState<Step>('scan');
  const [qr, setQr] = useState<AnswerSheetQr | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [saved, setSaved] = useState<{ name: string; score: number; max: number }[]>([]);

  const sheetQuery = useQuery({
    queryKey: ['answer-sheet', qr?.sheetId],
    queryFn: () => answerSheetsApi.get(qr!.sheetId),
    enabled: !!qr,
  });
  const sheet: AnswerSheet | null = sheetQuery.data ?? null;

  const scoresheetQuery = useQuery({
    queryKey: classRecordKeys.scoresheet(sheet?.offeringId ?? '', sheet?.gradingPeriodId ?? ''),
    queryFn: () => gradeSubmissionApi.scoresheet(sheet!.offeringId, sheet!.gradingPeriodId),
    enabled: !!sheet,
    refetchOnWindowFocus: false,
  });
  const row = useMemo(
    () => scoresheetQuery.data?.rows.find((r) => r.enrollmentId === qr?.enrollmentId) ?? null,
    [scoresheetQuery.data, qr?.enrollmentId]
  );
  const studentName = row ? `${row.lastName}, ${row.firstName}` : '';
  const canWrite = scoresheetQuery.data ? scoresheetQuery.data.isEditable && !scoresheetQuery.data.isRedacted : false;

  const onBarcode = useCallback(({ data }: { data: string }) => {
    if (data === lastRaw.current) return;
    lastRaw.current = data;
    const parsed = parseAnswerSheetQr(data);
    if (parsed) setQr(parsed);
  }, []);

  const reset = () => {
    lastRaw.current = '';
    setQr(null);
    setReading(null);
    setStep('scan');
  };

  /** Reads the bubbles of a photo already known to belong to `forSheet`; back to the camera when it can't */
  const readPhoto = (base64: string, forSheet: AnswerSheet) => {
    const result = readSheet(decodePhoto(base64), forSheet.itemCount, forSheet.choiceCount);
    if (!result) {
      Alert.alert(
        "Couldn't read the sheet",
        'Make sure all four black corner squares are in the photo, the sheet is upright and flat, and the light is even. Then try again.'
      );
      setStep('scan');
      return;
    }
    setReading({ answers: result.items.map((i) => i.answer), states: result.items.map((i) => i.state) });
    setStep('review');
  };

  // let the "Reading…" state paint before the CPU-bound work blocks the JS thread
  const paint = () => new Promise((resolve) => setTimeout(resolve, 50));

  const capture = async () => {
    if (!cameraRef.current || !sheet) return;
    setStep('reading');
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: true });
      if (!photo.base64) throw new Error('The camera did not return an image.');
      await paint();
      readPhoto(photo.base64, sheet);
    } catch (error) {
      Alert.alert('Scan failed', apiErrorMessage(error, 'Could not take or read the photo.'));
      setStep('scan');
    }
  };

  /** Scores a photo taken earlier: the QR code is read from the picture itself */
  const pickPhoto = async () => {
    const picked = await launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 1 });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset?.base64) return;
    setStep('reading');
    try {
      const codes = await scanFromURLAsync(asset.uri, ['qr']);
      const found = codes.map((c) => parseAnswerSheetQr(c.data)).find((q) => q !== null) ?? null;
      if (!found) {
        Alert.alert('No answer sheet QR code', 'The photo must show the whole sheet, including its QR code.');
        setStep('scan');
        return;
      }
      lastRaw.current = '';
      setQr(found);
      const photoSheet = await queryClient.fetchQuery({
        queryKey: ['answer-sheet', found.sheetId],
        queryFn: () => answerSheetsApi.get(found.sheetId),
      });
      if (!photoSheet) throw new Error('This answer sheet no longer exists.');
      await queryClient.fetchQuery({
        queryKey: classRecordKeys.scoresheet(photoSheet.offeringId, photoSheet.gradingPeriodId),
        queryFn: () => gradeSubmissionApi.scoresheet(photoSheet.offeringId, photoSheet.gradingPeriodId),
      });
      await paint();
      readPhoto(asset.base64, photoSheet);
    } catch (error) {
      Alert.alert('Scan failed', apiErrorMessage(error, 'Could not read the photo.'));
      setStep('scan');
    }
  };

  const score = sheet && reading ? scoreAnswers(sheet, reading.answers) : 0;

  const save = useMutation({
    mutationFn: () =>
      gradeSubmissionApi.saveScores(sheet!.offeringId, sheet!.gradingPeriodId, [
        { enrollmentId: qr!.enrollmentId!, gradingComponentItemId: sheet!.gradingComponentItemId, rawScore: score },
      ]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classRecordKeys.scoresheet(sheet!.offeringId, sheet!.gradingPeriodId) });
      setSaved((s) => [{ name: studentName, score, max: sheet!.maxScore }, ...s]);
      reset();
    },
    onError: (error) => Alert.alert('Could not save the score', apiErrorMessage(error)),
  });

  const setAnswer = (item: number, choice: number) =>
    setReading((r) => {
      if (!r) return r;
      const answers = [...r.answers];
      const states = [...r.states];
      answers[item] = answers[item] === choice ? null : choice;
      states[item] = answers[item] === null ? 'blank' : 'answered';
      return { answers, states };
    });

  // ---- Permission ----------------------------------------------------------------------------------
  if (!permission) return <View style={[styles.container, { backgroundColor: t.background }]} />;
  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <Ionicons name="camera" size={40} color={t.mutedForeground} />
        <Text style={[styles.title, { color: t.foreground }]}>Camera access needed</Text>
        <Text style={[styles.hint, { color: t.mutedForeground }]}>The camera reads the QR code and the shaded bubbles on a student&apos;s answer sheet.</Text>
        <TouchableOpacity style={[styles.btnInline, { backgroundColor: t.primary }]} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---- Review --------------------------------------------------------------------------------------
  if (step === 'review' && sheet && reading) {
    const flagged = reading.states.filter((s) => s !== 'answered').length;
    return (
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <ScrollView contentContainerStyle={styles.list}>
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.title, { color: t.foreground }]}>{studentName || 'Unknown student'}</Text>
            <Text style={[styles.hint, { color: t.mutedForeground }]}>
              {sheet.title} · {sheet.subject} · {sheet.term}
            </Text>
            <Text style={[styles.score, { color: t.primary }]}>
              {score} / {sheet.maxScore}
            </Text>
            {flagged > 0 && (
              <Text style={[styles.hint, { color: t.warning }]}>
                {flagged} item{flagged === 1 ? '' : 's'} blank or double-shaded — tap the right letter to fix.
              </Text>
            )}
            {!canWrite && scoresheetQuery.data && (
              <Text style={[styles.hint, { color: t.destructive }]}>This class record is locked or read-only, so the score can&apos;t be saved.</Text>
            )}
          </View>

          {reading.answers.map((answer, item) => {
            const key = sheet.answers[item];
            const state = reading.states[item];
            const correct = key !== null && answer === key;
            return (
              <View key={item} style={[styles.itemRow, { borderColor: state === 'answered' ? t.border : t.warning, backgroundColor: t.card }]}>
                <Text style={[styles.itemNo, { color: t.mutedForeground }]}>{item + 1}</Text>
                <View style={styles.choices}>
                  {Array.from({ length: sheet.choiceCount }, (_, c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setAnswer(item, c)}
                      style={[
                        styles.choice,
                        { borderColor: t.border },
                        answer === c && { backgroundColor: t.primary, borderColor: t.primary },
                      ]}
                    >
                      <Text style={{ color: answer === c ? t.primaryForeground : t.foreground, fontWeight: '700' }}>{letter(c)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Ionicons
                  name={key === null ? 'remove' : correct ? 'checkmark-circle' : 'close-circle'}
                  size={22}
                  color={key === null ? t.mutedForeground : correct ? t.success : t.destructive}
                />
              </View>
            );
          })}
        </ScrollView>
        <View style={[styles.bar, { backgroundColor: t.card, borderColor: t.border }]}>
          <TouchableOpacity style={[styles.btnOutline, { borderColor: t.border }]} onPress={reset}>
            <Text style={{ color: t.foreground, fontWeight: '700' }}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!canWrite || !row || save.isPending}
            style={[styles.btn, { backgroundColor: t.primary, opacity: !canWrite || !row || save.isPending ? 0.5 : 1 }]}
            onPress={() => save.mutate()}
          >
            {save.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save score</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---- Camera --------------------------------------------------------------------------------------
  const blank = qr && !qr.enrollmentId;
  const status = !qr
    ? 'Point the camera at the sheet so the QR code is visible'
    : sheetQuery.isLoading || scoresheetQuery.isLoading
      ? 'Loading sheet…'
      : sheetQuery.isError
        ? "This sheet isn't one of yours, or it no longer exists"
        : blank
          ? 'Blank copy — it has no student, so its score cannot be posted'
          : !row
            ? "This student isn't in the class record"
            : `${studentName} · ${sheet?.title ?? ''}`;
  const ready = !!sheet && !!row && step === 'scan';

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={step === 'scan' ? onBarcode : undefined}
      />
      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={[styles.frame, { borderColor: ready ? '#22c55e' : '#fff' }]} />
      </View>
      <View style={styles.top}>
        <Text style={styles.status}>{status}</Text>
        {saved.length > 0 && (
          <Text style={styles.statusSmall}>
            Saved {saved.length}: {saved[0].name} {saved[0].score}/{saved[0].max}
          </Text>
        )}
      </View>
      <View style={styles.shutterWrap}>
        {step === 'reading' ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <TouchableOpacity disabled={!ready} onPress={capture} style={[styles.shutter, { opacity: ready ? 1 : 0.35 }]} accessibilityLabel="Scan sheet">
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        )}
        {step === 'scan' && (
          <View style={styles.sideActions}>
            <TouchableOpacity onPress={pickPhoto} style={styles.clear} accessibilityLabel="Scan from photo">
              <Text style={styles.statusSmall}>From photo</Text>
            </TouchableOpacity>
            {qr && (
              <TouchableOpacity onPress={reset} style={styles.clear}>
                <Text style={styles.statusSmall}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  list: { padding: 12, paddingBottom: 100, gap: 6 },
  title: { fontSize: 20, fontWeight: '800' },
  hint: { fontSize: 13, textAlign: 'center' },
  score: { fontSize: 34, fontWeight: '800', marginVertical: 4 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 2, marginBottom: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10 },
  itemNo: { width: 26, textAlign: 'right', fontWeight: '700' },
  choices: { flex: 1, flexDirection: 'row', gap: 8 },
  choice: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  btn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnInline: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnOutline: { height: 46, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // The guide fits between the status text and the shutter, so on tall phones it never runs under the shutter
  frameWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingTop: 84, paddingBottom: 150 },
  frame: { height: '100%', maxWidth: '86%', aspectRatio: 210 / 297, borderWidth: 2, borderRadius: 10, opacity: 0.8 },
  top: { position: 'absolute', top: 12, left: 12, right: 12, alignItems: 'center', gap: 4 },
  status: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, overflow: 'hidden' },
  statusSmall: { color: '#fff', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8, overflow: 'hidden' },
  shutterWrap: { position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center', gap: 12 },
  shutter: { width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  clear: { padding: 4 },
  sideActions: { flexDirection: 'row', gap: 16 },
});
