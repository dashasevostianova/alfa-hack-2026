package alpha.hack.integration;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> status(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("message", error.getReason() == null ? "Ошибка запроса" : error.getReason()));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<?> constraint(DataIntegrityViolationException error) {
        return ResponseEntity.status(409).body(Map.of("message", "Данные противоречат ограничениям БД: проверьте уникальность логина/ИНН и обязательные поля."));
    }
    @ExceptionHandler({IllegalArgumentException.class, ArithmeticException.class, NullPointerException.class})
    public ResponseEntity<?> invalid(RuntimeException error) {
        return ResponseEntity.badRequest().body(Map.of("message", "Проверьте формат и обязательные поля запроса."));
    }
}
