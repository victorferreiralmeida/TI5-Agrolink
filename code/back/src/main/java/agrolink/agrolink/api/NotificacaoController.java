package agrolink.agrolink.api;

import agrolink.agrolink.auth.AgrolinkBearerToken;
import agrolink.agrolink.dto.NotificacaoResponse;
import agrolink.agrolink.service.NotificacaoService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notificacoes")
public class NotificacaoController {

	private final NotificacaoService notificacaoService;

	public NotificacaoController(NotificacaoService notificacaoService) {
		this.notificacaoService = notificacaoService;
	}

	@GetMapping
	public List<NotificacaoResponse> listar(@RequestHeader(value = "Authorization", required = false) String authorization) {
		long usuarioId = AgrolinkBearerToken.parseUsuarioId(authorization);
		return notificacaoService.listarRecentes(usuarioId);
	}
}
