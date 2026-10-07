/**
 * Adicionar lote a um produto.
 * Ao salvar: cria o lote e registra a movimentação ENTRY automaticamente.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import api from '../services/api';
import { colors, spacing, borderRadius } from '../utils/theme';
import { addDays, formatDate } from '../utils/dates';

const NewLotScreen = ({ route, navigation }) => {
  const { productId, productName } = route.params;

  const [lotCode, setLotCode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [manufacturedAt, setManufacturedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState(addDays(90));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const validate = () => {
    if (!lotCode.trim()) return 'Informe o código do lote';
    if (!quantity || Number(quantity) <= 0 || !Number.isInteger(Number(quantity))) {
      return 'Informe uma quantidade inteira maior que zero';
    }
    if (!expiresAt) return 'Informe a data de validade';
    if (manufacturedAt && expiresAt < manufacturedAt) {
      return 'A validade não pode ser anterior à fabricação';
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSaving(true);
    try {
      await api.post(`/products/${productId}/lots`, {
        lot_code: lotCode.trim(),
        quantity: Number(quantity),
        manufactured_at: manufacturedAt || null,
        expires_at: expiresAt,
      });

      Alert.alert('Lote cadastrado', 'Entrada registrada no histórico.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Produto */}
        <View style={styles.productBox}>
          <Text style={styles.productLabel}>PRODUTO</Text>
          <Text style={styles.productName}>{productName}</Text>
        </View>

        <Text style={styles.label}>Código do lote *</Text>
        <TextInput
          style={styles.input}
          value={lotCode}
          onChangeText={setLotCode}
          placeholder="Ex.: A49281"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Quantidade (unidades) *</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder="Ex.: 24"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Data de fabricação</Text>
        <TextInput
          style={styles.input}
          value={manufacturedAt}
          onChangeText={setManufacturedAt}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.hint}>
          {manufacturedAt ? `Fabricação: ${formatDate(manufacturedAt)}` : 'Opcional'}
        </Text>

        <Text style={styles.label}>Data de validade *</Text>
        <TextInput
          style={styles.input}
          value={expiresAt}
          onChangeText={setExpiresAt}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.hint}>
          {expiresAt ? `Validade: ${formatDate(expiresAt)}` : 'Obrigatória'}
        </Text>

        {/* Atalhos de validade */}
        <View style={styles.shortcutsRow}>
          {[
            { label: '30 dias', days: 30 },
            { label: '90 dias', days: 90 },
            { label: '180 dias', days: 180 },
            { label: '1 ano', days: 365 },
          ].map((s) => (
            <TouchableOpacity
              key={s.days}
              style={styles.shortcut}
              onPress={() => setExpiresAt(addDays(s.days))}
            >
              <Text style={styles.shortcutText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Salvando...' : 'Salvar lote + registrar entrada'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>
          O cadastro do lote registra automaticamente uma movimentação de
          ENTRADA no histórico de estoque.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
  productBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  productLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  shortcut: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  shortcutText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footnote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});

export default NewLotScreen;
