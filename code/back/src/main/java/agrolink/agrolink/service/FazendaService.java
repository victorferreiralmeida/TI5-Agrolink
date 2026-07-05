package agrolink.agrolink.service;

import agrolink.agrolink.domain.Fazenda;
import agrolink.agrolink.domain.FazendaSetor;
import agrolink.agrolink.domain.PapelUsuario;
import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.dto.AtualizarFazendaSetorRequest;
import agrolink.agrolink.dto.CriarFazendaSetorRequest;
import agrolink.agrolink.dto.FazendaMapaRegistroDto;
import agrolink.agrolink.dto.FazendaResponse;
import agrolink.agrolink.dto.FazendaSetorResponse;
import agrolink.agrolink.dto.RegistroOcorrenciaMapaResponse;
import agrolink.agrolink.dto.SetorRegistroDto;
import agrolink.agrolink.dto.UpsertFazendaRequest;
import agrolink.agrolink.repository.FazendaRepository;
import agrolink.agrolink.repository.FazendaSetorRepository;
import agrolink.agrolink.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class FazendaService {

	private static final ObjectMapper MAPPER = new ObjectMapper();
	private final FazendaRepository fazendaRepository;
	private final FazendaSetorRepository setorRepository;
	private final UsuarioRepository usuarioRepository;
	private final NotificacaoService notificacaoService;

	public FazendaService(
			FazendaRepository fazendaRepository,
			FazendaSetorRepository setorRepository,
			UsuarioRepository usuarioRepository,
			NotificacaoService notificacaoService) {
		this.fazendaRepository = fazendaRepository;
		this.setorRepository = setorRepository;
		this.usuarioRepository = usuarioRepository;
		this.notificacaoService = notificacaoService;
	}

	public List<SetorRegistroDto> listarSetoresParaRegistroOcorrencia(long usuarioId) {
		return mapaParaRegistroOcorrencia(usuarioId).setores();
	}

	/** Perímetros + setores para o mapa ao registrar ocorrência — apenas da fazenda do usuário. */
	public RegistroOcorrenciaMapaResponse mapaParaRegistroOcorrencia(long usuarioId) {
		Usuario usuario = usuarioRepository.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (!usuario.isAtivo()) {
			return new RegistroOcorrenciaMapaResponse(List.of(), List.of());
		}

		Optional<Fazenda> fazendaOpt = resolverFazendaParaRegistro(usuario);
		if (fazendaOpt.isEmpty()) {
			return new RegistroOcorrenciaMapaResponse(List.of(), List.of());
		}

		Fazenda f = fazendaOpt.get();
		List<FazendaMapaRegistroDto> fazendas = List.of(
				new FazendaMapaRegistroDto(f.getId(), f.getNome(), f.getPerimetroGeojson()));
		List<SetorRegistroDto> setores = setorRepository.findByFazendaIdOrderByNomeAsc(f.getId()).stream()
				.map(s -> new SetorRegistroDto(
						s.getId(),
						s.getNome(),
						f.getNome(),
						s.getPoligonoGeojson()))
				.toList();
		return new RegistroOcorrenciaMapaResponse(fazendas, setores);
	}

	/** Fazenda visível para registro de ocorrência (gerente da propriedade ou membro com convite aceito). */
	private Optional<Fazenda> resolverFazendaParaRegistro(Usuario usuario) {
		if (usuario.getPapel() == PapelUsuario.GERENTE) {
			return fazendaRepository.findByGerenteUsuarioId(usuario.getId());
		}
		Long vinculoFazendaId = usuario.getFazendaVinculoId();
		if (vinculoFazendaId == null) {
			return Optional.empty();
		}
		return fazendaRepository.findById(vinculoFazendaId);
	}

	public FazendaResponse obterMinhaFazenda(long usuarioId) {
		var u = usuarioRepository.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (u.getPapel() != PapelUsuario.GERENTE) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Apenas gerentes podem gerenciar a fazenda.");
		}
		var fazenda = fazendaRepository.findByGerenteUsuarioId(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fazenda não cadastrada."));
		return montarResponse(fazenda);
	}

	@Transactional
	public FazendaResponse salvarMinhaFazenda(long usuarioId, UpsertFazendaRequest body) {
		var u = usuarioRepository.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (u.getPapel() != PapelUsuario.GERENTE) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Apenas gerentes podem cadastrar a fazenda.");
		}
		var nome = body.nome().trim();
		var perimetro = normalizarGeojsonOpcional(body.perimetroGeojson());
		var fazenda = fazendaRepository.findByGerenteUsuarioId(usuarioId).orElseGet(Fazenda::new);
		boolean criacao = fazenda.getId() == null;
		if (fazenda.getId() == null) {
			fazenda.setGerenteUsuarioId(usuarioId);
		} else if (fazenda.getGerenteUsuarioId() != null && !fazenda.getGerenteUsuarioId().equals(usuarioId)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Fazenda pertence a outro gerente.");
		}
		fazenda.setNome(nome);
		fazenda.setPerimetroGeojson(perimetro);
		fazenda = fazendaRepository.save(fazenda);
		if (criacao) {
			notificacaoService.registrar(
					"FAZENDA_CRIADA",
					"Fazenda",
					"Fazenda cadastrada",
					"A propriedade \"" + nome + "\" foi cadastrada.",
					"FAZENDA",
					fazenda.getId(),
					fazenda.getId());
		} else {
			notificacaoService.registrar(
					"FAZENDA_ATUALIZADA",
					"Fazenda",
					"Dados da fazenda atualizados",
					"Atualização em \"" + nome + "\" (perímetro ou nome).",
					"FAZENDA",
					fazenda.getId(),
					fazenda.getId());
		}
		return montarResponse(fazenda);
	}

	public FazendaSetorResponse criarSetor(long usuarioId, CriarFazendaSetorRequest body) {
		var fazenda = obterFazendaDoGerente(usuarioId);
		var s = new FazendaSetor();
		s.setFazenda(fazenda);
		s.setNome(body.nome().trim());
		var poligono = normalizarGeojsonOpcional(body.poligonoGeojson());
		validarSemSobreposicaoSetor(fazenda, null, poligono);
		s.setPoligonoGeojson(poligono);
		s = setorRepository.save(s);
		notificacaoService.registrar(
				"SETOR_CRIADO",
				"Setor",
				"Novo setor na fazenda",
				"Setor \"" + s.getNome() + "\" criado em " + fazenda.getNome() + ".",
				"SETOR",
				s.getId(),
				fazenda.getId());
		return FazendaSetorResponse.from(s);
	}

	public FazendaSetorResponse atualizarSetor(long usuarioId, long setorId, AtualizarFazendaSetorRequest body) {
		var fazenda = obterFazendaDoGerente(usuarioId);
		var s = setorRepository.findById(setorId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Setor não encontrado."));
		if (!s.getFazenda().getId().equals(fazenda.getId())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Setor não pertence à sua fazenda.");
		}
		s.setNome(body.nome().trim());
		var poligono = normalizarGeojsonOpcional(body.poligonoGeojson());
		validarSemSobreposicaoSetor(fazenda, s.getId(), poligono);
		s.setPoligonoGeojson(poligono);
		s = setorRepository.save(s);
		notificacaoService.registrar(
				"SETOR_ATUALIZADO",
				"Setor",
				"Setor atualizado",
				"O setor \"" + s.getNome() + "\" foi alterado.",
				"SETOR",
				s.getId(),
				fazenda.getId());
		return FazendaSetorResponse.from(s);
	}

	public void removerSetor(long usuarioId, long setorId) {
		var fazenda = obterFazendaDoGerente(usuarioId);
		var s = setorRepository.findById(setorId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Setor não encontrado."));
		if (!s.getFazenda().getId().equals(fazenda.getId())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Setor não pertence à sua fazenda.");
		}
		String nomeRemovido = s.getNome();
		Long idRemovido = s.getId();
		setorRepository.delete(s);
		notificacaoService.registrar(
				"SETOR_REMOVIDO",
				"Setor",
				"Setor removido",
				"O setor \"" + nomeRemovido + "\" foi excluído.",
				"SETOR",
				idRemovido,
				fazenda.getId());
	}

	private Fazenda obterFazendaDoGerente(long usuarioId) {
		var u = usuarioRepository.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (u.getPapel() != PapelUsuario.GERENTE) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Apenas gerentes podem alterar setores.");
		}
		return fazendaRepository.findByGerenteUsuarioId(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cadastre a fazenda antes dos setores."));
	}

	private FazendaResponse montarResponse(Fazenda fazenda) {
		var setores = setorRepository.findByFazendaIdOrderByNomeAsc(fazenda.getId()).stream()
				.map(FazendaSetorResponse::from)
				.toList();
		return FazendaResponse.from(fazenda, setores);
	}

	private static String normalizarGeojsonOpcional(String raw) {
		if (raw == null) return null;
		var t = raw.trim();
		return t.isEmpty() ? null : t;
	}

	private void validarSemSobreposicaoSetor(Fazenda fazenda, Long setorAtualId, String novoPoligonoGeojson) {
		var novo = parsePolygon(novoPoligonoGeojson);
		if (novo.isEmpty()) return;
		var existentes = setorRepository.findByFazendaIdOrderByNomeAsc(fazenda.getId());
		for (var existente : existentes) {
			if (setorAtualId != null && setorAtualId.equals(existente.getId())) continue;
			var outro = parsePolygon(existente.getPoligonoGeojson());
			if (outro.isEmpty()) continue;
			if (polygonsOverlap(novo, outro)) {
				throw new ResponseStatusException(
						HttpStatus.BAD_REQUEST,
						"O polígono do setor invade outro setor existente da fazenda.");
			}
		}
	}

	private static List<double[]> parsePolygon(String geojson) {
		if (geojson == null || geojson.isBlank()) return List.of();
		try {
			JsonNode root = MAPPER.readTree(geojson);
			if (!"Polygon".equals(root.path("type").asText())) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "GeoJSON do setor deve ser do tipo Polygon.");
			}
			JsonNode ring = root.path("coordinates").isArray() && root.path("coordinates").size() > 0
					? root.path("coordinates").get(0)
					: null;
			if (ring == null || !ring.isArray()) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordenadas do polígono inválidas.");
			}
			List<double[]> pts = new ArrayList<>();
			for (JsonNode item : ring) {
				if (item == null || !item.isArray() || item.size() < 2) continue;
				double lng = item.get(0).asDouble(Double.NaN);
				double lat = item.get(1).asDouble(Double.NaN);
				if (Double.isFinite(lat) && Double.isFinite(lng)) pts.add(new double[]{lat, lng});
			}
			if (pts.size() >= 2) {
				double[] a = pts.get(0);
				double[] b = pts.get(pts.size() - 1);
				if (a[0] == b[0] && a[1] == b[1]) pts.remove(pts.size() - 1);
			}
			if (pts.size() > 0 && pts.size() < 3) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Polígono do setor deve ter ao menos 3 pontos.");
			}
			return pts;
		} catch (ResponseStatusException ex) {
			throw ex;
		} catch (Exception ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "GeoJSON do setor inválido.");
		}
	}

	private static boolean polygonsOverlap(List<double[]> a, List<double[]> b) {
		if (a.size() < 3 || b.size() < 3) return false;
		for (int i = 0; i < a.size(); i++) {
			double[] a1 = a.get(i);
			double[] a2 = a.get((i + 1) % a.size());
			for (int j = 0; j < b.size(); j++) {
				double[] b1 = b.get(j);
				double[] b2 = b.get((j + 1) % b.size());
				if (segmentsIntersect(a1, a2, b1, b2)) return true;
			}
		}
		return pointInPolygon(a.get(0), b) || pointInPolygon(b.get(0), a);
	}

	private static boolean pointInPolygon(double[] p, List<double[]> poly) {
		double x = p[1];
		double y = p[0];
		boolean inside = false;
		for (int i = 0, j = poly.size() - 1; i < poly.size(); j = i++) {
			double yi = poly.get(i)[0], xi = poly.get(i)[1];
			double yj = poly.get(j)[0], xj = poly.get(j)[1];
			double denom = Math.abs(yj - yi) < 1e-18 ? 1e-18 : (yj - yi);
			boolean intersects = ((yi > y) != (yj > y)) && (x < ((xj - xi) * (y - yi)) / denom + xi);
			if (intersects) inside = !inside;
		}
		return inside;
	}

	private static boolean segmentsIntersect(double[] p1, double[] p2, double[] q1, double[] q2) {
		double o1 = orientation(p1, p2, q1);
		double o2 = orientation(p1, p2, q2);
		double o3 = orientation(q1, q2, p1);
		double o4 = orientation(q1, q2, p2);
		if ((o1 > 0) != (o2 > 0) && (o3 > 0) != (o4 > 0)) return true;
		double eps = 1e-10;
		return (Math.abs(o1) <= eps && onSegment(p1, q1, p2))
				|| (Math.abs(o2) <= eps && onSegment(p1, q2, p2))
				|| (Math.abs(o3) <= eps && onSegment(q1, p1, q2))
				|| (Math.abs(o4) <= eps && onSegment(q1, p2, q2));
	}

	private static double orientation(double[] a, double[] b, double[] c) {
		return (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
	}

	private static boolean onSegment(double[] a, double[] p, double[] b) {
		return p[0] <= Math.max(a[0], b[0]) && p[0] >= Math.min(a[0], b[0])
				&& p[1] <= Math.max(a[1], b[1]) && p[1] >= Math.min(a[1], b[1]);
	}
}
