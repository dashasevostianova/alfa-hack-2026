package alpha.hack.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import alpha.hack.entity.Application;
import alpha.hack.enums.ApplicationStatus;

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