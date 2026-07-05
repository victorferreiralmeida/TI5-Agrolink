package agrolink.agrolink.dto;

import agrolink.agrolink.domain.FazendaSetor;

public record FazendaSetorResponse(Long id, String nome, String poligonoGeojson) {

	public static FazendaSetorResponse from(FazendaSetor s) {
		return new FazendaSetorResponse(s.getId(), s.getNome(), s.getPoligonoGeojson());
	}
}
