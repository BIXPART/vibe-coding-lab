/**
 * Tela de Scanner — fluxo principal do sistema.
 *
 * Escanear código → consultar API:
 * - Produto existe  → "Produto encontrado"  [Ver produto] [Adicionar lote]
 * - Produto não existe → "Produto não cadastrado" [Cadastrar produto]
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { colors, spacing, borderRadius } from '../utils/theme';
import { formatDate } from '../utils/dates';

const ScannerScreen = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null); // { found, product, barcode }
  const [error, setError] = useState(null);
  const lockRef = useRef(false);

  const handleBarcodeScanned = useCallback(
    async ({ data }) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setScanning(false);
      setError(null);
      setResult(null);

      try {
        const barcode = String(data).trim();
        const product = await api.get(`/products/barcode/${barcode}`);
        setResult({ found: true, product, barcode });
      } catch (err) {
        if (err.status === 404) {
          // Produto não cadastrado — fluxo de cadastro
          setResult({ found: false, barcode: String(data).trim() });
        } else {
          setError(err.message);
          setScanning(true);
          lockRef.current = false;
        }
      }
    },
    []
  );

  const resetScanner = () => {
    setResult(null);
    setError(null);
    setScanning(true);
    lockRef.current = false;
  };

  // Permissões
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionEmoji}>📷</Text>
        <Text style={styles.permissionTitle}>
          Permissão da câmera necessária
        </Text>
        <Text style={styles.permissionText}>
          O ValiStock usa a câmera para ler códigos de barras dos produtos.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Permitir câmera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Resultado: produto encontrado
  if (result && result.found) {
    const p = result.product;
    return (
      <View style={styles.resultContainer}>
        <View style={[styles.resultHeader, { backgroundColor: '#DCFCE7' }]}>
          <Text style={styles.resultHeaderEmoji}>✅</Text>
          <Text style={styles.resultHeaderText}>Produto encontrado</Text>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.resultName}>{p.name}</Text>
          <Text style={styles.resultBrand}>
            {p.brand || 'Sem marca'}
            {p.category ? ` · ${p.category.name}` : ''}
          </Text>
          <Text style={styles.resultBarcode}>Código: {p.barcode}</Text>

          <View style={styles.resultStats}>
            <Text style={styles.resultStatText}>
              {p.total_quantity} unidades · {p.lots_count}{' '}
              {p.lots_count === 1 ? 'lote' : 'lotes'}
            </Text>
            {p.nearest_status && (
              <StatusBadge status={p.nearest_status} size="small" />
            )}
          </View>

          {p.nearest_expires_at ? (
            <Text style={styles.resultExpiry}>
              Validade mais próxima: {formatDate(p.nearest_expires_at)}
            </Text>
          ) : (
            <Text style={styles.resultExpiry}>Nenhum lote cadastrado</Text>
          )}

          {p.lots && p.lots.length > 0 && (
            <View style={styles.lotsPreview}>
              {p.lots.slice(0, 3).map((lot) => (
                <View key={lot.id} style={styles.lotLine}>
                  <Text style={styles.lotLineText}>
                    Lote {lot.lot_code} · {lot.quantity} un ·{' '}
                    {formatDate(lot.expires_at)}
                  </Text>
                  <Text style={[styles.lotLineStatus, { color: lot.status.color }]}>
                    {lot.status.emoji} {lot.status.label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            navigation.navigate('ProductDetail', { id: p.id });
          }}
        >
          <Text style={styles.primaryButtonText}>Ver produto</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            navigation.navigate('NewLot', {
              productId: p.id,
              productName: p.name,
            })
          }
        >
          <Text style={styles.secondaryButtonText}>Adicionar lote</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={resetScanner}>
          <Text style={styles.linkText}>📷 Escanear outro código</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Resultado: produto não cadastrado
  if (result && !result.found) {
    return (
      <View style={styles.resultContainer}>
        <View style={[styles.resultHeader, { backgroundColor: '#FEE2E2' }]}>
          <Text style={styles.resultHeaderEmoji}>⚠️</Text>
          <Text style={styles.resultHeaderText}>Produto não cadastrado</Text>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.notFoundLabel}>Código lido:</Text>
          <Text style={styles.notFoundCode}>{result.barcode}</Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            navigation.navigate('NewProduct', { barcode: result.barcode })
          }
        >
          <Text style={styles.primaryButtonText}>Cadastrar produto</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={resetScanner}>
          <Text style={styles.linkText}> Escanear outro código</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Erro de conexão
  if (error) {
    return (
      <View style={styles.resultContainer}>
        <View style={[styles.resultHeader, { backgroundColor: '#FEE2E2' }]}>
          <Text style={styles.resultHeaderEmoji}>⚠️</Text>
          <Text style={styles.resultHeaderText}>Falha na consulta</Text>
        </View>
        <View style={styles.resultCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={resetScanner}>
          <Text style={styles.primaryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Câmera ativa
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'code128',
            'code39',
            'qr',
          ],
        }}
        onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
      />

      {/* Overlay de mira */}
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.scanHint}>Posicione o código de barras na moldura</Text>
        <Text style={styles.scanSubhint}>
          O produto será consultado automaticamente
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  permissionEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scanFrame: {
    width: 260,
    height: 160,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
  },
  scanHint: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: spacing.md,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  scanSubhint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  resultContainer: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  resultHeaderEmoji: {
    fontSize: 20,
  },
  resultHeaderText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  resultBrand: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  resultBarcode: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  resultStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resultStatText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  resultExpiry: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  lotsPreview: {
    marginTop: spacing.sm,
    gap: 4,
  },
  lotLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  lotLineText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  lotLineStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  notFoundLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  notFoundCode: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
  errorText: {
    fontSize: 15,
    color: colors.danger,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ScannerScreen;
