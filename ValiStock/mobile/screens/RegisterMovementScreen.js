/**
 * Registrar movimentação de estoque (venda, perda ou ajuste).
 * A entrada (ENTRY) é automática no cadastro do lote.
 */
import React, { useState, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { colors, spacing, borderRadius } from '../utils/theme';

const TYPES = [
  {
    key: 'SALE',
    label: 'Venda',
    icon: ' ',
    color: colors.primary,
    help: 'Saída por venda — reduz o estoque',
  },
  {
    key: 'LOSS',
    label: 'Perda',
    icon: '️',
    color: colors.danger,
    help: 'Produto danificado ou perdido — reduz o estoque',
  },
  {
    key: 'ADJUSTMENT',
    label: 'Ajuste',
    icon: '⚙️',
    color: colors.info,
    help: 'Correção de inventário — pode aumentar ou reduzir',
  },
];

const RegisterMovementScreen = ({ route, navigation }) => {
  const { productId, productName } = route.params;

  const [lots, setLots] = useState([]);
  const [lotId, setLotId] = useState(null);
  const [type, setType] = useState('SALE');
  const [quantity, setQuantity] = useState('');
  const [adjustSign, setAdjustSign] = useState(-1); // -1 reduz, +1 aumenta
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const result = await api.get(`/products/${productId}/lots`);
          const withStock = result.filter((l) => l.quantity > 0);
          setLots(withStock);
          if (withStock.length > 0) setLotId(withStock[0].id);
        } catch (err) {
          setError(err.message);
        }
      })();
    }, [productId])
  );

  const selectedLot = lots.find((l) => l.id === lotId);
  const selectedType = TYPES.find((t) => t.key === type);

  const handleSave = async () => {
    if (!lotId) {
      setError('Selecione um lote com estoque disponível');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      setError('Informe a quantidade');
      return;
    }
    if (type === 'ADJUSTMENT' && !reason.trim()) {
      setError('Informe o motivo do ajuste');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const body = {
        product_id: productId,
        lot_id: lotId,
        type,
        quantity: Number(quantity),
        reason: reason.trim() || selectedType.label,
      };

      if (type === 'ADJUSTMENT') {
        body.signed_quantity = adjustSign * Number(quantity);
      }

      await api.post('/stock/movements', body);

      Alert.alert(
        'Movimentação registrada',
        `${selectedType.label} de ${quantity} un registrada no histórico.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
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

        {/* Tipo */}
        <Text style={styles.label}>Tipo de movimentação</Text>
        <View style={styles.typesRow}>
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.typeCard,
                type === t.key && { borderColor: t.color, backgroundColor: `${t.color}14` },
              ]}
              onPress={() => setType(t.key)}
            >
              <Text style={styles.typeIcon}>{t.icon}</Text>
              <Text
                style={[styles.typeLabel, type === t.key && { color: t.color }]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.help}>{selectedType.help}</Text>

        {/* Lote */}
        <Text style={styles.label}>Lote</Text>
        {lots.length === 0 ? (
          <View style={styles.emptyLots}>
            <Text style={styles.emptyLotsText}>
              Nenhum lote com estoque disponível.
            </Text>
          </View>
        ) : (
          lots.map((lot) => (
            <TouchableOpacity
              key={lot.id}
              style={[styles.lotOption, lotId === lot.id && styles.lotOptionActive]}
              onPress={() => setLotId(lot.id)}
            >
              <View style={styles.lotInfo}>
                <Text style={styles.lotCode}>{lot.lot_code}</Text>
                <Text style={styles.lotExpiry}>Validade: {lot.expires_at}</Text>
              </View>
              <Text style={styles.lotQty}>{lot.quantity} un</Text>
            </TouchableOpacity>
          ))
        )}

        {/* Quantidade */}
        <Text style={styles.label}>Quantidade</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder="Ex.: 5"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
        />

        {/* Sinal do ajuste */}
        {type === 'ADJUSTMENT' && (
          <View style={styles.signRow}>
            <TouchableOpacity
              style={[styles.signButton, adjustSign === -1 && styles.signActiveMinus]}
              onPress={() => setAdjustSign(-1)}
            >
              <Text
                style={[
                  styles.signText,
                  adjustSign === -1 && { color: '#fff' },
                ]}
              >
                − Reduzir
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.signButton, adjustSign === 1 && styles.signActivePlus]}
              onPress={() => setAdjustSign(1)}
            >
              <Text
                style={[styles.signText, adjustSign === 1 && { color: '#fff' }]}
              >
                + Aumentar
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Motivo */}
        <Text style={styles.label}>
          Motivo {type === 'ADJUSTMENT' ? '*' : '(opcional)'}
        </Text>
        <TextInput
          style={styles.input}
          value={reason}
          onChangeText={setReason}
          placeholder={
            type === 'SALE'
              ? 'Ex.: Venda no caixa'
              : type === 'LOSS'
              ? 'Ex.: Produto danificado'
              : 'Ex.: Diferença de inventário'
          }
          placeholderTextColor={colors.textMuted}
        />

        {selectedLot && quantity ? (
          <View style={styles.preview}>
            <Text style={styles.previewText}>
              {selectedLot.lot_code}: {selectedLot.quantity} un →{' '}
              {Math.max(
                0,
                selectedLot.quantity +
                  (type === 'ADJUSTMENT'
                    ? adjustSign * Number(quantity)
                    : -Number(quantity))
              )}{' '}
              un
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.disabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Registrando...' : 'Registrar movimentação'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Toda movimentação fica registrada no histórico com data, usuário e
          motivo.
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
    marginTop: spacing.sm,
  },
  typesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 22,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 4,
  },
  help: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  emptyLots: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyLotsText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  lotOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  lotOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  lotInfo: {
    flex: 1,
  },
  lotCode: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  lotExpiry: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  lotQty: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
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
  },
  signRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  signButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  signActiveMinus: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  signActivePlus: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  signText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  preview: {
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  previewText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
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
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.lg,
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
  },
  disabled: {
    opacity: 0.6,
  },
});

export default RegisterMovementScreen;
