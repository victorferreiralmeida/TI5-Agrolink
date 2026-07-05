package agrolink.agrolink.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record NovaSalaChatRequest(@NotBlank @Size(max = 160) String nome, List<Long> membroIds) {

	public NovaSalaChatRequest {
		membroIds = membroIds == null ? List.of() : List.copyOf(membroIds);
	}
}
