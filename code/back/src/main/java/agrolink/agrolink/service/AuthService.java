package agrolink.agrolink.service;

import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.domain.PapelUsuario;
import agrolink.agrolink.dto.AuthResponse;
import agrolink.agrolink.dto.LoginRequest;
import agrolink.agrolink.dto.RegisterRequest;
import agrolink.agrolink.dto.UserSummary;
import agrolink.agrolink.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Locale;

@Service
public class AuthService {

	private final UsuarioRepository usuarios;
	private final PasswordEncoder passwordEncoder;
	private final EquipeService equipeService;
	private final FazendaAcessoService fazendaAcesso;

	public AuthService(
			UsuarioRepository usuarios,
			PasswordEncoder passwordEncoder,
			EquipeService equipeService,
			FazendaAcessoService fazendaAcesso) {
		this.usuarios = usuarios;
		this.passwordEncoder = passwordEncoder;
		this.equipeService = equipeService;
		this.fazendaAcesso = fazendaAcesso;
	}

	public AuthResponse login(LoginRequest body) {
		if (body == null || !StringUtils.hasText(body.email()) || !StringUtils.hasText(body.password())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "E-mail e senha são obrigatórios.");
		}
		var email = normalizeEmail(body.email());
		var usuario = usuarios.findByEmailIgnoreCase(email)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos."));
		if (!passwordEncoder.matches(body.password(), usuario.getSenhaHash())) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos.");
		}
		if (!usuario.isAtivo()) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Esta conta foi desativada. Procure o gestor da fazenda se precisar de acesso.");
		}
		return toResponse(usuario, fazendaAcesso);
	}

	public AuthResponse register(RegisterRequest body) {
		if (body == null
				|| !StringUtils.hasText(body.nome())
				|| !StringUtils.hasText(body.email())
				|| !StringUtils.hasText(body.password())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome, e-mail e senha são obrigatórios.");
		}
		var email = normalizeEmail(body.email());
		if (usuarios.existsByEmailIgnoreCase(email)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Este e-mail já está cadastrado.");
		}
		var papel = resolvePapel(body.papel());
		var u = new Usuario();
		u.setNome(body.nome().trim());
		u.setEmail(email);
		u.setSenhaHash(passwordEncoder.encode(body.password()));
		u.setPapel(papel);
		u.setDataIngresso(Instant.now());
		u.setAtivo(true);
		usuarios.save(u);
		equipeService.notificarConvitesPendentesAoRegistrar(u);
		return toResponse(u, fazendaAcesso);
	}

	private static String normalizeEmail(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}

	private static PapelUsuario resolvePapel(String papel) {
		try {
			var v = papel == null ? "" : papel.trim().toUpperCase(Locale.ROOT);
			if ("FUNCIONARIO".equals(v) || "FUNCIONARIOS".equals(v)) {
				return PapelUsuario.FUNCIONARIO_CAMPO;
			}
			return PapelUsuario.fromInput(papel);
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Perfil de acesso inválido.");
		}
	}

	private static AuthResponse toResponse(Usuario u, FazendaAcessoService fazendaAcesso) {
		return new AuthResponse("agrolink-" + u.getId(), fazendaAcesso.toUserSummary(u));
	}
}
