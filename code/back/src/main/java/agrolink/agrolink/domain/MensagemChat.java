package agrolink.agrolink.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "chat_mensagens")
public class MensagemChat {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "sala_id", nullable = false)
	private SalaChat sala;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "autor_id", nullable = false)
	private Usuario autor;

	/** Texto opcional se houver {@link #midiaUrl}. */
	@Column(length = 2000)
	private String texto;

	/** Caminho público (ex.: {@code /uploads/chat/1/arquivo.jpg}). */
	@Column(name = "midia_url", length = 500)
	private String midiaUrl;

	@Column(name = "criado_em", nullable = false)
	private Instant criadoEm;

	@PrePersist
	void prePersist() {
		if (criadoEm == null) {
			criadoEm = Instant.now();
		}
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public SalaChat getSala() {
		return sala;
	}

	public void setSala(SalaChat sala) {
		this.sala = sala;
	}

	public Usuario getAutor() {
		return autor;
	}

	public void setAutor(Usuario autor) {
		this.autor = autor;
	}

	public String getTexto() {
		return texto;
	}

	public void setTexto(String texto) {
		this.texto = texto;
	}

	public String getMidiaUrl() {
		return midiaUrl;
	}

	public void setMidiaUrl(String midiaUrl) {
		this.midiaUrl = midiaUrl;
	}

	public Instant getCriadoEm() {
		return criadoEm;
	}

	public void setCriadoEm(Instant criadoEm) {
		this.criadoEm = criadoEm;
	}
}
