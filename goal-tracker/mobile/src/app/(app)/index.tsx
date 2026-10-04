/**
 * Aba "Hoje".
 *
 * Uma chamada só: `GET /dashboard` devolve totais, taxa e, para cada meta
 * ativa, o período atual com streak. A tela não agrega nada por conta própria
 * (regra 10).
 *
 * ## Por que "Hoje" e não "Dashboard"
 *
 * O usuário não quer ver número de dashboard. Quer saber o que precisa fazer
 * agora. Os números ficam secundários; a lista de metas com botão de concluir
 * é o conteúdo principal.
 *
 * ## Concluir de volta e já mostrar como concluída
 *
 * Tocar em "Concluir" marca o item localmente **antes** de revalidar a lista.
 * Sem isso, a requisição + reload faz o botão piscar e voltar — em conexão
 * lenta o usuário toca de novo e recebe `409`. O `409` é tratado como sucesso
 * logo no service (ver `completeCurrentOccurrence`).
 */
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button, Card, EmptyState, ErrorBanner, Loading, StatusBadge } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useAsync } from '@/hooks/use-async';
import { useAction } from '@/hooks/use-action';
import { formatPeriod, formatRate, frequencyLabel } from '@/lib/format';
import { completeCurrentOccurrence } from '@/services/goals';
import { getDashboard } from '@/services/dashboard';
import type { Dashboard } from '@/types/api';

export default function TodayScreen() {
  const dashboard = useAsync<Dashboard>((signal) => getDashboard(signal), []);
  const complete = useAction(completeCurrentOccurrence);

  // Otimista: ids já concluídos, para o item não voltar a "pendente" enquanto a
  // requisição está em voo.
  const [optimistic, setOptimistic] = useState<ReadonlySet<number>>(() => new Set());

  const onComplete = useCallback(
    async (goalId: number) => {
      setOptimistic((current) => new Set(current).add(goalId));

      const result = await complete.run(goalId);

      // Sucesso (inclusive 409 reinterpretado) ou erro: em ambos os casos
      // revalidamos, porque o servidor é a fonte da verdade (regra 10).
      if (result) dashboard.reload();
      setOptimistic(new Set());
    },
    [complete, dashboard],
  );

  const data = dashboard.data;

  if (dashboard.loading && !data) return <Loading label="Carregando suas metas…" />;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={dashboard.loading} onRefresh={dashboard.reload} />
      }>
      <View style={styles.header}>
        <ThemedText type="title">Hoje</ThemedText>
        {data ? (
          <ThemedText type="small" themeColor="textSecondary">
            {data.totals.activeGoals === 0
              ? 'Nenhuma meta ativa.'
              : `${data.totals.activeGoals} ${data.totals.activeGoals === 1 ? 'meta ativa' : 'metas ativas'}`}
          </ThemedText>
        ) : null}
      </View>

      {dashboard.error ? <ErrorBanner message={dashboard.error} onRetry={dashboard.refetch} /> : null}
      {complete.error ? <ErrorBanner message={complete.error} /> : null}

      {data ? <Totals totals={data.totals} /> : null}

      {data?.goals.length === 0 ? (
        <EmptyState
          title="Você ainda não tem metas"
          hint="Crie a primeira na aba Metas para começar a acompanhar seus períodos."
        />
      ) : null}

      {data?.goals.map((goal) => {
        const done = goal.status === 'COMPLETED' || optimistic.has(goal.goalId);

        return (
          <Card key={goal.goalId} style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <View style={styles.goalTitleBlock}>
                <ThemedText type="subtitle">{goal.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {frequencyLabel(goal.frequency)} ·{' '}
                  {formatPeriod(goal.currentPeriodStart, goal.currentPeriodEnd)}
                </ThemedText>
              </View>
              <StatusBadge status={goal.status} />
            </View>

            <View style={styles.goalFooter}>
              <View style={styles.streakBlock}>
                <ThemedText type="smallBold">
                  {goal.currentStreak > 0 ? `${goal.currentStreak} seguidos` : 'sem sequência'}
                </ThemedText>
                {goal.bestStreak > 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    recorde: {goal.bestStreak}
                  </ThemedText>
                ) : null}
              </View>

              <View style={styles.goalActions}>
                <Button
                  title="Detalhes"
                  variant="secondary"
                  onPress={() => router.push(`/goals/${goal.goalId}`)}
                  style={styles.smallButton}
                />
                <Button
                  title={done ? 'Concluído' : 'Concluir'}
                  disabled={done || complete.pending}
                  loading={complete.pending}
                  onPress={() => void onComplete(goal.goalId)}
                  style={styles.smallButton}
                />
              </View>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

/**
 * Totais em uma linha.
 *
 * `hasData === false` vira "—", não "0%": a API §6 proíbe inventar taxa quando
 * não há períodos fechados ainda.
 *
 * O rótulo da taxa diz "na janela" de propósito. "Concluídas" e "Pendentes"
 * contam **metas no período atual**; a taxa conta **períodos fechados na janela
 * de medição** (30 períodos, no servidor). Sem essa distinção na tela, o
 * usuário compara "80%" com "2 de 3" e conclui que algum dos dois está errado.
 */
function Totals({ totals }: { totals: Dashboard['totals'] }) {
  return (
    <Card>
      <View style={styles.totalsRow}>
        <Total label="Concluídas hoje" value={String(totals.completed)} />
        <Total label="Pendentes hoje" value={String(totals.pending)} />
        <Total
          label="Taxa na janela"
          value={formatRate(totals.hasData, totals.completionRate)}
        />
      </View>
    </Card>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.total}>
      <ThemedText type="title">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
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
    gap: 4,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  total: {
    // `flex: 1` divide a linha em terços iguais. Sem isso cada coluna dimensiona
    // pelo texto e "Concluídas hoje" estoura a largura em tela estreita.
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  goalCard: {
    gap: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  goalTitleBlock: {
    flex: 1,
    gap: 2,
  },
  goalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  streakBlock: {
    gap: 2,
  },
  goalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    paddingHorizontal: 16,
  },
});