package agrolink.agrolink.service;

import agrolink.agrolink.domain.Fazenda;
import agrolink.agrolink.domain.FazendaSetor;
import agrolink.agrolink.domain.PapelUsuario;
import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.dto.AtualizarFazendaSetorRequest;
import agrolink.agrolink.dto.CriarFazendaSetorRequest;
import agrolink.agrolink.dto.FazendaResponse;
import agrolink.agrolink.dto.RegistroOcorrenciaMapaResponse;
import agrolink.agrolink.dto.UpsertFazendaRequest;
import agrolink.agrolink.repository.FazendaRepository;
import agrolink.agrolink.repository.FazendaSetorRepository;
import agrolink.agrolink.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Testes unitários do {@link FazendaService} — endpoints de fazenda e setores.
 * Segue o padrão de {@code AuthServiceTest}.
 */
@ExtendWith(MockitoExtension.class)
class FazendaServiceTest {

	private static final String POLY_A =
			"{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[0,1],[1,1],[1,0],[0,0]]]}";
	private static final String POLY_B_DISJOINT =
			"{\"type\":\"Polygon\",\"coordinates\":[[[10,10],[10,11],[11,11],[11,10],[10,10]]]}";
	private static final String POLY_B_OVERLAP =
			"{\"type\":\"Polygon\",\"coordinates\":[[[0.5,0.5],[0.5,1.5],[1.5,1.5],[1.5,0.5],[0.5,0.5]]]}";
	private static final String GEOJSON_NAO_POLYGON =
			"{\"type\":\"Point\",\"coordinates\":[0,0]}";
	private static final String GEOJSON_INVALIDO = "{ not json";
	private static final String POLY_POUCOS_PONTOS =
			"{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[1,1]]]}";

	@Mock
	private FazendaRepository fazendaRepository;

	@Mock
	private FazendaSetorRepository setorRepository;

	@Mock
	private UsuarioRepository usuarioRepository;

	@Mock
	private NotificacaoService notificacaoService;

	@InjectMocks
	private FazendaService fazendaService;

	private Fazenda fazenda;
	private Usuario gerente;
	private Usuario produtor;
	private Usuario funcionario;
	private FazendaSetor setor;

	@BeforeEach
	void setUp() {
		fazenda = new Fazenda();
		fazenda.setId(99L);
		fazenda.setGerenteUsuarioId(10L);
		fazenda.setNome("Fazenda Boa Vista");

		gerente = novoUsuario(10L, "Gerente Patricia", PapelUsuario.GERENTE, true, null);
		produtor = novoUsuario(20L, "Marcos Produtor", PapelUsuario.PRODUTOR, true, 99L);
		funcionario = novoUsuario(30L, "Joao Campo", PapelUsuario.FUNCIONARIO_CAMPO, true, 99L);

		setor = setorCom(5L, "Talhao Norte", POLY_A, fazenda);
	}

	private Usuario novoUsuario(Long id, String nome, PapelUsuario papel, boolean ativo, Long vinculo) {
		Usuario u = new Usuario();
		u.setId(id);
		u.setNome(nome);
		u.setEmail(nome.toLowerCase().replace(' ', '.') + "@agrolink.demo");
		u.setSenhaHash("$2a$10$hash");
		u.setPapel(papel);
		u.setAtivo(ativo);
		u.setFazendaVinculoId(vinculo);
		return u;
	}

	private FazendaSetor setorCom(Long id, String nome, String poligono, Fazenda f) {
		FazendaSetor s = new FazendaSetor();
		s.setId(id);
		s.setNome(nome);
		s.setPoligonoGeojson(poligono);
		s.setFazenda(f);
		return s;
	}

	private static void assertStatus(Throwable ex, HttpStatus status) {
		assertThat(ex).isInstanceOf(ResponseStatusException.class);
		assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(status);
	}

	// ---------------------------------------------------------------- mapaParaRegistroOcorrencia

	@Test
	void mapaParaRegistroOcorrencia_rejeitaUsuarioInexistente() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> fazendaService.mapaParaRegistroOcorrencia(10L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.UNAUTHORIZED));
		verifyNoInteractions(setorRepository, fazendaRepository);
	}

	@Test
	void mapaParaRegistroOcorrencia_retornaVazioParaUsuarioInativo() {
		gerente.setAtivo(false);
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));

		RegistroOcorrenciaMapaResponse r = fazendaService.mapaParaRegistroOcorrencia(10L);

		assertThat(r.fazendas()).isEmpty();
		assertThat(r.setores()).isEmpty();
		verify(fazendaRepository, never()).findByGerenteUsuarioId(any());
	}

	@Test
	void mapaParaRegistroOcorrencia_retornaVazioQuandoGerenteSemFazenda() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.empty());

		RegistroOcorrenciaMapaResponse r = fazendaService.mapaParaRegistroOcorrencia(10L);

		assertThat(r.fazendas()).isEmpty();
		assertThat(r.setores()).isEmpty();
	}

	@Test
	void mapaParaRegistroOcorrencia_retornaVazioParaFuncionarioSemVinculo() {
		funcionario.setFazendaVinculoId(null);
		when(usuarioRepository.findById(30L)).thenReturn(Optional.of(funcionario));

		RegistroOcorrenciaMapaResponse r = fazendaService.mapaParaRegistroOcorrencia(30L);

		assertThat(r.fazendas()).isEmpty();
		verify(fazendaRepository, never()).findById(any());
	}

	@Test
	void mapaParaRegistroOcorrencia_montaFazendaESetoresParaGerente() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findByFazendaIdOrderByNomeAsc(99L)).thenReturn(List.of(setor));

		RegistroOcorrenciaMapaResponse r = fazendaService.mapaParaRegistroOcorrencia(10L);

		assertThat(r.fazendas()).hasSize(1);
		assertThat(r.fazendas().get(0).id()).isEqualTo(99L);
		assertThat(r.fazendas().get(0).nome()).isEqualTo("Fazenda Boa Vista");
		assertThat(r.setores()).hasSize(1);
		assertThat(r.setores().get(0).fazendaNome()).isEqualTo("Fazenda Boa Vista");
		assertThat(r.setores().get(0).poligonoGeojson()).isEqualTo(POLY_A);
	}

	@Test
	void mapaParaRegistroOcorrencia_resolveFazendaPorVinculoParaFuncionario() {
		when(usuarioRepository.findById(30L)).thenReturn(Optional.of(funcionario));
		when(fazendaRepository.findById(99L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findByFazendaIdOrderByNomeAsc(99L)).thenReturn(List.of());

		RegistroOcorrenciaMapaResponse r = fazendaService.mapaParaRegistroOcorrencia(30L);

		assertThat(r.fazendas()).hasSize(1);
		assertThat(r.setores()).isEmpty();
		verify(fazendaRepository, never()).findByGerenteUsuarioId(any());
	}

	@Test
	void listarSetoresParaRegistroOcorrencia_delegaParaMapa() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findByFazendaIdOrderByNomeAsc(99L)).thenReturn(List.of(setor));

		var setores = fazendaService.listarSetoresParaRegistroOcorrencia(10L);

		assertThat(setores).hasSize(1);
		assertThat(setores.get(0).id()).isEqualTo(5L);
		assertThat(setores.get(0).nome()).isEqualTo("Talhao Norte");
	}

	// ---------------------------------------------------------------- obterMinhaFazenda

	@Test
	void obterMinhaFazenda_rejeitaUsuarioInexistente() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> fazendaService.obterMinhaFazenda(10L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.UNAUTHORIZED));
	}

	@Test
	void obterMinhaFazenda_rejeitaUsuarioNaoGerente() {
		when(usuarioRepository.findById(20L)).thenReturn(Optional.of(produtor));

		assertThatThrownBy(() -> fazendaService.obterMinhaFazenda(20L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
		verify(fazendaRepository, never()).findByGerenteUsuarioId(any());
	}

	@Test
	void obterMinhaFazenda_rejeitaQuandoFazendaNaoCadastrada() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> fazendaService.obterMinhaFazenda(10L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void obterMinhaFazenda_retornaFazendaComSetores() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findByFazendaIdOrderByNomeAsc(99L)).thenReturn(List.of(setor));

		FazendaResponse r = fazendaService.obterMinhaFazenda(10L);

		assertThat(r.id()).isEqualTo(99L);
		assertThat(r.nome()).isEqualTo("Fazenda Boa Vista");
		assertThat(r.setores()).hasSize(1);
		assertThat(r.setores().get(0).id()).isEqualTo(5L);
	}

	// ---------------------------------------------------------------- salvarMinhaFazenda

	@Test
	void salvarMinhaFazenda_rejeitaUsuarioInexistente() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> fazendaService.salvarMinhaFazenda(10L, new UpsertFazendaRequest("F", null)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.UNAUTHORIZED));
		verify(fazendaRepository, never()).save(any());
	}

	@Test
	void salvarMinhaFazenda_rejeitaUsuarioNaoGerente() {
		when(usuarioRepository.findById(20L)).thenReturn(Optional.of(produtor));

		assertThatThrownBy(() -> fazendaService.salvarMinhaFazenda(20L, new UpsertFazendaRequest("F", null)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
		verify(fazendaRepository, never()).save(any());
		verifyNoInteractions(notificacaoService);
	}

	@Test
	void salvarMinhaFazenda_criaNovaFazendaERegistraNotificacao() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.empty());
		when(fazendaRepository.save(any(Fazenda.class))).thenAnswer(inv -> {
			Fazenda f = inv.getArgument(0);
			f.setId(99L);
			return f;
		});
		when(setorRepository.findByFazendaIdOrderByNomeAsc(99L)).thenReturn(List.of());

		FazendaResponse r = fazendaService.salvarMinhaFazenda(10L, new UpsertFazendaRequest("  Fazenda Nova  ", null));

		ArgumentCaptor<Fazenda> captor = ArgumentCaptor.forClass(Fazenda.class);
		verify(fazendaRepository).save(captor.capture());
		assertThat(captor.getValue().getNome()).isEqualTo("Fazenda Nova");
		assertThat(captor.getValue().getGerenteUsuarioId()).isEqualTo(10L);
		assertThat(captor.getValue().getPerimetroGeojson()).isNull();
		assertThat(r.id()).isEqualTo(99L);
		verify(notificacaoService).registrar(
				eq("FAZENDA_CRIADA"), anyString(), anyString(), anyString(), eq("FAZENDA"), eq(99L), eq(99L));
	}

	@Test
	void salvarMinhaFazenda_normalizaPerimetroVazioParaNull() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.empty());
		when(fazendaRepository.save(any(Fazenda.class))).thenAnswer(inv -> {
			Fazenda f = inv.getArgument(0);
			f.setId(99L);
			return f;
		});
		when(setorRepository.findByFazendaIdOrderByNomeAsc(99L)).thenReturn(List.of());

		fazendaService.salvarMinhaFazenda(10L, new UpsertFazendaRequest("F", "   "));

		ArgumentCaptor<Fazenda> captor = ArgumentCaptor.forClass(Fazenda.class);
		verify(fazendaRepository).save(captor.capture());
		assertThat(captor.getValue().getPerimetroGeojson()).isNull();
	}

	@Test
	void salvarMinhaFazenda_atualizaFazendaExistenteERegistraNotificacao() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(fazendaRepository.save(any(Fazenda.class))).thenAnswer(inv -> inv.getArgument(0));
		when(setorRepository.findByFazendaIdOrderByNomeAsc(99L)).thenReturn(List.of());

		fazendaService.salvarMinhaFazenda(10L, new UpsertFazendaRequest("Renomeada", POLY_A));

		ArgumentCaptor<Fazenda> captor = ArgumentCaptor.forClass(Fazenda.class);
		verify(fazendaRepository).save(captor.capture());
		assertThat(captor.getValue().getNome()).isEqualTo("Renomeada");
		assertThat(captor.getValue().getPerimetroGeojson()).isEqualTo(POLY_A);
		assertThat(captor.getValue().getGerenteUsuarioId()).isEqualTo(10L);
		verify(notificacaoService).registrar(
				eq("FAZENDA_ATUALIZADA"), anyString(), anyString(), anyString(), eq("FAZENDA"), eq(99L), eq(99L));
	}

	@Test
	void salvarMinhaFazenda_rejeitaFazendaDeOutroGerente() {
		fazenda.setGerenteUsuarioId(77L);
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));

		assertThatThrownBy(() -> fazendaService.salvarMinhaFazenda(10L, new UpsertFazendaRequest("X", null)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
		verify(fazendaRepository, never()).save(any());
		verifyNoInteractions(notificacaoService);
	}

	// ---------------------------------------------------------------- criarSetor

	@Test
	void criarSetor_rejeitaUsuarioInexistente() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> fazendaService.criarSetor(10L, new CriarFazendaSetorRequest("S", null)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.UNAUTHORIZED));
	}

	@Test
	void criarSetor_rejeitaUsuarioNaoGerente() {
		when(usuarioRepository.findById(20L)).thenReturn(Optional.of(produtor));

		assertThatThrownBy(() -> fazendaService.criarSetor(20L, new CriarFazendaSetorRequest("S", null)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
		verify(setorRepository, never()).save(any());
	}

	@Test
	void criarSetor_rejeitaQuandoFazendaNaoCadastrada() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> fazendaService.criarSetor(10L, new CriarFazendaSetorRequest("S", null)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void criarSetor_criaSetorSemPoligonoERegistraNotificacao() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.save(any(FazendaSetor.class))).thenAnswer(inv -> {
			FazendaSetor s = inv.getArgument(0);
			s.setId(5L);
			return s;
		});

		var resp = fazendaService.criarSetor(10L, new CriarFazendaSetorRequest("  Setor A  ", null));

		ArgumentCaptor<FazendaSetor> captor = ArgumentCaptor.forClass(FazendaSetor.class);
		verify(setorRepository).save(captor.capture());
		assertThat(captor.getValue().getNome()).isEqualTo("Setor A");
		assertThat(captor.getValue().getFazenda()).isSameAs(fazenda);
		assertThat(captor.getValue().getPoligonoGeojson()).isNull();
		assertThat(resp.id()).isEqualTo(5L);
		verify(notificacaoService).registrar(
				eq("SETOR_CRIADO"), anyString(), anyString(), anyString(), eq("SETOR"), eq(5L), eq(99L));
	}

	@Test
	void criarSetor_criaSetorComPoligonoValidoSemSobreposicao() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findByFazendaIdOrderByNomeAsc(99L))
				.thenReturn(List.of(setorCom(2L, "Vizinho", POLY_B_DISJOINT, fazenda)));
		when(setorRepository.save(any(FazendaSetor.class))).thenAnswer(inv -> {
			FazendaSetor s = inv.getArgument(0);
			s.setId(6L);
			return s;
		});

		var resp = fazendaService.criarSetor(10L, new CriarFazendaSetorRequest("Setor Sul", POLY_A));

		assertThat(resp.id()).isEqualTo(6L);
		ArgumentCaptor<FazendaSetor> captor = ArgumentCaptor.forClass(FazendaSetor.class);
		verify(setorRepository).save(captor.capture());
		assertThat(captor.getValue().getPoligonoGeojson()).isEqualTo(POLY_A);
	}

	@Test
	void criarSetor_rejeitaPoligonoSobrepostoAoutroSetor() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findByFazendaIdOrderByNomeAsc(99L))
				.thenReturn(List.of(setorCom(2L, "Vizinho", POLY_B_OVERLAP, fazenda)));

		assertThatThrownBy(() -> fazendaService.criarSetor(10L, new CriarFazendaSetorRequest("S", POLY_A)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
		verify(setorRepository, never()).save(any());
		verifyNoInteractions(notificacaoService);
	}

	@Test
	void criarSetor_rejeitaGeojsonTipoInvalido() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));

		assertThatThrownBy(() -> fazendaService.criarSetor(10L, new CriarFazendaSetorRequest("S", GEOJSON_NAO_POLYGON)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
		verify(setorRepository, never()).save(any());
	}

	@Test
	void criarSetor_rejeitaGeojsonMalformado() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));

		assertThatThrownBy(() -> fazendaService.criarSetor(10L, new CriarFazendaSetorRequest("S", GEOJSON_INVALIDO)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	@Test
	void criarSetor_rejeitaPoligonoComPoucosPontos() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));

		assertThatThrownBy(() -> fazendaService.criarSetor(10L, new CriarFazendaSetorRequest("S", POLY_POUCOS_PONTOS)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
	}

	// ---------------------------------------------------------------- atualizarSetor

	@Test
	void atualizarSetor_rejeitaUsuarioNaoGerente() {
		when(usuarioRepository.findById(20L)).thenReturn(Optional.of(produtor));

		assertThatThrownBy(() -> fazendaService.atualizarSetor(20L, 5L, new AtualizarFazendaSetorRequest("X", null)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
		verify(setorRepository, never()).findById(any());
	}

	@Test
	void atualizarSetor_rejeitaSetorInexistente() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findById(5L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> fazendaService.atualizarSetor(10L, 5L, new AtualizarFazendaSetorRequest("X", null)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
	}

	@Test
	void atualizarSetor_rejeitaSetorDeOutraFazenda() {
		Fazenda outra = new Fazenda();
		outra.setId(500L);
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findById(5L)).thenReturn(Optional.of(setorCom(5L, "S", null, outra)));

		assertThatThrownBy(() -> fazendaService.atualizarSetor(10L, 5L, new AtualizarFazendaSetorRequest("X", null)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
		verify(setorRepository, never()).save(any());
	}

	@Test
	void atualizarSetor_atualizaSetorComSucessoERegistraNotificacao() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findById(5L)).thenReturn(Optional.of(setor));
		when(setorRepository.findByFazendaIdOrderByNomeAsc(99L)).thenReturn(List.of(setor));
		when(setorRepository.save(any(FazendaSetor.class))).thenAnswer(inv -> inv.getArgument(0));

		var resp = fazendaService.atualizarSetor(10L, 5L, new AtualizarFazendaSetorRequest("  Novo Nome  ", POLY_A));

		ArgumentCaptor<FazendaSetor> captor = ArgumentCaptor.forClass(FazendaSetor.class);
		verify(setorRepository).save(captor.capture());
		assertThat(captor.getValue().getNome()).isEqualTo("Novo Nome");
		assertThat(captor.getValue().getPoligonoGeojson()).isEqualTo(POLY_A);
		assertThat(resp.id()).isEqualTo(5L);
		verify(notificacaoService).registrar(
				eq("SETOR_ATUALIZADO"), anyString(), anyString(), anyString(), eq("SETOR"), eq(5L), eq(99L));
	}

	@Test
	void atualizarSetor_rejeitaPoligonoSobrepostoAoutroSetor() {
		FazendaSetor outro = setorCom(8L, "Outro", POLY_B_OVERLAP, fazenda);
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findById(5L)).thenReturn(Optional.of(setor));
		when(setorRepository.findByFazendaIdOrderByNomeAsc(99L)).thenReturn(List.of(setor, outro));

		assertThatThrownBy(() -> fazendaService.atualizarSetor(10L, 5L, new AtualizarFazendaSetorRequest("S", POLY_A)))
				.satisfies(ex -> assertStatus(ex, HttpStatus.BAD_REQUEST));
		verify(setorRepository, never()).save(any());
	}

	@Test
	void atualizarSetor_permiteManterProprioPoligonoSemColisaoConsigo() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findById(5L)).thenReturn(Optional.of(setor));
		when(setorRepository.findByFazendaIdOrderByNomeAsc(99L)).thenReturn(List.of(setor));
		when(setorRepository.save(any(FazendaSetor.class))).thenAnswer(inv -> inv.getArgument(0));

		var resp = fazendaService.atualizarSetor(10L, 5L, new AtualizarFazendaSetorRequest("Mesmo", POLY_A));

		assertThat(resp.nome()).isEqualTo("Mesmo");
		verify(setorRepository).save(any(FazendaSetor.class));
	}

	// ---------------------------------------------------------------- removerSetor

	@Test
	void removerSetor_rejeitaUsuarioNaoGerente() {
		when(usuarioRepository.findById(20L)).thenReturn(Optional.of(produtor));

		assertThatThrownBy(() -> fazendaService.removerSetor(20L, 5L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
		verify(setorRepository, never()).delete(any());
	}

	@Test
	void removerSetor_rejeitaSetorInexistente() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findById(5L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> fazendaService.removerSetor(10L, 5L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.NOT_FOUND));
		verify(setorRepository, never()).delete(any());
	}

	@Test
	void removerSetor_rejeitaSetorDeOutraFazenda() {
		Fazenda outra = new Fazenda();
		outra.setId(500L);
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findById(5L)).thenReturn(Optional.of(setorCom(5L, "S", null, outra)));

		assertThatThrownBy(() -> fazendaService.removerSetor(10L, 5L))
				.satisfies(ex -> assertStatus(ex, HttpStatus.FORBIDDEN));
		verify(setorRepository, never()).delete(any());
		verifyNoInteractions(notificacaoService);
	}

	@Test
	void removerSetor_removeSetorERegistraNotificacao() {
		when(usuarioRepository.findById(10L)).thenReturn(Optional.of(gerente));
		when(fazendaRepository.findByGerenteUsuarioId(10L)).thenReturn(Optional.of(fazenda));
		when(setorRepository.findById(5L)).thenReturn(Optional.of(setor));

		fazendaService.removerSetor(10L, 5L);

		verify(setorRepository).delete(setor);
		verify(notificacaoService).registrar(
				eq("SETOR_REMOVIDO"), anyString(), anyString(), anyString(), eq("SETOR"), eq(5L), eq(99L));
	}
}
