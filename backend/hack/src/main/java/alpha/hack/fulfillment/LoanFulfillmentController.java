package alpha.hack.fulfillment;

import alpha.hack.integration.SessionAccess;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/applications/{id}/fulfillment")
public class LoanFulfillmentController {
    private final LoanFulfillmentService service;
    public LoanFulfillmentController(LoanFulfillmentService service) { this.service = service; }
    @GetMapping public Map<String, Object> get(@PathVariable int id, HttpSession session) { return service.get(SessionAccess.user(session), id); }
    @PostMapping("/contract") public Map<String, Object> prepare(@PathVariable int id, HttpSession session) throws IOException {
        return service.prepare(SessionAccess.user(session), id);
    }
    @GetMapping(value="/contract.pdf", produces=MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> download(@PathVariable int id, HttpSession session) {
        return ResponseEntity.ok().header("Content-Disposition", "attachment; filename=\"DEMO-" + id + ".pdf\"")
            .body(service.download(SessionAccess.user(session), id));
    }
    @PostMapping(value="/document", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> upload(@PathVariable int id, @RequestParam("file") MultipartFile file, HttpSession session) throws IOException {
        return service.upload(SessionAccess.user(session), id, file);
    }
    @DeleteMapping("/document") public Map<String, Object> remove(@PathVariable int id, HttpSession session) { return service.remove(SessionAccess.user(session), id); }
    @PostMapping("/confirm") public Map<String, Object> confirm(@PathVariable int id, HttpSession session) {
        simulateProcessing(); return service.confirm(SessionAccess.user(session), id);
    }
    @PostMapping("/issue") public Map<String, Object> issue(@PathVariable int id, HttpSession session) {
        simulateProcessing(); return service.issue(SessionAccess.user(session), id);
    }
    private void simulateProcessing() {
        try { Thread.sleep(600); } catch (InterruptedException error) {
            Thread.currentThread().interrupt(); throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Операция прервана. Повторите попытку.");
        }
    }
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<?> tooLarge() { return ResponseEntity.status(413).body(Map.of("message", "Размер PDF не должен превышать 10 МБ.")); }
}
