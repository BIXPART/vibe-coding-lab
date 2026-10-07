/**
 * Badge de status de validade.
 * Usa o objeto `status` retornado pelo backend quando disponível.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const STATUS_COLORS = {
  VENCIDO: '#DC2626',
  URGENTE: '#DC2626',
  ATENCAO: '#EA580C',
  PROXIMO: '#CA8A04',
  NORMAL: '#16A34A',
};

const StatusBadge = ({ status, size = 'medium' }) => {
  if (!status) return null;

  const color = STATUS_COLORS[status.status] || status.color || '#64748B';
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: `${color}1A`, borderColor: color },
        isSmall && styles.badgeSmall,
      ]}
    >
      <Text style={[styles.text, { color }, isSmall && styles.textSmall]}>
        {status.emoji ? `${status.emoji} ` : ''}
        {status.label || status.status}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 11,
  },
});

export default StatusBadge;
