import { useRef, useState } from 'react';
import type { UploadedDocument } from '../loanFulfillment/types';
import { pdfMetadataError } from '../loanFulfillment/rules';

export function DocumentUploader({ document, disabled, busy, onUpload, onRemove }: {
  document?: UploadedDocument;
  disabled: boolean;
  busy: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  return <div className="fulfillment-upload" aria-busy={busy}>
    <h3>Загрузите условно подписанный договор</h3>
    <p className="muted">PDF до 10 МБ. Можно загрузить скачанный демонстрационный договор.</p>
    {document ? <div className="fulfillment-file">
      <span><strong>{document.name}</strong><small>{(document.size / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} КБ · PDF принят</small></span>
      <button className="inline-link" type="button" disabled={disabled || busy}
        onClick={() => { setError(''); void onRemove(); }}>Удалить и выбрать другой</button>
    </div> : <label className={`fulfillment-file-picker${disabled || busy ? ' disabled' : ''}`}>
      <span>{busy ? 'Проверяем и принимаем PDF…' : 'Выбрать PDF'}</span>
      <input ref={input} type="file" accept="application/pdf,.pdf" disabled={disabled || busy}
        aria-label="Условно подписанный договор PDF" onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          setError('');
          if (!file) return;
          const problem = pdfMetadataError(file);
          if (problem) { setError(problem); return; }
          void onUpload(file);
        }} />
    </label>}
    {error && <p className="error" role="alert">{error}</p>}
    <p className="hint">В демо проверяются формат и размер файла. Подпись и подлинность не проверяются.
      PDF и состояние оформления сохраняются на сервере. Загрузка не является юридически действительной электронной подписью.</p>
  </div>;
}
