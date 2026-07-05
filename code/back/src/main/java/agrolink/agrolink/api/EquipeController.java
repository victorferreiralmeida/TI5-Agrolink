package agrolink.agrolink.api;

import agrolink.agrolink.auth.AgrolinkBearerToken;
import agrolink.agrolink.dto.AtualizarMembroRequest;
import agrolink.agrolink.dto.ConvidarMembroRequest;
import agrolink.agrolink.dto.ConviteResponse;
import agrolink.agrolink.dto.EquipeResumo;
import agrolink.agrolink.dto.MembroResponse;
import agrolink.agrolink.service.EquipeService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/equipe")
public class EquipeController {

	private final EquipeService equipeService;

	public EquipeController(EquipeService equipeService) {
		this.equipeService = equipeService;
	}

	@GetMapping
	public EquipeResumo resumo(
			@RequestHeader("Authorization") String authorization,
			@RequestParam(name = "papel", required = false) String papel) {
		var uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return equipeService.carregarResumo(uid, papel);
	}

	@GetMapping("/membros")
	public List<MembroResponse> listarMembros(
			@RequestHeader("Authorization") String authorization,
			@RequestParam(name = "papel", required = false) String papel) {
		var uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return equipeService.listarMembros(uid, papel);
	}

	@GetMapping("/membros/{id}")
	public MembroResponse buscarMembro(
			@RequestHeader("Authorization") String authorization,
			@PathVariable Long id) {
		var uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return equipeService.buscarMembro(uid, id);
	}

	@PutMapping("/membros/{id}")
	public MembroResponse atualizarMembro(
			@RequestHeader("Authorization") String authorization,
			@PathVariable Long id,
			@RequestBody AtualizarMembroRequest body) {
		var uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return equipeService.atualizarMembro(uid, id, body);
	}

	@DeleteMapping("/membros/{id}")
	public ResponseEntity<Void> removerMembro(
			@RequestHeader("Authorization") String authorization,
			@PathVariable Long id) {
		var uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		equipeService.removerMembro(uid, id);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/convites")
	public List<ConviteResponse> listarConvites(@RequestHeader("Authorization") String authorization) {
		var uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return equipeService.listarConvitesPendentes(uid);
	}

	@PostMapping("/convites")
	public ResponseEntity<ConviteResponse> convidar(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@RequestBody ConvidarMembroRequest body) {
		Long uid = AgrolinkBearerToken.tryParseUsuarioId(authorization).orElse(null);
		var convite = equipeService.convidar(body, uid);
		return ResponseEntity.status(HttpStatus.CREATED).body(convite);
	}

	@GetMapping("/convites/me")
	public List<ConviteResponse> meusConvites(@RequestHeader("Authorization") String authorization) {
		var uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return equipeService.listarConvitesDoUsuario(uid);
	}

	@PostMapping("/convites/{id}/aceitar")
	public ConviteResponse aceitarConvite(
			@PathVariable Long id,
			@RequestHeader("Authorization") String authorization) {
		var uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return equipeService.aceitarConvite(uid, id);
	}

	@PostMapping("/convites/{id}/recusar")
	public ConviteResponse recusarConvite(
			@PathVariable Long id,
			@RequestHeader("Authorization") String authorization) {
		var uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return equipeService.recusarConvite(uid, id);
	}

	@PostMapping("/convites/{id}/reenviar")
	public ConviteResponse reenviar(
			@PathVariable Long id,
			@RequestHeader("Authorization") String authorization) {
		var uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		return equipeService.reenviar(uid, id);
	}

	@DeleteMapping("/convites/{id}")
	public ResponseEntity<Void> cancelar(
			@PathVariable Long id,
			@RequestHeader("Authorization") String authorization) {
		var uid = AgrolinkBearerToken.parseUsuarioId(authorization);
		equipeService.cancelar(uid, id);
		return ResponseEntity.noContent().build();
	}
}
