/**
 * Detalhe de uma meta: período atual, concluir, estatísticas e histórico.
 *
 * ## Nada nesta tela recalcula período
 *
 * `currentPeriod.periodStart/periodEnd`, `window.from/to` e todo o histórico
 * vêm prontos do backend. A tela formata e exibe (regra 10). O motivo
 * concreto: o fuso do usuário define o que é "hoje", e essa informação só
 * existe no servidor.
 *
 * ## `Promise.all` para meta + stats
 *
 * O endpoint de stats **não** devolve `isActive`, que a tela precisa para o
 * botão ativar/desativar. Duas requisições com um estado de carregamento só é
 * melhor que dois `Loading` piscando em sequência — mas continua sendo duas
 * requisições; se um dia o backend incluir `isActive` no stats, isto deve virar
 * uma só.
 */
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  Row,
  Section,
  StatusBadge,
} from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useAction } from '@/hooks/use-action';
import { useAsync } from '@/hooks/use-async';
import {
  formatCivilShort,
  formatInstant,
  formatPeriod,
  formatRate,
  frequencyLabel,
  statusLabel,
} from '@/lib/format';
import {
  completeCurrentOccurrence,
  deleteGoal,
  getGoal,
  getGoalStats,
  getHistory,
  updateGoal,
} from '@/services/goals';
import type { Goal, GoalOccurrences, GoalStats } from '@/types/api';

interface Detail {
  goal: Goal;
  stats: GoalStats;
}

export default function GoalDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  // Rota inválida é bug de navegação, não estado do usuário: falhar aqui é
  // melhor que disparar requisição com id quebrado.
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Rota /goals/[id] com id inválido: ${String(params.id)}`);
  }

  const detail = useAsync<Detail>(
    (signal) =>
      Promise.all([getGoal(id, signal), getGoalStats(id, signal)]).then(([goal, stats]) => ({
        goal,
        stats,
      })),
    [id],
  );
  const history = useAsync<GoalOccurrences>((signal) => getHistory(id, {}, signal), [id]);

  // `deleteGoal` resolve `void`: sem este wrapper, "deu certo" seria
  // indistinguível de "falhou". O wrapper devolve um booleano explícito.
  const complete = useAction(completeCurrentOccurrence);
  const toggleActive = useAction((active: boolean) => updateGoal(id, { isActive: active }));
  const remove = useAction(() => deleteGoal(id).then(() => true));

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Só as funções ESTÁVEIS entram nas deps de `refresh`.
  //
  // `detail` e `history` são objetos; mesmo memoizados, mudam de identidade
  // quando `data`/`loading` mudam. Depender deles tornaria `refresh` instável,
  // e o `useFocusEffect` abaixo (que usa o effect em `deps`) rodaria o cleanup
  // a cada render — o cleanup chama `refresh()`, que dispara fetch, que seta
  // estado, que re-renderiza. Loop infinito de requisições. `reload` é
  // `useCallback` com deps estáveis, então isso não acontece.
  const { reload: reloadDetail } = detail;
  const { reload: reloadHistory } = history;

  const refresh = useCallback(() => {
    reloadDetail();
    reloadHistory();
  }, [reloadDetail, reloadHistory]);

  // Revalida ao voltar de "editar" (ou de qualquer outra tela).
  //
  // O cleanup do `useFocusEffect` roda no BLUR, não no foco — é por isso que a
  // recarga aparece quando o usuário volta, e não quando ele sai. Custa uma
  // requisição desperdiçada na saída; trocar por refresh-on-focus exigiria um
  // `useRef` de "primeiro foco" para não duplicar o fetch do mount.
  //
  // Efeito colateral aceitável: saia da tela, o cleanup dispara um `reload`
  // cujo resultado é descartado, porque o `useAsync` aborta no unmount.
  useFocusEffect(
    useCallback(() => {
      return () => refresh();
    }, [refresh]),
  );

  if (detail.loading && !detail.data) return <Loading label="Carregando meta…" />;

  const data = detail.data;
  const stats = data?.stats;
  const goal = data?.goal;
  const period = stats?.currentPeriod;
  const done = period?.status === 'COMPLETED';

  async function handleComplete() {
    const result = await complete.run(id);
    if (result) refresh();
  }

  async function handleToggleActive() {
    if (!goal) return;

    // Otimista: reflete a intenção antes da resposta, para o botão não ficar
    // "travado" numa conexão lenta. Em erro, `reload()` desfaz.
    const result = await toggleActive.run(!goal.isActive);
    if (result) refresh();
  }

  async function handleDelete() {
    const ok = await remove.run();
    if (ok) router.replace('/goals');
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={detail.loading || history.loading} onRefresh={refresh} />
      }>
      <View style={styles.header}>
        <ThemedText type="title">{stats?.goalName ?? 'Meta'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {stats ? frequencyLabel(stats.frequency) : ''}
          {goal && !goal.isActive ? ' · inativa' : ''}
        </ThemedText>
      </View>

      {detail.error ? <ErrorBanner message={detail.error} onRetry={detail.refetch} /> : null}
      {complete.error ? <ErrorBanner message={complete.error} /> : null}
      {toggleActive.error ? <ErrorBanner message={toggleActive.error} /> : null}
      {remove.error ? <ErrorBanner message={remove.error} /> : null}

      {stats && period ? (
        <Card style={styles.periodCard}>
          <View style={styles.periodHeader}>
            <View style={styles.periodTitle}>
              <ThemedText type="subtitle">{formatPeriod(period.periodStart, period.periodEnd)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {statusLabel(period.status)}
                {period.completedAt ? ` · ${formatInstant(period.completedAt)}` : ''}
              </ThemedText>
            </View>
            <StatusBadge status={period.status} />
          </View>

          <Button
            title={done ? 'Concluído' : 'Concluir'}
            // Inativa não pode ser concluída: a regra é do backend (422), mas
            // desabilitar aqui evita um clique que só pode falhar.
            disabled={done || !goal?.isActive || complete.pending}
            loading={complete.pending}
            onPress={() => void handleComplete()}
          />
          {!goal?.isActive ? (
            <ThemedText type="small" themeColor="textSecondary">
              Metas inativas não podem ser concluídas. Reative abaixo.
            </ThemedText>
          ) : null}
        </Card>
      ) : null}

      {stats ? (
        <Section title="Sequência">
          <Card>
            <Row label="Atual" value={String(stats.currentStreak)} />
            <Row label="Recorde" value={String(stats.bestStreak)} />
            <Row label="Taxa de conclusão" value={formatRate(stats.hasData, stats.completionRate)} />
            <Row
              label="Período de medição"
              value={`${formatCivilShort(stats.window.from)} a ${formatCivilShort(stats.window.to)}`}
            />
          </Card>
        </Section>
      ) : null}

      {stats ? (
        <Section title="Contagem">
          <Card>
            <Row label="Concluídas" value={String(stats.completedCount)} />
            <Row label="Perdidas" value={String(stats.missedCount)} />
            <Row label="Pendentes" value={String(stats.pendingCount)} />
            <Row label="Períodos contados" value={String(stats.window.periodsCounted)} />
          </Card>
        </Section>
      ) : null}

      <Section title="Histórico">
        {history.loading && !history.data ? <Loading label="Carregando histórico…" /> : null}

        {history.error ? <ErrorBanner message={history.error} onRetry={history.refetch} /> : null}

        {history.data?.occurrences.length === 0 ? (
          <EmptyState
            title="Sem períodos ainda"
            hint="O histórico aparece conforme os períodos passam."
          />
        ) : null}

        {history.data?.occurrences.map((occurrence) => (
          <Card key={occurrence.periodStart} style={styles.historyRow}>
            <View style={styles.historyMain}>
              <ThemedText type="smallBold">
                {formatPeriod(occurrence.periodStart, occurrence.periodEnd)}
              </ThemedText>
              {!occurrence.persisted ? (
                // `persisted: false` = o backend gerou a linha para preencher a
                // lacuna: o app não foi aberto naquele dia. Distingue isso de
                // "o dia existiu e foi perdido".
                <ThemedText type="small" themeColor="textSecondary">
                  dia sem registro
                </ThemedText>
              ) : null}
            </View>
            <View style={styles.historySide}>
              <ThemedText type="small" themeColor="textSecondary">
                {statusLabel(occurrence.status)}
              </ThemedText>
              <StatusBadge status={occurrence.status} />
            </View>
          </Card>
        ))}
      </Section>

      {goal ? (
        <Section title="Gerenciar">
          <Card style={styles.manageCard}>
            <Button
              title="Editar meta"
              variant="secondary"
              onPress={() => router.push(`/goals/${id}/edit`)}
            />

            <Button
              title={goal.isActive ? 'Desativar' : 'Reativar'}
              variant="secondary"
              loading={toggleActive.pending}
              onPress={() => void handleToggleActive()}
            />

            <Button
              title={confirmingDelete ? 'Confirmar exclusão' : 'Excluir meta'}
              variant={confirmingDelete ? 'danger' : 'secondary'}
              loading={remove.pending}
              onPress={() => {
                if (confirmingDelete) {
                  void handleDelete();
                  return;
                }

                setConfirmingDelete(true);
                // Destrava sozinho: uma confirmação que fica para sempre
                // parada vira botão de voltar atrás.
                setTimeout(() => setConfirmingDelete(false), 5000);
              }}
            />

            {confirmingDelete ? (
              <ThemedText type="small" themeColor="textSecondary">
                A meta sai da lista, mas o histórico é preservado (regra 8). Não dá para desfazer.
              </ThemedText>
            ) : null}
          </Card>
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 24,
    padding: 24,
    paddingBottom: 48,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: 4,
  },
  periodCard: {
    gap: 16,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  periodTitle: {
    flex: 1,
    gap: 2,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  historyMain: {
    flex: 1,
    gap: 2,
  },
  historySide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageCard: {
    gap: 12,
  },
});