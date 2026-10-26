package alpha.hack.controller;

import alpha.hack.integration.ModelDecisionService;
import alpha.hack.integration.SessionAccess;
import jakarta.servlet.http.HttpSession;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/applications/{id}/model-decision")
public class ModelDecisionController {
    private final ModelDecisionService service;
    public ModelDecisionController(ModelDecisionService service) { this.service = service; }
    @PostMapping public Map<String, Object> evaluate(@PathVariable int id, HttpSession session) {
        return service.evaluate(SessionAccess.user(session), id);
    }
}
