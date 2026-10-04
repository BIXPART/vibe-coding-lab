/**
 * Dashboard.
 *
 * O backend monta o resumo inteiro em uma chamada: totais, taxa de conclusão e,
 * para cada meta ativa, o período atual com streak. O app **não** agrega metas
 * por conta própria.
 *
 * Isso não é só conveniência. `completionRate` tem uma definição precisa no
 * servidor (`streak.ts`: concluídas / (concluídas + perdidas), sobre a janela de
 * medição) e é a MESMA usada em `GoalStats`. Recalcular isso no cliente daria um
 * número diferente do servidor, e o usuário veria duas taxas para a mesma tela.
 *
 * Atenção ao ler `totals`: `completed`/`pending` contam **metas no período
 * atual**, enquanto `completionRate` é sobre **períodos na janela**. São duas
 * medidas com denominadores diferentes e por isso convivem no mesmo objeto.
 * Ver `Dashboard` em `@/types/api`.
 */
import { request } from '@/services/api';
import type { Dashboard } from '@/types/api';

export async function getDashboard(signal?: AbortSignal): Promise<Dashboard> {
  return request<Dashboard>('/dashboard', { signal });
}