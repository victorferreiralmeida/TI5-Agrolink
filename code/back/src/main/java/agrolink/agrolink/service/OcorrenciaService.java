package agrolink.agrolink.service;

import agrolink.agrolink.domain.Fazenda;
import agrolink.agrolink.domain.FazendaSetor;
import agrolink.agrolink.domain.Ocorrencia;
import agrolink.agrolink.domain.PapelUsuario;
import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.dto.ComentarioLinhaJson;
import agrolink.agrolink.dto.ComentarioRequest;
import agrolink.agrolink.dto.OcorrenciaRequest;
import agrolink.agrolink.dto.OcorrenciaResponse;
import agrolink.agrolink.repository.FazendaRepository;
import agrolink.agrolink.repository.FazendaSetorRepository;
import agrolink.agrolink.repository.OcorrenciaRepository;
import agrolink.agrolink.repository.UsuarioRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Service
public class OcorrenciaService {
	private static final Set<String> PRIORIDADES_VALIDAS = Set.of("BAIXA", "MEDIA", "ALTA", "URGENTE");
	private static final Set<String> STATUS_VALIDOS = Set.of("ABERTA", "RESOLVIDA");
	private static final Set<String> CONTENT_TYPES_PERMITIDOS = Set.of(
			"image/jpeg",
			"image/jpg",
			"image/pjpeg",
			"image/png",
			"image/webp",
			"image/gif"
	);
	/**
	 * Extensões aceitas como fallback quando o cliente envia Content-Type vazio ou
	 * {@code application/octet-stream} — comum em uploads do app mobile.
	 */
	private static final Set<String> EXTENSOES_PERMITIDAS = Set.of(
			".jpg", ".jpeg", ".png", ".webp", ".gif"
	);
	private static final int MAX_IMAGENS_POR_OCORRENCIA = 6;
	private static final int MAX_IMAGENS_POR_COMENTARIO = 3;
	private static final long MAX_TAMANHO_IMAGEM_BYTES = 10L * 1024L * 1024L;
	private static final Path UPLOAD_ROOT = Path.of("uploads", "ocorrencias");

	private static final ObjectMapper COMENTARIO_JSON = new ObjectMapper();

	private final OcorrenciaRepository ocorrenciaRepository;
	private final FazendaSetorRepository fazendaSetorRepository;
	private final FazendaRepository fazendaRepository;
	private final NotificacaoService notificacaoService;
	private final UsuarioRepository usuarioRepository;

	public OcorrenciaService(
			OcorrenciaRepository ocorrenciaRepository,
			FazendaSetorRepository fazendaSetorRepository,
			FazendaRepository fazendaRepository,
			NotificacaoService notificacaoService,
			UsuarioRepository usuarioRepository) {
		this.ocorrenciaRepository = ocorrenciaRepository;
		this.fazendaSetorRepository = fazendaSetorRepository;
		this.fazendaRepository = fazendaRepository;
		this.notificacaoService = notificacaoService;
		this.usuarioRepository = usuarioRepository;
	}

	public List<Ocorrencia> listarVisivelPara(long usuarioId) {
		return listarVisivelPara(usuarioId, null);
	}

	public List<Ocorrencia> listarVisivelPara(long usuarioId, Instant since) {
		Optional<Long> fazendaId = resolverFazendaDoUsuario(usuarioId);
		if (fazendaId.isEmpty()) {
			return List.of();
		}
		List<Long> setorIds = fazendaSetorRepository.findByFazendaIdOrderByNomeAsc(fazendaId.get()).stream()
				.map(FazendaSetor::getId)
				.toList();
		if (setorIds.isEmpty()) {
			return List.of();
		}
		if (since != null) {
			return ocorrenciaRepository.findBySetorFazendaIdInAndUpdatedAtAfter(setorIds, since);
		}
		return ocorrenciaRepository.findBySetorFazendaIdIn(setorIds);
	}

	public Optional<Ocorrencia> buscarSeVisivel(long id, long usuarioId) {
		return buscarPorId(id).filter(o -> podeVisualizar(usuarioId, o));
	}

	public Optional<Ocorrencia> buscarPorId(Long id) {
		return ocorrenciaRepository.findById(id);
	}

	public OcorrenciaResponse asResponse(Ocorrencia o) {
		Long rid = o.getResponsavelId();
		String nome = null;
		if (rid != null) {
			nome = usuarioRepository.findById(rid).map(Usuario::getNome).orElse(null);
		}
		return OcorrenciaResponse.from(o, nome);
	}

	/**
	 * Versão em lote de {@link #asResponse(Ocorrencia)}: carrega os nomes de todos os
	 * responsáveis em uma única consulta, evitando o N+1 ao montar a listagem.
	 */
	public List<OcorrenciaResponse> asResponseList(List<Ocorrencia> ocorrencias) {
		if (ocorrencias.isEmpty()) {
			return List.of();
		}
		List<Long> responsavelIds = ocorrencias.stream()
				.map(Ocorrencia::getResponsavelId)
				.filter(Objects::nonNull)
				.distinct()
				.toList();
		Map<Long, String> nomesPorId = responsavelIds.isEmpty()
				? Map.of()
				: usuarioRepository.findAllById(responsavelIds).stream()
						.collect(Collectors.toMap(Usuario::getId, Usuario::getNome));
		return ocorrencias.stream()
				.map(o -> {
					Long rid = o.getResponsavelId();
					return OcorrenciaResponse.from(o, rid == null ? null : nomesPorId.get(rid));
				})
				.toList();
	}

	public Ocorrencia criar(OcorrenciaRequest req, long usuarioId) {
		if (StringUtils.hasText(req.clientUuid())) {
			var existente = ocorrenciaRepository.findByClientUuid(req.clientUuid().trim());
			if (existente.isPresent()) {
				return existente.get();
			}
		}
		validarCoordenadas(req.coordsX(), req.coordsY());
		Long fazendaId = resolverFazendaDoUsuario(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
						"Cadastre sua fazenda (gerente) ou aceite um convite de equipe para registrar ocorrências."));
		validarSetorPertenceAFazenda(req, fazendaId);
		Ocorrencia o = new Ocorrencia();
		aplicarRequest(o, req);
		o.setHorario(normalizarHorario(req.horario()));
		o.setStatus("ABERTA");
		o.setComentarios(null);
		o.setImagens(null);
		if (StringUtils.hasText(req.clientUuid())) {
			o.setClientUuid(req.clientUuid().trim());
		}
		Ocorrencia salva = ocorrenciaRepository.save(o);
		notificacaoService.registrar(
				"OCORRENCIA_NOVA",
				"Nova ocorrência",
				"Nova ocorrência registrada",
				salva.getTitulo(),
				"OCORRENCIA",
				salva.getId(),
				fazendaIdDaOcorrencia(salva));
		return salva;
	}

	public Ocorrencia atualizar(Long id, OcorrenciaRequest req, long usuarioId) {
		validarCoordenadas(req.coordsX(), req.coordsY());
		Long fazendaId = resolverFazendaDoUsuario(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
						"Cadastre sua fazenda ou vincule-se a uma fazenda para editar ocorrências."));
		Ocorrencia o = ocorrenciaRepository.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência não encontrada."));
		assertPodeVisualizar(usuarioId, o);
		validarSetorPertenceAFazenda(req, fazendaId);
		aplicarRequest(o, req);
		Ocorrencia salva = ocorrenciaRepository.save(o);
		notificacaoService.registrar(
				"OCORRENCIA_ATUALIZADA",
				"Ocorrência",
				"Ocorrência atualizada",
				salva.getTitulo(),
				"OCORRENCIA",
				salva.getId(),
				fazendaIdDaOcorrencia(salva));
		return salva;
	}

	public void deletar(Long id, long usuarioId) {
		var opt = ocorrenciaRepository.findById(id);
		if (opt.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência não encontrada.");
		}
		assertPodeVisualizar(usuarioId, opt.get());
		Long fazendaId = fazendaIdDaOcorrencia(opt.get());
		String titulo = opt.get().getTitulo();
		ocorrenciaRepository.deleteById(id);
		notificacaoService.registrar(
				"OCORRENCIA_EXCLUIDA",
				"Exclusão",
				"Ocorrência removida",
				titulo,
				"OCORRENCIA",
				id,
				fazendaId);
	}

	public Ocorrencia resolver(Long id, long usuarioId) {
		Ocorrencia o = ocorrenciaRepository.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência não encontrada."));
		assertPodeVisualizar(usuarioId, o);
		o.setStatus("RESOLVIDA");
		Ocorrencia salva = ocorrenciaRepository.save(o);
		notificacaoService.registrar(
				"OCORRENCIA_RESOLVIDA",
				"Status",
				"Ocorrência resolvida",
				salva.getTitulo(),
				"OCORRENCIA",
				salva.getId(),
				fazendaIdDaOcorrencia(salva));
		return salva;
	}

	public Ocorrencia comentar(Long id, ComentarioRequest req, long usuarioLogadoId) {
		Ocorrencia o = ocorrenciaRepository.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência não encontrada."));
		assertPodeVisualizar(usuarioLogadoId, o);
		var texto = req.texto().trim();
		final String linha;
		final String autorNotificacao;
		Usuario u = usuarioRepository.findById(usuarioLogadoId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sessão inválida."));
		var foto = u.getFotoUrl();
		var cj = new ComentarioLinhaJson(
				Instant.now().toString(),
				u.getNome(),
				u.getEmail(),
				StringUtils.hasText(foto) ? foto : null,
				texto,
				null);
		try {
			linha = COMENTARIO_JSON.writeValueAsString(cj);
		} catch (JsonProcessingException e) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Falha ao gravar comentário.");
		}
		autorNotificacao = u.getNome();
		if (o.getComentarios() == null || o.getComentarios().isBlank()) {
			o.setComentarios(linha);
		} else {
			o.setComentarios(o.getComentarios() + "\n" + linha);
		}
		Ocorrencia salva = ocorrenciaRepository.save(o);
		notificacaoService.registrar(
				"OCORRENCIA_COMENTARIO",
				"Comentário",
				"Novo comentário na ocorrência",
				autorNotificacao + ": " + texto,
				"OCORRENCIA",
				salva.getId(),
				fazendaIdDaOcorrencia(salva));
		return salva;
	}

	/**
	 * Comentário com imagens (multipart). Exige sessão autenticada.
	 */
	public Ocorrencia comentarComArquivos(Long id, String texto, List<MultipartFile> files, long usuarioLogadoId) {
		Ocorrencia o = ocorrenciaRepository.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência não encontrada."));
		assertPodeVisualizar(usuarioLogadoId, o);
		var textoLimpo = texto == null ? "" : texto.trim();
		var anexos = persistirAnexosComentario(id, files);
		if (textoLimpo.isEmpty() && anexos.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Envie texto ou imagens.");
		}
		Usuario u = usuarioRepository.findById(usuarioLogadoId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sessão inválida."));
		var foto = u.getFotoUrl();
		var listaAnexos = anexos.isEmpty() ? null : anexos;
		var mensagemTexto = textoLimpo.isEmpty() ? "(anexo)" : textoLimpo;
		var cj = new ComentarioLinhaJson(
				Instant.now().toString(),
				u.getNome(),
				u.getEmail(),
				StringUtils.hasText(foto) ? foto : null,
				mensagemTexto,
				listaAnexos);
		final String linha;
		try {
			linha = COMENTARIO_JSON.writeValueAsString(cj);
		} catch (JsonProcessingException e) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Falha ao gravar comentário.");
		}
		if (o.getComentarios() == null || o.getComentarios().isBlank()) {
			o.setComentarios(linha);
		} else {
			o.setComentarios(o.getComentarios() + "\n" + linha);
		}
		Ocorrencia salva = ocorrenciaRepository.save(o);
		notificacaoService.registrar(
				"OCORRENCIA_COMENTARIO",
				"Comentário",
				"Novo comentário na ocorrência",
				u.getNome() + ": " + mensagemTexto,
				"OCORRENCIA",
				salva.getId(),
				fazendaIdDaOcorrencia(salva));
		return salva;
	}

	public Ocorrencia autoAtribuirResponsavel(Long ocorrenciaId, long usuarioId) {
		Usuario u = usuarioRepository.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado."));
		if (u.getPapel() != PapelUsuario.FUNCIONARIO_CAMPO && u.getPapel() != PapelUsuario.GERENTE) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Apenas funcionários de campo ou gerentes podem assumir uma ocorrência.");
		}
		Ocorrencia o = ocorrenciaRepository.findById(ocorrenciaId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência não encontrada."));
		assertPodeVisualizar(usuarioId, o);
		Long atual = o.getResponsavelId();
		if (atual != null && !atual.equals(usuarioId)) {
			// Gerente pode reassumir mesmo com outro responsável; funcionário de campo não.
			if (u.getPapel() != PapelUsuario.GERENTE) {
				throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um responsável. Peça ao gerente para alterar.");
			}
		}
		o.setResponsavelId(usuarioId);
		Ocorrencia salva = ocorrenciaRepository.save(o);
		notificacaoService.registrar(
				"OCORRENCIA_ATRIBUIDA",
				"Atribuição",
				"Ocorrência assumida",
				u.getNome() + " assumiu: " + salva.getTitulo(),
				"OCORRENCIA",
				salva.getId(),
				fazendaIdDaOcorrencia(salva));
		return salva;
	}

	/**
	 * Define (ou remove) o responsável de uma ocorrência. Permitido para
	 * {@link PapelUsuario#GERENTE} e {@link PapelUsuario#PRODUTOR} — ambos podem
	 * delegar tarefas a um {@link PapelUsuario#FUNCIONARIO_CAMPO} da fazenda.
	 */
	public Ocorrencia definirResponsavelGerente(Long ocorrenciaId, Long alvoUsuarioId, long gerenteId) {
		Usuario gerente = usuarioRepository.findById(gerenteId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado."));
		if (gerente.getPapel() != PapelUsuario.GERENTE && gerente.getPapel() != PapelUsuario.PRODUTOR) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN,
					"Apenas gerente ou produtor podem atribuir ocorrências a outros membros.");
		}
		Ocorrencia o = ocorrenciaRepository.findById(ocorrenciaId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência não encontrada."));
		assertPodeVisualizar(gerenteId, o);
		Long fazendaOcorrencia = fazendaIdDaOcorrencia(o);
		String msg;
		if (alvoUsuarioId == null) {
			o.setResponsavelId(null);
			msg = "Responsável removido: " + o.getTitulo();
		} else {
			Usuario alvo = usuarioRepository.findById(alvoUsuarioId)
					.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Funcionário não encontrado."));
			if (alvo.getPapel() != PapelUsuario.FUNCIONARIO_CAMPO) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Atribua apenas a funcionários de campo.");
			}
			if (alvo.getFazendaVinculoId() == null || !alvo.getFazendaVinculoId().equals(fazendaOcorrencia)) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O funcionário não pertence à equipe desta fazenda.");
			}
			o.setResponsavelId(alvoUsuarioId);
			msg = "Atribuído a " + alvo.getNome() + ": " + o.getTitulo();
		}
		Ocorrencia salva = ocorrenciaRepository.save(o);
		notificacaoService.registrar(
				"OCORRENCIA_ATRIBUIDA",
				"Atribuição",
				alvoUsuarioId == null ? "Ocorrência sem responsável" : "Ocorrência atribuída",
				msg,
				"OCORRENCIA",
				salva.getId(),
				fazendaIdDaOcorrencia(salva));
		return salva;
	}

	private List<String> persistirAnexosComentario(Long ocorrenciaId, List<MultipartFile> files) {
		if (files == null || files.isEmpty()) {
			return List.of();
		}
		var selecionadas = files.stream().filter(f -> f != null && !f.isEmpty()).limit(MAX_IMAGENS_POR_COMENTARIO).toList();
		if (selecionadas.isEmpty()) {
			return List.of();
		}
		var urls = new java.util.ArrayList<String>();
		try {
			Path pastaOcorrencia = UPLOAD_ROOT.resolve(String.valueOf(ocorrenciaId)).normalize();
			Files.createDirectories(pastaOcorrencia);
			for (MultipartFile file : selecionadas) {
				validarImagem(file);
				String ext = extrairExtensao(file.getOriginalFilename());
				String nome = "cmt-" + System.nanoTime() + "-" + Math.abs(file.hashCode()) + ext;
				Path destino = pastaOcorrencia.resolve(nome).normalize();
				Files.copy(file.getInputStream(), destino, StandardCopyOption.REPLACE_EXISTING);
				urls.add("/uploads/ocorrencias/" + ocorrenciaId + "/" + nome);
			}
		} catch (IOException e) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Falha ao salvar anexos do comentário.");
		}
		return urls;
	}

	public Ocorrencia adicionarImagens(Long id, List<MultipartFile> files, long usuarioId) {
		Ocorrencia o = ocorrenciaRepository.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência não encontrada."));
		assertPodeVisualizar(usuarioId, o);
		if (files == null || files.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Envie ao menos uma imagem.");
		}

		var atuais = lerImagens(o);
		if (atuais.size() >= MAX_IMAGENS_POR_OCORRENCIA) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limite de imagens já atingido.");
		}
		int vagas = MAX_IMAGENS_POR_OCORRENCIA - atuais.size();
		var selecionadas = files.stream().filter(f -> f != null && !f.isEmpty()).limit(vagas).toList();
		if (selecionadas.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nenhuma imagem válida para envio.");
		}

		try {
			Path pastaOcorrencia = UPLOAD_ROOT.resolve(String.valueOf(id)).normalize();
			Files.createDirectories(pastaOcorrencia);
			for (MultipartFile file : selecionadas) {
				validarImagem(file);
				String ext = extrairExtensao(file.getOriginalFilename());
				String nome = "img-" + System.currentTimeMillis() + "-" + Math.abs(file.hashCode()) + ext;
				Path destino = pastaOcorrencia.resolve(nome).normalize();
				Files.copy(file.getInputStream(), destino, StandardCopyOption.REPLACE_EXISTING);
				atuais.add("/uploads/ocorrencias/" + id + "/" + nome);
			}
		} catch (IOException e) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Falha ao salvar imagens.");
		}

		o.setImagens(String.join("\n", atuais));
		Ocorrencia salva = ocorrenciaRepository.save(o);
		notificacaoService.registrar(
				"OCORRENCIA_IMAGENS",
				"Anexos",
				"Imagens adicionadas à ocorrência",
				salva.getTitulo(),
				"OCORRENCIA",
				salva.getId(),
				fazendaIdDaOcorrencia(salva));
		return salva;
	}

	private Optional<Long> resolverFazendaDoUsuario(long usuarioId) {
		Usuario u = usuarioRepository.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (!u.isAtivo()) {
			return Optional.empty();
		}
		if (u.getPapel() == PapelUsuario.GERENTE) {
			return fazendaRepository.findByGerenteUsuarioId(usuarioId).map(Fazenda::getId);
		}
		if (u.getFazendaVinculoId() != null) {
			return Optional.of(u.getFazendaVinculoId());
		}
		return Optional.empty();
	}

	private boolean podeVisualizar(long usuarioId, Ocorrencia o) {
		Optional<Long> fid = resolverFazendaDoUsuario(usuarioId);
		if (fid.isEmpty()) {
			return false;
		}
		Long occF = fazendaIdDaOcorrencia(o);
		return occF != null && occF.equals(fid.get());
	}

	private void assertPodeVisualizar(long usuarioId, Ocorrencia o) {
		if (!podeVisualizar(usuarioId, o)) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência não encontrada.");
		}
	}

	private void validarSetorPertenceAFazenda(OcorrenciaRequest req, Long fazendaId) {
		if (req.setorId() == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione um setor cadastrado na sua fazenda.");
		}
		var setor = fazendaSetorRepository.findById(req.setorId())
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Setor cadastrado inválido."));
		if (!setor.getFazenda().getId().equals(fazendaId)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Setor não pertence à sua fazenda.");
		}
	}

	private Long fazendaIdDaOcorrencia(Ocorrencia o) {
		Long sid = o.getSetorFazendaId();
		if (sid == null) {
			return null;
		}
		return fazendaSetorRepository.findById(sid).map(s -> s.getFazenda().getId()).orElse(null);
	}

	private void aplicarRequest(Ocorrencia o, OcorrenciaRequest req) {
		o.setTitulo(req.titulo().trim());
		if (req.setorId() != null) {
			var setor = fazendaSetorRepository.findById(req.setorId())
					.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Setor cadastrado inválido."));
			o.setSetor(setor.getNome());
			o.setSetorFazendaId(setor.getId());
		} else {
			if (!StringUtils.hasText(req.setor())) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o setor ou selecione um setor cadastrado.");
			}
			o.setSetor(req.setor().trim());
			o.setSetorFazendaId(null);
		}
		o.setCategoria(req.categoria().trim());
		o.setPrioridade(normalizarPrioridade(req.prioridade()));
		o.setDescricao(normalizarDescricao(req.descricao()));
		if (req.status() != null && !req.status().isBlank()) {
			o.setStatus(normalizarStatus(req.status()));
		}
		if (req.horario() != null && !req.horario().isBlank()) {
			o.setHorario(normalizarHorario(req.horario()));
		}
		o.setCoordsX(req.coordsX());
		o.setCoordsY(req.coordsY());
	}

	private static String normalizarPrioridade(String prioridade) {
		var p = prioridade.trim().toUpperCase(Locale.ROOT);
		if (!PRIORIDADES_VALIDAS.contains(p)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Prioridade inválida.");
		}
		return p;
	}

	private static String normalizarDescricao(String descricao) {
		if (descricao == null) return null;
		var d = descricao.trim();
		return d.isEmpty() ? null : d;
	}

	private static String normalizarStatus(String status) {
		var s = status.trim().toUpperCase(Locale.ROOT);
		if (!STATUS_VALIDOS.contains(s)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status inválido.");
		}
		return s;
	}

	private static String normalizarHorario(String horario) {
		if (horario == null || horario.isBlank()) return Instant.now().toString();
		try {
			return Instant.parse(horario.trim()).toString();
		} catch (Exception e) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Data/hora inválida.");
		}
	}

	private static void validarCoordenadas(double lat, double lng) {
		if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordenadas fora do intervalo válido.");
		}
	}

	private static List<String> lerImagens(Ocorrencia o) {
		if (!StringUtils.hasText(o.getImagens())) return new java.util.ArrayList<>();
		return new java.util.ArrayList<>(
				List.of(o.getImagens().split("\n")).stream().map(String::trim).filter(StringUtils::hasText).toList()
		);
	}

	private static void validarImagem(MultipartFile file) {
		var contentType = StringUtils.hasText(file.getContentType()) ? file.getContentType().toLowerCase(Locale.ROOT) : "";
		boolean tipoOk = CONTENT_TYPES_PERMITIDOS.contains(contentType);
		// O app mobile pode enviar Content-Type vazio ou genérico ({@code application/octet-stream}).
		// Nesse caso aceitamos pela extensão do arquivo.
		if (!tipoOk) {
			boolean tipoGenerico = contentType.isEmpty() || contentType.equals("application/octet-stream");
			if (tipoGenerico) {
				String ext = extrairExtensao(file.getOriginalFilename()).toLowerCase(Locale.ROOT);
				tipoOk = EXTENSOES_PERMITIDAS.contains(ext);
			}
		}
		if (!tipoOk) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Formato de imagem não suportado.");
		}
		if (file.getSize() > MAX_TAMANHO_IMAGEM_BYTES) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Imagem excede 10MB.");
		}
	}

	private static String extrairExtensao(String nomeOriginal) {
		if (!StringUtils.hasText(nomeOriginal)) return ".jpg";
		int idx = nomeOriginal.lastIndexOf('.');
		if (idx < 0 || idx == nomeOriginal.length() - 1) return ".jpg";
		var ext = nomeOriginal.substring(idx).toLowerCase(Locale.ROOT);
		return ext.matches("\\.[a-z0-9]{2,5}") ? ext : ".jpg";
	}
}
