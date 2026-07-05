package agrolink.agrolink.dto;

/**
 * Corpo de {@code PUT /api/ocorrencias/{id}/responsavel} (somente gerente).
 * {@code usuarioId} nulo remove a atribuição.
 */
public record AtribuirResponsavelRequest(Long usuarioId) {
}
