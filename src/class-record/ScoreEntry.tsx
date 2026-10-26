import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useDashboardTheme } from '../dashboard/theme';

interface Props {
  label: string;
  /** The highest possible score; 0 means it is not configured */
  max: number;
  weight?: number;
  /** Only used at mount: the input is uncontrolled (the parent remounts it via `key` on a reset) */
  initial: number | undefined;
  disabled: boolean;
  over: boolean;
  blank: boolean;
  inputRef: (input: React.ComponentRef<typeof TextInput> | null) => void;
  onChange: (text: string) => void;
  onNext: () => void;
}

/**
 * One score field. It is deliberately uncontrolled: pushing `value` back into the native field while
 * the list re-renders is what crashed Fabric elsewhere in this app. The text is selected on focus,
 * and the keyboard's "Next" key moves to the same item of the next student.
 */
function ScoreEntry({ label, max, weight, initial, disabled, over, blank, inputRef, onChange, onNext }: Props) {
  const t = useDashboardTheme();
  const danger = over;
  return (
    <View style={styles.cell}>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: danger ? t.destructive : t.foreground }]} numberOfLines={1}>
          {label}
          <Text style={[styles.max, { color: danger ? t.destructive : t.muted }]}>
            {'  '}/ {max > 0 ? max : '—'}
            {weight !== undefined && weight > 0 ? ` · ${Math.round(weight * 100) / 100}%` : ''}
          </Text>
        </Text>
      </View>
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          {
            color: danger ? t.destructive : t.foreground,
            borderColor: danger ? t.destructive : blank ? t.warning : t.border,
            backgroundColor: disabled ? t.secondaryTint : t.card,
          },
        ]}
        defaultValue={initial === undefined ? '' : String(initial)}
        editable={!disabled}
        // Numbers-and-punctuation keeps a Return key (the decimal pad has none on iOS)
        keyboardType="numbers-and-punctuation"
        returnKeyType="next"
        selectTextOnFocus
        blurOnSubmit={false}
        onChangeText={onChange}
        onSubmitEditing={onNext}
        autoCorrect={false}
        autoCapitalize="none"
        placeholder="—"
        placeholderTextColor={t.muted}
      />
    </View>
  );
}

export default React.memo(ScoreEntry);

const styles = StyleSheet.create({
  cell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  labels: { flex: 1 },
  label: { fontSize: 14.5, fontWeight: '700' },
  max: { fontSize: 12, fontWeight: '500' },
  input: { width: 92, height: 36, textAlign: 'right', paddingVertical: 0, textAlignVertical: 'center', borderWidth: 1.5, borderRadius: 9, borderStyle: 'solid', paddingHorizontal: 10, fontSize: 15, fontWeight: '600' },
});
