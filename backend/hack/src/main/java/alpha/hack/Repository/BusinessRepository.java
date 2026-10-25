package alpha.hack.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import alpha.hack.entity.Business;

import java.util.Optional;

public interface BusinessRepository extends JpaRepository<Business, Integer> {

    Optional<Business> findByInn(String inn);

    Optional<Business> findFirstByReg_Id(Integer regId);

    boolean existsByInn(String inn);
}