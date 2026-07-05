package agrolink.agrolink.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "ocorrencias")
public class Ocorrencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String titulo;

    @Column(nullable = false, length = 100)
    private String setor;

    @Column(name = "setor_fazenda_id")
    private Long setorFazendaId;

    @Column(nullable = false, length = 100)
    private String categoria;

    @Column(length = 20)
    private String prioridade;

    @Column(length = 2000)
    private String descricao;

    @Column(nullable = false)
    private Double coordsx;

    @Column(nullable = false)
    private Double coordsy;

    @Column(nullable = false, length = 50)
    private String horario;

    @Column(length = 20)
    private String status;

    @Column(length = 4000)
    private String comentarios;

    @Column(length = 8000)
    private String imagens;

    /** Usuário responsável pela ocorrência (funcionário de campo ou atribuição do gerente). */
    @Column(name = "responsavel_id")
    private Long responsavelId;

    /** UUID gerado pelo cliente para idempotência em sync offline. */
    @Column(name = "client_uuid", unique = true, length = 36)
    private String clientUuid;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touchUpdatedAt() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getSetor() {
        return setor;
    }

    public void setSetor(String setor) {
        this.setor = setor;
    }

    public Long getSetorFazendaId() {
        return setorFazendaId;
    }

    public void setSetorFazendaId(Long setorFazendaId) {
        this.setorFazendaId = setorFazendaId;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public String getPrioridade() {
        return prioridade;
    }

    public void setPrioridade(String prioridade) {
        this.prioridade = prioridade;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public Double getCoordsX() {
        return coordsx;
    }

    public void setCoordsX(Double coordsx) {
        this.coordsx = coordsx;
    }

    public Double getCoordsY() {
        return coordsy;
    }

    public void setCoordsY(Double coordsy) {
        this.coordsy = coordsy;
    }

    public String getHorario() {
        return horario;
    }

    public void setHorario(String horario) {
        this.horario = horario;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getComentarios() {
        return comentarios;
    }

    public void setComentarios(String comentarios) {
        this.comentarios = comentarios;
    }

    public String getImagens() {
        return imagens;
    }

    public void setImagens(String imagens) {
        this.imagens = imagens;
    }

    public Long getResponsavelId() {
        return responsavelId;
    }

    public void setResponsavelId(Long responsavelId) {
        this.responsavelId = responsavelId;
    }

    public String getClientUuid() {
        return clientUuid;
    }

    public void setClientUuid(String clientUuid) {
        this.clientUuid = clientUuid;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}