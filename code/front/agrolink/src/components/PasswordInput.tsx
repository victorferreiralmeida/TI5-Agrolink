import { useId, useState, type InputHTMLAttributes } from 'react';
import { IconEye, IconEyeOff } from './icons/SystemIcons';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Campo de senha com botão para mostrar/ocultar valor (ícone alterna entre olho aberto e riscado).
 */
export function PasswordInput(props: Props) {
  const { className, id: idProp, ...rest } = props;
  const reactId = useId();
  const id = idProp ?? `password-input-${reactId}`;
  const [visible, setVisible] = useState(false);

  return (
    <div className={`password-field${className ? ` ${className}` : ''}`}>
      <input id={id} type={visible ? 'text' : 'password'} {...rest} />
      <button
        type="button"
        className="password-field__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
      >
        {visible ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  );
}
