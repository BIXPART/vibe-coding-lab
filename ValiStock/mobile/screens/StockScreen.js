/**
 * Tela de Estoque — visão geral com pesquisa e situação de validade.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { colors, spacing, borderRadius } from '../utils/theme';
import { formatDate } from '../utils/dates';

const StockScreen = ({ navigation }) => {
  const [search, setSearch] = useState('');
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await api.get('/stock');
      setAllItems(result);
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

  const term = search.trim().toLowerCase();
  const items = term
    ? allItems.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.barcode && p.barcode.includes(term)) ||
          (p.brand && p.brand.toLowerCase().includes(term))
      )
    : allItems;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ProductDetail', { id: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.qtyBox}>
          <Text style={styles.qty}>{item.total_quantity}</Text>
          <Text style={styles.qtyLabel}>un</Text>
        </View>
      </View>

      <Text style={styles.brand}>
        {item.brand || 'Sem marca'} · {item.lots_count}{' '}
        {item.lots_count === 1 ? 'lote' : 'lotes'}
      </Text>

      <View style={styles.footer}>
        {item.nearest_expires_at ? (
          <Text style={styles.expiry}>
            Vence: {formatDate(item.nearest_expires_at)}
          </Text>
        ) : (
          <Text style={styles.expiry}>Sem lotes</Text>
        )}
        {item.nearest_status && (
          <StatusBadge status={item.nearest_status} size="small" />
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading && allItems.length === 0) {
    return <LoadingState message="Carregando estoque..." />;
  }

  if (error && allItems.length === 0) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔎</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Pesquisar no estoque"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {items.length === 0 ? (
        <EmptyState
          emoji="📦"
          title="Nenhum item no estoque"
          subtitle="Os lotes aparecem aqui após o cadastro"
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          initialNumToRender={15}
          ListHeaderComponent={
            <Text style={styles.count}>
              {items.length} {items.length === 1 ? 'produto' : 'produtos'}
            </Text>
          }
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  clearIcon: {
    fontSize: 16,
    color: colors.textMuted,
    padding: spacing.xs,
  },
  list: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  count: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  qtyBox: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    minWidth: 52,
  },
  qty: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  qtyLabel: {
    fontSize: 10,
    color: colors.primary,
  },
  brand: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expiry: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});

export default StockScreen;
