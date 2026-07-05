package agrolink.agrolink.api;

import agrolink.agrolink.auth.AgrolinkBearerToken;
import agrolink.agrolink.dto.AtualizarFazendaSetorRequest;
import agrolink.agrolink.dto.CriarFazendaSetorRequest;
import agrolink.agrolink.dto.FazendaResponse;
import agrolink.agrolink.dto.FazendaSetorResponse;
import agrolink.agrolink.dto.RegistroOcorrenciaMapaResponse;
import agrolink.agrolink.dto.SetorRegistroDto;
import agrolink.agrolink.dto.UpsertFazendaRequest;
import agrolink.agrolink.service.FazendaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/fazenda")
public class FazendaController {

	private final FazendaService fazendaService;

	public FazendaController(FazendaService fazendaService) {
		this.fazendaService = fazendaService;
	}

	/** Setores da fazenda do usuário para o dropdown ao registrar ocorrência. */
	@GetMapping("/setores-registro")
	public List<SetorRegistroDto> setoresParaRegistro(
			@RequestHeader(value = "Authorization", required = false) String authorization) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		return fazendaService.listarSetoresParaRegistroOcorrencia(userId);
	}

	/** Fazendas (perímetro) + setores para o mapa na tela de registro de ocorrência. */
	@GetMapping("/registro-ocorrencia-mapa")
	public RegistroOcorrenciaMapaResponse mapaRegistroOcorrencia(
			@RequestHeader(value = "Authorization", required = false) String authorization) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		return fazendaService.mapaParaRegistroOcorrencia(userId);
	}

	@GetMapping("/me")
	public FazendaResponse minhaFazenda(@RequestHeader(value = "Authorization", required = false) String authorization) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		return fazendaService.obterMinhaFazenda(userId);
	}

	@PutMapping("/me")
	public ResponseEntity<FazendaResponse> salvarMinhaFazenda(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@Valid @RequestBody UpsertFazendaRequest body) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		var salva = fazendaService.salvarMinhaFazenda(userId, body);
		return ResponseEntity.status(HttpStatus.OK).body(salva);
	}

	@PostMapping("/me/setores")
	public ResponseEntity<FazendaSetorResponse> criarSetor(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@Valid @RequestBody CriarFazendaSetorRequest body) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		var criado = fazendaService.criarSetor(userId, body);
		return ResponseEntity.status(HttpStatus.CREATED).body(criado);
	}

	@PutMapping("/me/setores/{id}")
	public FazendaSetorResponse atualizarSetor(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@PathVariable Long id,
			@Valid @RequestBody AtualizarFazendaSetorRequest body) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		return fazendaService.atualizarSetor(userId, id, body);
	}

	@DeleteMapping("/me/setores/{id}")
	public ResponseEntity<Void> removerSetor(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@PathVariable Long id) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		fazendaService.removerSetor(userId, id);
		return ResponseEntity.noContent().build();
	}
}
