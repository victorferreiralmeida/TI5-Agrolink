package agrolink.agrolink.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AtualizarSalaChatRequest(@NotBlank @Size(max = 160) String nome) {
}
