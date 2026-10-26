package alpha.hack.integration;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

/** Confirms the frontend model evaluation using only server-owned application data. */
@Service
public class ModelDecisionService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final IntegrationService applications;
    private final String modelUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    public ModelDecisionService(JdbcTemplate jdbc, ObjectMapper json, IntegrationService applications,
            @Value("${MODEL_URL:http://localhost:8082}") String modelUrl) {
        this.jdbc = jdbc; this.json = json; this.applications = applications;
        this.modelUrl = modelUrl.replaceAll("/+$", "");
    }
    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message); }
    private static Number number(Object value, String name) {
        if (!(value instanceof Number result) || !Double.isFinite(result.doubleValue())) throw invalid("В заявке отсутствует показатель: " + name);
        return result;
    }
    @SuppressWarnings("unchecked")
    public static Map<String, Object> features(Map<String, Object> app, Instant now) {
        if (!(app.get("company") instanceof Map<?, ?> company) || !(app.get("finances") instanceof List<?> finances)
                || finances.isEmpty() || !(finances.getFirst() instanceof Map<?, ?> finance)) throw invalid("В заявке отсутствуют сведения компании или финансовые показатели.");
        Instant registered;
        try { registered = LocalDate.parse(String.valueOf(company.get("registration_date"))).atStartOfDay().toInstant(ZoneOffset.UTC); }
        catch (RuntimeException error) { throw invalid("В данных компании некорректная дата регистрации."); }
        if (registered.isAfter(now)) throw invalid("Дата регистрации компании не может быть в будущем.");
        Object legal = company.get("legal_form");
        if (!"OOO".equals(legal) && !"IP".equals(legal)) throw invalid("Не удалось определить юридическую форму компании.");
        int purpose = List.of("Пополнение оборотных средств", "Покупка оборудования", "Развитие бизнеса", "Ремонт помещения").indexOf(app.get("purpose"));
        if (purpose < 0) throw invalid("Для этой цели кредита нет кода модели.");
        var features = new LinkedHashMap<String, Object>();
        features.put("business_age_years", (now.toEpochMilli() - registered.toEpochMilli()) / 86_400_000.0 / 365.2425);
        features.put("legal_form", "OOO".equals(legal) ? 1 : 0);
        features.put("revenue", number(finance.get("revenue"), "выручка"));
        features.put("net_profit", number(finance.get("net_profit"), "чистая прибыль"));
        features.put("current_loans", finance.get("current_loans") != null && number(finance.get("current_loans"), "текущие обязательства").doubleValue() > 0 ? 1 : 0);
        features.put("purpose", purpose);
        features.put("amount", number(app.get("amount"), "сумма кредита"));
        features.put("term_months", number(app.get("months"), "срок кредита"));
        return features;
    }
    public int predict(Map<String, Object> features) {
        try {
            var request = HttpRequest.newBuilder(URI.create(modelUrl + "/predict")).timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json").header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(features))).build();
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new IllegalStateException("Model HTTP " + response.statusCode());
            Object value = json.readValue(response.body(), Map.class).get("prediction");
            if (!(value instanceof Number prediction) || (prediction.doubleValue() != 0 && prediction.doubleValue() != 1))
                throw new IllegalStateException("Invalid prediction");
            return prediction.intValue();
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt(); throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Запрос к модели прерван.");
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Не удалось подтвердить решение модели на сервере. Повторите оценку заявки.");
        }
    }
    @Transactional
    public Map<String, Object> evaluate(int user, int id) {
        if (jdbc.queryForList("SELECT id FROM application WHERE id=? AND reg_id=? FOR UPDATE", id, user).isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Заявка не найдена или недоступна.");
        var app = applications.application(user, id);
        // Preserve historical server decisions, including previously issued demo loans.
        if (app.get("decision") != null) return app;
        if (!List.of("SUBMITTED", "DOCS_REQUESTED", "IN_CHECK").contains(app.get("formationStatus")))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Заявка недоступна для оценки.");
        int prediction = predict(features(app, Instant.now()));
        String outcome = prediction == 1 ? "APPROVED" : "REJECTED";
        String summary = prediction == 1 ? "Модель оценила заявку как предварительно одобренную." : "Модель оценила заявку как не одобренную.";
        jdbc.update("INSERT INTO decision(decision_id,decision,reason,approved_amount,approved_term,approved_rate) VALUES (?,?::decision_t,?,?,?,?)",
            id, outcome, summary, prediction == 1 ? app.get("amount") : null,
            prediction == 1 ? app.get("months") : null, prediction == 1 ? app.get("annualRate") : null);
        jdbc.update("UPDATE application SET status=?::app_status_t WHERE id=?", outcome, id);
        return applications.application(user, id);
    }
}
