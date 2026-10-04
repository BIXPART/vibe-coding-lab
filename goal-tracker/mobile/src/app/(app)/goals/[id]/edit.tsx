/**
 * Editar meta.
 *
 * ## Por que o formulário é um componente separado
 *
 * Preencher `useState` a partir de um `useEffect` que espera a resposta da API
 * é estado derivado de estado: dois renders extras, e uma janela em que os
 * campos estão vazios. Se o usuário salvar nessa janela, sobrescreve a meta
 * com nada.
 *
 * Aqui quem carrega é a tela; o formulário só aparece com os dados prontos e
 * inicializa o estado **uma vez**, no construtor do `useState`. Sem efeito,
 * sem janela, sem sobrescrita acidental.
 *
 * A `key` remonta o formulário quando a meta muda de `updatedAt` — assim, voltar
 * de uma edição recarrega com o valor novo em vez de manter o texto antigo.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Choice, ErrorBanner, Field, Loading } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { fieldErrorsOf, useAction } from '@/hooks/use-action';
import { useAsync } from '@/hooks/use-async';
import { getGoal, updateGoal } from '@/services/goals';
import type { Frequency, Goal } from '@/types/api';

const FREQUENCIES = [
  { value: 'DAILY' as const, label: 'Diária' },
  { value: 'WEEKLY' as const, label: 'Semanal' },
  { value: 'MONTHLY' as const, label: 'Mensal' },
];

export default function EditGoalScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Rota /goals/[id]/edit com id inválido: ${String(params.id)}`);
  }

  const loaded = useAsync<Goal>((signal) => getGoal(id, signal), [id]);

  if (loaded.loading && !loaded.data) return <Loading label="Carregando meta…" />;

  if (!loaded.data) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Editar meta</ThemedText>
        {loaded.error ? (
          <ErrorBanner message={loaded.error} onRetry={loaded.refetch} />
        ) : (
          <ErrorBanner message="Meta não encontrada." />
        )}
      </ScrollView>
    );
  }

  const goal = loaded.data;

  return (
    <EditForm
      key={goal.updatedAt}
      id={id}
      goal={goal}
      onSaved={() => router.back()}
    />
  );
}

function EditForm({ id, goal, onSaved }: { id: number; goal: Goal; onSaved: () => void }) {
  const [name, setName] = useState(goal.name);
  const [description, setDescription] = useState(goal.description ?? '');
  const [frequency, setFrequency] = useState<Frequency>(goal.frequency);
  const [isActive, setIsActive] = useState(goal.isActive);

  const save = useAction(updateGoal);
  const fieldErrors = fieldErrorsOf(save.cause);

  async function submit() {
    const updated = await save.run(id, {
      name: name.trim(),
      description: description.trim() === '' ? null : description.trim(),
      frequency,
      isActive,
    });

    if (updated) onSaved();
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="title">Editar meta</ThemedText>

        {save.error && !fieldErrors ? <ErrorBanner message={save.error} /> : null}

        <Field
          label="Nome"
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
          maxLength={120}
          error={fieldErrors?.name}
        />

        <Field
          label="Descrição"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={500}
          style={styles.multiline}
          error={fieldErrors?.description}
        />

        <Choice label="Frequência" options={FREQUENCIES} value={frequency} onChange={setFrequency} />

        <ThemedText type="small" themeColor="textSecondary">
          {isActive
            ? 'Meta ativa: aparece em "Hoje" e aceita conclusão.'
            : 'Meta inativa: sai de "Hoje" e não aceita conclusão. O histórico permanece.'}
        </ThemedText>

        <Button
          title={isActive ? 'Marcar como inativa' : 'Reativar meta'}
          variant="secondary"
          onPress={() => setIsActive((value) => !value)}
        />

        <Button
          title="Salvar"
          onPress={() => void submit()}
          loading={save.pending}
          disabled={name.trim() === ''}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 24,
    paddingBottom: 48,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
});