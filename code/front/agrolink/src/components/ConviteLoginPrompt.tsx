import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  aceitarConviteEquipe,
  fetchMeusConvites,
  recusarConviteEquipe,
  type ConviteDto,
} from '../api/equipeApi';

function convitePapelLabel(papel: string) {
  return papel === 'GERENTE' ? 'Gerente' : 'Funcionário de campo';
}

/**
 * Ao entrar na área autenticada, pergunta se o usuário aceita convites pendentes de fazenda.
 */
export function ConviteLoginPrompt() {
  const { token, refreshUsuario } = useAuth();
  const [convites, setConvites] = useState<ConviteDto[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const lista = await fetchMeusConvites(token);
      setConvites(lista);
      setOpen(lista.length > 0);
    } catch {
      /* silencioso — sino continua disponível */
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const fecharSeVazio = (lista: ConviteDto[]) => {
    setConvites(lista);
    if (lista.length === 0) setOpen(false);
  };

  const aceitar = async (id: number) => {
    if (!token) return;
    setBusyId(id);
    setErro(null);
    try {
      await aceitarConviteEquipe(id, token);
      await refreshUsuario();
      fecharSeVazio(convites.filter((c) => c.id !== id));
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não foi possível aceitar o convite.');
    } finally {
      setBusyId(null);
    }
  };

  const recusar = async (id: number) => {
    if (!token) return;
    setBusyId(id);
    setErro(null);
    try {
      await recusarConviteEquipe(id, token);
      fecharSeVazio(convites.filter((c) => c.id !== id));
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não foi possível recusar o convite.');
    } finally {
      setBusyId(null);
    }
  };

  if (!open || convites.length === 0) return null;

  const convite = convites[0];
  const busy = busyId === convite.id;

  return (
    <div className="equipe-modal convite-login-modal" role="dialog" aria-modal="true" aria-labelledby="convite-login-title">
      <div className="equipe-modal__backdrop" aria-hidden />
      <div className="equipe-modal__panel convite-login-modal__panel">
        <header className="equipe-modal__head">
          <div className="equipe-modal__head-text">
            <h2 id="convite-login-title" className="equipe-modal__title">
              Convite para fazenda
            </h2>
            <p className="equipe-modal__sub muted">
              Você foi convidado para integrar a equipe de uma fazenda como{' '}
              <strong>{convitePapelLabel(convite.papel)}</strong>.
              {convites.length > 1 ? ` (${convites.length} convites pendentes)` : ''}
            </p>
          </div>
        </header>

        {erro ? (
          <p className="equipe-page__error" role="alert" style={{ margin: '0 0 1rem', color: 'var(--danger, #b91c1c)' }}>
            {erro}
          </p>
        ) : null}

        <p className="muted small" style={{ margin: '0 0 1rem' }}>
          Ao aceitar, você passa a enxergar ocorrências, mapa e equipe dessa propriedade.
        </p>

        <footer className="equipe-modal__footer equipe-modal__footer--split">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void recusar(convite.id)}>
            Recusar
          </button>
          <div className="equipe-modal__footer-right">
            <button type="button" className="btn primary" disabled={busy} onClick={() => void aceitar(convite.id)}>
              {busy ? 'Processando…' : 'Aceitar convite'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
