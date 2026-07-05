package agrolink.agrolink.dto;

import agrolink.agrolink.domain.ConviteEquipe;

public record ConviteResponse(
		Long id,
		String email,
		String telefone,
		String papel,
		String status,
		String dataEnvio,
		String dataExpiracao,
		Long fazendaId
) {
	public static ConviteResponse from(ConviteEquipe c) {
		return new ConviteResponse(
				c.getId(),
				c.getEmail(),
				c.getTelefone(),
				c.getPapel().name(),
				c.getStatus().name(),
				c.getDataEnvio().toString(),
				c.getDataExpiracao().toString(),
				c.getFazendaId()
		);
	}
}
