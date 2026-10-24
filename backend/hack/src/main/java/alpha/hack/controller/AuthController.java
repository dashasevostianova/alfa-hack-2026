package alpha.hack.controller;

import alpha.hack.dto.RegistrationRequest;
import alpha.hack.dto.RegistrationResponse;
import alpha.hack.entity.Reg;
import alpha.hack.repository.RegRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final RegRepository regRepository;

    public AuthController(RegRepository regRepository) {
        this.regRepository = regRepository;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegistrationResponse register(@RequestBody RegistrationRequest request) {
        if (request.login() == null || request.login().isBlank()
                || request.password() == null || request.password().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Login and password are required");
        }
        if (regRepository.existsByLogin(request.login())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Login is already registered");
        }

        Reg reg = new Reg();
        reg.setLogin(request.login());
        reg.setPasswordHash(request.password());
        Reg saved = regRepository.save(reg);
        return new RegistrationResponse(saved.getId(), saved.getLogin());
    }
}