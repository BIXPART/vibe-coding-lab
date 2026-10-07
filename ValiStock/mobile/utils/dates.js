/**
 * Helpers de data e validade para o mobile.
 *
 * O status oficial é calculado no backend (fonte da verdade).
 * Estes helpers servem para exibição local e listas offline-friendly.
 */

/**
 * Formata data ISO/DATEONLY (YYYY-MM-DD) para pt-BR (DD/MM/YYYY).
 */
export const formatDate = (date) => {
  if (!date) return '—';
  const str = String(date);
  if (str.includes('-') && str.length >= 10) {
    const [y, m, d] = str.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return str;
};

/**
 * Dias restantes até o vencimento (dinâmico, data atual).
 */
export const daysUntil = (date) => {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  return Math.round((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
};

/**
 * Status local (espelha a regra do backend).
 * Preferir usar o objeto `status` retornado pela API quando disponível.
 */
export const getLocalStatus = (date) => {
  const days = daysUntil(date);

  if (days === null) return { status: 'NORMAL', label: '—', emoji: '🟢', color: '#16A34A', days: null };
  if (days < 0) return { status: 'VENCIDO', label: 'Vencido', emoji: '🔴', color: '#DC2626', days };
  if (days <= 3) return { status: 'URGENTE', label: `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}`, emoji: '🔴', color: '#DC2626', days };
  if (days <= 7) return { status: 'ATENCAO', label: `Vence em ${days} dias`, emoji: '🟠', color: '#EA580C', days };
  if (days <= 30) return { status: 'PROXIMO', label: `Vence em ${days} dias`, emoji: '🟡', color: '#CA8A04', days };
  return { status: 'NORMAL', label: 'Normal', emoji: '🟢', color: '#16A34A', days };
};

/**
 * Converte Date para input type="date" (YYYY-MM-DD).
 */
export const toInputDate = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Data futura em N dias (para preencher validade padrão).
 */
export const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toInputDate(d);
};
