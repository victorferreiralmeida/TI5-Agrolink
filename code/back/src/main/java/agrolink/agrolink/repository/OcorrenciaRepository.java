package agrolink.agrolink.repository;

import agrolink.agrolink.domain.Ocorrencia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface OcorrenciaRepository extends JpaRepository<Ocorrencia, Long> {

	List<Ocorrencia> findBySetorFazendaIdIn(Collection<Long> setorFazendaIds);

	List<Ocorrencia> findBySetorFazendaIdInAndUpdatedAtAfter(Collection<Long> setorFazendaIds, Instant since);

	Optional<Ocorrencia> findByClientUuid(String clientUuid);
}