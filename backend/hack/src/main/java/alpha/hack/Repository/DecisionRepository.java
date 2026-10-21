package alpha.hack.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import alpha.hack.Entity.Decision;
import alpha.hack.Enums.DecisionType;
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