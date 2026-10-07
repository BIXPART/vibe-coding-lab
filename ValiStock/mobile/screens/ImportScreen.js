/**
 * Importação inicial de produtos por CSV.
 *
 * Formato:
 * codigo_barras,nome,categoria,marca
 *
 * A API valida por linha, identifica duplicados e retorna o resultado.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import api from '../services/api';
import { colors, spacing, borderRadius } from '../utils/theme';

const SAMPLE_CSV =
  'codigo_barras,nome,categoria,marca\n7894900011517,Coca-Cola Original 2L,Bebidas,Coca-Cola\n7891000100103,Leite Integral 1L,Laticínios,Marca X';

const ImportScreen = ({ navigation }) => {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const pickFile = async () => {
    setError(null);
    setResult(null);

    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });

      if (picked.canceled) return;

      const asset = picked.assets[0];
      setFile(asset);
    } catch (_err) {
      setError('Não foi possível selecionar o arquivo');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Selecione um arquivo CSV primeiro');
      return;
    }

    setError(null);
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name || 'produtos.csv',
        type: 'text/csv',
      });

      const res = await api.upload('/products/import', formData);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleDone = () => {
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Instruções */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Como funciona</Text>
        <Text style={styles.infoText}>
          Importe uma planilha CSV com os produtos iniciais do estoque.
        </Text>
        <Text style={styles.infoText}>
          A importação cria apenas PRODUTOS. Os lotes são cadastrados
          posteriormente, conforme a mercadoria chega.
        </Text>
      </View>

      {/* Formato */}
      <Text style={styles.sectionTitle}>FORMATO ESPERADO</Text>
      <View style={styles.codeCard}>
        <Text style={styles.codeText}>{SAMPLE_CSV}</Text>
      </View>
      <Text style={styles.hint}>
        Colunas obrigatórias: codigo_barras e nome. Categoria e marca são
        opcionais.
      </Text>

      {/* Seleção de arquivo */}
      <TouchableOpacity style={styles.pickButton} onPress={pickFile}>
        <Text style={styles.pickButtonText}>
          {file ? ` arquivos: ${file.name}` : 'Selecionar arquivo CSV'}
        </Text>
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Resultado */}
      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Resultado da importação</Text>

          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Linhas no arquivo</Text>
            <Text style={styles.resultValue}>{result.total_lines}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Importados</Text>
            <Text style={[styles.resultValue, { color: colors.success }]}>
              {result.imported}
            </Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Erros</Text>
            <Text
              style={[
                styles.resultValue,
                { color: result.errors.length > 0 ? colors.danger : colors.success },
              ]}
            >
              {result.errors.length}
            </Text>
          </View>

          {result.errors.length > 0 && (
            <View style={styles.errorsList}>
              <Text style={styles.errorsTitle}>Erros por linha:</Text>
              {result.errors.map((e, i) => (
                <Text key={i} style={styles.errorLine}>
                  • Linha {e.line}: {e.error}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Ações */}
      {result ? (
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Concluir</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.uploadButton, (!file || sending) && styles.disabled]}
          onPress={handleUpload}
          disabled={!file || sending}
        >
          <Text style={styles.uploadButtonText}>
            {sending ? 'Importando...' : 'Importar produtos'}
          </Text>
        </TouchableOpacity>
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
  infoCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  codeCard: {
    backgroundColor: '#0F172A',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  codeText: {
    color: '#A5F3FC',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  pickButton: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  pickButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  resultValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  errorsList: {
    marginTop: spacing.sm,
  },
  errorsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  errorLine: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  doneButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default ImportScreen;
