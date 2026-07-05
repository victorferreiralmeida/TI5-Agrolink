package agrolink.agrolink.config;

import agrolink.agrolink.domain.SalaChat;
import agrolink.agrolink.repository.SalaChatRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Garante ao menos uma sala de chat (canal geral da equipe).
 */
@Component
@Order(0)
public class ChatSalaBootstrap implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(ChatSalaBootstrap.class);

	private final SalaChatRepository salas;

	public ChatSalaBootstrap(SalaChatRepository salas) {
		this.salas = salas;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (salas.count() > 0) {
			return;
		}
		var s = new SalaChat();
		s.setNome("Canal geral da equipe");
		salas.save(s);
		log.info("AGROLINK: sala de chat padrão criada ({}).", s.getNome());
	}
}
