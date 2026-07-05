package agrolink.agrolink.auth;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

/**
 * Extrai o id do usuário do token retornado no login ({@code agrolink-{id}}).
 */
public final class AgrolinkBearerToken {

	private AgrolinkBearerToken() {
	}

	public static long parseUsuarioId(String authorization) {
		if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Envie o header Authorization: Bearer (token retornado no login).");
		}
		var token = authorization.substring(7).trim();
		if (!token.regionMatches(true, 0, "agrolink-", 0, 9)) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token de autenticação inválido.");
		}
		var suffix = token.substring(9);
		try {
			return Long.parseLong(suffix);
		} catch (NumberFormatException e) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token de autenticação inválido.");
		}
	}

	/** Token ausente ou inválido: retorna vazio (sem lançar exceção). */
	public static Optional<Long> tryParseUsuarioId(String authorization) {
		if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
			return Optional.empty();
		}
		var token = authorization.substring(7).trim();
		if (!token.regionMatches(true, 0, "agrolink-", 0, 9)) {
			return Optional.empty();
		}
		var suffix = token.substring(9);
		try {
			return Optional.of(Long.parseLong(suffix));
		} catch (NumberFormatException e) {
			return Optional.empty();
		}
	}
}
