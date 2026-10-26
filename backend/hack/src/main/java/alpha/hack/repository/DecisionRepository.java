package alpha.hack.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import alpha.hack.entity.Decision;
import alpha.hack.enums.DecisionType;

import java.util.List;
import java.util.Optional;

public interface DecisionRepository
        extends JpaRepository<Decision, Integer> {

    List<Decision> findByApplication_Id(Integer applicationId);

    List<Decision> findByDecision(DecisionType decision);

    Optional<Decision> findFirstByApplication_IdOrderByCreatedAtDesc(
            Integer applicationId
    );
}