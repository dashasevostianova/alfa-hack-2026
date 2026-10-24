package alpha.hack.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import alpha.hack.Entity.Application;
import alpha.hack.Enums.ApplicationStatus;
import java.util.List;

public interface ApplicationRepository
        extends JpaRepository<Application, Integer> {

    List<Application> findByReg_Id(Integer regId);

    List<Application> findByStatus(ApplicationStatus status);

    List<Application> findByReg_IdAndStatus(
            Integer regId,
            ApplicationStatus status
    );

    List<Application> findByProduct_Id(Integer productId);
}