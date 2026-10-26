package alpha.hack.controller;

import alpha.hack.dto.RegistrationRequest;
import alpha.hack.entity.Reg;
import alpha.hack.repository.RegRepository;
import alpha.hack.integration.SessionAccess;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final RegRepository repository;
    private final JdbcTemplate jdbc;
    public AuthController(RegRepository repository, JdbcTemplate jdbc) { this.repository = repository; this.jdbc = jdbc; }
    private Map<String, Object> view(Reg user) {
        return Map.of("id", user.getId().toString(), "regId", user.getId(), "login", user.getLogin(),
                "profileComplete", jdbc.queryForObject("SELECT count(*) FROM integration_profile WHERE reg_id=?", Integer.class, user.getId()) > 0);
    }
    private Map<String, Object> signIn(Reg user, HttpServletRequest request) {
        request.getSession().setAttribute("regId", user.getId());
        request.changeSessionId();
        request.getSession().removeAttribute("csrf");
        return view(user);
    }
    @GetMapping("/csrf") public Map<String, String> csrf(HttpSession session) {
        return Map.of("headerName", "X-CSRF-TOKEN", "token", SessionAccess.csrf(session));
    }
    @GetMapping("/me") public Map<String, Object> me(HttpSession session) {
        return view(repository.findById(SessionAccess.user(session)).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)));
    }
    @GetMapping("/login-availability") public Map<String, Boolean> available(@RequestParam String login) {
        return Map.of("available", !repository.existsByLogin(login));
    }
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> register(@RequestBody RegistrationRequest body, HttpServletRequest request) {
        if (body.login() == null || !body.login().matches("[a-zA-Z0-9_.-]{3,40}") || body.password() == null
                || body.password().length() < 9 || body.password().length() > 72
                || !body.password().matches("(?s).*[a-z].*") || !body.password().matches("(?s).*[A-Z].*"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Проверьте логин и пароль (9–72 символа, оба регистра латиницы).");
        if (repository.existsByLogin(body.login())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Этот логин уже занят.");
        Reg reg = new Reg(); reg.setLogin(body.login()); reg.setPasswordHash(body.password());
        // Existing PostgreSQL trigger hashes the password exactly once.
        return signIn(repository.saveAndFlush(reg), request);
    }
    @PostMapping("/login") public Map<String, Object> login(@RequestBody RegistrationRequest body, HttpServletRequest request) {
        if (body.password() == null || body.login() == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Неверный логин или пароль.");
        var ids = jdbc.queryForList("SELECT id FROM reg WHERE login=? AND password_hash=crypt(?,password_hash)", Integer.class, body.login(), body.password());
        if (ids.isEmpty()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Неверный логин или пароль.");
        return signIn(repository.findById(ids.getFirst()).orElseThrow(), request);
    }
    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpSession session) { session.invalidate(); }
}
