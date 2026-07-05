package agrolink.agrolink.dto;

import jakarta.validation.constraints.Size;

public record NovaMensagemChatRequest(@Size(max = 2000) String texto, @Size(max = 500) String midiaUrl) {
}
