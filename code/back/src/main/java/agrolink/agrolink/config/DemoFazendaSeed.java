package agrolink.agrolink.config;

import agrolink.agrolink.domain.Fazenda;
import agrolink.agrolink.domain.FazendaSetor;
import agrolink.agrolink.domain.Ocorrencia;
import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.repository.FazendaRepository;
import agrolink.agrolink.repository.FazendaSetorRepository;
import agrolink.agrolink.repository.OcorrenciaRepository;
import agrolink.agrolink.repository.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Popula a fazenda de demonstração ("Fazenda Demonstrativa AgroLink") quando o seed da equipe
 * já criou os usuários {@code @agrolink.demo}. Garante:
 * <ul>
 *   <li>Fazenda com perímetro próximo a Belo Horizonte (mesma referência do mapa front).</li>
 *   <li>3 setores com polígonos para popular o mapa e a tela de registro.</li>
 *   <li>Vínculo de equipe: gerente, produtor e funcionários de campo.</li>
 *   <li>12 ocorrências abertas com datas nos últimos 7 dias (incluindo hoje) para o dashboard.</li>
 *   <li>12 ocorrências resolvidas entre o início do ano e 20 de julho para relatórios e arquivados.</li>
 * </ul>
 *
 * <p>Operação idempotente: usa nomes únicos como chave; só cria itens ausentes. Controlado pela
 * mesma flag {@code agrolink.demo-seed} usada por {@link DemoTeamSeed} (ativa em {@code dev}).
 */
@Component
@Order(2)
public class DemoFazendaSeed implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(DemoFazendaSeed.class);

	private static final String FAZENDA_NOME = "Fazenda Demonstrativa AgroLink";
	private static final String GERENTE_EMAIL = "gerente1@agrolink.demo";
	private static final List<String> EMAILS_VINCULADOS = List.of(
			"produtor@agrolink.demo",
			"campo1@agrolink.demo",
			"campo2@agrolink.demo",
			"campo3@agrolink.demo",
			"campo4@agrolink.demo",
			"campo5@agrolink.demo");

	/**
	 * Centro aproximado do Parque das Mangabeiras (BH), usado como referência da fazenda demo —
	 * permite enxergar trechos verdes reais no satélite/OSM ao apresentar a aplicação.
	 */
	private static final double CENTRO_LAT = -19.9505;
	private static final double CENTRO_LNG = -43.9035;

	/** Perímetro irregular contornando o Parque das Mangabeiras (anel em [lat, lng]). */
	private static final double[][] PERIMETRO_PARQUE = {
			{ -19.9402, -43.9095 },
			{ -19.9408, -43.9020 },
			{ -19.9430, -43.8970 },
			{ -19.9475, -43.8945 },
			{ -19.9530, -43.8950 },
			{ -19.9582, -43.8985 },
			{ -19.9610, -43.9035 },
			{ -19.9595, -43.9085 },
			{ -19.9550, -43.9120 },
			{ -19.9490, -43.9130 },
			{ -19.9440, -43.9120 },
	};

	private static final double[][] POLIGONO_TALHAO_NORTE = {
			{ -19.9402, -43.9095 },
			{ -19.9408, -43.9020 },
			{ -19.9430, -43.8970 },
			{ -19.9475, -43.8970 },
			{ -19.9475, -43.9095 },
			{ -19.9440, -43.9120 },
	};

	private static final double[][] POLIGONO_TALHAO_SUL = {
			{ -19.9475, -43.9095 },
			{ -19.9475, -43.8970 },
			{ -19.9530, -43.8950 },
			{ -19.9560, -43.8985 },
			{ -19.9560, -43.9095 },
			{ -19.9550, -43.9120 },
			{ -19.9490, -43.9130 },
	};

	private static final double[][] POLIGONO_TALHAO_LESTE = {
			{ -19.9560, -43.8985 },
			{ -19.9582, -43.8985 },
			{ -19.9610, -43.9035 },
			{ -19.9595, -43.9085 },
			{ -19.9560, -43.9095 },
	};

	private final UsuarioRepository usuarios;
	private final FazendaRepository fazendas;
	private final FazendaSetorRepository setores;
	private final OcorrenciaRepository ocorrencias;
	private final boolean demoSeed;

	public DemoFazendaSeed(
			UsuarioRepository usuarios,
			FazendaRepository fazendas,
			FazendaSetorRepository setores,
			OcorrenciaRepository ocorrencias,
			@Value("${agrolink.demo-seed:false}") boolean demoSeed) {
		this.usuarios = usuarios;
		this.fazendas = fazendas;
		this.setores = setores;
		this.ocorrencias = ocorrencias;
		this.demoSeed = demoSeed;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (!demoSeed) {
			return;
		}
		Optional<Usuario> gerenteOpt = usuarios.findByEmailIgnoreCase(GERENTE_EMAIL);
		if (gerenteOpt.isEmpty()) {
			log.info("AGROLINK: fazenda demo — gerente {} não encontrado, ignorando.", GERENTE_EMAIL);
			return;
		}
		Usuario gerente = gerenteOpt.get();
		Fazenda fazenda = garantirFazenda(gerente);
		List<FazendaSetor> setoresAtuais = garantirSetores(fazenda);
		int vinculos = vincularEquipe(fazenda.getId());
		int ocorrenciasCriadas = garantirOcorrencias(fazenda, setoresAtuais);

		log.info(
				"AGROLINK: fazenda demo \"{}\" pronta (id={}). Setores: {} | Vínculos novos: {} | Ocorrências novas: {}.",
				fazenda.getNome(),
				fazenda.getId(),
				setoresAtuais.size(),
				vinculos,
				ocorrenciasCriadas);
	}

	private Fazenda garantirFazenda(Usuario gerente) {
		// Procura primeiro pela fazenda do gerente demo; se não houver, tenta pelo nome
		// (cobre o caso de banco antigo onde a fazenda demo ficou apontando para outro gerente).
		Fazenda existente = fazendas.findByGerenteUsuarioId(gerente.getId()).orElse(null);
		if (existente == null) {
			existente = fazendas.findAll().stream()
					.filter(f -> FAZENDA_NOME.equalsIgnoreCase(f.getNome()))
					.findFirst()
					.orElse(null);
		}
		String perimetroDesejado = geoJsonPoligono(PERIMETRO_PARQUE);
		if (existente != null) {
			boolean precisaSalvar = false;
			if (!FAZENDA_NOME.equals(existente.getNome())) {
				existente.setNome(FAZENDA_NOME);
				precisaSalvar = true;
			}
			if (!Objects.equals(existente.getGerenteUsuarioId(), gerente.getId())) {
				existente.setGerenteUsuarioId(gerente.getId());
				precisaSalvar = true;
			}
			if (!perimetroDesejado.equals(existente.getPerimetroGeojson())) {
				existente.setPerimetroGeojson(perimetroDesejado);
				precisaSalvar = true;
			}
			return precisaSalvar ? fazendas.save(existente) : existente;
		}
		Fazenda f = new Fazenda();
		f.setNome(FAZENDA_NOME);
		f.setGerenteUsuarioId(gerente.getId());
		f.setPerimetroGeojson(perimetroDesejado);
		return fazendas.save(f);
	}

	private List<FazendaSetor> garantirSetores(Fazenda fazenda) {
		List<SetorDemo> esperados = setoresEsperados();
		for (SetorDemo esperado : esperados) {
			List<FazendaSetor> atuais = setores.findByFazendaIdOrderByNomeAsc(fazenda.getId());
			FazendaSetor existente = atuais.stream()
					.filter(s -> s.getNome() != null && s.getNome().trim().equalsIgnoreCase(esperado.nome()))
					.findFirst()
					.orElse(null);
			String poligonoDesejado = geoJsonPoligono(esperado.poligono());
			if (existente != null) {
				if (!poligonoDesejado.equals(existente.getPoligonoGeojson())) {
					existente.setPoligonoGeojson(poligonoDesejado);
					setores.save(existente);
				}
				continue;
			}
			FazendaSetor s = new FazendaSetor();
			s.setFazenda(fazenda);
			s.setNome(esperado.nome());
			s.setPoligonoGeojson(poligonoDesejado);
			setores.save(s);
		}
		return setores.findByFazendaIdOrderByNomeAsc(fazenda.getId());
	}

	/**
	 * Garante que TODOS os e-mails demo estejam vinculados à fazenda demo, sobrescrevendo
	 * vínculos antigos (a outras fazendas). Também reativa a conta caso esteja desativada.
	 * Sem isso, num banco H2 antigo (clones, máquinas compartilhadas) os usuários demo
	 * podem ficar apontando para uma fazenda removida e a tela aparece vazia.
	 */
	private int vincularEquipe(Long fazendaId) {
		int vinculados = 0;
		for (String email : EMAILS_VINCULADOS) {
			Usuario u = usuarios.findByEmailIgnoreCase(email).orElse(null);
			if (u == null) {
				continue;
			}
			boolean precisaSalvar = false;
			if (!Objects.equals(u.getFazendaVinculoId(), fazendaId)) {
				u.setFazendaVinculoId(fazendaId);
				precisaSalvar = true;
			}
			if (!u.isAtivo()) {
				u.setAtivo(true);
				precisaSalvar = true;
			}
			if (precisaSalvar) {
				usuarios.save(u);
				vinculados++;
			}
		}
		return vinculados;
	}

	private int garantirOcorrencias(Fazenda fazenda, List<FazendaSetor> setoresFazenda) {
		// Busca ocorrências demo pelo título em TODO o banco (não apenas nos setores atuais)
		// para também migrar registros que ficaram presos a setores antigos / órfãos.
		List<Ocorrencia> existentes = ocorrencias.findAll();

		List<OcorrenciaDemo> exemplos = new ArrayList<>(ocorrenciasAbertasApresentacao());
		exemplos.addAll(ocorrenciasResolvidasApresentacao());
		Set<String> titulosEsperados = exemplos.stream()
				.map(d -> d.titulo().toLowerCase(Locale.ROOT))
				.collect(Collectors.toCollection(HashSet::new));
		Set<Long> setoresDemoIds = setoresFazenda.stream()
				.map(FazendaSetor::getId)
				.collect(Collectors.toCollection(HashSet::new));
		FazendaSetor setorNorte = procurarSetor(setoresFazenda, "Talhão Norte");
		FazendaSetor setorSul = procurarSetor(setoresFazenda, "Talhão Sul");
		FazendaSetor setorLeste = procurarSetor(setoresFazenda, "Talhão Leste");
		if (setorNorte == null || setorSul == null || setorLeste == null) {
			return 0;
		}

		List<Ocorrencia> paraRemover = new ArrayList<>();
		for (Ocorrencia antiga : existentes) {
			if (antiga.getSetorFazendaId() != null
					&& setoresDemoIds.contains(antiga.getSetorFazendaId())
					&& (antiga.getTitulo() == null
							|| !titulosEsperados.contains(antiga.getTitulo().toLowerCase(Locale.ROOT)))) {
				paraRemover.add(antiga);
			}
		}
		for (Ocorrencia antiga : paraRemover) {
			ocorrencias.delete(antiga);
		}
		int removidas = paraRemover.size();
		if (removidas > 0) {
			log.info("AGROLINK: fazenda demo — {} ocorrência(s) antiga(s) removida(s).", removidas);
		}

		int criadas = 0;
		for (OcorrenciaDemo demo : exemplos) {
			FazendaSetor setor = switch (demo.setor()) {
				case "norte" -> setorNorte;
				case "sul" -> setorSul;
				case "leste" -> setorLeste;
				default -> setorNorte;
			};
			double[] coord = demo.coord();
			Ocorrencia existente = existentes.stream()
					.filter(o -> o.getTitulo() != null && o.getTitulo().equalsIgnoreCase(demo.titulo()))
					.findFirst()
					.orElse(null);
			if (existente != null) {
				// Garante que ocorrências antigas migrem para o setor/coords/status/datas corretos da demo.
				boolean precisaSalvar = false;
				String horarioDesejado = demo.horarioIso();
				if (!Objects.equals(existente.getSetorFazendaId(), setor.getId())) {
					existente.setSetorFazendaId(setor.getId());
					existente.setSetor(setor.getNome());
					precisaSalvar = true;
				}
				if (!demo.status().equalsIgnoreCase(String.valueOf(existente.getStatus()))) {
					existente.setStatus(demo.status());
					precisaSalvar = true;
				}
				if (!horarioDesejado.equals(existente.getHorario())) {
					existente.setHorario(horarioDesejado);
					precisaSalvar = true;
				}
				if (existente.getCoordsY() == null || Math.abs(existente.getCoordsY() - coord[0]) > 1e-6) {
					existente.setCoordsY(coord[0]);
					precisaSalvar = true;
				}
				if (existente.getCoordsX() == null || Math.abs(existente.getCoordsX() - coord[1]) > 1e-6) {
					existente.setCoordsX(coord[1]);
					precisaSalvar = true;
				}
				if (precisaSalvar) {
					ocorrencias.save(existente);
				}
				continue;
			}
			Ocorrencia o = new Ocorrencia();
			o.setTitulo(demo.titulo());
			o.setSetor(setor.getNome());
			o.setSetorFazendaId(setor.getId());
			o.setCategoria(demo.categoria());
			o.setPrioridade(demo.prioridade());
			o.setDescricao(demo.descricao());
			o.setCoordsY(coord[0]);
			o.setCoordsX(coord[1]);
			o.setHorario(demo.horarioIso());
			o.setStatus(demo.status());
			o.setComentarios(null);
			o.setImagens(null);
			ocorrencias.save(o);
			criadas++;
		}
		return criadas;
	}

	private static FazendaSetor procurarSetor(List<FazendaSetor> lista, String nome) {
		return lista.stream()
				.filter(s -> s.getNome() != null && s.getNome().equalsIgnoreCase(nome))
				.findFirst()
				.orElse(null);
	}

	private static List<SetorDemo> setoresEsperados() {
		return List.of(
				new SetorDemo("Talhão Norte", POLIGONO_TALHAO_NORTE),
				new SetorDemo("Talhão Sul", POLIGONO_TALHAO_SUL),
				new SetorDemo("Talhão Leste", POLIGONO_TALHAO_LESTE));
	}

	/**
	 * 12 ocorrências abertas com horários relativos à subida do backend — aparecem em
	 * "Hoje" (últimas 24 h) e "Esta semana" (últimos 7 dias) no dashboard.
	 */
	private static List<OcorrenciaDemo> ocorrenciasAbertasApresentacao() {
		Instant agora = Instant.now();
		return List.of(
				new OcorrenciaDemo(
						"Foco de pragas na borda do talhão",
						"norte",
						"PRAGA",
						"ALTA",
						"ABERTA",
						"Identificada infestação localizada nas plantas próximas à divisa norte. Solicitar inspeção fitossanitária.",
						new double[] { -19.9425, -43.9020 },
						horarioIso(agora.minus(2, ChronoUnit.HOURS))),
				new OcorrenciaDemo(
						"Cerca rompida próxima ao acesso",
						"norte",
						"CERCA",
						"MEDIA",
						"ABERTA",
						"Cerca caída em ~6 m após a chuva. Risco de fuga de animais.",
						new double[] { -19.9460, -43.9080 },
						horarioIso(agora.minus(6, ChronoUnit.HOURS))),
				new OcorrenciaDemo(
						"Princípio de incêndio em palhada",
						"sul",
						"INCENDIO",
						"URGENTE",
						"ABERTA",
						"Foco isolado de fogo em palhada seca. Equipe acionada e contenção em andamento.",
						new double[] { -19.9540, -43.9070 },
						horarioIso(agora.minus(11, ChronoUnit.HOURS))),
				new OcorrenciaDemo(
						"Vazamento em mangueira de irrigação",
						"leste",
						"INFRAESTRUTURA",
						"ALTA",
						"ABERTA",
						"Mangueira com furo na linha principal; vazamento contido provisoriamente.",
						new double[] { -19.9585, -43.9055 },
						horarioIso(agora.minus(20, ChronoUnit.HOURS))),
				new OcorrenciaDemo(
						"Animal solto na divisa sul",
						"sul",
						"CERCA",
						"ALTA",
						"ABERTA",
						"Bovino avistado fora do piquete sul; equipe de campo acionada.",
						new double[] { -19.9515, -43.9085 },
						horarioIso(agora.minus(1, ChronoUnit.DAYS).minus(4, ChronoUnit.HOURS))),
				new OcorrenciaDemo(
						"Erosão em curva de nível",
						"sul",
						"SOLO",
						"BAIXA",
						"ABERTA",
						"Pequena erosão em curva de nível após escoamento da última chuva. Avaliar reforço.",
						new double[] { -19.9505, -43.9020 },
						horarioIso(agora.minus(2, ChronoUnit.DAYS).minus(2, ChronoUnit.HOURS))),
				new OcorrenciaDemo(
						"Infestação de lagarta no talhão norte",
						"norte",
						"PRAGA",
						"MEDIA",
						"ABERTA",
						"Lagarta-do-cartucho em estágio inicial; monitoramento diário recomendado.",
						new double[] { -19.9435, -43.9055 },
						horarioIso(agora.minus(3, ChronoUnit.DAYS).minus(1, ChronoUnit.HOURS))),
				new OcorrenciaDemo(
						"Manutenção do galpão de máquinas",
						"leste",
						"MANUTENCAO",
						"MEDIA",
						"ABERTA",
						"Telhado com infiltração; agendar reparo antes da próxima estação chuvosa.",
						new double[] { -19.9575, -43.9020 },
						horarioIso(agora.minus(4, ChronoUnit.DAYS).minus(3, ChronoUnit.HOURS))),
				new OcorrenciaDemo(
						"Falha no sensor de umidade",
						"norte",
						"INFRAESTRUTURA",
						"MEDIA",
						"ABERTA",
						"Sensor do talhão norte sem leitura há 12 h; verificar alimentação e cabo.",
						new double[] { -19.9448, -43.9015 },
						horarioIso(agora.minus(5, ChronoUnit.DAYS).minus(5, ChronoUnit.HOURS))),
				new OcorrenciaDemo(
						"Porteira destravada no acesso leste",
						"leste",
						"CERCA",
						"BAIXA",
						"ABERTA",
						"Porteira não trava corretamente; substituir trinco antes do fim de semana.",
						new double[] { -19.9598, -43.9030 },
						horarioIso(agora.minus(5, ChronoUnit.DAYS).minus(10, ChronoUnit.HOURS))),
				new OcorrenciaDemo(
						"Acúmulo de água na estrada interna",
						"sul",
						"SOLO",
						"MEDIA",
						"ABERTA",
						"Poça persistente após chuva; risco de atolamento para veículos leves.",
						new double[] { -19.9535, -43.9005 },
						horarioIso(agora.minus(6, ChronoUnit.DAYS).minus(2, ChronoUnit.HOURS))),
				new OcorrenciaDemo(
						"Trecho de cerca caído após vento",
						"norte",
						"CERCA",
						"MEDIA",
						"ABERTA",
						"~4 m de cerca derrubados pelo vento forte de ontem à noite.",
						new double[] { -19.9410, -43.9075 },
						horarioIso(agora.minus(6, ChronoUnit.DAYS).minus(14, ChronoUnit.HOURS))));
	}

	/**
	 * 12 ocorrências resolvidas entre 1º de janeiro e 20 de julho do ano corrente —
	 * alimentam relatórios, KPIs e o filtro "Arquivados" do dashboard.
	 */
	private static List<OcorrenciaDemo> ocorrenciasResolvidasApresentacao() {
		int ano = LocalDate.now(ZoneOffset.UTC).getYear();
		return List.of(
				new OcorrenciaDemo(
						"Calagem do talhão Sul concluída",
						"sul",
						"SOLO",
						"BAIXA",
						"RESOLVIDA",
						"Calagem aplicada conforme análise de solo do trimestre.",
						new double[] { -19.9485, -43.9060 },
						horarioDia(ano, 1, 12, 7, 30)),
				new OcorrenciaDemo(
						"Formiga-cortadeira neutralizada",
						"norte",
						"PRAGA",
						"ALTA",
						"RESOLVIDA",
						"Formigueiro tratado; monitoramento sem reinfestação por 72 h.",
						new double[] { -19.9465, -43.9030 },
						horarioDia(ano, 1, 28, 12, 10)),
				new OcorrenciaDemo(
						"Troca de rolamento no trator",
						"leste",
						"MANUTENCAO",
						"MEDIA",
						"RESOLVIDA",
						"Rolamento dianteiro substituído; trator liberado para operação.",
						new double[] { -19.9600, -43.9045 },
						horarioDia(ano, 2, 14, 14, 0)),
				new OcorrenciaDemo(
						"Porteira de acesso reforçada",
						"sul",
						"CERCA",
						"MEDIA",
						"RESOLVIDA",
						"Porteira reforçada com trava reforçada e dobradiças novas.",
						new double[] { -19.9545, -43.9100 },
						horarioDia(ano, 2, 25, 8, 30)),
				new OcorrenciaDemo(
						"Pulverização preventiva aplicada",
						"norte",
						"PRAGA",
						"MEDIA",
						"RESOLVIDA",
						"Aplicação preventiva concluída conforme calendário fitossanitário.",
						new double[] { -19.9415, -43.9040 },
						horarioDia(ano, 3, 18, 7, 45)),
				new OcorrenciaDemo(
						"Sensor de umidade recalibrado",
						"norte",
						"INFRAESTRUTURA",
						"BAIXA",
						"RESOLVIDA",
						"Sensor recalibrado e leituras validadas com estação de referência.",
						new double[] { -19.9445, -43.9000 },
						horarioDia(ano, 4, 5, 16, 0)),
				new OcorrenciaDemo(
						"Reparo de cerca elétrica",
						"norte",
						"CERCA",
						"ALTA",
						"RESOLVIDA",
						"Fio rompido reparado e isoladores substituídos na divisa norte.",
						new double[] { -19.9450, -43.9050 },
						horarioDia(ano, 4, 22, 10, 15)),
				new OcorrenciaDemo(
						"Desobstrução de acequia",
						"sul",
						"SOLO",
						"MEDIA",
						"RESOLVIDA",
						"Acequia principal desobstruída; escoamento restabelecido.",
						new double[] { -19.9520, -43.8990 },
						horarioDia(ano, 5, 9, 11, 30)),
				new OcorrenciaDemo(
						"Extintores recarregados no galpão",
						"leste",
						"INCENDIO",
						"ALTA",
						"RESOLVIDA",
						"Extintores recarregados e laudo de conformidade arquivado.",
						new double[] { -19.9592, -43.9005 },
						horarioDia(ano, 5, 27, 13, 0)),
				new OcorrenciaDemo(
						"Limpeza de drenagem concluída",
						"sul",
						"SOLO",
						"BAIXA",
						"RESOLVIDA",
						"Canaletas desobstruídas após acúmulo de sedimento na chuva.",
						new double[] { -19.9510, -43.9040 },
						horarioDia(ano, 6, 14, 15, 20)),
				new OcorrenciaDemo(
						"Reservatório de água com vazamento",
						"leste",
						"INFRAESTRUTURA",
						"ALTA",
						"RESOLVIDA",
						"Vazamento na tubulação de saída foi corrigido pela equipe de campo.",
						new double[] { -19.9590, -43.9060 },
						horarioDia(ano, 7, 8, 10, 0)),
				new OcorrenciaDemo(
						"Válvula de irrigação substituída",
						"leste",
						"INFRAESTRUTURA",
						"MEDIA",
						"RESOLVIDA",
						"Válvula danificada trocada; pressão normalizada no setor leste.",
						new double[] { -19.9580, -43.9010 },
						horarioDia(ano, 7, 18, 13, 30)));
	}

	private static String horarioIso(Instant instant) {
		return instant.toString();
	}

	private static String horarioDia(int ano, int mes, int dia, int hora, int minuto) {
		return LocalDate.of(ano, mes, dia)
				.atTime(hora, minuto)
				.toInstant(ZoneOffset.UTC)
				.toString();
	}

	private static String geoJsonPoligono(double[][] anel) {
		StringBuilder sb = new StringBuilder();
		sb.append("{\"type\":\"Polygon\",\"coordinates\":[[");
		for (int i = 0; i < anel.length; i++) {
			double lat = anel[i][0];
			double lng = anel[i][1];
			sb.append('[').append(formatNumero(lng)).append(',').append(formatNumero(lat)).append(']');
			sb.append(',');
		}
		// Fecha o anel repetindo o primeiro ponto.
		sb.append('[').append(formatNumero(anel[0][1])).append(',').append(formatNumero(anel[0][0])).append(']');
		sb.append("]]}");
		return sb.toString();
	}

	private static String formatNumero(double v) {
		return String.format(Locale.ROOT, "%.6f", v);
	}

	private record SetorDemo(String nome, double[][] poligono) {}

	/** Demo. {@code horarioIso} = instante UTC (ISO-8601) do evento registrado. */
	private record OcorrenciaDemo(
			String titulo,
			String setor,
			String categoria,
			String prioridade,
			String status,
			String descricao,
			double[] coord,
			String horarioIso) {}
}
