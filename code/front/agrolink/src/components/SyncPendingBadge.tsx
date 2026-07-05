type SyncPendingBadgeProps = {
  /** `inline` no card; `banner` na faixa de aviso */
  variant?: 'inline' | 'banner';
  className?: string;
};

export function SyncPendingBadge({ variant = 'inline', className = '' }: SyncPendingBadgeProps) {
  const cls =
    variant === 'banner'
      ? `sync-pending-badge sync-pending-badge--banner ${className}`.trim()
      : `sync-pending-badge ${className}`.trim();

  return (
    <span className={cls} title="Será enviada ao servidor quando houver conexão">
      <span className="sync-pending-badge__icon" aria-hidden>
        ↻
      </span>
      Aguardando sync
    </span>
  );
}

export function isOcorrenciaPendingSync(o: { pendingSync?: boolean; id?: number }): boolean {
  return o.pendingSync === true || (typeof o.id === 'number' && o.id < 0);
}
