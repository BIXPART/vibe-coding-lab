/**
 * Estados visuais compartilhados: loading, erro, vazio.
 * Mantém consistência e reduz duplicação nas telas.
 */
import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, borderRadius } from '../utils/theme';

export const LoadingState = ({ message = 'Carregando...' }) => (
  <View style={styles.center}>
    <ActivityIndicator size="large" color={colors.primary} />
    <Text style={styles.loadingText}>{message}</Text>
  </View>
);

export const ErrorState = ({ message, onRetry, retryLabel = 'Tentar novamente' }) => (
  <View style={styles.center}>
    <Text style={styles.errorEmoji}>⚠️</Text>
    <Text style={styles.errorText}>{message || 'Algo deu errado.'}</Text>
    {onRetry && (
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>{retryLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

export const EmptyState = ({ emoji = '📦', title, subtitle, actionLabel, onAction }) => (
  <View style={styles.center}>
    <Text style={styles.emptyEmoji}>{emoji}</Text>
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    {actionLabel && onAction && (
      <TouchableOpacity style={styles.retryButton} onPress={onAction}>
        <Text style={styles.retryText}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: 15,
  },
  errorEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    minWidth: 180,
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default { LoadingState, ErrorState, EmptyState };
