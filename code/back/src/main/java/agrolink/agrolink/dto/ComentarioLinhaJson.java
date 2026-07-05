package agrolink.agrolink.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Uma linha de comentário persistida como JSON (fácil de estender e escapar corretamente).
 * {@code a} = URLs de imagens anexadas ao comentário (mesmo esquema de path que as evidências da ocorrência).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ComentarioLinhaJson(String ts, String n, String e, String f, String m, List<String> a) {
}
