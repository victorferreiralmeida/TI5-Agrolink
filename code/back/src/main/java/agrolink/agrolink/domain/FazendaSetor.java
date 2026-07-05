package agrolink.agrolink.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "fazenda_setores")
public class FazendaSetor {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "fazenda_id", nullable = false)
	private Fazenda fazenda;

	@Column(nullable = false, length = 100)
	private String nome;

	@Column(name = "poligono_geojson", columnDefinition = "LONGTEXT")
	private String poligonoGeojson;

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public Fazenda getFazenda() {
		return fazenda;
	}

	public void setFazenda(Fazenda fazenda) {
		this.fazenda = fazenda;
	}

	public String getNome() {
		return nome;
	}

	public void setNome(String nome) {
		this.nome = nome;
	}

	public String getPoligonoGeojson() {
		return poligonoGeojson;
	}

	public void setPoligonoGeojson(String poligonoGeojson) {
		this.poligonoGeojson = poligonoGeojson;
	}
}
