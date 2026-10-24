package alpha.hack.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import alpha.hack.dto.LoanProductResponse;
import alpha.hack.entity.Product;
import alpha.hack.repository.ProductRepository;

@Service
public class ProductService {
    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public List<LoanProductResponse> getAllProducts() {
        List<LoanProductResponse> products = new ArrayList<>();
        for (Product product : productRepository.findAll()) {
            products.add(new LoanProductResponse(product.getId(), product.getName(),
            product.getDescription(), product.getRate(), product.getMinAmount(),
            product.getMaxAmount(), product.getMinTerm(), product.getMaxTerm()));
        }
        return products;
    }

}
