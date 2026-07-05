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
		name = "usuarios",
		uniqueConstraints = @UniqueConstraint(name = "uk_usuario_email", columnNames = "email")
)
public class Usuario {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 120)
	private String nome;

	@Column(nullable = false, length = 180)
	private String email;

	@Column(name = "senha_hash", nullable = false, length = 80)
	private String senhaHash;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 40)
	private PapelUsuario papel;

	@Column(length = 20)
	private String telefone;

	@Column(name = "foto_url", length = 500)
	private String fotoUrl;

	@Column(name = "data_ingresso")
	private Instant dataIngresso;

	/** Quando preenchido, o usuário (campo/produtor) enxerga notificações só desta fazenda. */
	@Column(name = "fazenda_vinculo_id")
	private Long fazendaVinculoId;

	@Column(nullable = false)
	private boolean ativo = true;

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getNome() {
		return nome;
	}

	public void setNome(String nome) {
		this.nome = nome;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getSenhaHash() {
		return senhaHash;
	}

	public void setSenhaHash(String senhaHash) {
		this.senhaHash = senhaHash;
	}

	public PapelUsuario getPapel() {
		return papel;
	}

	public void setPapel(PapelUsuario papel) {
		this.papel = papel;
	}

	public String getTelefone() {
		return telefone;
	}

	public void setTelefone(String telefone) {
		this.telefone = telefone;
	}

	public String getFotoUrl() {
		return fotoUrl;
	}

	public void setFotoUrl(String fotoUrl) {
		this.fotoUrl = fotoUrl;
	}

	public Instant getDataIngresso() {
		return dataIngresso;
	}

	public void setDataIngresso(Instant dataIngresso) {
		this.dataIngresso = dataIngresso;
	}

	public Long getFazendaVinculoId() {
		return fazendaVinculoId;
	}

	public void setFazendaVinculoId(Long fazendaVinculoId) {
		this.fazendaVinculoId = fazendaVinculoId;
	}

	public boolean isAtivo() {
		return ativo;
	}

	public void setAtivo(boolean ativo) {
		this.ativo = ativo;
	}
}
