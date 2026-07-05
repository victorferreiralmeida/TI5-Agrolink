package agrolink.agrolink.api;

import agrolink.agrolink.auth.AgrolinkBearerToken;
import agrolink.agrolink.dto.MembroResponse;
import agrolink.agrolink.dto.MensagemResponse;
import agrolink.agrolink.dto.NovaMensagemChatRequest;
import agrolink.agrolink.dto.AtualizarSalaChatRequest;
import agrolink.agrolink.dto.NovaSalaChatRequest;
import agrolink.agrolink.dto.SalaResponse;
import agrolink.agrolink.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

	private final ChatService chatService;

	public ChatController(ChatService chatService) {
		this.chatService = chatService;
	}

	@GetMapping("/salas")
	public List<SalaResponse> salas(@RequestHeader(value = "Authorization", required = false) String authorization) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		return chatService.listarSalasResumo(userId);
	}

	@PostMapping("/salas")
	public ResponseEntity<SalaResponse> criarSala(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@Valid @RequestBody NovaSalaChatRequest body) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		var sala = chatService.criarSala(userId, body);
		return ResponseEntity.status(HttpStatus.CREATED).body(sala);
	}

	@PatchMapping("/salas/{salaId}")
	public SalaResponse atualizarSala(
			@PathVariable Long salaId,
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@Valid @RequestBody AtualizarSalaChatRequest body) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		return chatService.atualizarSala(salaId, userId, body);
	}

	@GetMapping("/salas/{salaId}/membros")
	public List<MembroResponse> membrosDaSala(
			@PathVariable Long salaId,
			@RequestHeader(value = "Authorization", required = false) String authorization) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		return chatService.listarMembrosSala(salaId, userId);
	}

	@GetMapping("/salas/{salaId}/mensagens")
	public List<MensagemResponse> mensagens(
			@PathVariable Long salaId,
			@RequestHeader(value = "Authorization", required = false) String authorization) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		return chatService.listarMensagens(salaId, userId);
	}

	@PostMapping("/salas/{salaId}/mensagens")
	public ResponseEntity<MensagemResponse> enviar(
			@PathVariable Long salaId,
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@Valid @RequestBody NovaMensagemChatRequest body) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		var criada = chatService.enviar(salaId, userId, body);
		return ResponseEntity.status(HttpStatus.CREATED).body(criada);
	}

	@PostMapping(path = "/salas/{salaId}/mensagens/com-arquivo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<MensagemResponse> enviarComArquivo(
			@PathVariable Long salaId,
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@RequestParam(value = "texto", required = false) String texto,
			@RequestParam("file") MultipartFile file) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		var criada = chatService.enviarComArquivo(salaId, userId, texto, file);
		return ResponseEntity.status(HttpStatus.CREATED).body(criada);
	}

	@PostMapping(path = "/salas/{salaId}/imagem", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<SalaResponse> atualizarImagemSala(
			@PathVariable Long salaId,
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@RequestParam("file") MultipartFile file) {
		var userId = AgrolinkBearerToken.parseUsuarioId(authorization);
		var atualizada = chatService.atualizarImagemSala(salaId, userId, file);
		return ResponseEntity.ok(atualizada);
	}
}
