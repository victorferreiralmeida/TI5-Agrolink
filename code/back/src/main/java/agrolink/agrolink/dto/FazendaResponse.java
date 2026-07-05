package agrolink.agrolink.dto;

import agrolink.agrolink.domain.Fazenda;

import java.util.List;

public record FazendaResponse(Long id, String nome, String perimetroGeojson, List<FazendaSetorResponse> setores) {

	public static FazendaResponse from(Fazenda f, List<FazendaSetorResponse> setores) {
		return new FazendaResponse(f.getId(), f.getNome(), f.getPerimetroGeojson(), setores);
	}
}
