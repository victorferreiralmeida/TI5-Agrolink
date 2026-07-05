package agrolink.agrolink.service;

import agrolink.agrolink.domain.PapelUsuario;
import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.dto.UserSummary;
import agrolink.agrolink.repository.FazendaRepository;
import org.springframework.stereotype.Service;

/**
 * Regra de negócio: dados operacionais só existem após vínculo com uma fazenda.
 * Gerente: cadastrou a propriedade. Demais papéis: {@code fazenda_vinculo_id} preenchido (convite aceito).
 */
@Service
public class FazendaAcessoService {

	private final FazendaRepository fazendas;

	public FazendaAcessoService(FazendaRepository fazendas) {
		this.fazendas = fazendas;
	}

	public boolean temFazenda(Usuario u) {
		if (u == null || !u.isAtivo()) {
			return false;
		}
		if (u.getPapel() == PapelUsuario.GERENTE) {
			return fazendas.findByGerenteUsuarioId(u.getId()).isPresent();
		}
		return u.getFazendaVinculoId() != null;
	}

	public UserSummary toUserSummary(Usuario u) {
		return UserSummary.from(u, temFazenda(u));
	}
}
