package alpha.hack.controller;
import alpha.hack.integration.IntegrationService;
import alpha.hack.integration.ExternalServices;
import alpha.hack.integration.SessionAccess;
import jakarta.servlet.http.HttpSession;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api")
public class ProfileController {
    private final IntegrationService service;
    private final ExternalServices external;
    public ProfileController(IntegrationService service, ExternalServices external) { this.service=service; this.external=external; }
    @GetMapping("/profile") public Map<String, Object> get(HttpSession session) { return service.profile(SessionAccess.user(session)); }
    @PostMapping("/profile") public Map<String, Object> save(@RequestBody Map<String, Object> profile, HttpSession session) { return service.saveProfile(SessionAccess.user(session), profile); }
    @GetMapping("/formation/companies/{inn}") public Map<String, Object> company(@PathVariable String inn) { return external.company(inn); }
    @GetMapping("/loans/quote") public Map<String, Object> quote(@RequestParam boolean collateral, HttpSession session) { return service.quote(SessionAccess.user(session), collateral); }
}
