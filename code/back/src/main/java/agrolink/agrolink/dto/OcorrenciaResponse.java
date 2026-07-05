package agrolink.agrolink.dto;

import agrolink.agrolink.domain.Ocorrencia;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;

public record OcorrenciaResponse(
		Long id,
		String titulo,
		String setor,
		Long setorFazendaId,
		String categoria,
		String prioridade,
		String descricao,
		String status,
		String comentarios,
		Double coordsX,
		Double coordsY,
		String horario,
		Long responsavelId,
		String responsavelNome,
		List<String> imagens,
		String clientUuid,
		Instant updatedAt
) {
	public static OcorrenciaResponse from(Ocorrencia o, String responsavelNome) {
		var prioridade = StringUtils.hasText(o.getPrioridade()) ? o.getPrioridade() : "MEDIA";
		var status = StringUtils.hasText(o.getStatus()) ? o.getStatus() : "ABERTA";
		var imagens = StringUtils.hasText(o.getImagens())
				? List.of(o.getImagens().split("\n")).stream().map(String::trim).filter(StringUtils::hasText).toList()
				: List.<String>of();
		return new OcorrenciaResponse(
				o.getId(),
				o.getTitulo(),
				o.getSetor(),
				o.getSetorFazendaId(),
				o.getCategoria(),
				prioridade,
				o.getDescricao(),
				status,
				o.getComentarios(),
				o.getCoordsX(),
				o.getCoordsY(),
				o.getHorario(),
				o.getResponsavelId(),
				responsavelNome,
				imagens,
				o.getClientUuid(),
				o.getUpdatedAt()
		);
	}
}
