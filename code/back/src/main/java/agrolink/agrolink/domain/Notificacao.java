package agrolink.agrolink.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "notificacoes")
public class Notificacao {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** Ex.: OCORRENCIA_NOVA, FAZENDA_ATUALIZADA, SETOR_CRIADO */
	@Column(nullable = false, length = 48)
	private String tipo;

	/** Rótulo curto para o chip (ex.: Nova ocorrência) */
	@Column(nullable = false, length = 120)
	private String tag;

	@Column(nullable = false, length = 500)
	private String titulo;

	@Column(length = 2000)
	private String mensagem;

	@Column(name = "ref_tipo", length = 40)
	private String refTipo;

	@Column(name = "ref_id")
	private Long refId;

	/** Fazenda à qual o evento se refere; nulo = notificações globais de equipe (visíveis ao produtor). */
	@Column(name = "fazenda_id")
	private Long fazendaId;

	/** Quando preenchido, a notificação aparece prioritariamente para este usuário (ex.: convite de equipe). */
	@Column(name = "destinatario_usuario_id")
	private Long destinatarioUsuarioId;

	@Column(name = "criado_em", nullable = false)
	private Instant criadoEm = Instant.now();

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getTipo() {
		return tipo;
	}

	public void setTipo(String tipo) {
		this.tipo = tipo;
	}

	public String getTag() {
		return tag;
	}

	public void setTag(String tag) {
		this.tag = tag;
	}

	public String getTitulo() {
		return titulo;
	}

	public void setTitulo(String titulo) {
		this.titulo = titulo;
	}

	public String getMensagem() {
		return mensagem;
	}

	public void setMensagem(String mensagem) {
		this.mensagem = mensagem;
	}

	public String getRefTipo() {
		return refTipo;
	}

	public void setRefTipo(String refTipo) {
		this.refTipo = refTipo;
	}

	public Long getRefId() {
		return refId;
	}

	public void setRefId(Long refId) {
		this.refId = refId;
	}

	public Long getFazendaId() {
		return fazendaId;
	}

	public void setFazendaId(Long fazendaId) {
		this.fazendaId = fazendaId;
	}

	public Long getDestinatarioUsuarioId() {
		return destinatarioUsuarioId;
	}

	public void setDestinatarioUsuarioId(Long destinatarioUsuarioId) {
		this.destinatarioUsuarioId = destinatarioUsuarioId;
	}

	public Instant getCriadoEm() {
		return criadoEm;
	}

	public void setCriadoEm(Instant criadoEm) {
		this.criadoEm = criadoEm;
	}
}
