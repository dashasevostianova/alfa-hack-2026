package alpha.hack.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import alpha.hack.entity.Product;

import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Integer> {
    Optional<Product> findByName(String name);
    boolean existsByName(String name);
}