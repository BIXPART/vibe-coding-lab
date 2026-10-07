/**
 * Função centralizada de cálculo de status de validade.
 * A classificação é SEMPRE dinâmica (baseada na data atual),
 * nunca armazenada no banco.
 *
 * Classificação:
 * - Data já passou      → VENCIDO
 * - 0 a 3 dias          → URGENTE
 * - 4 a 7 dias          → ATENÇÃO
 * - 8 a 30 dias         → PRÓXIMO
 * - Mais de 30 dias     → NORMAL
 */

const STATUS = {
  VENCIDO: 'VENCIDO',
  URGENTE: 'URGENTE',
  ATENCAO: 'ATENCAO',
  PROXIMO: 'PROXIMO',
  NORMAL: 'NORMAL',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Converte uma data (string ISO/DATEONLY ou Date) para Date às 00:00 local.
 */
const toStartOfDay = (date) => {
  let d;
  if (date instanceof Date) {
    d = new Date(date);
  } else {
    const str = String(date);
    // Strings com componente horário (ISO completo) são parseadas direto;
    // strings só de data (DATEONLY, ex: "2026-10-10") recebem T00:00:00 local.
    d = new Date(str.includes('T') ? str : `${str}T00:00:00`);
  }
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Calcula os dias restantes até o vencimento (data de hoje à meia-noite).
 * Valores negativos indicam dias já vencidos.
 */
const daysUntilExpiry = (expiresAt) => {
  const today = toStartOfDay(new Date());
  const expiry = toStartOfDay(expiresAt);
  return Math.round((expiry.getTime() - today.getTime()) / DAY_MS);
};

/**
 * Retorna o status de validade de uma data de validade.
 * @param {string|Date} expiresAt - data de validade
 * @returns {{ status: string, label: string, days: number, color: string, emoji: string }}
 */
const getExpiryStatus = (expiresAt) => {
  const days = daysUntilExpiry(expiresAt);

  if (days < 0) {
    return {
      status: STATUS.VENCIDO,
      label: 'Vencido',
      days,
      color: '#DC2626',
      emoji: '🔴',
    };
  }

  if (days <= 3) {
    return {
      status: STATUS.URGENTE,
      label: `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}`,
      days,
      color: '#DC2626',
      emoji: '🔴',
    };
  }

  if (days <= 7) {
    return {
      status: STATUS.ATENCAO,
      label: `Vence em ${days} dias`,
      days,
      color: '#EA580C',
      emoji: '🟠',
    };
  }

  if (days <= 30) {
    return {
      status: STATUS.PROXIMO,
      label: `Vence em ${days} dias`,
      days,
      color: '#CA8A04',
      emoji: '🟡',
    };
  }

  return {
    status: STATUS.NORMAL,
    label: 'Normal',
    days,
    color: '#16A34A',
    emoji: '🟢',
  };
};

/**
 * Filtra lotes por faixa de dias (para dashboard e tela de validades).
 * @param {Array} lots - array de lotes com expires_at
 * @param {number} maxDays - limite máximo de dias (inclusivo)
 */
const filterByDays = (lots, maxDays) => {
  return lots.filter((lot) => {
    const days = daysUntilExpiry(lot.expires_at);
    return days >= 0 && days <= maxDays;
  });
};

/**
 * Filtra lotes vencidos (data já passou).
 */
const filterExpired = (lots) => {
  return lots.filter((lot) => daysUntilExpiry(lot.expires_at) < 0);
};

module.exports = {
  STATUS,
  getExpiryStatus,
  daysUntilExpiry,
  filterByDays,
  filterExpired,
};
