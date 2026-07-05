package agrolink.agrolink.repository;

import agrolink.agrolink.domain.PapelUsuario;
import agrolink.agrolink.domain.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

	Optional<Usuario> findByEmailIgnoreCase(String email);

	boolean existsByEmailIgnoreCase(String email);

	List<Usuario> findByAtivoTrue();

	List<Usuario> findByPapelAndAtivoTrue(PapelUsuario papel);

	long countByAtivoTrue();

	List<Usuario> findByFazendaVinculoIdAndAtivoTrue(Long fazendaVinculoId);
}
