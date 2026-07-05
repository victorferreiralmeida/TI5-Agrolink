import { useState } from 'react';
import { publicAssetUrl } from '../utils/publicUrl';

type Props = {
  nome: string;
  fotoUrl?: string | null;
  className?: string;
  /** Texto alternativo; padrão: primeiro nome */
  label?: string;
};

/**
 * Avatar com foto opcional; em erro de carregamento mostra iniciais.
 */
export function UserAvatar({ nome, fotoUrl, className = '', label }: Props) {
  const [imgOk, setImgOk] = useState(true);
  const src = publicAssetUrl(fotoUrl);
  const initials = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const showImg = Boolean(src && imgOk);

  return (
    <span className={`user-avatar ${className}`.trim()} title={nome} aria-label={label ?? nome}>
      {showImg ? (
        <img
          className="user-avatar__img"
          src={src!}
          alt=""
          loading="lazy"
          onError={() => setImgOk(false)}
        />
      ) : (
        <span className="user-avatar__fallback" aria-hidden>
          {initials || '?'}
        </span>
      )}
    </span>
  );
}
