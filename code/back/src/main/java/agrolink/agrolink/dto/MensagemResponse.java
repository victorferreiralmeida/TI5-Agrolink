package agrolink.agrolink.dto;

import agrolink.agrolink.domain.MensagemChat;
import agrolink.agrolink.domain.Usuario;

public record MensagemResponse(
		Long id,
		String autorNome,
		String autorEmail,
		String autorFotoUrl,
		String texto,
		String midiaUrl,
		String criadoEm) {

	public static MensagemResponse from(MensagemChat m) {
		return from(m, m.getAutor());
	}

	public static MensagemResponse from(MensagemChat m, Usuario autor) {
		var t = m.getTexto();
		var foto = autor.getFotoUrl();
		return new MensagemResponse(
				m.getId(),
				autor.getNome(),
				autor.getEmail(),
				foto,
				t == null ? "" : t,
				m.getMidiaUrl(),
				m.getCriadoEm().toString());
	}
}
