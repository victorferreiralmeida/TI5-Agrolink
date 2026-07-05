package agrolink.agrolink.repository;

import agrolink.agrolink.domain.MensagemChat;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MensagemChatRepository extends JpaRepository<MensagemChat, Long> {

	@EntityGraph(attributePaths = "autor")
	@Query("select m from MensagemChat m where m.sala.id = :salaId order by m.criadoEm asc")
	List<MensagemChat> findBySalaIdOrderByCriadoEmAscWithAutor(@Param("salaId") Long salaId, Pageable pageable);

	List<MensagemChat> findBySalaIdOrderByCriadoEmAsc(Long salaId, Pageable pageable);

	Optional<MensagemChat> findTopBySalaIdOrderByCriadoEmDesc(Long salaId);

	long countBySalaId(Long salaId);
}
