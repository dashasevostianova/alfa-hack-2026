package alpha.hack.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import alpha.hack.Entity.Business;
import java.util.Optional;

public interface BusinessRepository extends JpaRepository<Business, Integer> {

    Optional<Business> findByInn(String inn);

    boolean existsByInn(String inn);
}