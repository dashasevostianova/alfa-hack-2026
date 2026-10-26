import { jsPDF } from 'jspdf';
import type { DemoContract } from './types';
import { formatDateTime } from './types';

let fontPromise: Promise<string> | undefined;
async function loadFont() {
  fontPromise ??= fetch(`${import.meta.env.BASE_URL}fonts/DejaVuSans.ttf`).then(async response => {
    if (!response.ok) throw new Error('Не удалось загрузить шрифт договора. Повторите скачивание.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  }).catch(error => { fontPromise = undefined; throw error; });
  return fontPromise;
}

const rubles = (value: number) => `${new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value)} руб.`;

export function contractParagraphs(contract: DemoContract): string[] {
  return [
    'ДЕМОНСТРАЦИОННЫЙ КРЕДИТНЫЙ ДОГОВОР',
    'Демонстрационный документ. Не имеет юридической силы',
    `Номер договора: ${contract.number}`,
    `Дата формирования: ${formatDateTime(contract.generatedAt)}`,
    `Номер заявки: ${contract.applicationId}`,
    `Заёмщик: ${contract.borrower.fullName}`,
    `Компания: ${contract.borrower.companyName}`,
    `ИНН: ${contract.borrower.inn}`,
    ...(contract.borrowerSource === 'current-profile'
      ? ['Реквизиты старой заявки взяты из текущей анкеты на дату формирования договора.'] : []),
    `Продукт: ${contract.productName}`,
    `Цель: ${contract.purpose}`,
    `Сумма кредита: ${rubles(contract.amount)}`,
    `Срок: ${contract.months} мес.`,
    `Годовая процентная ставка: ${contract.annualRate}%`,
    `Расчётный ежемесячный платёж: ${rubles(contract.monthlyPayment)}`,
    'Условия демонстрационного кредитования',
    'Платёж рассчитан по аннуитетной формуле. В учебном сценарии используется условный ежемесячный график. '
      + 'Для кредитных линий и овердрафтов этот расчёт является иллюстрацией, фактический график может отличаться.',
    'Документ создан для демонстрации пользовательского пути. Загрузка PDF и подтверждение в кабинете '
      + 'имитируют подписание, электронная подпись и подлинность документа не проверяются. '
      + 'Выдача кредита моделируется без движения денежных средств и возникновения обязательств.',
    'Условная подпись заёмщика: ____________________',
    'Дата условного подписания: ____________________',
  ];
}

export async function generateContractPdf(contract: DemoContract): Promise<Blob> {
  const font = await loadFont();
  const doc = new jsPDF({ compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS('DejaVuSans.ttf', font);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.setFont('DejaVuSans');
  doc.setFontSize(11);
  doc.setProperties({ title: `Демонстрационный договор ${contract.number}`, author: 'Учебный проект Альфа-Бизнес' });
  let y = 22;
  for (const paragraph of contractParagraphs(contract)) {
    // Render line by line to keep long company names and multi-page text inside margins.
    const lines: string[] = doc.splitTextToSize(paragraph.replace(/[\r\n\t]/g, ' '), 170);
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = 22; }
      doc.text(line, 20, y);
      y += 6;
    }
    y += 4;
  }
  return doc.output('blob');
}
