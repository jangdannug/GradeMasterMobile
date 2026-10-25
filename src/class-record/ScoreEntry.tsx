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
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: danger ? t.destructive : t.muted }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.max, { color: danger ? t.destructive : t.muted }]}>
          / {max > 0 ? max : '—'}
          {weight !== undefined && weight > 0 ? ` · ${Math.round(weight * 100) / 100}%` : ''}
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
            borderStyle: blank && !danger ? 'dashed' : 'solid',
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
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
}

export default React.memo(ScoreEntry);

const styles = StyleSheet.create({
  cell: { width: '47%', flexGrow: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 4 },
  label: { flexShrink: 1, fontSize: 12, fontWeight: '700' },
  max: { fontSize: 11 },
  input: { height: 42, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, fontWeight: '600' },
});
