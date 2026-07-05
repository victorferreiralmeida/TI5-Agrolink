package agrolink.agrolink.repository;

import agrolink.agrolink.domain.ConviteEquipe;
import agrolink.agrolink.domain.StatusConvite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConviteEquipeRepository extends JpaRepository<ConviteEquipe, Long> {

	List<ConviteEquipe> findByStatus(StatusConvite status);

	List<ConviteEquipe> findByStatusAndFazendaId(StatusConvite status, Long fazendaId);

	List<ConviteEquipe> findByStatusAndEmailIgnoreCaseOrderByDataEnvioDesc(StatusConvite status, String email);

	Optional<ConviteEquipe> findByToken(String token);

	boolean existsByEmailIgnoreCaseAndStatus(String email, StatusConvite status);

	boolean existsByEmailIgnoreCaseAndStatusAndFazendaId(String email, StatusConvite status, Long fazendaId);
}
