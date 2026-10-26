export const MAX_PDF_SIZE = 10 * 1024 * 1024;

export function pdfMetadataError(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (!/\.pdf$/i.test(file.name) || (file.type !== '' && file.type !== 'application/pdf')) {
    return 'Выберите документ PDF с расширением .pdf и типом application/pdf.';
  }
  if (file.size <= 0) return 'Выбранный файл пуст.';
  if (file.size > MAX_PDF_SIZE) return 'Размер PDF не должен превышать 10 МБ.';
  return null;
}
