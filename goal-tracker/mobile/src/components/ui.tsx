/**
 * Componentes compartilhados pelas telas.
 *
 * São propositalmente "burros": recebem dados prontos, não chamam a API e não
 * decidem regra de negócio. A única responsabilidade que têm é não repetir
 * estilo em seis telas.
 *
 * Todos usam o tema do template (`useTheme`), então o suporte a dark mode
 * continua funcionando sem código extra por tela.
 */
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { ReactNode } from 'react';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" themeColor="textSecondary">
        {title}
      </ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** Linha rótulo/valor, usada em telas de detalhe. */
export function Row({ label, value }: { label: string; value: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderTopColor: theme.backgroundSelected }]}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      {typeof value === 'string' || typeof value === 'number' ? (
        <ThemedText type="smallBold">{value}</ThemedText>
      ) : (
        value
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator />
      <ThemedText type="small" themeColor="textSecondary" style={styles.spacedTop}>
        {label}
      </ThemedText>
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.centered}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.spacedTop}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * Mensagem de erro.
 *
 * A UI decide por `ApiError.code`, nunca por texto — a mensagem pode mudar no
 * servidor a qualquer momento.
 */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const theme = useTheme();

  return (
    <View style={[styles.banner, { borderColor: theme.text }]}>
      <ThemedText type="small" style={styles.bannerText}>
        {message}
      </ThemedText>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8}>
          <ThemedText type="linkPrimary">
            Tentar de novo
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Entrada                                                                    */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  error,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  hint?: string;
  error?: string | null;
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            backgroundColor: theme.background,
            borderColor: error ? theme.text : theme.backgroundSelected,
            color: theme.text,
          },
        ]}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error ? (
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: object;
}) {
  const theme = useTheme();

  const isDisabled = disabled || loading;

  const background =
    variant === 'primary'
      ? theme.text
      : variant === 'danger'
        ? theme.text
        : theme.backgroundElement;

  const color = variant === 'secondary' ? theme.text : theme.background;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityLabel={title}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: isDisabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <ThemedText type="smallBold" style={{ color }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

/** Seletor de valor único. Usado para frequência e para filtros. */
export function Choice<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      {label ? (
        <ThemedText type="smallBold">{label}</ThemedText>
      ) : null}
      <View style={styles.choiceRow}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => onChange(option.value)}
              style={[
                styles.choice,
                {
                  backgroundColor: selected ? theme.text : theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: selected ? theme.background : theme.text }}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Interruptor simples usado para ativar/desativar uma meta. */
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={[styles.row, { borderTopColor: theme.backgroundSelected }]}>
      <ThemedText>{label}</ThemedText>
      <View
        style={[
          styles.toggleTrack,
          { backgroundColor: value ? theme.text : theme.backgroundSelected },
        ]}>
        <View
          style={[
            styles.toggleKnob,
            { backgroundColor: theme.background, alignSelf: value ? 'flex-end' : 'flex-start' },
          ]}
        />
      </View>
    </Pressable>
  );
}

/** Distintivo colorido de status. A cor é estável por status, não aleatória. */
export function StatusBadge({ status }: { status: 'PENDING' | 'COMPLETED' | 'MISSED' }) {
  const theme = useTheme();

  const color =
    status === 'COMPLETED' ? '#1a7f37' : status === 'MISSED' ? '#b42318' : theme.textSecondary;

  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <ThemedText type="smallBold" style={{ color }}>
        {status === 'COMPLETED' ? '✓' : status === 'MISSED' ? '✕' : '○'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  sectionBody: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  spacedTop: {
    marginTop: Spacing.one,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  bannerText: {
    flex: 1,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  choice: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
  },
  toggleTrack: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});