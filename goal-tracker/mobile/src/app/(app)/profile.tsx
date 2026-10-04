/**
 * Perfil.
 *
 * Além de identidade, mostra **o endereço da API que o app está chamando** e o
 * fuso em uso. Ambos resolvem problemas concretos e recorrentes:
 *
 * - API errada = "não funciona no meu celular" e nenhuma pista do porquê.
 * - Fuso errado = todo o cálculo de período do backend usa o dia errado
 *   (regra 7), e o sintoma aparece só perto da meia-noite.
 *
 * ## Logout é local
 *
 * O backend não tem revogação de token (o JWT é válido até expirar). "Sair"
 * limpa o token do aparelho e é isso — é honesto mostrar isso aqui em vez de
 * fingir que o token foi invalidado no servidor.
 */
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';

import { Button, Card, ErrorBanner, Field, Row, Section } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/ctx';
import { fieldErrorsOf, useAction } from '@/hooks/use-action';
import { describeApiTarget } from '@/lib/env';
import { updateProfile } from '@/services/auth';

export default function ProfileScreen() {
  const { user, logout } = useSession();

  const [name, setName] = useState(user?.name ?? '');

  const save = useAction(updateProfile);
  const fieldErrors = fieldErrorsOf(save.cause);

  if (!user) {
    // `Stack.Protected` garante que esta tela só existe logado. Se chegar aqui,
    // é bug de navegação — falhar alto.
    throw new Error('ProfileScreen renderizado sem usuário na sessão.');
  }

  async function submit() {
    await save.run({ name: name.trim() === '' ? null : name.trim() });
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ThemedText type="title">Perfil</ThemedText>

      {save.error && !fieldErrors ? <ErrorBanner message={save.error} /> : null}

      <Section title="Conta">
        <Card>
          <Row label="E-mail" value={user.email} />
          <Row label="Fuso" value={user.timezone} />
          <Row label="Criada em" value={new Date(user.createdAt).toLocaleDateString()} />
        </Card>
      </Section>

      <Section title="Nome de exibição">
        <Card style={styles.formCard}>
          <Field
            label="Nome"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            maxLength={120}
            error={fieldErrors?.name}
            hint="Opcional. Usado só na interface."
          />
          <Button
            title="Salvar"
            onPress={() => void submit()}
            loading={save.pending}
            disabled={name.trim() === (user.name ?? '')}
          />
        </Card>
      </Section>

      <Section title="Diagnóstico">
        <Card style={styles.formCard}>
          <ThemedText type="small" themeColor="textSecondary">
            Endereço da API em uso
          </ThemedText>
          {/* `Platform.OS` é obrigatório aqui, não opcional: sem o argumento
              `describeApiTarget` cai no default `'web'` e o aviso de Android
              nunca aparece — que é justamente a plataforma onde ele importa
              (`localhost` é o próprio aparelho). `sign-in.tsx` já faz igual. */}
          <ThemedText type="small">{describeApiTarget(Platform.OS)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            O fuso acima é detectado no aparelho e sincronizado a cada abertura. Em Android
            emulador, `localhost` aponta para o próprio aparelho — defina
            `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` no `.env.local` se precisar.
          </ThemedText>
        </Card>
      </Section>

      <Section title="Sessão">
        <Card style={styles.formCard}>
          <ThemedText type="small" themeColor="textSecondary">
            O token fica no armazenamento do aparelho e é removido ao sair. Ele não é
            revogado no servidor: continua válido até expirar.
          </ThemedText>
          <Button title="Sair" variant="secondary" onPress={() => void logout()} />
        </Card>
      </Section>
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
  formCard: {
    gap: 12,
  },
});