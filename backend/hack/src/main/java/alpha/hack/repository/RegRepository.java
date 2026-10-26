package alpha.hack.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import alpha.hack.entity.Reg;

import java.util.Optional;

public interface RegRepository extends JpaRepository<Reg, Integer> {

    Optional<Reg> findByLogin(String login);

    boolean existsByLogin(String login);
}