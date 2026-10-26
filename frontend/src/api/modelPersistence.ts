import { request } from './index';
import type { FormationResult } from './formation';

// The browser result remains available locally; signing needs a server-owned decision.
// Only the application ID is sent. Java reconstructs features and calls the same model.
export async function persistModelDecision(id: string, prediction: 0 | 1): Promise<FormationResult> {
  const application = await request<FormationResult>(`/applications/${encodeURIComponent(id)}/model-decision`, 'POST');
  const expected = prediction === 1 ? 'APPROVED' : 'REJECTED';
  if (application.status !== 'COMPLETED' || application.decision?.outcome !== expected) {
    throw new Error('Решение сервера отличается от локального результата модели. Обновите страницу заявки.');
  }
  return application;
}
