package agrolink.agrolink.service;

import agrolink.agrolink.domain.MensagemChat;
import agrolink.agrolink.domain.PapelUsuario;
import agrolink.agrolink.domain.SalaChat;
import agrolink.agrolink.domain.SalaChatMembro;
import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.dto.MembroResponse;
import agrolink.agrolink.dto.MensagemResponse;
import agrolink.agrolink.dto.NovaMensagemChatRequest;
import agrolink.agrolink.dto.AtualizarSalaChatRequest;
import agrolink.agrolink.dto.NovaSalaChatRequest;
import agrolink.agrolink.dto.SalaResponse;
import agrolink.agrolink.repository.MensagemChatRepository;
import agrolink.agrolink.repository.SalaChatMembroRepository;
import agrolink.agrolink.repository.SalaChatRepository;
import agrolink.agrolink.repository.UsuarioRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import agrolink.agrolink.messaging.ChatMensagemEvent;
import agrolink.agrolink.messaging.ChatMensagemPublisher;


import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ChatService {

	private static final int MAX_MENSAGENS_LISTA = 500;
	private static final int MAX_TEXTO = 2000;
	private static final long MAX_ARQUIVO_BYTES = 10L * 1024L * 1024L;
	private static final long MAX_CAPA_SALA_BYTES = 5L * 1024L * 1024L;
	private static final Set<String> TIPOS_IMAGEM_CHAT = Set.of(
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/gif"
	);
	private static final Set<String> CONTENT_TYPES_PERMITIDOS = Set.of(
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/gif",
			"application/pdf",
			"application/octet-stream"
	);
	private static final Path UPLOAD_CHAT = Path.of("uploads", "chat");

	private final SalaChatRepository salas;
	private final MensagemChatRepository mensagens;
	private final UsuarioRepository usuarios;
	private final SalaChatMembroRepository salaMembros;
	private final ChatMensagemPublisher chatMensagemPublisher;

	public ChatService(
		SalaChatRepository salas,
		MensagemChatRepository mensagens,
		UsuarioRepository usuarios,
		SalaChatMembroRepository salaMembros,
		ChatMensagemPublisher chatMensagemPublisher) {
	this.salas = salas;
	this.mensagens = mensagens;
	this.usuarios = usuarios;
	this.salaMembros = salaMembros;
	this.chatMensagemPublisher = chatMensagemPublisher;
}

	@Transactional(readOnly = true)
	public List<SalaResponse> listarSalasResumo(Long usuarioId) {
		var usuario = usuarios.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (!usuario.isAtivo()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Conta inativa.");
		}
		return salaMembros.findSalasDoUsuario(usuarioId).stream()
				.map(s -> {
					var ultima = mensagens.findTopBySalaIdOrderByCriadoEmDesc(s.getId()).orElse(null);
					return SalaResponse.from(s, ultima);
				})
				.toList();
	}

	@Transactional(readOnly = true)
	public List<MensagemResponse> listarMensagens(Long salaId, Long usuarioId) {
		exigirMembro(salaId, usuarioId);
		var page = PageRequest.of(0, MAX_MENSAGENS_LISTA);
		return mensagens.findBySalaIdOrderByCriadoEmAscWithAutor(salaId, page).stream()
				.map(MensagemResponse::from)
				.toList();
	}

	@Transactional(readOnly = true)
	public List<MembroResponse> listarMembrosSala(Long salaId, Long usuarioId) {
		exigirMembro(salaId, usuarioId);
		return salaMembros.findUsuariosBySalaId(salaId).stream()
				.map(MembroResponse::from)
				.toList();
	}

	@Transactional
	public MensagemResponse enviar(Long salaId, Long autorUsuarioId, NovaMensagemChatRequest body) {
		if (body == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Corpo da mensagem é obrigatório.");
		}
		var textoBruto = body.texto() == null ? "" : body.texto().trim();
		var midiaBruta = body.midiaUrl() == null ? null : body.midiaUrl().trim();
		if (!StringUtils.hasText(textoBruto) && !StringUtils.hasText(midiaBruta)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Envie texto ou mídia.");
		}
		if (textoBruto.length() > MAX_TEXTO) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mensagem muito longa (máx. " + MAX_TEXTO + " caracteres).");
		}
		exigirMembro(salaId, autorUsuarioId);
		SalaChat sala = carregarSala(salaId);
		var autor = usuarios.findById(autorUsuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (!autor.isAtivo()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Conta inativa.");
		}
		var m = new MensagemChat();
		m.setSala(sala);
		m.setAutor(autor);
		m.setTexto(StringUtils.hasText(textoBruto) ? textoBruto : "");
		m.setMidiaUrl(StringUtils.hasText(midiaBruta) ? midiaBruta : null);
		mensagens.save(m);

        var response = MensagemResponse.from(m, autor);

        chatMensagemPublisher.publicar(new ChatMensagemEvent(
		   m.getId(),
		   sala.getId(),
		   autor.getId(),
		   autor.getNome(),
		   autor.getEmail(),
		   response.texto(),
		   response.midiaUrl(),
		   response.criadoEm()
));

return response;
	}

	@Transactional
	public MensagemResponse enviarComArquivo(Long salaId, Long autorUsuarioId, String textoOpcional, MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Envie um arquivo.");
		}
		validarArquivo(file);
		exigirMembro(salaId, autorUsuarioId);
		SalaChat sala = carregarSala(salaId);
		var autor = usuarios.findById(autorUsuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (!autor.isAtivo()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Conta inativa.");
		}
		var texto = textoOpcional == null ? "" : textoOpcional.trim();
		if (texto.length() > MAX_TEXTO) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Legenda muito longa.");
		}
		String urlPublica;
		try {
			Path pastaBase = UPLOAD_CHAT.resolve(String.valueOf(salaId)).toAbsolutePath().normalize();
			Files.createDirectories(pastaBase);
			var ext = extrairExtensao(file.getOriginalFilename(), file.getContentType());
			var nome = UUID.randomUUID() + ext;
			var destino = pastaBase.resolve(nome).normalize();
			if (!destino.startsWith(pastaBase)) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Caminho inválido.");
			}
			Files.copy(file.getInputStream(), destino, StandardCopyOption.REPLACE_EXISTING);
			urlPublica = "/uploads/chat/" + salaId + "/" + nome;
		} catch (IOException e) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Falha ao salvar arquivo: " + e.getMessage());
		}
		var m = new MensagemChat();
		m.setSala(sala);
		m.setAutor(autor);
		m.setTexto(StringUtils.hasText(texto) ? texto : "");
		m.setMidiaUrl(urlPublica);
		mensagens.save(m);

        var response = MensagemResponse.from(m, autor);

        chatMensagemPublisher.publicar(new ChatMensagemEvent(
		   m.getId(),
		   sala.getId(),
		   autor.getId(),
		   autor.getNome(),
		   autor.getEmail(),
		   response.texto(),
		   response.midiaUrl(),
		   response.criadoEm()
));

return response;
	}

	@Transactional
	public SalaResponse criarSala(Long criadorId, NovaSalaChatRequest body) {
		var criador = usuarios.findById(criadorId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (!criador.isAtivo()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Conta inativa.");
		}
		var papel = criador.getPapel();
		if (papel != PapelUsuario.PRODUTOR && papel != PapelUsuario.GERENTE) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Apenas produtor ou gerente pode criar canais.");
		}
		var nome = body.nome().trim();
		var ids = new HashSet<>(body.membroIds());
		ids.add(criadorId);
		var porId = new HashMap<Long, Usuario>();
		for (Long uid : ids) {
			var u = usuarios.findById(uid)
					.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Membro inválido: " + uid));
			if (!u.isAtivo()) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Membro inativo: " + uid);
			}
			porId.put(uid, u);
		}
		var s = new SalaChat();
		s.setNome(nome);
		salas.save(s);
		for (Long uid : ids) {
			var link = new SalaChatMembro();
			link.setSala(s);
			link.setUsuario(porId.get(uid));
			salaMembros.save(link);
		}
		return SalaResponse.from(s, null);
	}

	@Transactional
	public SalaResponse atualizarSala(Long salaId, Long usuarioId, AtualizarSalaChatRequest body) {
		if (body == null || body.nome() == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome é obrigatório.");
		}
		var nome = body.nome().trim();
		if (!StringUtils.hasText(nome)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome do canal não pode ficar vazio.");
		}
		if (nome.length() > 160) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome muito longo (máx. 160 caracteres).");
		}
		exigirMembro(salaId, usuarioId);
		var usuario = usuarios.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (!usuario.isAtivo()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Conta inativa.");
		}
		SalaChat sala = carregarSala(salaId);
		sala.setNome(nome);
		salas.save(sala);
		var ultima = mensagens.findTopBySalaIdOrderByCriadoEmDesc(salaId).orElse(null);
		return SalaResponse.from(sala, ultima);
	}

	@Transactional
	public SalaResponse atualizarImagemSala(Long salaId, Long usuarioId, MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Envie uma imagem.");
		}
		validarImagemCapa(file);
		exigirMembro(salaId, usuarioId);
		SalaChat sala = carregarSala(salaId);
		var usuario = usuarios.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (!usuario.isAtivo()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Conta inativa.");
		}
		String urlPublica;
		try {
			Path pastaBase = UPLOAD_CHAT.resolve(String.valueOf(salaId)).toAbsolutePath().normalize();
			Files.createDirectories(pastaBase);
			var ext = extrairExtensaoImagem(file.getOriginalFilename(), file.getContentType());
			var nome = "capa-" + UUID.randomUUID() + ext;
			var destino = pastaBase.resolve(nome).normalize();
			if (!destino.startsWith(pastaBase)) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Caminho inválido.");
			}
			Files.copy(file.getInputStream(), destino, StandardCopyOption.REPLACE_EXISTING);
			urlPublica = "/uploads/chat/" + salaId + "/" + nome;
		} catch (IOException e) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Falha ao salvar imagem: " + e.getMessage());
		}
		sala.setImagemUrl(urlPublica);
		salas.save(sala);
		var ultima = mensagens.findTopBySalaIdOrderByCriadoEmDesc(salaId).orElse(null);
		return SalaResponse.from(sala, ultima);
	}

	private void exigirMembro(Long salaId, Long usuarioId) {
		carregarSala(salaId);
		if (!salaMembros.existsBySala_IdAndUsuario_Id(salaId, usuarioId)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Você não participa deste canal.");
		}
	}

	private static void validarArquivo(MultipartFile file) {
		var ctNorm = normalizarContentTypeArquivo(file);
		if (!CONTENT_TYPES_PERMITIDOS.contains(ctNorm)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de arquivo não permitido (use imagem JPEG/PNG/WebP/GIF ou PDF).");
		}
		if (file.getSize() > MAX_ARQUIVO_BYTES) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Arquivo muito grande (máx. 10 MB).");
		}
	}

	private static void validarImagemCapa(MultipartFile file) {
		var ctNorm = normalizarContentTypeArquivo(file);
		if (!TIPOS_IMAGEM_CHAT.contains(ctNorm)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use uma imagem JPEG, PNG, WebP ou GIF para a foto do grupo.");
		}
		if (file.getSize() > MAX_CAPA_SALA_BYTES) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Imagem muito grande (máx. 5 MB).");
		}
	}

	private static String normalizarContentTypeArquivo(MultipartFile file) {
		var ct = file.getContentType();
		var ctNorm = ct == null ? "" : ct.toLowerCase(Locale.ROOT).trim();
		var nome = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
		if ("application/octet-stream".equals(ctNorm) || ctNorm.isEmpty()) {
			if (nome.endsWith(".pdf")) {
				ctNorm = "application/pdf";
			} else if (nome.endsWith(".png")) {
				ctNorm = "image/png";
			} else if (nome.endsWith(".jpg") || nome.endsWith(".jpeg")) {
				ctNorm = "image/jpeg";
			} else if (nome.endsWith(".webp")) {
				ctNorm = "image/webp";
			} else if (nome.endsWith(".gif")) {
				ctNorm = "image/gif";
			}
		}
		return ctNorm;
	}

	private static String extrairExtensao(String originalFilename, String contentType) {
		if (originalFilename != null) {
			var lower = originalFilename.toLowerCase(Locale.ROOT);
			if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return ".jpg";
			if (lower.endsWith(".png")) return ".png";
			if (lower.endsWith(".webp")) return ".webp";
			if (lower.endsWith(".gif")) return ".gif";
			if (lower.endsWith(".pdf")) return ".pdf";
		}
		if ("image/png".equalsIgnoreCase(contentType)) return ".png";
		if ("image/webp".equalsIgnoreCase(contentType)) return ".webp";
		if ("image/gif".equalsIgnoreCase(contentType)) return ".gif";
		if ("application/pdf".equalsIgnoreCase(contentType)) return ".pdf";
		return ".jpg";
	}

	private static String extrairExtensaoImagem(String originalFilename, String contentType) {
		if (originalFilename != null) {
			var lower = originalFilename.toLowerCase(Locale.ROOT);
			if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return ".jpg";
			if (lower.endsWith(".png")) return ".png";
			if (lower.endsWith(".webp")) return ".webp";
			if (lower.endsWith(".gif")) return ".gif";
		}
		if ("image/png".equalsIgnoreCase(contentType)) return ".png";
		if ("image/webp".equalsIgnoreCase(contentType)) return ".webp";
		if ("image/gif".equalsIgnoreCase(contentType)) return ".gif";
		return ".jpg";
	}

	private SalaChat carregarSala(Long salaId) {
		return salas.findById(salaId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sala de chat não encontrada."));
	}
}
