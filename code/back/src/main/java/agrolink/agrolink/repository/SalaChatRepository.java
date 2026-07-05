package agrolink.agrolink.repository;

import agrolink.agrolink.domain.SalaChat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SalaChatRepository extends JpaRepository<SalaChat, Long> {

	List<SalaChat> findAllByOrderByIdAsc();
}
