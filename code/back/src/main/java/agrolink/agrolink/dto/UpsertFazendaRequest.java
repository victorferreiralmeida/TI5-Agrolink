package agrolink.agrolink.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpsertFazendaRequest(
		@NotBlank @Size(max = 200) String nome,
		@Size(max = 16000) String perimetroGeojson
) {
}
