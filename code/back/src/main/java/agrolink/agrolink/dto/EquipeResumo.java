package agrolink.agrolink.dto;

import java.util.List;

public record EquipeResumo(
		List<MembroResponse> membros,
		List<ConviteResponse> convitesPendentes,
		long totalGerentes,
		long totalFuncionarios,
		long totalProdutores,
		long vagasOcupadas,
		long capacidadeMaxima
) {
}
