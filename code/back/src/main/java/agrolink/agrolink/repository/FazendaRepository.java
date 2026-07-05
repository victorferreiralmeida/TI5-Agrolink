package agrolink.agrolink.repository;

import agrolink.agrolink.domain.Fazenda;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FazendaRepository extends JpaRepository<Fazenda, Long> {

	Optional<Fazenda> findByGerenteUsuarioId(Long gerenteUsuarioId);

	boolean existsByGerenteUsuarioId(Long gerenteUsuarioId);
}
