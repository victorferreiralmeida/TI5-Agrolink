import type { ReactNode } from 'react';

export type IconSquircleTone = 'muted' | 'accent';
export type IconSquircleSize = 'xs' | 'sm' | 'md' | 'lg';

type Props = {
  tone: IconSquircleTone;
  size?: IconSquircleSize;
  children: ReactNode;
  className?: string;
};

const sizeClass: Record<IconSquircleSize, string> = {
  xs: 'icon-squircle--xs',
  sm: 'icon-squircle--sm',
  md: 'icon-squircle--md',
  lg: 'icon-squircle--lg',
};

export function IconSquircle({ tone, size = 'md', children, className = '' }: Props) {
  return (
    <span
      className={`icon-squircle icon-squircle--${tone} ${sizeClass[size]} ${className}`.trim()}
      aria-hidden
    >
      <span className="icon-squircle__glyph">{children}</span>
    </span>
  );
}
