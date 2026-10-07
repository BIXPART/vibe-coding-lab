/**
 * Tela de Produtos — busca por nome/código de barras + filtros de validade.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { colors, spacing, borderRadius } from '../utils/theme';
import { formatDate } from '../utils/dates';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'expired', label: 'Vencidos' },
  { key: 'urgent', label: 'Urgentes' },
  { key: 'up_to_7', label: 'Até 7 dias' },
  { key: 'up_to_30', label: 'Até 30 dias' },
  { key: 'normal', label: 'Normais' },
];

const ProductsScreen = ({ navigation }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (filter !== 'all') params.append('filter', filter);

      const query = params.toString();
      const result = await api.get(`/products${query ? `?${query}` : ''}`);
      setProducts(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  // Busca com debounce simples
  useEffect(() => {
    const timer = setTimeout(fetchData, 350);
    return () => clearTimeout(timer);
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ProductDetail', { id: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.productName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.nearest_status && (
          <StatusBadge status={item.nearest_status} size="small" />
        )}
      </View>

      <Text style={styles.brand}>
        {item.brand || 'Sem marca'}
        {item.category ? ` · ${item.category.name}` : ''}
      </Text>

      <View style={styles.cardFooter}>
        <Text style={styles.meta}>
          {item.total_quantity} un · {item.lots_count}{' '}
          {item.lots_count === 1 ? 'lote' : 'lotes'}
        </Text>
        <Text style={styles.expiry}>
          {item.nearest_expires_at
            ? `Vence: ${formatDate(item.nearest_expires_at)}`
            : 'Sem lotes'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Busca */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔎</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome ou código de barras"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

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
            style={[
              styles.filterChip,
              filter === f.key && styles.filterChipActive,
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.key && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      {loading && products.length === 0 ? (
        <LoadingState message="Carregando produtos..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : products.length === 0 ? (
        <EmptyState
          emoji=" products"
          title="Nenhum produto encontrado"
          subtitle={
            search
              ? 'Tente outro termo de busca'
              : 'Cadastre produtos ou importe um CSV'
          }
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          initialNumToRender={15}
          ListHeaderComponent={
            <Text style={styles.count}>
              {products.length}{' '}
              {products.length === 1 ? 'produto' : 'produtos'}
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
  filtersScroll: {
    maxHeight: 44,
    marginBottom: spacing.xs,
  },
  filtersRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
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
  productName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  brand: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  expiry: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});

export default ProductsScreen;
