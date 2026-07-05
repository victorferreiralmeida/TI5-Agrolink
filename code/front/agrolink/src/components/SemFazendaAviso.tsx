import { Link } from 'react-router-dom';
import type { PapelConta } from '../types/api';

type Props = {
  papel?: PapelConta | null;
};

/**
 * Estado vazio global: usuário autenticado ainda sem vínculo com uma fazenda.
 */
export function SemFazendaAviso({ papel }: Props) {
  const gerente = papel === 'GERENTE';

  return (
    <div className="dash-fazenda-banner sem-fazenda-aviso" role="status">
      {gerente ? (
        <>
          <p>
            <strong>Cadastre sua fazenda</strong> para começar a registrar ocorrências, ver o mapa e convidar sua equipe.
          </p>
          <Link to="/fazenda" className="btn primary btn-sm">
            Ir para Minha fazenda
          </Link>
        </>
      ) : (
        <p>
          <strong>Você ainda não está vinculado a uma fazenda.</strong> Aguarde o convite do gestor ou aceite-o nas
          notificações. Até lá, o painel permanece vazio.
        </p>
      )}
    </div>
  );
}
