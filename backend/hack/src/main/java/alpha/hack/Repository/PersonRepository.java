package alpha.hack.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import alpha.hack.Entity.Person;

public interface PersonRepository extends JpaRepository<Person, Integer> {
}