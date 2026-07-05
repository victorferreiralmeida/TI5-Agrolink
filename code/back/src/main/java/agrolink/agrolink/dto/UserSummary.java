package agrolink.agrolink.dto;

import agrolink.agrolink.domain.Usuario;

public record UserSummary(
		Long id,
		String nome,
		String email,
		String papel,
		String telefone,
		String fotoUrl,
		boolean temFazenda) {
	public static UserSummary from(Usuario u, boolean temFazenda) {
		return new UserSummary(
				u.getId(),
				u.getNome(),
				u.getEmail(),
				u.getPapel().name(),
				u.getTelefone(),
				u.getFotoUrl(),
				temFazenda);
	}
}
