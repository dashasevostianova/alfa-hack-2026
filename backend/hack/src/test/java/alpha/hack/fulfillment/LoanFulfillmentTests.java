package alpha.hack.fulfillment;

import alpha.hack.integration.IntegrationService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class LoanFulfillmentTests {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final IntegrationService integration = mock(IntegrationService.class);
    private final LoanFulfillmentService service = new LoanFulfillmentService(jdbc, new ObjectMapper(), integration, new ContractPdfGenerator());
    private Map<String, Object> app() {
        var app = new LinkedHashMap<String, Object>();
        app.put("id", "12"); app.put("status", "COMPLETED"); app.put("decision", Map.of("outcome", "APPROVED"));
        app.put("createdAt", Instant.now().minusSeconds(30).toString()); app.put("amount", 1_000_000); app.put("months", 24);
        app.put("annualRate", new BigDecimal("22")); app.put("productName", "Учебный продукт"); app.put("purpose", "Развитие бизнеса");
        app.put("borrowerSnapshot", Map.of("fullName", "Иван Иванов", "companyName", "ООО Демо", "inn", "1234567890"));
        when(jdbc.queryForList(contains("FOR UPDATE"), eq(12), eq(7))).thenReturn(List.of(Map.of("id", 12)));
        when(integration.application(7, 12)).thenReturn(app);
        return app;
    }
    @SuppressWarnings("unchecked") private Map<String, Object> state(Map<String, Object> app) { return (Map<String, Object>)app.get("fulfillment"); }
    private MockMultipartFile pdf() { return new MockMultipartFile("file", "signed.pdf", "application/pdf", "%PDF-1.7\ndemo".getBytes()); }

    @Test void refusesForeignAndNonApprovedApplications() {
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> service.get(99, 12)).getStatusCode().value());
        var app = app(); app.put("decision", Map.of("outcome", "REJECTED"));
        assertThrows(ResponseStatusException.class, () -> service.prepare(7, 12));
        app.put("decision", Map.of("outcome", "REVISION"));
        assertThrows(ResponseStatusException.class, () -> service.issue(7, 12));
    }
    @Test void createsReadableRussianPdfFromFrozenConditionsAndHandlesLongNames() throws Exception {
        var app = app();
        app.put("borrowerSnapshot", Map.of("fullName", "Иван Иванов", "companyName", "Длинное название ".repeat(200), "inn", "1234567890"));
        service.prepare(7, 12);
        @SuppressWarnings("unchecked") var contract = (Map<String, Object>)state(app).get("contract");
        assertEquals(new BigDecimal("51878.15"), contract.get("monthlyPayment"));
        byte[] bytes = new ContractPdfGenerator().generate(contract);
        try (var doc = Loader.loadPDF(bytes)) {
            var text = new PDFTextStripper().getText(doc);
            assertTrue(doc.getNumberOfPages() > 1);
            for (String value : List.of("Иван Иванов", "1234567890", "DEMO-12", "1000000", "24 мес.", "22%", "Не имеет юридической силы")) assertTrue(text.contains(value), value);
        }
        verify(jdbc, times(1)).update(startsWith("INSERT INTO loan_fulfillment"), eq(12), anyString(), any(byte[].class));
        service.prepare(7, 12);
        verify(jdbc, times(1)).update(startsWith("INSERT INTO loan_fulfillment"), eq(12), anyString(), any(byte[].class));
    }
    @Test void rejectsMissingRateAndChangedOrAlternativeApprovalTerms() throws Exception {
        var app = app(); app.put("annualRate", null);
        assertThrows(ResponseStatusException.class, () -> service.prepare(7, 12));
        app.put("annualRate", 22); service.prepare(7, 12); app.put("months", 36);
        assertThrows(ResponseStatusException.class, () -> service.confirm(7, 12));
        app.put("months", 24);
        when(jdbc.queryForList(startsWith("SELECT approved_amount"), eq(12))).thenReturn(List.of(Map.of("approved_amount", 500_000)));
        assertThrows(ResponseStatusException.class, () -> service.issue(7, 12));
    }
    @Test void enforcesOrderingAndNeverDuplicatesSigningOrIssuance() throws Exception {
        var app = app(); service.prepare(7, 12);
        assertThrows(ResponseStatusException.class, () -> service.confirm(7, 12));
        assertThrows(ResponseStatusException.class, () -> service.issue(7, 12));
        assertThrows(ResponseStatusException.class, () -> service.upload(7, 12, pdf()));
        service.download(7, 12); service.upload(7, 12, pdf());
        service.remove(7, 12);
        assertThrows(ResponseStatusException.class, () -> service.confirm(7, 12));
        service.upload(7, 12, pdf()); service.confirm(7, 12); service.confirm(7, 12);
        assertThrows(ResponseStatusException.class, () -> service.remove(7, 12));
        assertThrows(ResponseStatusException.class, () -> service.upload(7, 12, pdf()));
        service.issue(7, 12); Object issuedAt = state(app).get("issuedAt"); service.issue(7, 12);
        assertEquals("ISSUED", state(app).get("status")); assertEquals(issuedAt, state(app).get("issuedAt"));
        @SuppressWarnings("unchecked") var history = (List<Map<String, Object>>)state(app).get("history");
        assertEquals(1, history.stream().filter(e -> e.get("type").equals("SIGNED")).count());
        assertEquals(1, history.stream().filter(e -> e.get("type").equals("ISSUED")).count());
    }
    @Test void validatesPdfFormatSizeAndEmptyMime() throws Exception {
        LoanFulfillmentService.validateFile(pdf());
        LoanFulfillmentService.validateFile(new MockMultipartFile("file", "signed.PDF", "", "%PDF-1.7".getBytes()));
        for (var invalid : List.of(
            new MockMultipartFile("file", "bad.txt", "application/pdf", "%PDF-1.7".getBytes()),
            new MockMultipartFile("file", "bad.pdf", "text/plain", "%PDF-1.7".getBytes()),
            new MockMultipartFile("file", "bad.pdf", "application/pdf", "invalid".getBytes()),
            new MockMultipartFile("file", "bad.pdf", "application/pdf", new byte[0]),
            new MockMultipartFile("file", "bad.pdf", "application/pdf", new byte[(int)LoanFulfillmentService.MAX_PDF_SIZE + 1])))
            assertThrows(ResponseStatusException.class, () -> LoanFulfillmentService.validateFile(invalid));
    }
}
