/**
 * Lista de metas.
 *
 * ## Paginação: "carregar mais" aumenta o `limit`, não o `page`
 *
 * O endpoint é paginado (`page`/`limit`) e trunca silenciosamente em 100
 * registros. Duas formas de implementar "carregar mais" foram avaliadas:
 *
 * - somar páginas em estado -> exige um efeito sincronizando `data` em
 *   `pages`, ou seja, estado derivado de estado. É a origem de bug mais comum
 *   em lista paginada;
 * - pedir `page: 1` com `limit` cada vez maior -> a resposta já vem completa.
 *   Sem acumulação, sem efeito, sem estado duplicado.
 *
 * A segunda é mais simples e produz o mesmo resultado visível. O teto continua
 * sendo 100 do servidor, então o botão some ao chegar lá — e é honesto mostrar
 * esse limite em vez de simular rolagem infinita sobre uma base truncada.
 *
 * ## Recarrega ao voltar
 *
 * `useFocusEffect` com cleanup: ao desfocar (voltar do detalhe), a lista recarrega
 * do zero, porque ativar/excluir uma meta mudou o servidor.
 */
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Button, Card, EmptyState, ErrorBanner, Loading, Toggle } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useAsync } from '@/hooks/use-async';
import { frequencyLabel } from '@/lib/format';
import { listGoals } from '@/services/goals';
import type { PaginatedGoals } from '@/types/api';

const PAGE_SIZE = 20;

/** Teto do servidor. Acima disso a resposta vem truncada sem aviso. */
const SERVER_MAX_LIMIT = 100;

export default function GoalsListScreen() {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [includeInactive, setIncludeInactive] = useState(false);

  const request = useAsync<PaginatedGoals>(
    (signal) => listGoals({ page: 1, limit, includeInactive }, signal),
    [limit, includeInactive],
  );

  const { data, error, loading, reload, refetch } = request;

  const reset = useCallback(() => setLimit(PAGE_SIZE), []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        // Runs on blur: volta ao primeiro "lote" para não mostrar uma lista já
        // deslocada quando um item mudar lá dentro.
        reset();
        reload();
      };
    }, [reload, reset]),
  );

  const goals = data?.goals ?? [];
  const pagination = data?.pagination;
  const hasMore = limit < SERVER_MAX_LIMIT && (pagination?.total ?? 0) > limit;

  if (loading && !data) return <Loading label="Carregando metas…" />;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => reload()} />}>
      <View style={styles.header}>
        <ThemedText type="title">Metas</ThemedText>
        <Button title="Nova meta" onPress={() => router.push('/goals/new')} style={styles.newButton} />
      </View>

      <Toggle
        label="Mostrar inativas"
        value={includeInactive}
        onChange={(next) => {
          setIncludeInactive(next);
          reset();
        }}
      />

      {error ? <ErrorBanner message={error} onRetry={refetch} /> : null}

      {goals.length === 0 && !loading ? (
        <EmptyState
          title={includeInactive ? 'Nenhuma meta' : 'Nenhuma meta ativa'}
          hint={
            includeInactive
              ? 'Crie uma meta para começar.'
              : 'Você tem metas inativas. Toque em "Mostrar inativas" para vê-las.'
          }
        />
      ) : null}

      {goals.map((goal) => (
        <Card key={goal.id}>
          <View style={styles.cardTitle}>
            <ThemedText type="subtitle">{goal.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {frequencyLabel(goal.frequency)}
              {goal.isActive ? '' : ' · inativa'}
            </ThemedText>
          </View>

          {goal.description ? (
            <ThemedText type="small" themeColor="textSecondary">
              {goal.description}
            </ThemedText>
          ) : null}

          <Button
            title="Abrir"
            variant="secondary"
            onPress={() => router.push(`/goals/${goal.id}`)}
            style={styles.openButton}
          />
        </Card>
      ))}

      {hasMore ? (
        <Button
          title={`Carregar mais (${pagination?.total ?? 0} no total)`}
          variant="secondary"
          loading={loading}
          onPress={() => setLimit((value) => Math.min(value + PAGE_SIZE, SERVER_MAX_LIMIT))}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    padding: 24,
    paddingBottom: 48,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: 12,
  },
  newButton: {
    alignSelf: 'flex-start',
  },
  cardTitle: {
    gap: 2,
  },
  openButton: {
    alignSelf: 'stretch',
  },
});