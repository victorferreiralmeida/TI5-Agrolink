package agrolink.agrolink.service;

import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.dto.AtualizarPerfilRequest;
import agrolink.agrolink.dto.UserSummary;
import agrolink.agrolink.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;

@Service
public class PerfilUsuarioService {

	private static final Set<String> CONTENT_TYPES = Set.of(
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/gif"
	);
	private static final long MAX_BYTES = 5L * 1024L * 1024L;
	private static final Path UPLOAD_ROOT = Path.of("uploads", "avatars");

	private final UsuarioRepository usuarios;
	private final FazendaAcessoService fazendaAcesso;

	public PerfilUsuarioService(UsuarioRepository usuarios, FazendaAcessoService fazendaAcesso) {
		this.usuarios = usuarios;
		this.fazendaAcesso = fazendaAcesso;
	}

	@Transactional(readOnly = true)
	public UserSummary resumo(Long usuarioId) {
		return fazendaAcesso.toUserSummary(carregarAtivo(usuarioId));
	}

	@Transactional
	public UserSummary atualizar(Long usuarioId, AtualizarPerfilRequest body) {
		if (body == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Corpo obrigatório.");
		}
		Usuario u = carregarAtivo(usuarioId);
		u.setNome(body.nome().trim());
		var tel = body.telefone() == null ? null : body.telefone().trim();
		u.setTelefone(tel == null || tel.isEmpty() ? null : tel);
		usuarios.save(u);
		return fazendaAcesso.toUserSummary(u);
	}

	@Transactional
	public UserSummary salvarFoto(Long usuarioId, MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Envie uma imagem.");
		}
		validarImagem(file);
		Usuario u = carregarAtivo(usuarioId);
		try {
			Path pasta = UPLOAD_ROOT.resolve(String.valueOf(usuarioId)).normalize();
			Files.createDirectories(pasta);
			String ext = extrairExtensao(file.getOriginalFilename());
			String nome = "avatar-" + System.currentTimeMillis() + ext;
			Path destino = pasta.resolve(nome).normalize();
			if (!destino.startsWith(pasta)) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Caminho inválido.");
			}
			Files.copy(file.getInputStream(), destino, StandardCopyOption.REPLACE_EXISTING);
			String publicUrl = "/uploads/avatars/" + usuarioId + "/" + nome;
			u.setFotoUrl(publicUrl);
			usuarios.save(u);
			return fazendaAcesso.toUserSummary(u);
		} catch (IOException e) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Falha ao salvar a foto.");
		}
	}

	private Usuario carregarAtivo(Long usuarioId) {
		var u = usuarios.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado."));
		if (!u.isAtivo()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Conta inativa.");
		}
		return u;
	}

	private static void validarImagem(MultipartFile file) {
		var ct = StringUtils.hasText(file.getContentType()) ? file.getContentType().toLowerCase(Locale.ROOT) : "";
		if (!CONTENT_TYPES.contains(ct)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use JPEG, PNG, WebP ou GIF.");
		}
		if (file.getSize() > MAX_BYTES) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Imagem excede 5MB.");
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
