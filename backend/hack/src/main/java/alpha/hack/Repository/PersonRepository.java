package alpha.hack.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import alpha.hack.entity.Person;

import java.util.Optional;

public interface PersonRepository extends JpaRepository<Person, Integer> {
    Optional<Person> findFirstByReg_Id(Integer regId);

}