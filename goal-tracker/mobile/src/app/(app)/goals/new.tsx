/**
 * Criar meta.
 *
 * ## Validação: quem decide o que é válido
 *
 * O formulário só verifica o que é impossível enviar (nome vazio). Tamanho,
 * caracteres e o resto são do backend (regra 10) — e o `422`/`400` volta com
 * `details` campo a campo, que é exibido abaixo do campo correspondente.
 *
 * Duplicar as regras de validação aqui criaria dois lugares para manter em
 * sincronia, e o lugar errado (o cliente) perderia: validação no app não é
 * segurança.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { Button, Choice, ErrorBanner, Field } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { fieldErrorsOf, useAction } from '@/hooks/use-action';
import { createGoal } from '@/services/goals';
import type { Frequency } from '@/types/api';

const FREQUENCIES = [
  { value: 'DAILY' as const, label: 'Diária' },
  { value: 'WEEKLY' as const, label: 'Semanal' },
  { value: 'MONTHLY' as const, label: 'Mensal' },
];

export default function NewGoalScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('DAILY');

  const save = useAction(createGoal);

  /** Erros por campo, vindos do `details` do backend. */
  const fieldErrors = fieldErrorsOf(save.cause);

  async function submit() {
    const created = await save.run({
      name: name.trim(),
      frequency,
      description: description.trim() === '' ? null : description.trim(),
    });

    if (created) {
      // `replace` e não `push`: voltar depois de criar deve retornar para a
      // LISTA, não para um formulário pre-preenchido que não existe mais.
      router.replace(`/goals/${created.id}`);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="title">Nova meta</ThemedText>

        {save.error && !fieldErrors ? <ErrorBanner message={save.error} /> : null}

        <Field
          label="Nome"
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize="sentences"
          maxLength={120}
          returnKeyType="next"
          error={fieldErrors?.name}
          placeholder="Ex.: Estudar inglês"
        />

        <Field
          label="Descrição (opcional)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={500}
          style={styles.multiline}
          error={fieldErrors?.description}
        />

        <Choice
          label="Frequência"
          options={FREQUENCIES}
          value={frequency}
          onChange={setFrequency}
        />

        <ThemedText type="small" themeColor="textSecondary">
          {frequency === 'DAILY'
            ? 'Uma meta por dia. Períodos de um dia.'
            : frequency === 'WEEKLY'
              ? 'Uma meta por semana. O período vai do dia de criação ao mesmo dia da semana seguinte.'
              : 'Uma meta por mês. O período vai do dia de criação ao mesmo dia do mês seguinte.'}
        </ThemedText>

        <Button
          title="Criar meta"
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