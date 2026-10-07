/**
 * Tela de Validades — rotina de conferência.
 * Prioriza praticidade e velocidade: filtros prontos e lista objetiva.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { colors, spacing, borderRadius } from '../utils/theme';
import { formatDate } from '../utils/dates';

const FILTERS = [
  { key: 'today', label: 'Hoje', days: 0 },
  { key: '3', label: '3 dias', days: 3 },
  { key: '7', label: '7 dias', days: 7 },
  { key: '30', label: '30 dias', days: 30 },
  { key: 'expired', label: 'Vencidos', days: -1 },
];

const ExpiryScreen = ({ navigation }) => {
  const [filter, setFilter] = useState('7');
  const [expired, setExpired] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [expiredResult, expiringResult] = await Promise.all([
        api.get('/stock/expired'),
        api.get('/stock/expiring?days=30'),
      ]);
      setExpired(expiredResult);
      setExpiring(expiringResult);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const selected = FILTERS.find((f) => f.key === filter);

  let items = [];
  if (filter === 'expired') {
    items = expired;
  } else if (filter === 'today') {
    items = expiring.filter((l) => l.days === 0);
  } else {
    items = expiring.filter((l) => l.days <= selected.days);
  }

  const totalUnits = items.reduce((sum, l) => sum + l.quantity, 0);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('ProductDetail', { id: item.product.id })
      }
    >
      <View style={styles.cardLeft}>
        <Text style={styles.productName} numberOfLines={1}>
          {item.product.name}
        </Text>
        <Text style={styles.meta}>
          {item.quantity} unidades · Lote {item.lot_code}
        </Text>
        <Text style={styles.expiry}>Validade: {formatDate(item.expires_at)}</Text>
      </View>

      <View
        style={[styles.statusBox, { backgroundColor: `${item.status.color}1A` }]}
      >
        <Text style={styles.statusEmoji}>{item.status.emoji}</Text>
        <Text style={[styles.statusText, { color: item.status.color }]}>
          {item.days < 0
            ? `${Math.abs(item.days)}d atrás`
            : item.days === 0
            ? 'hoje'
            : `${item.days}d`}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return <LoadingState message="Carregando validades..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  return (
    <View style={styles.container}>
      {/* Filtros */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[styles.chipText, filter === f.key && styles.chipTextActive]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Resumo */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {items.length} {items.length === 1 ? 'lote' : 'lotes'} ·{' '}
          {totalUnits} unidades
        </Text>
        {filter === 'expired' && expired.length > 0 && (
          <View style={styles.alertPill}>
            <Text style={styles.alertPillText}>🔴 VENCIDOS</Text>
          </View>
        )}
      </View>

      {items.length === 0 ? (
        <EmptyState
          emoji="✅"
          title="Nenhum lote nesta faixa"
          subtitle="Nada vencendo no período selecionado"
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.lot_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          initialNumToRender={20}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filtersScroll: {
    maxHeight: 52,
    marginTop: spacing.sm,
  },
  filtersRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  alertPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  alertPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.danger,
  },
  list: {
    padding: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  expiry: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBox: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 68,
  },
  statusEmoji: {
    fontSize: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
});

export default ExpiryScreen;
