/** URLs relativas da API (ex.: `/uploads/...`) funcionam com o proxy do Vite. */
export function publicAssetUrl(url: string | null | undefined): string | null {
  if (url == null) return null;
  const u = String(url).trim();
  return u.length ? u : null;
}
