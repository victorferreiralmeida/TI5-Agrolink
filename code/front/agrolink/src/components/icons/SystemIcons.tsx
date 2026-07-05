import type { SVGProps } from 'react';

const stroke = (props: SVGProps<SVGSVGElement>) => ({
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
});

export function IconAgrolink(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <path d="M12 3c-3 4-6 7.5-6 11a6 6 0 0 0 12 0c0-3.5-3-7-6-11Z" />
      <path d="M12 14v7M9 17h6" />
    </svg>
  );
}

export function IconBell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M6 20v-1.5a4 4 0 0 1 4-3.5h4a4 4 0 0 1 4 3.5V20" />
    </svg>
  );
}

export function IconOcorrencias(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <path d="M4 7h16v12H4z" />
      <path d="M8 5h8v4H8zM9 11h6M9 15h4" />
      <circle cx="17" cy="9" r="2.5" />
    </svg>
  );
}

export function IconEquipe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <circle cx="9" cy="8" r="2.5" />
      <path d="M4 19v-1a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1" />
      <circle cx="17" cy="9" r="2" />
      <path d="M20 19v-1a3 3 0 0 0-2-2.8" />
    </svg>
  );
}

export function IconDecisao(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" />
      <circle cx="8" cy="15" r="1.2" />
      <circle cx="11" cy="11" r="1.2" />
      <circle cx="14" cy="13" r="1.2" />
      <circle cx="18" cy="7" r="1.2" />
    </svg>
  );
}

export function IconTractor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <circle cx="7" cy="17" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M4.5 17H5l2-8h6l2 3h3.5a1 1 0 0 1 1 1v4h-2M9 9l-1.2 5M15 12h2.5" />
      <path d="M11 7V5h3v2" />
    </svg>
  );
}

export function IconGerente(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20v-1a5 5 0 0 1 5-5h.5M17.5 11a2 2 0 1 1 0 4M17.5 15v2M17.5 19v.5" />
      <path d="M19 20h-3" />
    </svg>
  );
}

export function IconFuncionario(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <rect x="6" y="7" width="12" height="11" rx="2" />
      <path d="M9 12h6M9 15h4" />
    </svg>
  );
}

export function IconSun(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconMoon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <path d="M21 12.8A7.5 7.5 0 0 1 11.2 3a6 6 0 1 0 9.8 9.8Z" />
    </svg>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke({ strokeWidth: 2.25, ...props })}>
      <path d="M6 12l4 4 8-8" />
    </svg>
  );
}

/** Olho aberto — senha oculta; clique para mostrar */
export function IconEye(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Olho riscado — senha visível; clique para ocultar */
export function IconEyeOff(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke(props)}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

const mapControl = (props: SVGProps<SVGSVGElement>) =>
  stroke({ strokeWidth: 2, ...props });

/** Controles do mapa — aproximar */
export function IconMapZoomIn(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...mapControl(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Controles do mapa — afastar */
export function IconMapZoomOut(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...mapControl(props)}>
      <path d="M5 12h14" />
    </svg>
  );
}

/** Controles do mapa — centralizar / minha posição */
export function IconMapLocate(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...mapControl(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

/** Controles do mapa — alternar tipo de mapa / camadas */
export function IconMapLayers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...mapControl(props)}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 12l9 5 9-5" />
      <path d="M3 17l9 5 9-5" />
    </svg>
  );
}
