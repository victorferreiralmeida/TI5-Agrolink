package agrolink.agrolink.repository;

import agrolink.agrolink.domain.Notificacao;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificacaoRepository extends JpaRepository<Notificacao, Long> {

	List<Notificacao> findByFazendaIdOrderByCriadoEmDesc(Long fazendaId, Pageable pageable);

	List<Notificacao> findByFazendaIdIsNullOrderByCriadoEmDesc(Pageable pageable);

	List<Notificacao> findByDestinatarioUsuarioIdOrderByCriadoEmDesc(Long destinatarioUsuarioId, Pageable pageable);
}
