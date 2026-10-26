package alpha.hack.integration;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ModelDecisionServiceTests {
    private Map<String, Object> app() {
        var app = new LinkedHashMap<String, Object>();
        app.put("id", "42"); app.put("status", "SUBMITTED"); app.put("formationStatus", "SUBMITTED");
        app.put("company", Map.of("legal_form", "OOO", "registration_date", "2020-01-01"));
        app.put("finances", List.of(Map.of("revenue", 1_200_000, "net_profit", -50_000, "current_loans", 1)));
        app.put("purpose", "Покупка оборудования"); app.put("amount", 500_000); app.put("months", 24); app.put("annualRate", 20);
        return app;
    }
    @Test void matchesFrontendFeatureEncoding() {
        var features = ModelDecisionService.features(app(), Instant.parse("2026-10-26T00:00:00Z"));
        assertEquals(8, features.size()); assertEquals(1, features.get("legal_form"));
        assertEquals(1, features.get("purpose")); assertEquals(1, features.get("current_loans"));
        assertEquals(-50_000, features.get("net_profit")); assertEquals(24, features.get("term_months"));
        assertEquals(500_000, features.get("amount"));
        assertEquals((Instant.parse("2026-10-26T00:00:00Z").toEpochMilli() - Instant.parse("2020-01-01T00:00:00Z").toEpochMilli()) / 86400000.0 / 365.2425,
            features.get("business_age_years"));
        var changed = app(); changed.put("finances", List.of(Map.of("revenue", 0, "net_profit", 0)));
        changed.put("company", Map.of("legal_form", "IP", "registration_date", "2020-01-01"));
        assertEquals(0, ModelDecisionService.features(changed, Instant.now()).get("current_loans"));
        assertEquals(0, ModelDecisionService.features(changed, Instant.now()).get("legal_form"));
        changed.put("finances", List.of());
        assertThrows(ResponseStatusException.class, () -> ModelDecisionService.features(changed, Instant.now()));
    }
    @Test void preservesExistingDecisionsAndRejectsForeignApplications() {
        var jdbc = mock(JdbcTemplate.class); var integration = mock(IntegrationService.class);
        var service = new ModelDecisionService(jdbc, new ObjectMapper(), integration, "http://127.0.0.1:1");
        assertThrows(ResponseStatusException.class, () -> service.evaluate(7, 42));
        verifyNoInteractions(integration);
        when(jdbc.queryForList(contains("FOR UPDATE"), eq(42), eq(7))).thenReturn(List.of(Map.of("id", 42)));
        var approved = app(); approved.put("decision", Map.of("outcome", "APPROVED"));
        when(integration.application(7, 42)).thenReturn(approved);
        assertSame(approved, service.evaluate(7, 42));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }
    @Test void persistsModelDecisionOnceUsingServerConditions() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var calls = new java.util.concurrent.atomic.AtomicInteger();
        server.createContext("/predict", exchange -> {
            calls.incrementAndGet();
            var payload = new ObjectMapper().readValue(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8), Map.class);
            assertEquals(500_000, payload.get("amount")); assertEquals(8, payload.size());
            byte[] response = "{\"prediction\":1}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, response.length); exchange.getResponseBody().write(response); exchange.close();
        });
        server.start();
        try {
            var jdbc = mock(JdbcTemplate.class); var integration = mock(IntegrationService.class);
            var service = new ModelDecisionService(jdbc, new ObjectMapper(), integration, "http://127.0.0.1:" + server.getAddress().getPort());
            when(jdbc.queryForList(contains("FOR UPDATE"), eq(42), eq(7))).thenReturn(List.of(Map.of("id", 42)));
            var approved = app(); approved.put("status", "COMPLETED"); approved.put("decision", Map.of("outcome", "APPROVED"));
            when(integration.application(7, 42)).thenReturn(app(), approved, approved);
            assertSame(approved, service.evaluate(7, 42)); assertSame(approved, service.evaluate(7, 42));
            assertEquals(1, calls.get());
            verify(jdbc, times(1)).update(startsWith("INSERT INTO decision"), eq(42), eq("APPROVED"), anyString(), eq(500_000), eq(24), eq(20));
        } finally { server.stop(0); }
    }
    @Test void rejectsUnreachableModelWithoutSavingApproval() {
        var service = new ModelDecisionService(mock(JdbcTemplate.class), new ObjectMapper(), mock(IntegrationService.class), "http://127.0.0.1:1");
        assertEquals(502, assertThrows(ResponseStatusException.class, () -> service.predict(Map.of())).getStatusCode().value());
    }
}
