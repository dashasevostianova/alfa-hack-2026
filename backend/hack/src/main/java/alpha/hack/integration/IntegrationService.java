package alpha.hack.integration;

import alpha.hack.dto.ApplicationSubmission;
import alpha.hack.enums.Purpose;
import alpha.hack.enums.LegalForm;
import alpha.hack.enums.BusinessStatus;
import alpha.hack.service.ApplicationService;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Service
public class IntegrationService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ExternalServices external;
    private final ApplicationService applications;
    private static final List<String> PURPOSES = List.of("Пополнение оборотных средств", "Покупка оборудования", "Развитие бизнеса", "Ремонт помещения");
    public IntegrationService(JdbcTemplate jdbc, ObjectMapper json, ExternalServices external, ApplicationService applications) {
        this.jdbc = jdbc; this.json = json; this.external = external; this.applications = applications;
    }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return (Map<String, Object>) value; }
    private Map<String, Object> read(String value) { return map(json.readValue(value, Map.class)); }
    private String text(Map<String, Object> value, String key) { return Objects.toString(value.get(key), "").trim(); }
    private Integer integer(Object value) { return value == null ? null : new java.math.BigDecimal(value.toString()).intValueExact(); }
    public Map<String, Object> profile(int user) {
        var values = jdbc.queryForList("SELECT payload::text FROM integration_profile WHERE reg_id=?", String.class, user);
        return values.isEmpty() ? null : read(values.getFirst());
    }
    public Map<String, Object> saveProfile(int user, Map<String, Object> profile) {
        for (String key : List.of("fullName", "phone", "email", "passport", "companyName", "industry", "citizenship"))
            if (text(profile, key).isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Заполните поле " + key);
        String[] name = text(profile, "fullName").split("\\s+");
        String passport = text(profile, "passport").replaceAll("\\s", "");
        if (name.length < 2 || !passport.matches("[0-9]{10}")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Проверьте ФИО и паспорт.");
        try {
            LocalDate birth = LocalDate.parse(text(profile, "birthDate"));
            if (birth.isAfter(LocalDate.now().minusYears(18))) throw new IllegalArgumentException();
            if (integer(profile.get("monthlyRevenue")) <= 0) throw new IllegalArgumentException();
        } catch (Exception error) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Укажите дату рождения (18+) и положительную месячную выручку."); }
        Map<String, Object> prepared = external.prepare(profile);
        var saved = new LinkedHashMap<>(profile); saved.put("prepared", prepared);
        jdbc.update("INSERT INTO integration_profile(reg_id,payload) VALUES (?,?::jsonb) ON CONFLICT(reg_id) DO UPDATE SET payload=excluded.payload,updated_at=now()", user, json.writeValueAsString(saved));
        return saved;
    }
    public Map<String, Object> quote(int user, boolean collateral) {
        var profile = profile(user);
        if (profile == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Сначала сохраните анкету.");
        var company = map(map(profile.get("prepared")).get("company"));
        return companyQuote(company, collateral);
    }
    private Map<String, Object> companyQuote(Map<String, Object> company, boolean collateral) {
        LocalDate registered = LocalDate.parse(text(company, "registration_date"));
        int ageMonths = Math.toIntExact(java.time.temporal.ChronoUnit.MONTHS.between(registered, LocalDate.now(ZoneOffset.UTC)));
        if (registered.isAfter(LocalDate.now(ZoneOffset.UTC))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Проверьте дату регистрации бизнеса.");
        return external.quote(ageMonths, collateral, text(company, "legal_form"));
    }
    @Transactional
    public Map<String, Object> create(int user, Map<String, Object> draft) {
        var profile = profile(user);
        if (profile == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Сначала сохраните анкету.");
        var prepared = map(profile.get("prepared"));
        var company = map(prepared.get("company")); var stored = map(prepared.get("stored"));
        int months = integer(draft.get("months"));
        boolean collateral = Boolean.TRUE.equals(draft.get("collateral"));
        var quote = companyQuote(company, collateral);
        var offer = ExternalServices.selectOffer(quote, text(draft, "bankOfferId"));
        if (draft.get("annualRate") == null || Double.compare(((Number)offer.get("annualRate")).doubleValue(), Double.parseDouble(draft.get("annualRate").toString())) != 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ставка изменилась. Обновите расчёт перед отправкой.");
        int purpose = PURPOSES.indexOf(text(draft, "purpose"));
        if (purpose < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Неизвестная цель кредита.");
        var owners = jdbc.queryForList("SELECT reg_id FROM business WHERE inn=?", Integer.class, text(company, "inn"));
        if (!owners.isEmpty() && owners.getFirst() != user) throw new ResponseStatusException(HttpStatus.CONFLICT, "ИНН уже связан с другим аккаунтом.");
        String[] name = text(profile, "fullName").split("\\s+", 3);
        String passport = text(profile, "passport").replaceAll("\\s", "");
        var snapshot = new LinkedHashMap<String, Object>();
        snapshot.put("bankOffer", offer);
        snapshot.put("kind", "integration_snapshot_v1"); snapshot.put("profile", profile); snapshot.put("prepared", prepared); snapshot.put("quote", quote);
        ApplicationSubmission submission = new ApplicationSubmission(user, integer(draft.get("productId")), integer(draft.get("amount")), months,
            Purpose.values()[purpose],
            new ApplicationSubmission.PersonDetails(name[1], name[0], name.length > 2 ? name[2] : null,
                LocalDate.parse(text(profile, "birthDate")), text(profile, "citizenship"), passport.substring(0, 4), passport.substring(4), null, null, null, text(profile, "phone"), text(profile, "email")),
            new ApplicationSubmission.BusinessDetails(LegalForm.valueOf(text(company, "legal_form")), text(company, "fullname"),
                BusinessStatus.valueOf(text(company, "status")), text(company, "inn"), (String)company.get("ogrn"), LocalDate.parse(text(company, "registration_date")), null, text(company, "okved"), null),
            List.of(new ApplicationSubmission.FinanceDetails(integer(stored.get("revenue")), integer(stored.get("net_profit")), json.writeValueAsString(snapshot), integer(stored.get("tax_arrears")), integer(stored.get("current_loans")))));
        // Existing Java service remains responsible for the transactional application/person/business/finance write.
        int id = applications.submit(submission).id();
        jdbc.update("UPDATE application SET status='SUBMITTED' WHERE id=?", id);
        return application(user, id);
    }
    public List<Map<String, Object>> list(int user) {
        return jdbc.queryForList("SELECT id FROM application WHERE reg_id=? ORDER BY id DESC", Integer.class, user).stream().map(id -> application(user, id)).toList();
    }
    public Map<String, Object> application(int user, int id) {
        var rows = jdbc.queryForList("SELECT a.*,p.name AS product_name,p.rate FROM application a JOIN product p ON p.id=a.product_id WHERE a.id=? AND a.reg_id=?", id, user);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Заявка не найдена.");
        var row = rows.getFirst();
        var finances = jdbc.queryForList("SELECT * FROM finances WHERE application_id=? ORDER BY id", id);
        Map<String, Object> snapshot = new LinkedHashMap<>();
        if (!finances.isEmpty() && finances.getFirst().get("account_statements") instanceof String raw) {
            try { snapshot = read(raw); } catch (Exception ignored) { /* Legacy free-text statement. */ }
        }
        String status = text(row, "status");
        var result = new LinkedHashMap<String, Object>();
        result.put("id", String.valueOf(id)); result.put("productId", row.get("product_id").toString());
        result.put("productName", row.get("product_name")); result.put("amount", row.get("amount")); result.put("months", row.get("term_months"));
        try { result.put("purpose", PURPOSES.get(Purpose.valueOf(text(row,"purpose").replace(' ', '_')).ordinal())); }
        catch (Exception ignored) { result.put("purpose", row.get("purpose")); }
        result.put("createdAt", ((java.sql.Timestamp)row.get("created_at")).toLocalDateTime().atOffset(ZoneOffset.UTC).toString());
        result.put("status", switch(status) { case "DOCS_REQUESTED" -> "VERIFICATION"; case "IN_CHECK" -> "REVIEW"; case "APPROVED", "REJECTED" -> "COMPLETED"; default -> "SUBMITTED"; });
        result.put("formationStatus", status); result.put("decision", null); result.put("annualRate", row.get("rate"));
        result.put("finances", finances); result.put("company", Map.of()); result.put("calculated", Map.of()); result.put("warnings", List.of()); result.put("source", "legacy");
        if (snapshot.get("prepared") instanceof Map<?, ?>) {
            if (snapshot.get("profile") instanceof Map<?, ?>) {
                var borrower = map(snapshot.get("profile"));
                result.put("borrowerSnapshot", Map.of("fullName", text(borrower, "fullName"),
                    "companyName", text(borrower, "companyName"), "inn", text(borrower, "inn")));
            }
            var prepared = map(snapshot.get("prepared")); var report = map(prepared.get("report"));
            result.put("company", prepared.get("company")); result.put("calculated", report.get("calculated"));
            result.put("source", report.get("source")); result.put("warnings", report.get("warnings"));
            var quote = map(snapshot.get("quote")); result.put("annualRate", quote.get("annualRate")); result.put("collateral", quote.get("collateral"));
            if (snapshot.get("bankOffer") instanceof Map<?, ?>) {
                var offer = map(snapshot.get("bankOffer"));
                result.put("annualRate", offer.get("annualRate")); result.put("bankOfferId", offer.get("id"));
                result.put("bankOfferName", offer.get("name"));
            } else {
                // Old snapshots did not preserve which product or rate unit was parsed.
                result.put("annualRate", null);
                result.put("rateWarning", "Ставка старой заявки не содержит продукт и единицу измерения; требуется новый расчёт.");
            }
        }
        // Existing real decisions always take priority over the optional demo adapter.
        var decisions = jdbc.queryForList("SELECT * FROM decision WHERE decision_id=? ORDER BY created_at DESC,id DESC LIMIT 1", id);
        if (!decisions.isEmpty()) {
            var decision = decisions.getFirst(); String outcome = text(decision, "decision");
            var view = new LinkedHashMap<String, Object>();
            view.put("outcome", outcome.equals("APPROVED") ? "APPROVED" : outcome.equals("REJECTED") ? "REJECTED" : "REVISION");
            view.put("summary", decision.get("reason")); view.put("reasons", List.of()); view.put("recommendations", List.of());
            if (decision.get("approved_amount") != null) view.put("suggestedAmount", decision.get("approved_amount"));
            result.put("decision", view);
        }
        var fulfillment = jdbc.queryForList("SELECT payload::text FROM loan_fulfillment WHERE application_id=?", String.class, id);
        if (!fulfillment.isEmpty()) result.put("fulfillment", read(fulfillment.getFirst()));
        // Read old demo decisions for compatibility; all new decisions come from the model.
        if (result.get("decision") == null) {
            var legacy = jdbc.queryForList("SELECT payload::text FROM loan_demo_review WHERE application_id=?", String.class, id);
            if (!legacy.isEmpty()) {
                var review = read(legacy.getFirst());
                result.put("status", "COMPLETED"); result.put("decision", review.get("decision"));
                result.put("decisionSource", "DEMO"); result.put("decisionAt", review.get("at"));
            }
        }
        return result;
    }
}
