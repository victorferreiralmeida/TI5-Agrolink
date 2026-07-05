package agrolink.agrolink.service;

import agrolink.agrolink.domain.ConviteEquipe;
import agrolink.agrolink.domain.PapelUsuario;
import agrolink.agrolink.domain.StatusConvite;
import agrolink.agrolink.domain.Usuario;
import agrolink.agrolink.dto.AtualizarMembroRequest;
import agrolink.agrolink.dto.ConvidarMembroRequest;
import agrolink.agrolink.dto.ConviteResponse;
import agrolink.agrolink.dto.EquipeResumo;
import agrolink.agrolink.dto.MembroResponse;
import agrolink.agrolink.repository.ConviteEquipeRepository;
import agrolink.agrolink.repository.FazendaRepository;
import agrolink.agrolink.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
public class EquipeService {

	private static final long CAPACIDADE_MAXIMA = 20L;
	private static final Duration VALIDADE_CONVITE = Duration.ofHours(48);

	private final UsuarioRepository usuarios;
	private final ConviteEquipeRepository convites;
	private final FazendaRepository fazendas;
	private final NotificacaoService notificacaoService;

	public EquipeService(
			UsuarioRepository usuarios,
			ConviteEquipeRepository convites,
			FazendaRepository fazendas,
			NotificacaoService notificacaoService) {
		this.usuarios = usuarios;
		this.convites = convites;
		this.fazendas = fazendas;
		this.notificacaoService = notificacaoService;
	}

	@Transactional(readOnly = true)
	public EquipeResumo carregarResumo(long usuarioId, String filtroPapel) {
		var ator = carregarUsuarioAtivo(usuarioId);
		Long fazendaId = fazendaVisivelParaUsuario(ator).orElse(null);
		var base = fazendaId == null ? List.<Usuario>of() : membrosDaFazenda(fazendaId);
		var papel = parsePapelFiltro(filtroPapel);
		var lista = papel == null ? base : base.stream().filter(u -> u.getPapel() == papel).toList();
		var membros = lista.stream().map(MembroResponse::from).toList();
		var pendentes = fazendaId != null && podeGerirEquipeNaFazenda(ator, fazendaId)
				? convites.findByStatusAndFazendaId(StatusConvite.PENDENTE, fazendaId).stream()
						.map(ConviteResponse::from)
						.toList()
				: List.<ConviteResponse>of();
		long gerentes = base.stream().filter(u -> u.getPapel() == PapelUsuario.GERENTE).count();
		long funcionarios = base.stream().filter(u -> u.getPapel() == PapelUsuario.FUNCIONARIO_CAMPO).count();
		long produtores = base.stream().filter(u -> u.getPapel() == PapelUsuario.PRODUTOR).count();
		long ocupadas = base.size();
		return new EquipeResumo(membros, pendentes, gerentes, funcionarios, produtores, ocupadas, CAPACIDADE_MAXIMA);
	}

	@Transactional(readOnly = true)
	public List<MembroResponse> listarMembros(long usuarioId, String filtroPapel) {
		var ator = carregarUsuarioAtivo(usuarioId);
		Long fazendaId = fazendaVisivelParaUsuario(ator).orElse(null);
		var base = fazendaId == null ? List.<Usuario>of() : membrosDaFazenda(fazendaId);
		var papel = parsePapelFiltro(filtroPapel);
		var lista = papel == null ? base : base.stream().filter(u -> u.getPapel() == papel).toList();
		return lista.stream().map(MembroResponse::from).toList();
	}

	/**
	 * Sem fazenda vinculada: lista vazia (conta nova não enxerga equipe demo global).
	 */

	@Transactional(readOnly = true)
	public MembroResponse buscarMembro(long usuarioId, Long id) {
		var ator = carregarUsuarioAtivo(usuarioId);
		Long fazendaId = fazendaVisivelParaUsuario(ator).orElseThrow(() -> new ResponseStatusException(
				HttpStatus.FORBIDDEN, "Nenhuma fazenda vinculada para visualizar a equipe."));
		var membro = carregarMembroAtivo(id);
		if (!membroPertenceAFazenda(membro, fazendaId)) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Membro não encontrado.");
		}
		return MembroResponse.from(membro);
	}

	@Transactional
	public MembroResponse atualizarMembro(long usuarioId, Long id, AtualizarMembroRequest body) {
		if (body == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dados do membro são obrigatórios.");
		}
		var ator = carregarUsuarioAtivo(usuarioId);
		Long fazendaId = fazendaVisivelParaUsuario(ator)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem fazenda para gerir equipe."));
		if (!podeGerirEquipeNaFazenda(ator, fazendaId)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão para alterar membros.");
		}
		var membro = carregarMembroAtivo(id);
		if (!membroPertenceAFazenda(membro, fazendaId)) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Membro não encontrado.");
		}
		if (StringUtils.hasText(body.nome())) {
			membro.setNome(body.nome().trim());
		}
		if (body.telefone() != null) {
			membro.setTelefone(normalizarTelefone(body.telefone()));
		}
		if (body.fotoUrl() != null) {
			var url = body.fotoUrl().trim();
			membro.setFotoUrl(url.isEmpty() ? null : url);
		}
		if (StringUtils.hasText(body.papel())) {
			var novoPapel = resolvePapel(body.papel());
			if (membro.getPapel() == PapelUsuario.PRODUTOR && novoPapel != PapelUsuario.PRODUTOR) {
				throw new ResponseStatusException(HttpStatus.FORBIDDEN, "O papel de produtor não pode ser alterado.");
			}
			membro.setPapel(novoPapel);
		}
		usuarios.save(membro);
		notificacaoService.registrar(
				"MEMBRO_ATUALIZADO",
				"Equipe",
				"Dados de membro atualizados",
				"O perfil de " + membro.getNome() + " foi alterado.",
				"USUARIO",
				membro.getId(),
				fazendaId);
		return MembroResponse.from(membro);
	}

	@Transactional
	public void removerMembro(long usuarioId, Long id) {
		var ator = carregarUsuarioAtivo(usuarioId);
		Long fazendaId = fazendaVisivelParaUsuario(ator)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem fazenda para gerir equipe."));
		if (!podeGerirEquipeNaFazenda(ator, fazendaId)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão para remover membros.");
		}
		if (ator.getPapel() == PapelUsuario.GERENTE && Objects.equals(ator.getId(), id)) {
			throw new ResponseStatusException(
					HttpStatus.FORBIDDEN,
					"O gerente não pode remover a si mesmo da equipe. Peça ao produtor se precisar sair.");
		}
		var membro = carregarMembroAtivo(id);
		if (!membroPertenceAFazenda(membro, fazendaId)) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Membro não encontrado.");
		}
		if (membro.getPapel() == PapelUsuario.PRODUTOR) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "O produtor não pode ser removido da equipe.");
		}
		String nome = membro.getNome();
		var fazenda = fazendas.findById(fazendaId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fazenda não encontrada."));
		if (fazenda.getGerenteUsuarioId() != null && fazenda.getGerenteUsuarioId().equals(membro.getId())) {
			fazenda.setGerenteUsuarioId(null);
			fazendas.save(fazenda);
		}
		if (Objects.equals(membro.getFazendaVinculoId(), fazendaId)) {
			membro.setFazendaVinculoId(null);
		}
		usuarios.save(membro);
		notificacaoService.registrar(
				"MEMBRO_REMOVIDO",
				"Equipe",
				"Membro removido da equipe",
				nome + " foi removido da equipe desta fazenda (a conta Agrolink permanece ativa).",
				"USUARIO",
				id,
				fazendaId);
	}

	@Transactional
	public ConviteResponse convidar(ConvidarMembroRequest body) {
		return convidar(body, null);
	}

	@Transactional
	public ConviteResponse convidar(ConvidarMembroRequest body, Long usuarioSolicitanteId) {
		if (body == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dados do convite são obrigatórios.");
		}
		if (usuarioSolicitanteId == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para enviar convites.");
		}
		var solicitante = carregarUsuarioAtivo(usuarioSolicitanteId);
		Long fazendaId = resolverFazendaDoConvite(usuarioSolicitanteId);
		if (fazendaId == null) {
			throw new ResponseStatusException(
					HttpStatus.CONFLICT, "Crie ou vincule uma fazenda antes de convidar membros.");
		}
		if (!podeGerirEquipeNaFazenda(solicitante, fazendaId)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão para convidar nesta fazenda.");
		}
		var email = StringUtils.hasText(body.email()) ? normalizarEmail(body.email()) : null;
		if (email == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o e-mail do convidado. Convites usam apenas e-mail.");
		}
		var papel = resolvePapel(body.papel());
		if (papel == PapelUsuario.PRODUTOR) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não é permitido convidar outro produtor.");
		}
		long ocupadas = membrosDaFazenda(fazendaId).size();
		if (ocupadas >= CAPACIDADE_MAXIMA) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Capacidade máxima de membros atingida nesta fazenda.");
		}
		Long destinatarioNotif = null;
		var existenteOpt = usuarios.findByEmailIgnoreCase(email);
		if (existenteOpt.isPresent()) {
			var ex = existenteOpt.get();
			if (!ex.isAtivo()) {
				throw new ResponseStatusException(HttpStatus.CONFLICT, "Este e-mail pertence a uma conta inativa.");
			}
			if (ex.getPapel() == PapelUsuario.GERENTE || ex.getPapel() == PapelUsuario.PRODUTOR) {
				throw new ResponseStatusException(
						HttpStatus.CONFLICT,
						"Este e-mail pertence a uma conta de produtor ou gerente, que não pode ser convidada por este fluxo.");
			}
			if (Objects.equals(ex.getFazendaVinculoId(), fazendaId)) {
				throw new ResponseStatusException(HttpStatus.CONFLICT, "Este usuário já faz parte desta equipe.");
			}
			if (ex.getFazendaVinculoId() != null) {
				throw new ResponseStatusException(
						HttpStatus.CONFLICT,
						"Este e-mail já está vinculado a outra fazenda. O usuário precisa sair da equipe atual para aceitar um novo convite.");
			}
			destinatarioNotif = ex.getId();
		}
		if (convites.existsByEmailIgnoreCaseAndStatusAndFazendaId(email, StatusConvite.PENDENTE, fazendaId)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um convite pendente para este e-mail nesta fazenda.");
		}
		var agora = Instant.now();
		var c = new ConviteEquipe();
		c.setEmail(email);
		c.setTelefone(null);
		c.setPapel(papel);
		c.setStatus(StatusConvite.PENDENTE);
		c.setToken(UUID.randomUUID().toString());
		c.setDataEnvio(agora);
		c.setDataExpiracao(agora.plus(VALIDADE_CONVITE));
		c.setFazendaId(fazendaId);
		convites.save(c);
		var destino = email;
		var papelLegivel = legivelPapelConvite(papel);
		notificacaoService.registrar(
				"CONVITE_EQUIPE",
				"Convite",
				"Convite enviado",
				"Convite enviado para " + destino + " como " + papelLegivel + ".",
				"CONVITE",
				c.getId(),
				fazendaId,
				null);
		if (destinatarioNotif != null) {
			notificacaoService.registrar(
					"CONVITE_EQUIPE_RECEBIDO",
					"Convite",
					"Convite para você",
					"Você foi convidado a integrar a equipe de uma fazenda como " + papelLegivel
							+ ". Aceite ou recuse na área \"Convites para entrar em fazenda\" acima.",
					"CONVITE",
					c.getId(),
					null,
					destinatarioNotif);
		}
		return ConviteResponse.from(c);
	}

	/** Após cadastro: avisa convites pendentes enviados antes da conta existir. */
	@Transactional
	public void notificarConvitesPendentesAoRegistrar(Usuario usuario) {
		if (usuario == null || !usuario.isAtivo()) {
			return;
		}
		var email = normalizarEmail(usuario.getEmail());
		expirarConvitesAtrasados();
		var pendentes = convites.findByStatusAndEmailIgnoreCaseOrderByDataEnvioDesc(StatusConvite.PENDENTE, email);
		for (var c : pendentes) {
			var papelLegivel = legivelPapelConvite(c.getPapel());
			notificacaoService.registrar(
					"CONVITE_EQUIPE_RECEBIDO",
					"Convite",
					"Convite para você",
					"Você foi convidado a integrar a equipe de uma fazenda como " + papelLegivel + ".",
					"CONVITE",
					c.getId(),
					null,
					usuario.getId());
		}
	}

	@Transactional(readOnly = true)
	public List<ConviteResponse> listarConvitesDoUsuario(long usuarioId) {
		var usuario = usuarios.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (!usuario.isAtivo()) {
			return List.of();
		}
		var email = normalizarEmail(usuario.getEmail());
		expirarConvitesAtrasados();
		return convites.findByStatusAndEmailIgnoreCaseOrderByDataEnvioDesc(StatusConvite.PENDENTE, email)
				.stream()
				.map(ConviteResponse::from)
				.toList();
	}

	@Transactional
	public ConviteResponse aceitarConvite(long usuarioId, long conviteId) {
		var usuario = usuarios.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		var convite = convites.findById(conviteId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Convite não encontrado."));
		validarConviteDestinatario(convite, usuario);
		if (convite.getDataExpiracao().isBefore(Instant.now())) {
			convite.setStatus(StatusConvite.EXPIRADO);
			convites.save(convite);
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Convite expirado.");
		}
		if (convite.getFazendaId() == null) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Convite sem fazenda vinculada. Solicite novo convite.");
		}
		usuario.setFazendaVinculoId(convite.getFazendaId());
		if (usuario.getPapel() != PapelUsuario.PRODUTOR) {
			usuario.setPapel(convite.getPapel());
		}
		usuarios.save(usuario);
		convite.setStatus(StatusConvite.ACEITO);
		convites.save(convite);
		notificacaoService.registrar(
				"CONVITE_ACEITO",
				"Equipe",
				"Convite aceito",
				usuario.getNome() + " aceitou o convite da equipe.",
				"CONVITE",
				convite.getId(),
				convite.getFazendaId());
		return ConviteResponse.from(convite);
	}

	@Transactional
	public ConviteResponse recusarConvite(long usuarioId, long conviteId) {
		var usuario = usuarios.findById(usuarioId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		var convite = convites.findById(conviteId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Convite não encontrado."));
		validarConviteDestinatario(convite, usuario);
		if (convite.getStatus() != StatusConvite.PENDENTE) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Convite não está pendente.");
		}
		convite.setStatus(StatusConvite.CANCELADO);
		convites.save(convite);
		notificacaoService.registrar(
				"CONVITE_RECUSADO",
				"Equipe",
				"Convite recusado",
				usuario.getNome() + " recusou o convite da equipe.",
				"CONVITE",
				convite.getId(),
				convite.getFazendaId());
		return ConviteResponse.from(convite);
	}

	@Transactional
	public ConviteResponse reenviar(long usuarioId, Long conviteId) {
		var ator = carregarUsuarioAtivo(usuarioId);
		var c = convites.findById(conviteId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Convite não encontrado."));
		assertPodeGerirConvite(ator, c);
		if (c.getStatus() == StatusConvite.ACEITO) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Convite já foi aceito.");
		}
		if (!StringUtils.hasText(c.getEmail())) {
			throw new ResponseStatusException(
					HttpStatus.CONFLICT,
					"Este convite não tem e-mail. Cancele e envie um novo convite usando apenas o e-mail do convidado.");
		}
		var agora = Instant.now();
		c.setStatus(StatusConvite.PENDENTE);
		c.setTelefone(null);
		c.setToken(UUID.randomUUID().toString());
		c.setDataEnvio(agora);
		c.setDataExpiracao(agora.plus(VALIDADE_CONVITE));
		convites.save(c);
		Long destinatarioNotif = null;
		String emailConvite = null;
		if (StringUtils.hasText(c.getEmail())) {
			emailConvite = normalizarEmail(c.getEmail());
			destinatarioNotif = usuarios.findByEmailIgnoreCase(emailConvite)
					.filter(u -> u.isAtivo() && u.getFazendaVinculoId() == null)
					.map(Usuario::getId)
					.orElse(null);
		}
		var destinoTxt = c.getEmail().trim();
		var papelLegivel = legivelPapelConvite(c.getPapel());
		notificacaoService.registrar(
				"CONVITE_REENVIADO",
				"Convite",
				"Convite reenviado",
				"Convite para " + destinoTxt + " foi reenviado (novo prazo de 48 h) como " + papelLegivel + ".",
				"CONVITE",
				c.getId(),
				c.getFazendaId(),
				null);
		if (destinatarioNotif != null) {
			notificacaoService.registrar(
					"CONVITE_REENVIADO_RECEBIDO",
					"Convite",
					"Convite atualizado",
					"Seu convite como " + papelLegivel + " foi reenviado com novo prazo. Use Aceitar ou Recusar na área de convites acima.",
					"CONVITE",
					c.getId(),
					null,
					destinatarioNotif);
		}
		return ConviteResponse.from(c);
	}

	@Transactional
	public void cancelar(long usuarioId, Long conviteId) {
		var ator = carregarUsuarioAtivo(usuarioId);
		var c = convites.findById(conviteId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Convite não encontrado."));
		assertPodeGerirConvite(ator, c);
		if (c.getStatus() == StatusConvite.ACEITO) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Não é possível cancelar um convite já aceito.");
		}
		c.setStatus(StatusConvite.CANCELADO);
		convites.save(c);
		notificacaoService.registrar(
				"CONVITE_CANCELADO",
				"Convite",
				"Convite cancelado",
				"O convite #" + conviteId + " foi cancelado.",
				"CONVITE",
				conviteId,
				c.getFazendaId());
	}

	@Transactional(readOnly = true)
	public List<ConviteResponse> listarConvitesPendentes(long usuarioId) {
		var ator = carregarUsuarioAtivo(usuarioId);
		Long fazendaId = fazendaVisivelParaUsuario(ator).orElse(null);
		if (fazendaId == null || !podeGerirEquipeNaFazenda(ator, fazendaId)) {
			return List.of();
		}
		expirarConvitesAtrasados();
		return convites.findByStatusAndFazendaId(StatusConvite.PENDENTE, fazendaId).stream()
				.map(ConviteResponse::from)
				.toList();
	}

	private void assertPodeGerirConvite(Usuario ator, ConviteEquipe c) {
		if (c.getFazendaId() == null) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Convite inválido.");
		}
		if (!podeGerirEquipeNaFazenda(ator, c.getFazendaId())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão para este convite.");
		}
	}

	private boolean podeGerirEquipeNaFazenda(Usuario u, Long fazendaId) {
		if (u.getPapel() == PapelUsuario.GERENTE) {
			return fazendas.findByGerenteUsuarioId(u.getId()).map(f -> f.getId().equals(fazendaId)).orElse(false);
		}
		if (u.getPapel() == PapelUsuario.PRODUTOR) {
			return Objects.equals(u.getFazendaVinculoId(), fazendaId);
		}
		return false;
	}

	private Optional<Long> fazendaVisivelParaUsuario(Usuario u) {
		if (u.getPapel() == PapelUsuario.GERENTE) {
			return fazendas.findByGerenteUsuarioId(u.getId()).map(f -> f.getId());
		}
		return Optional.ofNullable(u.getFazendaVinculoId());
	}

	private List<Usuario> membrosDaFazenda(Long fazendaId) {
		if (fazendaId == null) {
			return List.of();
		}
		var fazenda = fazendas.findById(fazendaId).orElse(null);
		if (fazenda == null) {
			return List.of();
		}
		var vinculados = usuarios.findByFazendaVinculoIdAndAtivoTrue(fazendaId);
		Long gid = fazenda.getGerenteUsuarioId();
		if (gid == null) {
			return ordenarPorId(vinculados);
		}
		var gerenteOpt = usuarios.findById(gid);
		if (gerenteOpt.isEmpty() || !gerenteOpt.get().isAtivo()) {
			return ordenarPorId(vinculados);
		}
		var gerente = gerenteOpt.get();
		boolean jaIncluido = vinculados.stream().anyMatch(x -> x.getId().equals(gerente.getId()));
		if (jaIncluido) {
			return ordenarPorId(vinculados);
		}
		var merged = new ArrayList<Usuario>(vinculados.size() + 1);
		merged.addAll(vinculados);
		merged.add(gerente);
		return ordenarPorId(merged);
	}

	private static List<Usuario> ordenarPorId(List<Usuario> lista) {
		return lista.stream().sorted(Comparator.comparing(Usuario::getId)).toList();
	}

	private boolean membroPertenceAFazenda(Usuario membro, Long fazendaId) {
		if (membro.getFazendaVinculoId() != null && membro.getFazendaVinculoId().equals(fazendaId)) {
			return true;
		}
		return fazendas.findById(fazendaId).map(f -> membro.getId().equals(f.getGerenteUsuarioId())).orElse(false);
	}

	private void expirarConvitesAtrasados() {
		var agora = Instant.now();
		var pendentes = convites.findByStatus(StatusConvite.PENDENTE);
		for (var c : pendentes) {
			if (c.getDataExpiracao().isBefore(agora)) {
				c.setStatus(StatusConvite.EXPIRADO);
				convites.save(c);
			}
		}
	}

	private void validarConviteDestinatario(ConviteEquipe convite, Usuario usuario) {
		if (convite.getStatus() != StatusConvite.PENDENTE) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Convite não está pendente.");
		}
		if (!StringUtils.hasText(convite.getEmail())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Convite não pode ser validado para esta conta.");
		}
		var emailUsuario = normalizarEmail(usuario.getEmail());
		if (!convite.getEmail().equalsIgnoreCase(emailUsuario)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este convite pertence a outro usuário.");
		}
	}

	private Long resolverFazendaDoConvite(Long usuarioSolicitanteId) {
		if (usuarioSolicitanteId == null) {
			return null;
		}
		var usuario = usuarios.findById(usuarioSolicitanteId).orElse(null);
		if (usuario == null) {
			return null;
		}
		if (usuario.getPapel() == PapelUsuario.GERENTE) {
			return fazendas.findByGerenteUsuarioId(usuarioSolicitanteId).map(f -> f.getId()).orElse(null);
		}
		if (usuario.getPapel() == PapelUsuario.PRODUTOR) {
			return usuario.getFazendaVinculoId();
		}
		return null;
	}

	private Usuario carregarUsuarioAtivo(long id) {
		var u = usuarios.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado."));
		if (!u.isAtivo()) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado.");
		}
		return u;
	}

	private Usuario carregarMembroAtivo(Long id) {
		var u = usuarios.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Membro não encontrado."));
		if (!u.isAtivo()) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Membro não encontrado.");
		}
		return u;
	}

	private static PapelUsuario parsePapelFiltro(String valor) {
		if (!StringUtils.hasText(valor) || "TODOS".equalsIgnoreCase(valor.trim())) {
			return null;
		}
		return resolvePapel(valor);
	}

	private static PapelUsuario resolvePapel(String papel) {
		try {
			var v = papel == null ? "" : papel.trim().toUpperCase(Locale.ROOT);
			if ("FUNCIONARIO".equals(v) || "FUNCIONARIOS".equals(v)) {
				return PapelUsuario.FUNCIONARIO_CAMPO;
			}
			if ("GERENTES".equals(v)) {
				return PapelUsuario.GERENTE;
			}
			return PapelUsuario.fromInput(papel);
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Perfil de acesso inválido.");
		}
	}

	private static String legivelPapelConvite(PapelUsuario papel) {
		if (papel == PapelUsuario.GERENTE) {
			return "gerente";
		}
		if (papel == PapelUsuario.FUNCIONARIO_CAMPO) {
			return "funcionário de campo";
		}
		return papel.name().toLowerCase(Locale.ROOT);
	}

	private static String normalizarEmail(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}

	private static String normalizarTelefone(String telefone) {
		if (telefone == null) {
			return null;
		}
		var t = telefone.trim();
		return t.isEmpty() ? null : t;
	}
}
