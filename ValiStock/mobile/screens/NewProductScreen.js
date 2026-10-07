/**
 * Cadastro de produto.
 * Pode ser aberto pelo Scanner com o código de barras já preenchido.
 * Após cadastrar, oferece seguir direto para o primeiro lote.
 */
import React, { useState, useEffect } from 'react';
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
import { LoadingState } from '../components/States';
import { colors, spacing, borderRadius } from '../utils/theme';

const NewProductScreen = ({ route, navigation }) => {
  const scannedBarcode = route.params?.barcode || '';

  const [barcode, setBarcode] = useState(scannedBarcode);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.get('/categories');
        setCategories(result);
      } catch (err) {
        // Categorias são opcionais — não bloqueia o cadastro
        console.warn('Falha ao carregar categorias:', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (goToLot) => {
    if (!barcode.trim()) {
      setError('Informe o código de barras');
      return;
    }
    if (!name.trim()) {
      setError('Informe o nome do produto');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const product = await api.post('/products', {
        barcode: barcode.trim(),
        name: name.trim(),
        brand: brand.trim() || null,
        category_id: categoryId,
      });

      if (goToLot) {
        // Segue direto para o primeiro lote (fluxo do scanner)
        navigation.replace('NewLot', {
          productId: product.id,
          productName: product.name,
        });
      } else {
        Alert.alert('Produto cadastrado', product.name, [
          {
            text: 'Adicionar lote',
            onPress: () =>
              navigation.replace('NewLot', {
                productId: product.id,
                productName: product.name,
              }),
          },
          { text: 'Concluir', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Carregando categorias..." />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Código de barras *</Text>
        <TextInput
          style={[styles.input, scannedBarcode && styles.inputDisabled]}
          value={barcode}
          onChangeText={setBarcode}
          placeholder="Escaneie ou digite o código"
          placeholderTextColor={colors.textMuted}
          editable={!scannedBarcode}
        />
        {scannedBarcode ? (
          <Text style={styles.hint}> Preenchido pelo scanner</Text>
        ) : null}

        <Text style={styles.label}>Nome do produto *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex.: Coca-Cola Original 2L"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Marca</Text>
        <TextInput
          style={styles.input}
          value={brand}
          onChangeText={setBrand}
          placeholder="Ex.: Coca-Cola"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Categoria</Text>
        <View style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.chip, categoryId === null && styles.chipActive]}
            onPress={() => setCategoryId(null)}
          >
            <Text
              style={[styles.chipText, categoryId === null && styles.chipTextActive]}
            >
              Sem categoria
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, categoryId === cat.id && styles.chipActive]}
              onPress={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  categoryId === cat.id && styles.chipTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.disabled]}
          onPress={() => handleSave(true)}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Salvando...' : 'Salvar e adicionar lote'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, saving && styles.disabled]}
          onPress={() => handleSave(false)}
          disabled={saving}
        >
          <Text style={styles.secondaryButtonText}>Apenas salvar produto</Text>
        </TouchableOpacity>
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
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
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
  inputDisabled: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    color: colors.success,
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
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
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default NewProductScreen;
