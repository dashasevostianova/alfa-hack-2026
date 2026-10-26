package alpha.hack.controller;
import alpha.hack.integration.IntegrationService;
import alpha.hack.integration.SessionAccess;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/applications")
public class ApplicationController {
    private final IntegrationService service;
    public ApplicationController(IntegrationService service) { this.service = service; }
    @GetMapping public List<Map<String, Object>> list(HttpSession session) { return service.list(SessionAccess.user(session)); }
    @GetMapping("/{id}") public Map<String, Object> get(@PathVariable int id, HttpSession session) { return service.application(SessionAccess.user(session), id); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@RequestBody Map<String, Object> draft, HttpSession session) { return service.create(SessionAccess.user(session), draft); }
}
