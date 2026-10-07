/**
 * Tela inicial — Dashboard com indicadores e lotes mais urgentes.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LoadingState, ErrorState } from '../components/States';
import { colors, spacing, borderRadius } from '../utils/theme';
import { formatDate } from '../utils/dates';

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await api.get('/dashboard');
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading && !data) {
    return <LoadingState message="Carregando dashboard..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  const ind = data ? data.indicators : {};
  const urgent = data ? data.urgent : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {user?.name?.split(' ')[0]}</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('pt-BR')}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Indicadores principais */}
      <View style={styles.indicatorsRow}>
        <IndicatorCard
          value={ind.products}
          label="Produtos"
          icon=" products"
        />
        <IndicatorCard
          value={ind.total_units}
          label="Unidades"
          icon="️"
        />
      </View>

      {/* Lotes por faixa de vencimento */}
      <Text style={styles.sectionTitle}>LOTES POR VENCIMENTO</Text>
      <View style={styles.indicatorsRow}>
        <IndicatorCard
          value={ind.lots_expired}
          label="Vencidos"
          icon="🔴"
          color={colors.vencido}
        />
        <IndicatorCard
          value={ind.lots_expiring_3_days}
          label="Até 3 dias"
          icon="🔴"
          color={colors.urgente}
        />
        <IndicatorCard
          value={ind.lots_expiring_7_days}
          label="Até 7 dias"
          icon="🟠"
          color={colors.atencao}
        />
        <IndicatorCard
          value={ind.lots_expiring_30_days}
          label="Até 30 dias"
          icon="🟡"
          color={colors.proximo}
        />
      </View>

      {/* Urgentes */}
      <Text style={styles.sectionTitle}>⚠️ PRÓXIMOS DO VENCIMENTO</Text>

      {urgent.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>✅</Text>
          <Text style={styles.emptyText}>
            Nenhum lote próximo do vencimento
          </Text>
        </View>
      ) : (
        urgent.map((item) => (
          <TouchableOpacity
            key={item.lot_id}
            style={styles.urgentCard}
            onPress={() =>
              navigation.navigate('ProductDetail', { id: item.product.id })
            }
          >
            <View style={styles.urgentInfo}>
              <Text style={styles.urgentName} numberOfLines={1}>
                {item.product.name}
              </Text>
              <Text style={styles.urgentMeta}>
                {item.quantity} unidades · Lote {item.lot_code}
              </Text>
              <Text style={styles.urgentExpiry}>
                Validade: {formatDate(item.expires_at)}
              </Text>
            </View>
            <View
              style={[
                styles.urgentBadge,
                { backgroundColor: `${item.status.color}1A` },
              ]}
            >
              <Text style={[styles.urgentBadgeText, { color: item.status.color }]}>
                {item.status.emoji}
              </Text>
              <Text style={[styles.urgentDays, { color: item.status.color }]}>
                {item.days < 0
                  ? `${Math.abs(item.days)}d vencido`
                  : item.days === 0
                  ? 'hoje'
                  : `${item.days}d`}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}

      {/* Atalho importação */}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('Import')}
      >
        <Text style={styles.secondaryButtonText}>📥 Importar produtos (CSV)</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const IndicatorCard = ({ value, label, icon, color = colors.primary }) => (
  <View style={[styles.indicatorCard, { borderLeftColor: color }]}>
    <Text style={styles.indicatorIcon}>{icon}</Text>
    <View>
      <Text style={styles.indicatorValue}>{value ?? 0}</Text>
      <Text style={styles.indicatorLabel}>{label}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  date: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  indicatorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  indicatorCard: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  indicatorIcon: {
    fontSize: 22,
  },
  indicatorValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  indicatorLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  urgentCard: {
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
  urgentInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  urgentName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  urgentMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  urgentExpiry: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  urgentBadge: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    minWidth: 70,
  },
  urgentBadgeText: {
    fontSize: 18,
  },
  urgentDays: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
});

export default HomeScreen;
