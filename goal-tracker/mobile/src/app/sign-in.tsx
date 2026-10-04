/**
 * Entrar / criar conta.
 *
 * Uma tela para os dois fluxos, alternada por um switch. Motivo: os campos são
 * quase os mesmos (e-mail e senha), o erro é o mesmo, e o rate limit é o mesmo
 * (`authLimiter` cobre `/auth/login` e `/auth/register` juntos). Duas telas
 * duplicariam tudo sem ganhar nada.
 *
 * ## Rate limit: o 429 aqui é esperado
 *
 * O backend limita tentativas por `ip:email`. Repetir "entrar" com senha
 * errada umas poucas vezes durante o desenvolvimento **vai** gerar 429. Isso é
 * proteção funcionando, não bug do app — a mensagem diz isso explicitamente para
 * não confundir quem está testando.
 *
 * ## Regra 10
 *
 * A validação de senha é do backend, e hoje ela é APENAS `min(8)`/`max(72)` —
 * nenhuma exigência de maiúscula ou dígito. Por isso a dica abaixo promete só o
 * mínimo que existe. (Prometer mais do que o servidor aceita é pior que não
 * prometer nada: o usuário escreve uma senha que segue a dica e mesmo assim
 * toma 400.)
 *
 * O app não tenta adivinhar regra de senha: a senha digitada é enviada como
 * está e o servidor responde 400 com `details` campo a campo, que é o que
 * exibimos.
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Stack } from 'expo-router';

import { Button, ErrorBanner, Field } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { describeApiTarget } from '@/lib/env';
import { useSession } from '@/ctx';
import { ApiError } from '@/services/api';
import { explainAuthError } from '@/services/auth';

type Mode = 'signIn' | 'signUp';

const MODE_LABELS: Record<Mode, { title: string; cta: string; switchTo: string }> = {
  signIn: { title: 'Entrar', cta: 'Entrar', switchTo: 'Não tem conta? Criar conta' },
  signUp: { title: 'Criar conta', cta: 'Criar conta', switchTo: 'Já tem conta? Entrar' },
};

export default function SignIn() {
  const { login, register } = useSession();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signIn') {
        await login({ email: email.trim(), password });
      } else {
        await register({
          email: email.trim(),
          password,
          // O backend aceita `name` ausente; mandamos só se preenchido.
          ...(name.trim() ? { name: name.trim() } : {}),
        });
      }
      // Sucesso: não navegamos manualmente. `Stack.Protected` troca o guard e o
      // Router move o usuário para `(app)` sozinho. Navegar aqui criaria uma
      // corrida entre o `router.replace` e a troca de guard.
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setLoading(false);
    }
  }

  const labels = MODE_LABELS[mode];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: labels.title }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.header}>
          <ThemedText type="title">{labels.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {mode === 'signIn'
              ? 'Acompanhe o que você se propõe a fazer, período por período.'
              : 'Leva menos de um minuto.'}
          </ThemedText>
        </View>

        {error ? <ErrorBanner message={error} /> : null}

        {mode === 'signUp' ? (
          <Field
            label="Nome (opcional)"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />
        ) : null}

        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          // `none` (não `email`): o backend normaliza para minúsculas, e o iOS
          // tentaria "corrigir" o domínio. `none` deixa o usuário escrever
          // maiúscula e ainda assim funcionar.
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />

        <Field
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          hint={mode === 'signUp' ? 'Mínimo 8 caracteres.' : undefined}
        />

        <Button
          title={labels.cta}
          onPress={() => void submit()}
          loading={loading}
          disabled={email.trim() === '' || password === ''}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setError(null);
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          }}>
          <ThemedText type="linkPrimary" style={styles.switch}>
            {labels.switchTo}
          </ThemedText>
        </Pressable>

        {/* Diagnóstico: a URL da API é a causa nº 1 de "não funciona no meu
            celular". Ver o que o app está de fato chamando evita horas de
            adivinhação (regra 12: erro visível > erro silencioso). */}
        <ThemedText type="small" themeColor="textSecondary" style={styles.diagnostic}>
          API: {describeApiTarget(Platform.OS)}
        </ThemedText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Converte a exceção em texto.
 *
 * `explainAuthError` conhece os códigos do backend. `429` cai aqui à parte,
 * porque a mensagem do rate limit merece explicar que é proteção e não erro.
 */
function explain(error: unknown): string {
  const specific = explainAuthError(error);
  if (specific) return specific;

  if (error instanceof ApiError) {
    if (error.status === 429) {
      return (
        'Muitas tentativas de login. Espere alguns minutos e tente de novo. ' +
        'Se está testando, isso é o rate limit do servidor funcionando.'
      );
    }

    if (error.status >= 500) {
      return 'O servidor deu erro. Tente de novo em instantes.';
    }
  }

  // `NetworkError` já vem com mensagem explicativa (inclui o caso do emulador
  // Android). Qualquer outra coisa cai no genérico.
  return error instanceof Error ? error.message : 'Não foi possível conectar.';
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: 4,
    marginBottom: 8,
  },
  switch: {
    textAlign: 'center',
    paddingVertical: 8,
  },
  diagnostic: {
    textAlign: 'center',
    marginTop: 8,
  },
});