package agrolink.agrolink.api;

import agrolink.agrolink.auth.AgrolinkBearerToken;
import agrolink.agrolink.dto.AtribuirResponsavelRequest;
import agrolink.agrolink.dto.ComentarioRequest;
import agrolink.agrolink.dto.OcorrenciaRequest;
import agrolink.agrolink.dto.OcorrenciaResponse;
import agrolink.agrolink.service.OcorrenciaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/ocorrencias")
public class OcorrenciaController {

	private final OcorrenciaService ocorrenciaService;

	public OcorrenciaController(OcorrenciaService ocorrenciaService) {
		this.ocorrenciaService = ocorrenciaService;
	}

	@GetMapping
	public List<OcorrenciaResponse> listar(
			@RequestHeader("Authorization") String authorization,
			@RequestParam(value = "since", required = false) String since) {
		long uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		Instant sinceInstant = parseSince(since);
		return ocorrenciaService.asResponseList(ocorrenciaService.listarVisivelPara(uid, sinceInstant));
	}

	private static Instant parseSince(String since) {
		if (since == null || since.isBlank()) {
			return null;
		}
		try {
			return Instant.parse(since.trim());
		} catch (Exception e) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parâmetro since inválido (use ISO-8601).");
		}
	}

	@GetMapping("/{id}")
	public OcorrenciaResponse buscar(@PathVariable Long id, @RequestHeader("Authorization") String authorization) {
		long uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return ocorrenciaService.buscarSeVisivel(id, uid)
				.map(ocorrenciaService::asResponse)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência não encontrada."));
	}

	@PostMapping
	public ResponseEntity<OcorrenciaResponse> criar(
			@RequestHeader("Authorization") String authorization,
			@Valid @RequestBody OcorrenciaRequest body) {
		long uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		var salva = ocorrenciaService.criar(body, uid);
		return ResponseEntity.status(HttpStatus.CREATED).body(ocorrenciaService.asResponse(salva));
	}

	@PutMapping("/{id}")
	public OcorrenciaResponse atualizar(
			@PathVariable Long id,
			@RequestHeader("Authorization") String authorization,
			@Valid @RequestBody OcorrenciaRequest body) {
		long uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		var salva = ocorrenciaService.atualizar(id, body, uid);
		return ocorrenciaService.asResponse(salva);
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> remover(@PathVariable Long id, @RequestHeader("Authorization") String authorization) {
		long uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		ocorrenciaService.deletar(id, uid);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/{id}/resolver")
	public OcorrenciaResponse resolver(@PathVariable Long id, @RequestHeader("Authorization") String authorization) {
		long uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return ocorrenciaService.asResponse(ocorrenciaService.resolver(id, uid));
	}

	@PostMapping(path = "/{id}/comentarios", consumes = MediaType.APPLICATION_JSON_VALUE)
	public OcorrenciaResponse comentar(
			@PathVariable Long id,
			@RequestHeader("Authorization") String authorization,
			@Valid @RequestBody ComentarioRequest body) {
		long uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return ocorrenciaService.asResponse(ocorrenciaService.comentar(id, body, uid));
	}

	@PostMapping(path = "/{id}/comentarios", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public OcorrenciaResponse comentarComAnexos(
			@PathVariable Long id,
			@RequestHeader("Authorization") String authorization,
			@RequestParam(value = "texto", required = false) String texto,
			@RequestParam(value = "files", required = false) List<MultipartFile> files) {
		long uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return ocorrenciaService.asResponse(ocorrenciaService.comentarComArquivos(id, texto, files == null ? List.of() : files, uid));
	}

	@PostMapping(path = "/{id}/imagens", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public OcorrenciaResponse uploadImagens(
			@PathVariable Long id,
			@RequestHeader("Authorization") String authorization,
			@RequestParam("files") List<MultipartFile> files) {
		long uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return ocorrenciaService.asResponse(ocorrenciaService.adicionarImagens(id, files, uid));
	}

	@PostMapping("/{id}/responsavel/mim")
	public OcorrenciaResponse assumirResponsavel(
			@PathVariable Long id,
			@RequestHeader("Authorization") String authorization) {
		long uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return ocorrenciaService.asResponse(ocorrenciaService.autoAtribuirResponsavel(id, uid));
	}

	@PutMapping("/{id}/responsavel")
	public OcorrenciaResponse definirResponsavel(
			@PathVariable Long id,
			@RequestHeader("Authorization") String authorization,
			@RequestBody(required = false) AtribuirResponsavelRequest body) {
		long gerenteId = AgrolinkBearerToken.parseUsuarioId(authorization);
		Long alvo = body == null ? null : body.usuarioId();
		return ocorrenciaService.asResponse(ocorrenciaService.definirResponsavelGerente(id, alvo, gerenteId));
	}
}
