package agrolink.agrolink.service;

import agrolink.agrolink.domain.PapelUsuario;
import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.dto.LoginRequest;
import agrolink.agrolink.dto.RegisterRequest;
import agrolink.agrolink.dto.UserSummary;
import agrolink.agrolink.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

	@Mock
	private UsuarioRepository usuarios;

	@Mock
	private PasswordEncoder passwordEncoder;

	@Mock
	private EquipeService equipeService;

	@Mock
	private FazendaAcessoService fazendaAcesso;

	@InjectMocks
	private AuthService authService;

	private Usuario usuarioAtivo;

	@BeforeEach
	void setUp() {
		usuarioAtivo = new Usuario();
		usuarioAtivo.setId(42L);
		usuarioAtivo.setNome("Patricia Gerente");
		usuarioAtivo.setEmail("gerente1@agrolink.demo");
		usuarioAtivo.setSenhaHash("$2a$10$hash");
		usuarioAtivo.setPapel(PapelUsuario.GERENTE);
		usuarioAtivo.setAtivo(true);
	}

	@Test
	void login_rejeitaCorpoSemEmail() {
		assertThatThrownBy(() -> authService.login(new LoginRequest("", "senha123")))
				.isInstanceOf(ResponseStatusException.class)
				.extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
				.isEqualTo(HttpStatus.BAD_REQUEST);
	}

	@Test
	void login_rejeitaEmailInexistente() {
		when(usuarios.findByEmailIgnoreCase("nao@existe.demo")).thenReturn(Optional.empty());

		assertThatThrownBy(() -> authService.login(new LoginRequest("nao@existe.demo", "x")))
				.isInstanceOf(ResponseStatusException.class)
				.extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
				.isEqualTo(HttpStatus.UNAUTHORIZED);
	}

	@Test
	void login_rejeitaSenhaIncorreta() {
		when(usuarios.findByEmailIgnoreCase(usuarioAtivo.getEmail())).thenReturn(Optional.of(usuarioAtivo));
		when(passwordEncoder.matches("errada", usuarioAtivo.getSenhaHash())).thenReturn(false);

		assertThatThrownBy(() -> authService.login(new LoginRequest(usuarioAtivo.getEmail(), "errada")))
				.isInstanceOf(ResponseStatusException.class)
				.extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
				.isEqualTo(HttpStatus.UNAUTHORIZED);
	}

	@Test
	void login_rejeitaContaInativa() {
		usuarioAtivo.setAtivo(false);
		when(usuarios.findByEmailIgnoreCase(usuarioAtivo.getEmail())).thenReturn(Optional.of(usuarioAtivo));
		when(passwordEncoder.matches("AgrolinkDemo1!", usuarioAtivo.getSenhaHash())).thenReturn(true);

		assertThatThrownBy(() -> authService.login(new LoginRequest(usuarioAtivo.getEmail(), "AgrolinkDemo1!")))
				.isInstanceOf(ResponseStatusException.class)
				.extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
				.isEqualTo(HttpStatus.UNAUTHORIZED);
	}

	@Test
	void login_comCredenciaisValidasRetornaToken() {
		when(usuarios.findByEmailIgnoreCase(usuarioAtivo.getEmail())).thenReturn(Optional.of(usuarioAtivo));
		when(passwordEncoder.matches("AgrolinkDemo1!", usuarioAtivo.getSenhaHash())).thenReturn(true);
		when(fazendaAcesso.toUserSummary(usuarioAtivo)).thenReturn(
				new UserSummary(42L, "Patricia Gerente", usuarioAtivo.getEmail(), "GERENTE", null, null, true));

		var resposta = authService.login(new LoginRequest("  GERENTE1@agrolink.demo  ", "AgrolinkDemo1!"));

		assertThat(resposta.token()).isEqualTo("agrolink-42");
		assertThat(resposta.usuario().email()).isEqualTo(usuarioAtivo.getEmail());
	}

	@Test
	void register_rejeitaEmailDuplicado() {
		when(usuarios.existsByEmailIgnoreCase("novo@agrolink.demo")).thenReturn(true);

		var body = new RegisterRequest("Novo", "novo@agrolink.demo", "SenhaForte1!", "GERENTE");
		assertThatThrownBy(() -> authService.register(body))
				.isInstanceOf(ResponseStatusException.class)
				.extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
				.isEqualTo(HttpStatus.CONFLICT);

		verify(usuarios, never()).save(any());
	}

	@Test
	void register_persisteUsuarioComSenhaCriptografada() {
		when(usuarios.existsByEmailIgnoreCase("novo@agrolink.demo")).thenReturn(false);
		when(passwordEncoder.encode("SenhaForte1!")).thenReturn("hash-gerado");
		when(usuarios.save(any(Usuario.class))).thenAnswer(inv -> {
			Usuario u = inv.getArgument(0);
			u.setId(99L);
			return u;
		});
		when(fazendaAcesso.toUserSummary(any(Usuario.class))).thenAnswer(inv -> {
			Usuario u = inv.getArgument(0);
			return new UserSummary(u.getId(), u.getNome(), u.getEmail(), u.getPapel().name(), null, null, false);
		});

		var resposta = authService.register(
				new RegisterRequest("  Novo Usuário  ", "  NOVO@agrolink.demo  ", "SenhaForte1!", "GERENTE"));

		var captor = ArgumentCaptor.forClass(Usuario.class);
		verify(usuarios).save(captor.capture());
		assertThat(captor.getValue().getEmail()).isEqualTo("novo@agrolink.demo");
		assertThat(captor.getValue().getNome()).isEqualTo("Novo Usuário");
		assertThat(captor.getValue().getSenhaHash()).isEqualTo("hash-gerado");
		assertThat(captor.getValue().getPapel()).isEqualTo(PapelUsuario.GERENTE);
		assertThat(captor.getValue().isAtivo()).isTrue();
		assertThat(resposta.token()).isEqualTo("agrolink-99");
	}
}
