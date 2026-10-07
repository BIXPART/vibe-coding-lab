/**
 * Detalhe do produto — dados, estoque total e lista de lotes com validade.
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
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { colors, spacing, borderRadius } from '../utils/theme';
import { formatDate } from '../utils/dates';

const ProductDetailScreen = ({ route, navigation }) => {
  const { id } = route.params;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await api.get(`/products/${id}`);
      setProduct(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  if (loading && !product) {
    return <LoadingState message="Carregando produto..." />;
  }

  if (error && !product) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchData();
          }}
        />
      }
    >
      {/* Cabeçalho do produto */}
      <View style={styles.headerCard}>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.brand}>
          {product.brand || 'Sem marca'}
          {product.category ? ` · ${product.category.name}` : ''}
        </Text>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Código</Text>
            <Text style={styles.infoValue}>{product.barcode}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{product.total_quantity}</Text>
            <Text style={styles.statLabel}>unidades</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{product.lots_count}</Text>
            <Text style={styles.statLabel}>
              {product.lots_count === 1 ? 'lote' : 'lotes'}
            </Text>
          </View>
        </View>
      </View>

      {/* Lotes */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>LOTES</Text>
        <View style={styles.sectionActions}>
          <TouchableOpacity
            style={styles.movementButton}
            onPress={() =>
              navigation.navigate('RegisterMovement', {
                productId: product.id,
                productName: product.name,
              })
            }
          >
            <Text style={styles.movementButtonText}>↕ Movimentar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() =>
              navigation.navigate('NewLot', {
                productId: product.id,
                productName: product.name,
              })
            }
          >
            <Text style={styles.addButtonText}>+ Lote</Text>
          </TouchableOpacity>
        </View>
      </View>

      {product.lots.length === 0 ? (
        <EmptyState
          emoji=" boxes"
          title="Nenhum lote cadastrado"
          subtitle="Registre a entrada da mercadoria"
          actionLabel="+ Adicionar primeiro lote"
          onAction={() =>
            navigation.navigate('NewLot', {
              productId: product.id,
              productName: product.name,
            })
          }
        />
      ) : (
        product.lots.map((lot) => (
          <View key={lot.id} style={styles.lotCard}>
            <View style={styles.lotHeader}>
              <Text style={styles.lotCode}>Lote {lot.lot_code}</Text>
              <StatusBadge status={lot.status} size="small" />
            </View>

            <Text style={styles.lotQuantity}>{lot.quantity} unidades</Text>

            <View style={styles.lotDates}>
              {lot.manufactured_at ? (
                <Text style={styles.lotDate}>
                  Fab.: {formatDate(lot.manufactured_at)}
                </Text>
              ) : null}
              <Text style={styles.lotDate}>
                Validade: {formatDate(lot.expires_at)}
              </Text>
            </View>

            <Text style={[styles.lotStatus, { color: lot.status.color }]}>
              {lot.status.emoji} {lot.status.label}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  brand: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoRow: {
    marginTop: spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  movementButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  movementButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  lotCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lotCode: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  lotQuantity: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xs,
  },
  lotDates: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  lotDate: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  lotStatus: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
});

export default ProductDetailScreen;
