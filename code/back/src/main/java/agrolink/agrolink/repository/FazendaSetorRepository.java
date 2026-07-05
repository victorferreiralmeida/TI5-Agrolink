package agrolink.agrolink.repository;

import agrolink.agrolink.domain.FazendaSetor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface FazendaSetorRepository extends JpaRepository<FazendaSetor, Long> {

	List<FazendaSetor> findByFazendaIdOrderByNomeAsc(Long fazendaId);

	@Query("select s from FazendaSetor s join fetch s.fazenda f order by f.nome asc, s.nome asc")
	List<FazendaSetor> findAllComFazendaOrder();
}
