package agrolink.agrolink.service;

import agrolink.agrolink.domain.Notificacao;
import agrolink.agrolink.domain.PapelUsuario;
import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.dto.NotificacaoResponse;
import agrolink.agrolink.repository.FazendaRepository;
import agrolink.agrolink.repository.NotificacaoRepository;
import agrolink.agrolink.repository.UsuarioRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

@Service
public class NotificacaoService {

	private static final int LIMITE = 100;
	private static final PageRequest PAGE = PageRequest.of(0, LIMITE);

	private final NotificacaoRepository repository;
	private final UsuarioRepository usuarioRepository;
	private final FazendaRepository fazendaRepository;

	public NotificacaoService(
			NotificacaoRepository repository,
			UsuarioRepository usuarioRepository,
			FazendaRepository fazendaRepository) {
		this.repository = repository;
		this.usuarioRepository = usuarioRepository;
		this.fazendaRepository = fazendaRepository;
	}

	@Transactional(readOnly = true)
	public List<NotificacaoResponse> listarRecentes(long usuarioId) {
		Usuario u = usuarioRepository.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (!u.isAtivo()) {
			return List.of();
		}
		PapelUsuario papel = u.getPapel();
		Long vinculo = u.getFazendaVinculoId();

		if (papel == PapelUsuario.GERENTE) {
			var daFazenda = fazendaRepository.findByGerenteUsuarioId(usuarioId)
					.map(f -> repository.findByFazendaIdOrderByCriadoEmDesc(f.getId(), PAGE))
					.orElseGet(List::of);
			var diretas = repository.findByDestinatarioUsuarioIdOrderByCriadoEmDesc(usuarioId, PAGE);
			return Stream.concat(daFazenda.stream(), diretas.stream())
					.sorted(Comparator.comparing(Notificacao::getCriadoEm).reversed())
					.limit(LIMITE)
					.map(NotificacaoResponse::from)
					.toList();
		}

		if (papel == PapelUsuario.FUNCIONARIO_CAMPO) {
			if (vinculo == null) {
				return repository.findByDestinatarioUsuarioIdOrderByCriadoEmDesc(usuarioId, PAGE).stream()
						.map(NotificacaoResponse::from)
						.toList();
			}
			return repository.findByFazendaIdOrderByCriadoEmDesc(vinculo, PAGE).stream()
					.filter(n -> n.getDestinatarioUsuarioId() == null
							|| Objects.equals(n.getDestinatarioUsuarioId(), usuarioId))
					.map(NotificacaoResponse::from)
					.toList();
		}

		// PRODUTOR: convites / equipe (fazenda nula) + fazenda vinculada, se houver
		List<Notificacao> globais = repository.findByFazendaIdIsNullOrderByCriadoEmDesc(PAGE);
		if (vinculo == null) {
			return globais.stream().map(NotificacaoResponse::from).toList();
		}
		List<Notificacao> daFazenda = repository.findByFazendaIdOrderByCriadoEmDesc(vinculo, PAGE);
		return Stream.concat(globais.stream(), daFazenda.stream())
				.sorted(Comparator.comparing(Notificacao::getCriadoEm).reversed())
				.limit(LIMITE)
				.map(NotificacaoResponse::from)
				.toList();
	}

	@Transactional
	public void registrar(String tipo, String tag, String titulo, String mensagem, String refTipo, Long refId, Long fazendaId) {
		registrar(tipo, tag, titulo, mensagem, refTipo, refId, fazendaId, null);
	}

	@Transactional
	public void registrar(
			String tipo,
			String tag,
			String titulo,
			String mensagem,
			String refTipo,
			Long refId,
			Long fazendaId,
			Long destinatarioUsuarioId) {
		var n = new Notificacao();
		n.setTipo(tipo);
		n.setTag(tag);
		n.setTitulo(titulo);
		n.setMensagem(mensagem != null && !mensagem.isBlank() ? mensagem : titulo);
		n.setRefTipo(refTipo);
		n.setRefId(refId);
		n.setFazendaId(fazendaId);
		n.setDestinatarioUsuarioId(destinatarioUsuarioId);
		n.setCriadoEm(Instant.now());
		repository.save(n);
	}
}
