package agrolink.agrolink.api;

import agrolink.agrolink.auth.AgrolinkBearerToken;
import agrolink.agrolink.dto.AtualizarPerfilRequest;
import agrolink.agrolink.dto.UserSummary;
import agrolink.agrolink.service.PerfilUsuarioService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/usuario")
public class UsuarioPerfilController {

	private final PerfilUsuarioService perfilUsuarioService;

	public UsuarioPerfilController(PerfilUsuarioService perfilUsuarioService) {
		this.perfilUsuarioService = perfilUsuarioService;
	}

	@GetMapping("/me")
	public UserSummary me(@RequestHeader(value = "Authorization", required = false) String authorization) {
		var id = AgrolinkBearerToken.parseUsuarioId(authorization);
		return perfilUsuarioService.resumo(id);
	}

	@PutMapping("/me")
	public UserSummary atualizar(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@Valid @RequestBody AtualizarPerfilRequest body) {
		var id = AgrolinkBearerToken.parseUsuarioId(authorization);
		return perfilUsuarioService.atualizar(id, body);
	}

	@PostMapping(path = "/me/foto", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<UserSummary> uploadFoto(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@RequestParam("file") MultipartFile file) {
		var id = AgrolinkBearerToken.parseUsuarioId(authorization);
		var u = perfilUsuarioService.salvarFoto(id, file);
		return ResponseEntity.status(HttpStatus.OK).body(u);
	}
}
