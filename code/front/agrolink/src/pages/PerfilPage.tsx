import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppShell } from '../components/AppShell';
import { UserAvatar } from '../components/UserAvatar';
import { atualizarUsuarioMe, fetchUsuarioMe, uploadFotoUsuarioMe } from '../api/usuarioApi';
import { publicAssetUrl } from '../utils/publicUrl';
import { papelContaLabel } from '../utils/papelConta';

export function PerfilPage() {
  const { token, user, setUsuario } = useAuth();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchUsuarioMe(token)
      .then((u) => {
        if (cancelled) return;
        setUsuario(u);
        setNome(u.nome);
        setTelefone(u.telefone ?? '');
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível carregar o perfil.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, setUsuario]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const n = nome.trim();
    if (!n) {
      setError('Informe o nome.');
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const next = await atualizarUsuarioMe(token, { nome: n, telefone: telefone.trim() });
      setUsuario(next);
      setOkMsg('Dados salvos.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleFotoChange(files: FileList | null) {
    const f = files?.[0];
    if (!f || !token) return;
    setUploading(true);
    setError(null);
    setOkMsg(null);
    try {
      const next = await uploadFotoUsuarioMe(token, f);
      setUsuario(next);
      setOkMsg('Foto atualizada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no envio da foto.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const previewFoto = publicAssetUrl(user?.fotoUrl);

  return (
    <AppShell>
      <div className="perfil-page">
        <header className="perfil-page__head">
          <div>
            <h1 className="perfil-page__title">Meu perfil</h1>
            <p className="perfil-page__sub muted small">
              {user ? `${user.email} · ${papelContaLabel(user.papel)}` : null}
            </p>
          </div>
          <Link to="/dashboard" className="btn ghost btn-sm">
            Voltar ao painel
          </Link>
        </header>

        {loading ? (
          <p className="muted">Carregando…</p>
        ) : (
          <div className="perfil-page__grid">
            <section className="perfil-page__card" aria-labelledby="perfil-foto-heading">
              <h2 id="perfil-foto-heading" className="perfil-page__h2">
                Foto de perfil
              </h2>
              <div className="perfil-page__foto-row">
                <UserAvatar nome={user?.nome ?? '?'} fotoUrl={user?.fotoUrl} className="perfil-page__foto-av" />
                <div className="perfil-page__foto-actions">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hidden
                    onChange={(e) => void handleFotoChange(e.target.files)}
                  />
                  <button
                    type="button"
                    className="btn primary btn-sm"
                    disabled={uploading || !token}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? 'Enviando…' : previewFoto ? 'Trocar foto' : 'Enviar foto'}
                  </button>
                  <p className="muted small" style={{ margin: '0.35rem 0 0' }}>
                    JPEG, PNG, WebP ou GIF · até 5MB. A foto aparece na equipe, no chat e nos comentários de ocorrências.
                  </p>
                </div>
              </div>
            </section>

            <section className="perfil-page__card" aria-labelledby="perfil-dados-heading">
              <h2 id="perfil-dados-heading" className="perfil-page__h2">
                Dados básicos
              </h2>
              <form className="perfil-page__form stack" onSubmit={handleSubmit}>
                <label className="field">
                  <span>Nome completo</span>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} autoComplete="name" />
                </label>
                <label className="field">
                  <span>Telefone</span>
                  <input
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    maxLength={20}
                    autoComplete="tel"
                    placeholder="Opcional"
                  />
                </label>
                <label className="field">
                  <span>E-mail</span>
                  <input value={user?.email ?? ''} disabled className="perfil-page__input-disabled" />
                </label>
                <p className="muted small" style={{ margin: 0 }}>
                  O e-mail não pode ser alterado por aqui.
                </p>
                {error ? (
                  <p className="error-text" role="alert">
                    {error}
                  </p>
                ) : null}
                {okMsg ? (
                  <p className="perfil-page__ok" role="status">
                    {okMsg}
                  </p>
                ) : null}
                <div className="perfil-page__form-actions">
                  <button type="submit" className="btn primary" disabled={saving}>
                    {saving ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
