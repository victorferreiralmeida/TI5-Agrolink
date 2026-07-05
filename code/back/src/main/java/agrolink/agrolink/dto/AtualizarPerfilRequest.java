package agrolink.agrolink.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AtualizarPerfilRequest(
		@NotBlank @Size(max = 120) String nome,
		@Size(max = 20) String telefone
) {
}
