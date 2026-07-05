package agrolink.agrolink.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record OcorrenciaRequest(
		@NotBlank @Size(max = 200) String titulo,
		@Size(max = 100) String setor,
		@NotBlank @Size(max = 100) String categoria,
		@NotBlank @Size(max = 20) String prioridade,
		@Size(max = 2000) String descricao,
		@Size(max = 20) String status,
		@Size(max = 50) String horario,
		@NotNull Double coordsX,
		@NotNull Double coordsY,
		Long setorId,
		@Size(max = 36) String clientUuid
) {
}
