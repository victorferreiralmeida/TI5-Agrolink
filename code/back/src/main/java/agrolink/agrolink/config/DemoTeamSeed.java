package agrolink.agrolink.config;

import agrolink.agrolink.domain.PapelUsuario;
import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.repository.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Garante usuários demo: 1 produtor, 2 gerentes, 5 funcionários de campo. Insere cada e-mail
 * {@code @agrolink.demo} apenas se ainda não existir (banco pode já ter outros cadastros).
 * Controlado por {@code agrolink.demo-seed} (habilitado no perfil {@code dev}).
 */
@Component
@Order(1)
public class DemoTeamSeed implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(DemoTeamSeed.class);

	/** Senha única dos logins demo (documentada em {@code code/README.md}). */
	public static final String DEMO_PASSWORD = "AgrolinkDemo1!";

	private final UsuarioRepository usuarios;
	private final PasswordEncoder passwordEncoder;
	private final boolean demoSeed;

	public DemoTeamSeed(
			UsuarioRepository usuarios,
			PasswordEncoder passwordEncoder,
			@Value("${agrolink.demo-seed:false}") boolean demoSeed) {
		this.usuarios = usuarios;
		this.passwordEncoder = passwordEncoder;
		this.demoSeed = demoSeed;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (!demoSeed) {
			return;
		}
		String hash = passwordEncoder.encode(DEMO_PASSWORD);
		Instant now = Instant.now();

		int criados = 0;
		criados += saveIfAbsent("Fazenda Demo — Produtor", "produtor@agrolink.demo", hash, PapelUsuario.PRODUTOR, now);
		criados += saveIfAbsent("Patricia Gerente", "gerente1@agrolink.demo", hash, PapelUsuario.GERENTE, now);
		criados += saveIfAbsent("Ricardo Gerente", "gerente2@agrolink.demo", hash, PapelUsuario.GERENTE, now);
		criados += saveIfAbsent("Funcionário Campo 1", "campo1@agrolink.demo", hash, PapelUsuario.FUNCIONARIO_CAMPO, now);
		criados += saveIfAbsent("Funcionário Campo 2", "campo2@agrolink.demo", hash, PapelUsuario.FUNCIONARIO_CAMPO, now);
		criados += saveIfAbsent("Funcionário Campo 3", "campo3@agrolink.demo", hash, PapelUsuario.FUNCIONARIO_CAMPO, now);
		criados += saveIfAbsent("Funcionário Campo 4", "campo4@agrolink.demo", hash, PapelUsuario.FUNCIONARIO_CAMPO, now);
		criados += saveIfAbsent("Funcionário Campo 5", "campo5@agrolink.demo", hash, PapelUsuario.FUNCIONARIO_CAMPO, now);

		if (criados > 0) {
			log.info(
					"AGROLINK: equipe demo — {} usuário(s) novo(s) (senha: {}). Demais e-mails @agrolink.demo já existiam. Ver code/README.md",
					criados,
					DEMO_PASSWORD);
		} else {
			log.info("AGROLINK: equipe demo — nenhum usuário novo (todos os e-mails @agrolink.demo já existem).");
		}
	}

	/** @return 1 se inseriu, 0 se o e-mail já existia */
	private int saveIfAbsent(String nome, String email, String senhaHash, PapelUsuario papel, Instant dataIngresso) {
		var em = email.toLowerCase();
		if (usuarios.existsByEmailIgnoreCase(em)) {
			return 0;
		}
		var u = new Usuario();
		u.setNome(nome);
		u.setEmail(em);
		u.setSenhaHash(senhaHash);
		u.setPapel(papel);
		u.setDataIngresso(dataIngresso);
		u.setAtivo(true);
		usuarios.save(u);
		return 1;
	}
}
