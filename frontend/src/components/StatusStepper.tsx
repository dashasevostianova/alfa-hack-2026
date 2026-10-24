import type { ApplicationStatus } from '../types';

const steps: { value: ApplicationStatus; label: string }[] = [
  { value: 'SUBMITTED', label: 'Отправлено' },
  { value: 'VERIFICATION', label: 'Проверка' },
  { value: 'REVIEW', label: 'Рассмотрение заявки' },
  { value: 'COMPLETED', label: 'Рассмотрено' },
];

export function StatusStepper({ status }: { status: ApplicationStatus }) {
  const current = steps.findIndex((step) => step.value === status);
  return <ol className="stepper" aria-label="Статус заявки">
    {steps.map((step, index) => (
      <li key={step.value} className={index === current ? 'current' : index < current ? 'done' : ''}
        aria-current={index === current ? 'step' : undefined}>
        <span className="step-dot" aria-hidden="true">{index < current ? '✓' : ''}</span>
        <span>{step.label}</span>
      </li>
    ))}
  </ol>;
}
