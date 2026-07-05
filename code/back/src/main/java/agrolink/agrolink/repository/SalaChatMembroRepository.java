package agrolink.agrolink.repository;

import agrolink.agrolink.domain.SalaChat;
import agrolink.agrolink.domain.SalaChatMembro;
import agrolink.agrolink.domain.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SalaChatMembroRepository extends JpaRepository<SalaChatMembro, Long> {

	boolean existsBySala_IdAndUsuario_Id(Long salaId, Long usuarioId);

	long countBySala_Id(Long salaId);

	@Query("select m.sala from SalaChatMembro m where m.usuario.id = :usuarioId order by m.sala.id asc")
	List<SalaChat> findSalasDoUsuario(@Param("usuarioId") Long usuarioId);

	@Query("select m.usuario from SalaChatMembro m where m.sala.id = :salaId order by m.usuario.nome asc")
	List<Usuario> findUsuariosBySalaId(@Param("salaId") Long salaId);
}
