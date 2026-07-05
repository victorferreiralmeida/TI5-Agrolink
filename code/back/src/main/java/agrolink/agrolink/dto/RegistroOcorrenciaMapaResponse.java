package agrolink.agrolink.dto;

import java.util.List;

public record RegistroOcorrenciaMapaResponse(
		List<FazendaMapaRegistroDto> fazendas,
		List<SetorRegistroDto> setores) {
}
