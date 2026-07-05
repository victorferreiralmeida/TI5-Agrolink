package agrolink.agrolink.messaging;

public record ChatMensagemEvent(
		Long id,
		Long salaId,
		Long autorId,
		String autorNome,
		String autorEmail,
		String texto,
		String midiaUrl,
		String criadoEm
) {
}