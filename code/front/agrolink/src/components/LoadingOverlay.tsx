type Props = {
  visible: boolean;
  label?: string;
};

export function LoadingOverlay({ visible, label }: Props) {
  return (
    <div
      className={`agrolink-loader${visible ? ' agrolink-loader--visible' : ''}`}
      aria-hidden={!visible}
      aria-live="polite"
      aria-busy={visible}
    >
      <div className="agrolink-loader__backdrop" />
      <div className="agrolink-loader__panel" role="status">
        <div className="agrolink-loader__ring" aria-hidden>
          <span className="agrolink-loader__ring-arc" />
          <span className="agrolink-loader__ring-core" />
        </div>
        <p className="agrolink-loader__brand">AgroLink</p>
        <p className="agrolink-loader__text">{label?.trim() || 'Carregando…'}</p>
        <div className="agrolink-loader__dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
