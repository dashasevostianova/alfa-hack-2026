package alpha.hack.fulfillment;

import alpha.hack.integration.IntegrationService;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Service
public class LoanFulfillmentService {
    public static final long MAX_PDF_SIZE = 10 * 1024 * 1024;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final IntegrationService integration;
    private final ContractPdfGenerator pdf;
    public LoanFulfillmentService(JdbcTemplate jdbc, ObjectMapper json, IntegrationService integration, ContractPdfGenerator pdf) {
        this.jdbc = jdbc; this.json = json; this.integration = integration; this.pdf = pdf;
    }
    @SuppressWarnings("unchecked") private static Map<String, Object> map(Object value) { return (Map<String, Object>)value; }
    private static ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
    private Map<String, Object> application(int user, int id) {
        if (jdbc.queryForList("SELECT id FROM application WHERE id=? AND reg_id=? FOR UPDATE", id, user).isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Заявка не найдена или недоступна.");
        var app = integration.application(user, id);
        if (!"COMPLETED".equals(app.get("status")) || app.get("decision") == null
                || !"APPROVED".equals(map(app.get("decision")).get("outcome")))
            throw conflict("Оформление доступно только для одобренной заявки.");
        return app;
    }
    private Map<String, Object> state(Map<String, Object> app) {
        if (app.get("fulfillment") == null) throw conflict("Сначала сформируйте договор.");
        conditions(app);
        return map(app.get("fulfillment"));
    }
    private void conditions(Map<String, Object> app) {
        if (!(app.get("annualRate") instanceof Number rate) || !Double.isFinite(rate.doubleValue())
                || rate.doubleValue() < 0 || app.get("rateWarning") != null) throw conflict("Для оформления нужна подтверждённая годовая ставка.");
        if (app.get("fulfillment") != null) {
            var contract = map(map(app.get("fulfillment")).get("contract"));
            for (String field : List.of("amount", "months", "annualRate"))
                if (new BigDecimal(contract.get(field).toString()).compareTo(new BigDecimal(app.get(field).toString())) != 0)
                    throw conflict("Условия заявки изменились после формирования договора.");
        }
        // Do not mistake recommendations or an alternative approval for the original terms.
        var decisions = jdbc.queryForList("SELECT approved_amount,approved_term,approved_rate FROM decision WHERE decision_id=? ORDER BY created_at DESC,id DESC LIMIT 1", Integer.parseInt(app.get("id").toString()));
        if (!decisions.isEmpty()) {
            var decision = decisions.getFirst();
            for (var pair : Map.of("approved_amount", "amount", "approved_term", "months", "approved_rate", "annualRate").entrySet())
                if (decision.get(pair.getKey()) != null && new BigDecimal(decision.get(pair.getKey()).toString())
                        .compareTo(new BigDecimal(app.get(pair.getValue()).toString())) != 0)
                    throw conflict("Одобренные условия отличаются от заявки. Требуется согласование условий.");
        }
    }
    private static Map<String, Object> event(String type, String at) {
        return Map.of("id", UUID.randomUUID().toString(), "type", type, "at", at);
    }
    @SuppressWarnings("unchecked") private static void record(Map<String, Object> state, String type, String at) {
        ((List<Map<String, Object>>)state.get("history")).add(event(type, at));
    }
    private void save(int id, Map<String, Object> state) {
        jdbc.update("UPDATE loan_fulfillment SET payload=?::jsonb,updated_at=now() WHERE application_id=?", json.writeValueAsString(state), id);
    }
    private void unsigned(Map<String, Object> state) {
        if (state.get("signedAt") != null || "ISSUED".equals(state.get("status"))) throw conflict("После подписания документ нельзя изменить.");
    }

    @Transactional public Map<String, Object> get(int user, int id) { return application(user, id); }

    @Transactional
    public Map<String, Object> prepare(int user, int id) throws IOException {
        var app = application(user, id); conditions(app);
        if (app.get("fulfillment") != null) return app;
        var source = app.get("borrowerSnapshot") != null ? map(app.get("borrowerSnapshot")) : integration.profile(user);
        if (source == null || List.of("fullName", "companyName", "inn").stream().anyMatch(key -> source.get(key) == null || source.get(key).toString().isBlank()))
            throw conflict("Заполните реквизиты заёмщика.");
        String now = Instant.now().toString();
        double amount = ((Number)app.get("amount")).doubleValue();
        int months = ((Number)app.get("months")).intValue();
        double annualRate = ((Number)app.get("annualRate")).doubleValue();
        double rate = annualRate / 1200;
        double payment = rate == 0 ? amount / months : amount * rate / (1 - Math.pow(1 + rate, -months));
        var contract = new LinkedHashMap<String, Object>();
        contract.put("number", "DEMO-" + id); contract.put("applicationId", String.valueOf(id)); contract.put("generatedAt", now);
        contract.put("borrower", Map.of("fullName", source.get("fullName"), "companyName", source.get("companyName"), "inn", source.get("inn")));
        contract.put("borrowerSource", app.get("borrowerSnapshot") != null ? "application" : "current-profile");
        contract.put("amount", app.get("amount")); contract.put("months", months); contract.put("annualRate", app.get("annualRate"));
        contract.put("monthlyPayment", BigDecimal.valueOf(payment).setScale(2, RoundingMode.HALF_UP));
        contract.put("purpose", app.get("purpose")); contract.put("productName", app.getOrDefault("bankOfferName", app.get("productName")));
        var state = new LinkedHashMap<String, Object>(); state.put("status", "AWAITING_SIGNATURE"); state.put("contract", contract);
        state.put("history", new ArrayList<>(List.of(event("SUBMITTED", app.get("createdAt").toString()),
            event("APPROVAL_OBSERVED", now), event("CONTRACT_CREATED", now))));
        byte[] bytes = pdf.generate(contract);
        jdbc.update("INSERT INTO loan_fulfillment(application_id,payload,contract_pdf) VALUES (?,?::jsonb,?)", id, json.writeValueAsString(state), bytes);
        app.put("fulfillment", state); return app;
    }

    @Transactional public byte[] download(int user, int id) {
        var app = application(user, id); var state = state(app);
        if (state.get("downloadedAt") == null) {
            String now = Instant.now().toString(); state.put("downloadedAt", now); record(state, "CONTRACT_DOWNLOADED", now); save(id, state);
        }
        return jdbc.queryForObject("SELECT contract_pdf FROM loan_fulfillment WHERE application_id=?", byte[].class, id);
    }

    public static void validateFile(MultipartFile file) throws IOException {
        String name = file.getOriginalFilename(); String type = file.getContentType();
        if (name == null || name.length() > 255 || !name.toLowerCase(Locale.ROOT).endsWith(".pdf")
                || type != null && !type.isBlank() && !type.equalsIgnoreCase("application/pdf"))
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Выберите документ PDF.");
        if (file.getSize() > MAX_PDF_SIZE) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Размер PDF не должен превышать 10 МБ.");
        try (var stream = file.getInputStream()) {
            if (!new String(stream.readNBytes(5), StandardCharsets.US_ASCII).equals("%PDF-"))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Файл пуст или не содержит заголовок PDF.");
        }
    }

    @Transactional public Map<String, Object> upload(int user, int id, MultipartFile file) throws IOException {
        var app = application(user, id); var state = state(app); unsigned(state);
        if (state.get("downloadedAt") == null) throw conflict("Сначала скачайте договор.");
        validateFile(file);
        String name = file.getOriginalFilename().replace('\\', '/'); name = name.substring(name.lastIndexOf('/') + 1);
        String now = Instant.now().toString();
        state.put("document", Map.of("id", UUID.randomUUID().toString(), "name", name, "size", file.getSize(), "type", "application/pdf", "uploadedAt", now));
        state.put("status", "DOCUMENT_UPLOADED"); record(state, "DOCUMENT_UPLOADED", now);
        jdbc.update("UPDATE loan_fulfillment SET signed_pdf=? WHERE application_id=?", file.getBytes(), id);
        save(id, state); return app;
    }

    @Transactional public Map<String, Object> remove(int user, int id) {
        var app = application(user, id); var state = state(app); unsigned(state);
        if (state.remove("document") != null) {
            state.put("status", "AWAITING_SIGNATURE"); record(state, "DOCUMENT_REMOVED", Instant.now().toString());
            jdbc.update("UPDATE loan_fulfillment SET signed_pdf=NULL WHERE application_id=?", id); save(id, state);
        }
        return app;
    }

    @Transactional public Map<String, Object> confirm(int user, int id) {
        var app = application(user, id); var state = state(app);
        if (state.get("signedAt") != null) return app;
        if (state.get("downloadedAt") == null || state.get("document") == null || !"DOCUMENT_UPLOADED".equals(state.get("status")))
            throw conflict("Сначала скачайте и загрузите договор PDF.");
        String now = Instant.now().toString(); state.put("signedAt", now); state.put("status", "SIGNED"); record(state, "SIGNED", now);
        save(id, state); return app;
    }

    @Transactional public Map<String, Object> issue(int user, int id) {
        var app = application(user, id); var state = state(app);
        if (state.get("signedAt") == null || state.get("document") == null || !List.of("SIGNED", "ISSUED").contains(state.get("status")))
            throw conflict("Выдача доступна только после подтверждения подписания.");
        if (state.get("issuedAt") != null) return app;
        String now = Instant.now().toString(); state.put("issuedAt", now); state.put("status", "ISSUED"); record(state, "ISSUED", now);
        save(id, state); return app;
    }
}
