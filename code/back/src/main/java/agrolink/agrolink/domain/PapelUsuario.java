package agrolink.agrolink.domain;

import java.util.Locale;

public enum PapelUsuario {
	PRODUTOR,
	GERENTE,
	FUNCIONARIO_CAMPO;

	public static PapelUsuario fromInput(String value) {
		if (value == null || value.isBlank()) {
			return FUNCIONARIO_CAMPO;
		}
		return PapelUsuario.valueOf(value.trim().toUpperCase(Locale.ROOT));
	}
}
