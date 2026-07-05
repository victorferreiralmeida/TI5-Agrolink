/** Letras unicode (inclui ç, ã, etc.), espaços, hífen e apóstrofo — típico para nomes próprios */
const NAO_NOME = /[^\p{L}\s'\-]/gu;

/** Enquanto digita: bloqueia números e símbolos; evita vários espaços seguidos */
export function maskNomeDigitando(value: string): string {
  return value.replace(NAO_NOME, '').replace(/\s{2,}/g, ' ');
}

/** Ao sair do campo: capitaliza palavras (ex.: joão silva → João Silva; ana-maria → Ana-Maria) */
export function formatNomeBlur(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed
    .split(' ')
    .map((word) => {
      const parts = word.split('-');
      return parts
        .map((part) => {
          if (!part) return part;
          const low = part.toLocaleLowerCase('pt-BR');
          return low.charAt(0).toLocaleUpperCase('pt-BR') + low.slice(1);
        })
        .join('-');
    })
    .join(' ');
}
