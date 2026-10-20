import { useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function Field({ label, type = 'text', id, ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  return (
    <label className="field" htmlFor={inputId}>
      <span>{label}</span>
      <span className="input-wrap">
        <input {...props} id={inputId} type={type === 'password' && visible ? 'text' : type} />
        {type === 'password' && (
          <button type="button" className="password-toggle"
            aria-label={`${visible ? 'Скрыть' : 'Показать'} пароль`} aria-pressed={visible}
            onClick={() => setVisible(!visible)}>{visible ? 'Скрыть' : 'Показать'}</button>
        )}
      </span>
    </label>
  );
}
