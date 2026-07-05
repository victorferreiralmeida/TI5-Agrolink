package agrolink.agrolink.config;

import agrolink.agrolink.domain.SalaChatMembro;
import agrolink.agrolink.repository.SalaChatMembroRepository;
import agrolink.agrolink.repository.SalaChatRepository;
import agrolink.agrolink.repository.UsuarioRepository;
import agrolink.agrolink.service.FazendaAcessoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Salas antigas sem membros: associa apenas usuários que já têm vínculo com fazenda.
 */
@Component
@Order(20)
public class ChatSalaMembrosBootstrap implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(ChatSalaMembrosBootstrap.class);

	private final SalaChatRepository salas;
	private final SalaChatMembroRepository salaMembros;
	private final UsuarioRepository usuarios;
	private final FazendaAcessoService fazendaAcesso;

	public ChatSalaMembrosBootstrap(
			SalaChatRepository salas,
			SalaChatMembroRepository salaMembros,
			UsuarioRepository usuarios,
			FazendaAcessoService fazendaAcesso) {
		this.salas = salas;
		this.salaMembros = salaMembros;
		this.usuarios = usuarios;
		this.fazendaAcesso = fazendaAcesso;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		var ativos = usuarios.findByAtivoTrue().stream()
				.filter(fazendaAcesso::temFazenda)
				.toList();
		if (ativos.isEmpty()) {
			return;
		}
		int adicionados = 0;
		for (var sala : salas.findAll()) {
			if (salaMembros.countBySala_Id(sala.getId()) > 0) {
				continue;
			}
			for (var u : ativos) {
				var m = new SalaChatMembro();
				m.setSala(sala);
				m.setUsuario(u);
				salaMembros.save(m);
				adicionados++;
			}
		}
		if (adicionados > 0) {
			log.info("AGROLINK: {} vínculo(s) sala↔usuário criado(s) em salas sem membros (migração).", adicionados);
		}
	}
}
