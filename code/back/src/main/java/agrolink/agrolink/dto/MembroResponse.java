package agrolink.agrolink.dto;

import agrolink.agrolink.domain.Usuario;

public record MembroResponse(
		Long id,
		String nome,
		String email,
		String telefone,
		String papel,
		String fotoUrl,
		String dataIngresso,
		boolean ativo
) {
	public static MembroResponse from(Usuario u) {
		return new MembroResponse(
				u.getId(),
				u.getNome(),
				u.getEmail(),
				u.getTelefone(),
				u.getPapel().name(),
				u.getFotoUrl(),
				u.getDataIngresso() == null ? null : u.getDataIngresso().toString(),
				u.isAtivo()
		);
	}
}
