package agrolink.agrolink.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AtualizarFazendaSetorRequest(
		@NotBlank @Size(max = 100) String nome,
		@Size(max = 16000) String poligonoGeojson
) {
}
