package alpha.hack.controller;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import alpha.hack.dto.LoanProductResponse;
import alpha.hack.service.ProductService;

@RestController
@RequestMapping("/api/loans/products")
public class ProductController {
    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping("")
    public List<LoanProductResponse> getLoanProducts() {
        return productService.getAllProducts();
    }
}
