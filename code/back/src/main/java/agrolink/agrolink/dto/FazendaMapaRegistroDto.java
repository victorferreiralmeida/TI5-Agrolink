package agrolink.agrolink.dto;

/** Perímetro da fazenda para desenho no mapa de registro de ocorrência. */
public record FazendaMapaRegistroDto(Long id, String nome, String perimetroGeojson) {
}
