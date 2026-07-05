package agrolink.agrolink.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "fazendas")
public class Fazenda {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** Pode ser nulo quando a fazenda ainda não tem gerente ou após remoção da equipe. */
	@Column(name = "gerente_usuario_id", unique = true)
	private Long gerenteUsuarioId;

	@Column(nullable = false, length = 200)
	private String nome;

	@Column(name = "perimetro_geojson", columnDefinition = "LONGTEXT")
	private String perimetroGeojson;

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public Long getGerenteUsuarioId() {
		return gerenteUsuarioId;
	}

	public void setGerenteUsuarioId(Long gerenteUsuarioId) {
		this.gerenteUsuarioId = gerenteUsuarioId;
	}

	public String getNome() {
		return nome;
	}

	public void setNome(String nome) {
		this.nome = nome;
	}

	public String getPerimetroGeojson() {
		return perimetroGeojson;
	}

	public void setPerimetroGeojson(String perimetroGeojson) {
		this.perimetroGeojson = perimetroGeojson;
	}
}
