package alpha.hack.fulfillment;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/** Optional demo adapter. Never writes to or replaces the real decision table. */
@Service
public class DemoLoanReview {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final boolean enabled;
    public DemoLoanReview(JdbcTemplate jdbc, ObjectMapper json,
            @Value("${loan.demo-decision-enabled:false}") boolean enabled) {
        this.jdbc = jdbc; this.json = json; this.enabled = enabled;
    }

    public static Map<String, Object> decision(int amount) {
        var result = new LinkedHashMap<String, Object>();
        result.put("reasons", List.of()); result.put("recommendations", List.of());
        if (amount <= 2_000_000) {
            result.put("outcome", "APPROVED"); result.put("summary", "Ваша заявка одобрена в демонстрационном режиме.");
        } else if (amount <= 5_000_000) {
            result.put("outcome", "REVISION"); result.put("summary", "Текущая заявка не одобрена. Можно изменить условия и подать новую.");
            result.put("reasons", List.of("Запрошенная сумма превышает демонстрационный лимит."));
            result.put("recommendations", List.of("Уменьшите сумму до 2 000 000 ₽ и подайте новую заявку."));
            result.put("suggestedAmount", 2_000_000);
        } else {
            result.put("outcome", "REJECTED"); result.put("summary", "По заявке принято отрицательное демонстрационное решение.");
            result.put("reasons", List.of("Сумма существенно превышает демонстрационный лимит."));
            result.put("recommendations", List.of("Пересмотрите объём финансирования."));
        }
        return result;
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> apply(int user, int id, Map<String, Object> view) {
        if (view.get("decision") != null || !List.of("SUBMITTED", "DOCS_REQUESTED", "IN_CHECK")
                .contains(view.get("formationStatus"))) return view;
        if (!enabled && jdbc.queryForList("SELECT payload::text FROM loan_demo_review WHERE application_id=?", String.class, id).isEmpty()) return view;
        // Serialize demo-review creation with signing and never override a real model decision.
        jdbc.queryForList("SELECT id FROM application WHERE id=? AND reg_id=? FOR UPDATE", id, user);
        if (jdbc.queryForObject("SELECT count(*) FROM decision WHERE decision_id=?", Integer.class, id) > 0) return view;
        view.put("decisionSource", "DEMO");
        long age = Duration.between(Instant.parse(view.get("createdAt").toString()), Instant.now()).toSeconds();
        var saved = jdbc.queryForList("SELECT payload::text FROM loan_demo_review WHERE application_id=?", String.class, id);
        if (saved.isEmpty() && age < 15) {
            view.put("status", age < 5 ? "SUBMITTED" : age < 10 ? "VERIFICATION" : "REVIEW");
            return view;
        }
        Map<String, Object> review;
        if (saved.isEmpty()) {
            review = Map.of("decision", decision(((Number)view.get("amount")).intValue()), "at", Instant.now().toString());
            jdbc.update("INSERT INTO loan_demo_review(application_id,payload) VALUES (?,?::jsonb)", id, json.writeValueAsString(review));
        } else review = json.readValue(saved.getFirst(), Map.class);
        view.put("status", "COMPLETED"); view.put("decision", review.get("decision")); view.put("decisionAt", review.get("at"));
        return view;
    }
}
