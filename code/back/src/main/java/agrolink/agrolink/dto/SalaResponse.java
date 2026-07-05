package agrolink.agrolink.dto;

import agrolink.agrolink.domain.MensagemChat;
import agrolink.agrolink.domain.SalaChat;

public record SalaResponse(
		Long id,
		String nome,
		String imagemUrl,
		String ultimaPreview,
		String ultimaEm,
		Long ultimaMensagemId,
		String ultimaAutorEmail) {

	public static SalaResponse from(SalaChat s, MensagemChat ultima) {
		if (ultima == null) {
			return new SalaResponse(s.getId(), s.getNome(), s.getImagemUrl(), null, null, null, null);
		}
		var u = ultima.getAutor();
		var preview = montarPreview(ultima, u.getNome());
		return new SalaResponse(
				s.getId(),
				s.getNome(),
				s.getImagemUrl(),
				preview,
				ultima.getCriadoEm().toString(),
				ultima.getId(),
				u.getEmail());
	}

	private static String montarPreview(MensagemChat m, String nomeAutor) {
		var t = m.getTexto();
		var midia = m.getMidiaUrl();
		var base = "";
		if (t != null && !t.isBlank()) {
			base = nomeAutor + ": " + t.trim();
		} else if (midia != null && !midia.isBlank()) {
			var lower = midia.toLowerCase();
			if (lower.endsWith(".pdf")) {
				base = nomeAutor + ": [PDF]";
			} else {
				base = nomeAutor + ": [imagem]";
			}
		} else {
			base = nomeAutor + ": (mensagem)";
		}
		if (base.length() > 80) {
			return base.substring(0, 77) + "…";
		}
		return base;
	}
}
