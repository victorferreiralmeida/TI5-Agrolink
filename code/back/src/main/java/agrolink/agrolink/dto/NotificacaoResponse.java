package agrolink.agrolink.dto;

import agrolink.agrolink.domain.Notificacao;

public record NotificacaoResponse(
		Long id,
		String tipo,
		String tag,
		String tagTone,
		String icon,
		String titulo,
		String mensagem,
		String refTipo,
		Long refId,
		String criadoEm
) {
	public static NotificacaoResponse from(Notificacao n) {
		return new NotificacaoResponse(
				n.getId(),
				n.getTipo(),
				n.getTag(),
				tagToneParaTipo(n.getTipo()),
				iconParaTipo(n.getTipo()),
				n.getTitulo(),
				n.getMensagem(),
				n.getRefTipo(),
				n.getRefId(),
				n.getCriadoEm().toString()
		);
	}

	private static String tagToneParaTipo(String tipo) {
		if (tipo == null) return "muted";
		return switch (tipo) {
			case "OCORRENCIA_NOVA", "OCORRENCIA_EXCLUIDA" -> "danger";
			case "OCORRENCIA_RESOLVIDA", "OCORRENCIA_COMENTARIO", "CONVITE_EQUIPE", "CONVITE_EQUIPE_RECEBIDO", "CONVITE_REENVIADO", "CONVITE_REENVIADO_RECEBIDO", "OCORRENCIA_IMAGENS" -> "ok";
			default -> "muted";
		};
	}

	private static String iconParaTipo(String tipo) {
		if (tipo == null) return "sync";
		return switch (tipo) {
			case "OCORRENCIA_NOVA", "OCORRENCIA_ATUALIZADA", "OCORRENCIA_EXCLUIDA" -> "alert";
			case "OCORRENCIA_RESOLVIDA" -> "sync";
			case "OCORRENCIA_COMENTARIO" -> "chat";
			case "OCORRENCIA_IMAGENS" -> "wrench";
			case "CONVITE_EQUIPE", "CONVITE_EQUIPE_RECEBIDO", "CONVITE_REENVIADO", "CONVITE_REENVIADO_RECEBIDO", "CONVITE_CANCELADO", "MEMBRO_ATUALIZADO", "MEMBRO_REMOVIDO" -> "user";
			case "FAZENDA_CRIADA", "FAZENDA_ATUALIZADA", "SETOR_CRIADO", "SETOR_ATUALIZADO", "SETOR_REMOVIDO" -> "wrench";
			default -> "sync";
		};
	}
}
