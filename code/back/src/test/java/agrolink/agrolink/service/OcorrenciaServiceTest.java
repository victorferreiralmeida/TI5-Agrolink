package agrolink.agrolink.service;

import agrolink.agrolink.domain.Fazenda;
import agrolink.agrolink.domain.FazendaSetor;
import agrolink.agrolink.domain.Ocorrencia;
import agrolink.agrolink.domain.PapelUsuario;
import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.dto.ComentarioRequest;
import agrolink.agrolink.dto.OcorrenciaRequest;
import agrolink.agrolink.dto.OcorrenciaResponse;
import agrolink.agrolink.repository.FazendaRepository;
import agrolink.agrolink.repository.FazendaSetorRepository;
import agrolink.agrolink.repository.OcorrenciaRepository;
import agrolink.agrolink.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes unitários do {@link OcorrenciaService} — endpoint principal de gestão de ocorrências.
 *
 * Segue exatamente o padrão de {@code AuthServiceTest}:
 *  - Mockito puro com {@link MockitoExtension}, sem contexto Spring;
 *  - AssertJ ({@code assertThat} / {@code assertThatThrownBy});
 *  - status HTTP via {@link ResponseStatusException};
 *  - nomenclatura PT-BR no formato {@code metodo_cenario()}.
 */
@ExtendWith(MockitoExtension.class)
class OcorrenciaServiceTest {

	@Mock
	private OcorrenciaRepository ocorrenciaRepository;

	@Mock
	private FazendaSetorRepository fazendaSetorRepository;

	@Mock
	private FazendaRepository fazendaRepository;

	@Mock
	private NotificacaoService notificacaoService;

	@Mock
	private UsuarioRepository usuarioRepository;

	@InjectMocks
	private OcorrenciaService service;

	private Fazenda fazenda;
	private Usuario gerente;
	private Usuario funcionario;
	private Usuario produtor;
	private FazendaSetor setor;
	private FazendaSetor setorOutraFazenda;
	private Ocorrencia ocorrencia;
	private OcorrenciaRequest reqValido;

	@BeforeEach
	void setUp() {
		fazenda = new Fazenda();
		fazenda.setId(10L);
		fazenda.setGerenteUsuarioId(1L);
		fazenda.setNome("Fazenda Boa Vista");

		Fazenda outra = new Fazenda();
		outra.setId(99L);
		outra.setGerenteUsuarioId(7L);
		outra.setNome("Outra Fazenda");

		gerente = novoUsuario(1L, "Gerente Patricia", "gerente@agrolink.demo",
				PapelUsuario.GERENTE, true, null);
		funcionario = novoUsuario(2L, "Joao Campo", "campo@agrolink.demo",
				PapelUsuario.FUNCIONARIO_CAMPO, true, 10L);
		produtor = novoUsuario(3L, "Marcos Produtor", "produtor@agrolink.demo",
				PapelUsuario.PRODUTOR, true, 10L);

		setor = new FazendaSetor();
		setor.setId(100L);
		setor.setNome("Talhao Norte");
		setor.setFazenda(fazenda);

		setorOutraFazenda = new FazendaSetor();
		setorOutraFazenda.setId(200L);
		setorOutraFazenda.setNome("Talhao Vizinho");
		setorOutraFazenda.setFazenda(outra);

		ocorrencia = new Ocorrencia();
		ocorrencia.setId(500L);
		ocorrencia.setTitulo("Praga detectada");
		ocorrencia.setSetor("Talhao Norte");
		ocorrencia.setSetorFazendaId(100L);
		ocorrencia.setCategoria("Pragas");
		ocorrencia.setPrioridade("ALTA");
		ocorrencia.setStatus("ABERTA");
		ocorrencia.setCoordsX(-20.0);
		ocorrencia.setCoordsY(-45.0);
		ocorrencia.setHorario("2026-05-20T10:00:00Z");

		reqValido = new OcorrenciaRequest(
				"Praga detectada", null, "Pragas", "ALTA",
				"Folhas amareladas", null, null, -20.0, -45.0, 100L, null);
	}

	private Usuario novoUsuario(Long id, String nome, String email, PapelUsuario papel,
			boolean ativo, Long vinculo) {
		Usuario u = new Usuario();
		u.setId(id);
		u.setNome(nome);
		u.setEmail(email);
		u.setSenhaHash("$2a$10$hash");
		u.setPapel(papel);
		u.setAtivo(ativo);
		u.setFazendaVinculoId(vinculo);
		return u;
	}

	/** Stubs mínimos para o funcionário (id 2, vínculo fazenda 10) enxergar a ocorrência id 500. */
	private void visivelComoFuncionario() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
	}

	private static void assertStatus(Throwable ex, HttpStatus status) {
		assertThat(ex).isInstanceOf(ResponseStatusException.class);
		assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(status);
	}

	// =========================================================================== listarVisivelPara

	@Test
	void listarVisivelPara_retornaVazioQuandoUsuarioSemFazenda() {
		funcionario.setFazendaVinculoId(null);
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));

		assertThat(service.listarVisivelPara(2L)).isEmpty();
		verify(ocorrenciaRepository, never()).findBySetorFazendaIdIn(any());
	}

	@Test
	void listarVisivelPara_retornaVazioQuandoUsuarioInativo() {
		funcionario.setAtivo(false);
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));

		assertThat(service.listarVisivelPara(2L)).isEmpty();
	}

	@Test
	void listarVisivelPara_lancaUnauthorizedQuandoUsuarioInexistente() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.listarVisivelPara(2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.UNAUTHORIZED));
	}

	@Test
	void listarVisivelPara_retornaVazioQuandoFazendaSemSetores() {
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(1L)).thenReturn(Optional.of(fazenda));
		when(fazendaSetorRepository.findByFazendaIdOrderByNomeAsc(10L)).thenReturn(List.of());

		assertThat(service.listarVisivelPara(1L)).isEmpty();
		verify(ocorrenciaRepository, never()).findBySetorFazendaIdIn(any());
	}

	@Test
	void listarVisivelPara_retornaOcorrenciasDosSetoresParaGerente() {
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(1L)).thenReturn(Optional.of(fazenda));
		when(fazendaSetorRepository.findByFazendaIdOrderByNomeAsc(10L)).thenReturn(List.of(setor));
		when(ocorrenciaRepository.findBySetorFazendaIdIn(List.of(100L))).thenReturn(List.of(ocorrencia));

		assertThat(service.listarVisivelPara(1L)).containsExactly(ocorrencia);
	}

	@Test
	void listarVisivelPara_resolveFazendaPorVinculoQuandoFuncionario() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(fazendaSetorRepository.findByFazendaIdOrderByNomeAsc(10L)).thenReturn(List.of(setor));
		when(ocorrenciaRepository.findBySetorFazendaIdIn(List.of(100L))).thenReturn(List.of(ocorrencia));

		assertThat(service.listarVisivelPara(2L)).containsExactly(ocorrencia);
		verify(fazendaRepository, never()).findByGerenteUsuarioId(anyLong());
	}

	// =========================================================================== buscarSeVisivel / buscarPorId

	@Test
	void buscarSeVisivel_retornaVazioQuandoOcorrenciaNaoExiste() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.empty());

		assertThat(service.buscarSeVisivel(500L, 2L)).isEmpty();
	}

	@Test
	void buscarSeVisivel_retornaVazioQuandoUsuarioNaoPodeVisualizar() {
		funcionario.setFazendaVinculoId(99L);
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		assertThat(service.buscarSeVisivel(500L, 2L)).isEmpty();
	}

	@Test
	void buscarSeVisivel_retornaOcorrenciaQuandoVisivel() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		assertThat(service.buscarSeVisivel(500L, 2L)).contains(ocorrencia);
	}

	@Test
	void buscarPorId_delegaParaRepositorio() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));

		assertThat(service.buscarPorId(500L)).contains(ocorrencia);
		verify(ocorrenciaRepository).findById(500L);
	}

	// =========================================================================== asResponse

	@Test
	void asResponse_semResponsavelNaoConsultaUsuario() {
		ocorrencia.setResponsavelId(null);

		OcorrenciaResponse resp = service.asResponse(ocorrencia);

		assertThat(resp.responsavelId()).isNull();
		assertThat(resp.responsavelNome()).isNull();
		verify(usuarioRepository, never()).findById(any());
	}

	@Test
	void asResponse_comResponsavelInclueNome() {
		ocorrencia.setResponsavelId(2L);
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));

		OcorrenciaResponse resp = service.asResponse(ocorrencia);

		assertThat(resp.responsavelId()).isEqualTo(2L);
		assertThat(resp.responsavelNome()).isEqualTo("Joao Campo");
	}

	@Test
	void asResponse_comResponsavelInexistenteRetornaNomeNulo() {
		ocorrencia.setResponsavelId(99L);
		when(usuarioRepository.findById(99L)).thenReturn(Optional.empty());

		assertThat(service.asResponse(ocorrencia).responsavelNome()).isNull();
	}

	// =========================================================================== criar

	@Test
	void criar_rejeitaCoordenadasForaDoIntervalo() {
		var req = new OcorrenciaRequest("T", null, "C", "ALTA", null, null, null, 200.0, -45.0, 100L, null);

		assertThatThrownBy(() -> service.criar(req, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
		verify(ocorrenciaRepository, never()).save(any());
	}

	@Test
	void criar_rejeitaUsuarioSemFazenda() {
		funcionario.setFazendaVinculoId(null);
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));

		assertThatThrownBy(() -> service.criar(reqValido, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
		verify(ocorrenciaRepository, never()).save(any());
	}

	@Test
	void criar_lancaUnauthorizedQuandoUsuarioInexistente() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.criar(reqValido, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.UNAUTHORIZED));
	}

	@Test
	void criar_rejeitaSetorIdNulo() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		var req = new OcorrenciaRequest("T", null, "C", "ALTA", null, null, null, -20.0, -45.0, null, null);

		assertThatThrownBy(() -> service.criar(req, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	@Test
	void criar_rejeitaSetorInexistente() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.criar(reqValido, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	@Test
	void criar_rejeitaSetorDeOutraFazenda() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(fazendaSetorRepository.findById(200L)).thenReturn(Optional.of(setorOutraFazenda));
		var req = new OcorrenciaRequest("T", null, "C", "ALTA", null, null, null, -20.0, -45.0, 200L, null);

		assertThatThrownBy(() -> service.criar(req, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
	}

	@Test
	void criar_rejeitaPrioridadeInvalida() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		var req = new OcorrenciaRequest("T", null, "C", "EXTREMA", null, null, null, -20.0, -45.0, 100L, null);

		assertThatThrownBy(() -> service.criar(req, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	@Test
	void criar_rejeitaHorarioInvalido() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		var req = new OcorrenciaRequest("T", null, "C", "ALTA", null, null, "nao-data", -20.0, -45.0, 100L, null);

		assertThatThrownBy(() -> service.criar(req, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	@Test
	void criar_persisteOcorrenciaComStatusAberta() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(inv -> {
			Ocorrencia o = inv.getArgument(0);
			o.setId(500L);
			return o;
		});

		Ocorrencia salva = service.criar(reqValido, 2L);

		ArgumentCaptor<Ocorrencia> captor = ArgumentCaptor.forClass(Ocorrencia.class);
		verify(ocorrenciaRepository).save(captor.capture());
		assertThat(captor.getValue().getStatus()).isEqualTo("ABERTA");
		assertThat(captor.getValue().getComentarios()).isNull();
		assertThat(captor.getValue().getImagens()).isNull();
		assertThat(captor.getValue().getTitulo()).isEqualTo("Praga detectada");
		assertThat(captor.getValue().getSetorFazendaId()).isEqualTo(100L);
		assertThat(salva.getId()).isEqualTo(500L);
		verify(notificacaoService).registrar(
				eq("OCORRENCIA_NOVA"), anyString(), anyString(), anyString(),
				eq("OCORRENCIA"), eq(500L), eq(10L));
	}

	// =========================================================================== atualizar

	@Test
	void atualizar_rejeitaCoordenadasInvalidas() {
		var req = new OcorrenciaRequest("T", null, "C", "ALTA", null, null, null, -20.0, -300.0, 100L, null);

		assertThatThrownBy(() -> service.atualizar(500L, req, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	@Test
	void atualizar_rejeitaUsuarioSemFazenda() {
		funcionario.setFazendaVinculoId(null);
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));

		assertThatThrownBy(() -> service.atualizar(500L, reqValido, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
	}

	@Test
	void atualizar_lancaNotFoundQuandoOcorrenciaInexistente() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.atualizar(500L, reqValido, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void atualizar_lancaNotFoundQuandoNaoVisivel() {
		funcionario.setFazendaVinculoId(99L);
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));

		assertThatThrownBy(() -> service.atualizar(500L, reqValido, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void atualizar_salvaEEmiteNotificacao() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(inv -> inv.getArgument(0));

		Ocorrencia salva = service.atualizar(500L, reqValido, 2L);

		assertThat(salva).isSameAs(ocorrencia);
		verify(notificacaoService).registrar(
				eq("OCORRENCIA_ATUALIZADA"), anyString(), anyString(), anyString(),
				eq("OCORRENCIA"), eq(500L), eq(10L));
	}

	// =========================================================================== deletar

	@Test
	void deletar_lancaNotFoundQuandoInexistente() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.deletar(500L, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
		verify(ocorrenciaRepository, never()).deleteById(any());
	}

	@Test
	void deletar_lancaNotFoundQuandoNaoVisivel() {
		funcionario.setFazendaVinculoId(99L);
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		assertThatThrownBy(() -> service.deletar(500L, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
		verify(ocorrenciaRepository, never()).deleteById(any());
	}

	@Test
	void deletar_removeEEmiteNotificacao() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		service.deletar(500L, 2L);

		verify(ocorrenciaRepository).deleteById(500L);
		verify(notificacaoService).registrar(
				eq("OCORRENCIA_EXCLUIDA"), anyString(), anyString(), anyString(),
				eq("OCORRENCIA"), eq(500L), eq(10L));
	}

	// =========================================================================== resolver

	@Test
	void resolver_lancaNotFoundQuandoInexistente() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.resolver(500L, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void resolver_lancaNotFoundQuandoNaoVisivel() {
		funcionario.setFazendaVinculoId(99L);
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		assertThatThrownBy(() -> service.resolver(500L, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void resolver_marcaComoResolvidaEEmiteNotificacao() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();
		when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(inv -> inv.getArgument(0));

		Ocorrencia salva = service.resolver(500L, 2L);

		assertThat(salva.getStatus()).isEqualTo("RESOLVIDA");
		verify(notificacaoService).registrar(
				eq("OCORRENCIA_RESOLVIDA"), anyString(), anyString(), anyString(),
				eq("OCORRENCIA"), eq(500L), eq(10L));
	}

	// =========================================================================== comentar

	@Test
	void comentar_lancaNotFoundQuandoOcorrenciaInexistente() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.comentar(500L, new ComentarioRequest("oi", null), 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void comentar_lancaNotFoundQuandoNaoVisivel() {
		funcionario.setFazendaVinculoId(99L);
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		assertThatThrownBy(() -> service.comentar(500L, new ComentarioRequest("oi", null), 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void comentar_lancaUnauthorizedQuandoUsuarioDaSessaoInexistente() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario), Optional.empty());

		assertThatThrownBy(() -> service.comentar(500L, new ComentarioRequest("oi", null), 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.UNAUTHORIZED));
	}

	@Test
	void comentar_anexaComentarioEEmiteNotificacao() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();
		when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(inv -> inv.getArgument(0));
		ocorrencia.setComentarios(null);

		service.comentar(500L, new ComentarioRequest("Tudo certo", null), 2L);

		ArgumentCaptor<Ocorrencia> captor = ArgumentCaptor.forClass(Ocorrencia.class);
		verify(ocorrenciaRepository).save(captor.capture());
		assertThat(captor.getValue().getComentarios())
				.isNotBlank()
				.contains("Tudo certo")
				.contains("Joao Campo");
		verify(notificacaoService).registrar(
				eq("OCORRENCIA_COMENTARIO"), anyString(), anyString(), anyString(),
				eq("OCORRENCIA"), eq(500L), eq(10L));
	}

	@Test
	void comentar_concatenaQuandoJaExistemComentarios() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();
		when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(inv -> inv.getArgument(0));
		ocorrencia.setComentarios("linha-antiga");

		service.comentar(500L, new ComentarioRequest("Novo comentario", null), 2L);

		ArgumentCaptor<Ocorrencia> captor = ArgumentCaptor.forClass(Ocorrencia.class);
		verify(ocorrenciaRepository).save(captor.capture());
		assertThat(captor.getValue().getComentarios())
				.startsWith("linha-antiga\n")
				.contains("Novo comentario");
	}

	// =========================================================================== autoAtribuirResponsavel

	@Test
	void autoAtribuirResponsavel_lancaNotFoundQuandoUsuarioInexistente() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.autoAtribuirResponsavel(500L, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void autoAtribuirResponsavel_rejeitaProdutor() {
		when(usuarioRepository.findById(3L)).thenReturn(Optional.of(produtor));

		assertThatThrownBy(() -> service.autoAtribuirResponsavel(500L, 3L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
	}

	@Test
	void autoAtribuirResponsavel_lancaNotFoundQuandoOcorrenciaInexistente() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.autoAtribuirResponsavel(500L, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void autoAtribuirResponsavel_lancaNotFoundQuandoNaoVisivel() {
		funcionario.setFazendaVinculoId(99L);
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));

		assertThatThrownBy(() -> service.autoAtribuirResponsavel(500L, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void autoAtribuirResponsavel_lancaConflitoQuandoJaExisteOutroResponsavel() {
		ocorrencia.setResponsavelId(7L);
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));

		assertThatThrownBy(() -> service.autoAtribuirResponsavel(500L, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.CONFLICT));
	}

	@Test
	void autoAtribuirResponsavel_gerentePodeAssumirMesmoComOutroResponsavel() {
		ocorrencia.setResponsavelId(7L);
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(1L)).thenReturn(Optional.of(fazenda));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(inv -> inv.getArgument(0));

		assertThat(service.autoAtribuirResponsavel(500L, 1L).getResponsavelId()).isEqualTo(1L);
	}

	@Test
	void autoAtribuirResponsavel_atribuiQuandoSemResponsavel() {
		ocorrencia.setResponsavelId(null);
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(inv -> inv.getArgument(0));

		Ocorrencia salva = service.autoAtribuirResponsavel(500L, 2L);

		assertThat(salva.getResponsavelId()).isEqualTo(2L);
		verify(notificacaoService).registrar(
				eq("OCORRENCIA_ATRIBUIDA"), anyString(), anyString(), anyString(),
				eq("OCORRENCIA"), eq(500L), eq(10L));
	}

	@Test
	void autoAtribuirResponsavel_permiteReassumirQuandoJaEhResponsavel() {
		ocorrencia.setResponsavelId(2L);
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(inv -> inv.getArgument(0));

		assertThat(service.autoAtribuirResponsavel(500L, 2L).getResponsavelId()).isEqualTo(2L);
	}

	@Test
	void autoAtribuirResponsavel_permiteGerenteAssumir() {
		ocorrencia.setResponsavelId(null);
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(1L)).thenReturn(Optional.of(fazenda));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(inv -> inv.getArgument(0));

		assertThat(service.autoAtribuirResponsavel(500L, 1L).getResponsavelId()).isEqualTo(1L);
	}

	// =========================================================================== definirResponsavelGerente

	@Test
	void definirResponsavelGerente_lancaNotFoundQuandoGerenteInexistente() {
		when(usuarioRepository.findById(1L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.definirResponsavelGerente(500L, 2L, 1L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void definirResponsavelGerente_rejeitaUsuarioNaoGerente() {
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));

		assertThatThrownBy(() -> service.definirResponsavelGerente(500L, 2L, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
	}

	@Test
	void definirResponsavelGerente_lancaNotFoundQuandoOcorrenciaInexistente() {
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(gerente));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.definirResponsavelGerente(500L, 2L, 1L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void definirResponsavelGerente_lancaNotFoundQuandoNaoVisivel() {
		setor.setFazenda(setorOutraFazenda.getFazenda()); // ocorrência cai em fazenda 99
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(1L)).thenReturn(Optional.of(fazenda));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));

		assertThatThrownBy(() -> service.definirResponsavelGerente(500L, 2L, 1L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void definirResponsavelGerente_removeResponsavelQuandoAlvoNulo() {
		ocorrencia.setResponsavelId(2L);
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(1L)).thenReturn(Optional.of(fazenda));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(inv -> inv.getArgument(0));

		Ocorrencia salva = service.definirResponsavelGerente(500L, null, 1L);

		assertThat(salva.getResponsavelId()).isNull();
		verify(notificacaoService).registrar(
				eq("OCORRENCIA_ATRIBUIDA"), anyString(), eq("Ocorrência sem responsável"),
				anyString(), eq("OCORRENCIA"), eq(500L), eq(10L));
	}

	@Test
	void definirResponsavelGerente_lancaNotFoundQuandoAlvoInexistente() {
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(1L)).thenReturn(Optional.of(fazenda));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		when(usuarioRepository.findById(2L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.definirResponsavelGerente(500L, 2L, 1L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void definirResponsavelGerente_rejeitaAlvoNaoFuncionarioCampo() {
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(1L)).thenReturn(Optional.of(fazenda));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		when(usuarioRepository.findById(3L)).thenReturn(Optional.of(produtor));

		assertThatThrownBy(() -> service.definirResponsavelGerente(500L, 3L, 1L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	@Test
	void definirResponsavelGerente_rejeitaAlvoDeOutraFazenda() {
		funcionario.setFazendaVinculoId(99L);
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(1L)).thenReturn(Optional.of(fazenda));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));

		assertThatThrownBy(() -> service.definirResponsavelGerente(500L, 2L, 1L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	@Test
	void definirResponsavelGerente_atribuiAFuncionarioValido() {
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(1L)).thenReturn(Optional.of(fazenda));
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		when(fazendaSetorRepository.findById(100L)).thenReturn(Optional.of(setor));
		when(usuarioRepository.findById(2L)).thenReturn(Optional.of(funcionario));
		when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(inv -> inv.getArgument(0));

		Ocorrencia salva = service.definirResponsavelGerente(500L, 2L, 1L);

		assertThat(salva.getResponsavelId()).isEqualTo(2L);
		verify(notificacaoService).registrar(
				eq("OCORRENCIA_ATRIBUIDA"), anyString(), eq("Ocorrência atribuída"),
				anyString(), eq("OCORRENCIA"), eq(500L), eq(10L));
	}

	// =========================================================================== comentarComArquivos (sem filesystem)

	@Test
	void comentarComArquivos_lancaNotFoundQuandoOcorrenciaInexistente() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.comentarComArquivos(500L, "x", null, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void comentarComArquivos_lancaNotFoundQuandoNaoVisivel() {
		funcionario.setFazendaVinculoId(99L);
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		assertThatThrownBy(() -> service.comentarComArquivos(500L, "x", null, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void comentarComArquivos_rejeitaQuandoSemTextoESemAnexos() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		assertThatThrownBy(() -> service.comentarComArquivos(500L, null, null, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	@Test
	void comentarComArquivos_anexaTextoSemArquivos() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();
		when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(inv -> inv.getArgument(0));
		ocorrencia.setComentarios(null);

		service.comentarComArquivos(500L, "comentario sem anexo", null, 2L);

		ArgumentCaptor<Ocorrencia> captor = ArgumentCaptor.forClass(Ocorrencia.class);
		verify(ocorrenciaRepository).save(captor.capture());
		assertThat(captor.getValue().getComentarios()).isNotBlank().contains("comentario sem anexo");
		verify(notificacaoService).registrar(
				eq("OCORRENCIA_COMENTARIO"), anyString(), anyString(), anyString(),
				eq("OCORRENCIA"), eq(500L), eq(10L));
	}

	// =========================================================================== adicionarImagens (sem filesystem)

	@Test
	void adicionarImagens_lancaNotFoundQuandoOcorrenciaInexistente() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.adicionarImagens(500L, List.of(mock(MultipartFile.class)), 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void adicionarImagens_lancaNotFoundQuandoNaoVisivel() {
		funcionario.setFazendaVinculoId(99L);
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		assertThatThrownBy(() -> service.adicionarImagens(500L, List.of(mock(MultipartFile.class)), 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void adicionarImagens_rejeitaQuandoListaNula() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		assertThatThrownBy(() -> service.adicionarImagens(500L, null, 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	@Test
	void adicionarImagens_rejeitaQuandoListaVazia() {
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		assertThatThrownBy(() -> service.adicionarImagens(500L, List.of(), 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	@Test
	void adicionarImagens_rejeitaQuandoLimiteJaAtingido() {
		ocorrencia.setImagens("a\nb\nc\nd\ne\nf");
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		assertThatThrownBy(() -> service.adicionarImagens(500L, List.of(mock(MultipartFile.class)), 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	@Test
	void adicionarImagens_rejeitaQuandoNenhumaImagemValida() {
		ocorrencia.setImagens(null);
		MultipartFile vazio = mock(MultipartFile.class);
		when(vazio.isEmpty()).thenReturn(true);
		when(ocorrenciaRepository.findById(500L)).thenReturn(Optional.of(ocorrencia));
		visivelComoFuncionario();

		assertThatThrownBy(() -> service.adicionarImagens(500L, List.of(vazio), 2L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}
}
