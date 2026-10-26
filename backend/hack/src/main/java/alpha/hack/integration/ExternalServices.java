package alpha.hack.integration;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ExternalServices {
    private final RestClient formation;
    private final RestClient parser;
    private record CachedOffers(List<Map<String, Object>> offers, Instant fetchedAt) {}
    private final Map<String, CachedOffers> cache = new HashMap<>();

    public ExternalServices(@Value("${formation.url:http://127.0.0.1:8081}") String formationUrl,
                            @Value("${parser.url:http://127.0.0.1:8000}") String parserUrl) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(180));
        formation = RestClient.builder().baseUrl(formationUrl).requestFactory(factory).build();
        parser = RestClient.builder().baseUrl(parserUrl).requestFactory(factory).build();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> company(String inn) {
        if (!inn.matches("(?:[0-9]{10}|[0-9]{12})")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Проверьте ИНН.");
        try { return formation.get().uri("/api/formation/companies/" + inn).retrieve().body(Map.class); }
        catch (Exception error) { throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Не удалось проверить ИНН: сервис formation недоступен или данные компании некорректны."); }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> prepare(Map<String, Object> profile) {
        try {
            // The existing Python HTTP server expects Content-Length, not chunked transfer.
            byte[] payload = tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsBytes(profile);
            return formation.post().uri("/api/formation/prepare")
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .contentLength(payload.length).body(payload).retrieve().body(Map.class);
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT, "Проверьте реквизиты и финансовые показатели. Сервис formation не смог подготовить данные.");
        }
    }

    public static String ageBucket(int businessAgeMonths, String legalForm) {
        if (businessAgeMonths < 0 || !("OOO".equals(legalForm) || "IP".equals(legalForm)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректный возраст или форма бизнеса.");
        int boundary = legalForm.equals("IP") ? 3 : 9;
        return (businessAgeMonths > boundary ? "Более " : "До ") + boundary + " месяцев";
    }

    @SuppressWarnings("unchecked")
    public synchronized Map<String, Object> quote(int businessAgeMonths, boolean collateral, String legalForm) {
        String bucket = ageBucket(businessAgeMonths, legalForm);
        String key = bucket + "|" + (collateral ? "С залогом" : "Без залога") + "|" + (legalForm.equals("IP") ? "Для ИП" : "Для ООО");
        CachedOffers cached = cache.get(key);
        if (cached == null || !cached.fetchedAt().plus(Duration.ofDays(1)).isAfter(Instant.now())) {
            try {
                Map<String, Object> response = parser.get().uri(uri -> uri.path("/offers")
                        .queryParam("legal_form", legalForm).queryParam("business_age_months", businessAgeMonths)
                        .queryParam("collateral", collateral).build()).retrieve().body(Map.class);
                if (response == null || !bucket.equals(response.get("businessAgeBucket"))
                        || !(response.get("offers") instanceof List<?> raw) || raw.isEmpty()) throw new IllegalStateException();
                var validated = new ArrayList<Map<String, Object>>();
                var ids = new HashSet<String>();
                for (Object value : raw) {
                    if (!(value instanceof Map<?, ?> item) || !(item.get("id") instanceof String id) || id.isBlank()
                            || !(item.get("name") instanceof String name) || name.isBlank() || !ids.add(id)) throw new IllegalStateException();
                    String unit = Objects.toString(item.get("rateUnit"), "");
                    if (!Set.of("annual", "monthly", "monthly_overpayment", "not_published").contains(unit)) throw new IllegalStateException();
                    Object rate = item.get("annualRate");
                    if (unit.equals("annual")) {
                        if (!(rate instanceof Number number) || !Double.isFinite(number.doubleValue())
                                || number.doubleValue() < 0 || number.doubleValue() > 100) throw new IllegalStateException();
                    } else if (rate != null) throw new IllegalStateException();
                    validated.add(Collections.unmodifiableMap(new LinkedHashMap<>((Map<String, Object>) item)));
                }
                Instant fetchedAt = response.get("fetchedAt") instanceof String timestamp ? Instant.parse(timestamp) : Instant.now();
                if (fetchedAt.isAfter(Instant.now()) || !fetchedAt.plus(Duration.ofDays(1)).isAfter(Instant.now())) throw new IllegalStateException();
                cached = new CachedOffers(List.copyOf(validated), fetchedAt);
                cache.put(key, cached);
            } catch (Exception error) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Не удалось получить предложения банка. Повторите запрос; заявка не отправлена.");
            }
        }
        return Map.of("offers", cached.offers(), "key", key, "businessAgeMonths", businessAgeMonths,
                "businessAgeBucket", bucket, "legalForm", legalForm, "collateral", collateral,
                "fetchedAt", cached.fetchedAt().toString(), "source", "https://alfabank.ru/sme/profits/");
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> selectOffer(Map<String, Object> quote, String id) {
        var offers = (List<Map<String, Object>>) quote.get("offers");
        var selected = offers.stream().filter(offer -> offer.get("id").equals(id)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Предложение изменилось. Обновите расчёт и выберите предложение банка."));
        if (!(selected.get("annualRate") instanceof Number))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT, "Для этого предложения не опубликована сопоставимая годовая ставка. Выберите другое предложение.");
        return selected;
    }
}
