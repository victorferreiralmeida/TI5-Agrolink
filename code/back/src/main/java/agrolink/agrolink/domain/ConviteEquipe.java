package agrolink.agrolink.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

@Entity
@Table(
		name = "convites_equipe",
		uniqueConstraints = @UniqueConstraint(name = "uk_convite_token", columnNames = "token")
)
public class ConviteEquipe {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(length = 180)
	private String email;

	@Column(length = 20)
	private String telefone;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 40)
	private PapelUsuario papel;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private StatusConvite status;

	@Column(nullable = false, length = 80)
	private String token;

	@Column(name = "data_envio", nullable = false)
	private Instant dataEnvio;

	@Column(name = "data_expiracao", nullable = false)
	private Instant dataExpiracao;

	/** Fazenda destino do convite (vínculo aplicado ao aceitar). */
	@Column(name = "fazenda_id")
	private Long fazendaId;

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getTelefone() {
		return telefone;
	}

	public void setTelefone(String telefone) {
		this.telefone = telefone;
	}

	public PapelUsuario getPapel() {
		return papel;
	}

	public void setPapel(PapelUsuario papel) {
		this.papel = papel;
	}

	public StatusConvite getStatus() {
		return status;
	}

	public void setStatus(StatusConvite status) {
		this.status = status;
	}

	public String getToken() {
		return token;
	}

	public void setToken(String token) {
		this.token = token;
	}

	public Instant getDataEnvio() {
		return dataEnvio;
	}

	public void setDataEnvio(Instant dataEnvio) {
		this.dataEnvio = dataEnvio;
	}

	public Instant getDataExpiracao() {
		return dataExpiracao;
	}

	public void setDataExpiracao(Instant dataExpiracao) {
		this.dataExpiracao = dataExpiracao;
	}

	public Long getFazendaId() {
		return fazendaId;
	}

	public void setFazendaId(Long fazendaId) {
		this.fazendaId = fazendaId;
	}
}
