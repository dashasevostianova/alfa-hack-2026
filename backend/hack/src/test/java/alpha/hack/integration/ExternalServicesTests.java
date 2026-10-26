package alpha.hack.integration;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class ExternalServicesTests {
    @Test void selectsBusinessAgeBoundaryForEachLegalForm() {
        assertEquals("До 9 месяцев", ExternalServices.ageBucket(9, "OOO"));
        assertEquals("Более 9 месяцев", ExternalServices.ageBucket(10, "OOO"));
        assertEquals("До 3 месяцев", ExternalServices.ageBucket(3, "IP"));
        assertEquals("Более 3 месяцев", ExternalServices.ageBucket(4, "IP"));
        assertEquals("До 3 месяцев", ExternalServices.ageBucket(0, "IP"));
        assertThrows(ResponseStatusException.class, () -> ExternalServices.ageBucket(-1, "OOO"));
        assertThrows(ResponseStatusException.class, () -> ExternalServices.ageBucket(12, "OTHER"));
    }

    @Test void preservesNamedOffersAndCachesByBusinessConditions() throws Exception {
        var count = new AtomicInteger();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/offers", exchange -> {
            count.incrementAndGet();
            assertTrue(exchange.getRequestURI().getQuery().contains("business_age_months="));
            byte[] body = ("{\"businessAgeBucket\":\"До 9 месяцев\",\"offers\":["
                + "{\"id\":\"credit\",\"name\":\"Кредит\",\"annualRate\":23.5,\"rateUnit\":\"annual\"},"
                + "{\"id\":\"line\",\"name\":\"Линия\",\"annualRate\":20,\"rateUnit\":\"annual\"},"
                + "{\"id\":\"seller\",\"name\":\"Селлер\",\"annualRate\":null,\"ratePercent\":1.2,\"rateUnit\":\"monthly_overpayment\"}]}").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body); exchange.close();
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort();
            var external = new ExternalServices(base, base);
            var quote = external.quote(9, false, "OOO");
            assertEquals(23.5, ExternalServices.selectOffer(quote, "credit").get("annualRate"));
            assertEquals(20, ExternalServices.selectOffer(quote, "line").get("annualRate"));
            assertThrows(ResponseStatusException.class, () -> ExternalServices.selectOffer(quote, "seller"));
            assertThrows(ResponseStatusException.class, () -> ExternalServices.selectOffer(quote, "unknown"));
            external.quote(6, false, "OOO");
            assertEquals(1, count.get());
            external.quote(6, true, "OOO");
            assertEquals(2, count.get());
            assertThrows(ResponseStatusException.class, () -> external.quote(10, false, "OOO"));
        } finally { server.stop(0); }
    }

    @Test void rejectsAnnualRateAttachedToMonthlyOverpayment() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/offers", exchange -> {
            byte[] body = "{\"businessAgeBucket\":\"До 3 месяцев\",\"offers\":[{\"id\":\"seller\",\"name\":\"Селлер\",\"annualRate\":1.2,\"rateUnit\":\"monthly_overpayment\"}]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body); exchange.close();
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort();
            assertThrows(ResponseStatusException.class, () -> new ExternalServices(base, base).quote(2, false, "IP"));
        } finally { server.stop(0); }
    }

    @Test void prepareSendsContentLengthForExistingPythonHttpServer() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var accepted = new java.util.concurrent.atomic.AtomicBoolean();
        server.createContext("/api/formation/prepare", exchange -> {
            byte[] request = exchange.getRequestBody().readAllBytes();
            accepted.set(Integer.toString(request.length).equals(exchange.getRequestHeaders().getFirst("Content-Length"))
                && new String(request, StandardCharsets.UTF_8).contains("companyName"));
            byte[] response = "{}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(accepted.get() ? 200 : 400, response.length);
            exchange.getResponseBody().write(response); exchange.close();
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort();
            new ExternalServices(base, base).prepare(Map.of("companyName", "Тест"));
            assertTrue(accepted.get());
        } finally { server.stop(0); }
    }

    @Test void preservesParserTimestampAndRejectsExpiredOffers() throws Exception {
        var expired = new java.util.concurrent.atomic.AtomicBoolean();
        String fetchedAt = java.time.Instant.now().minusSeconds(3600).toString();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/offers", exchange -> {
            String timestamp = expired.get() ? java.time.Instant.now().minusSeconds(86401).toString() : fetchedAt;
            byte[] response = ("{\"businessAgeBucket\":\"До 9 месяцев\",\"fetchedAt\":\"" + timestamp
                + "\",\"offers\":[{\"id\":\"credit\",\"name\":\"Кредит\",\"annualRate\":20,\"rateUnit\":\"annual\"}]}")
                .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response); exchange.close();
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort();
            var first = new ExternalServices(base, base);
            assertEquals(fetchedAt, first.quote(6, false, "OOO").get("fetchedAt"));
            expired.set(true);
            // A Java restart must not reset the age of the persisted parser cache.
            var restarted = new ExternalServices(base, base);
            assertThrows(ResponseStatusException.class, () -> restarted.quote(6, false, "OOO"));
        } finally { server.stop(0); }
    }
}
