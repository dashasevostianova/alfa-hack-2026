package alpha.hack.fulfillment;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.stereotype.Component;

@Component
public class ContractPdfGenerator {
    @SuppressWarnings("unchecked")
    public byte[] generate(Map<String, Object> contract) throws IOException {
        var borrower = (Map<String, Object>)contract.get("borrower");
        var paragraphs = new ArrayList<>(List.of(
            "ДЕМОНСТРАЦИОННЫЙ КРЕДИТНЫЙ ДОГОВОР",
            "Демонстрационный документ. Не имеет юридической силы",
            "Номер договора: " + contract.get("number"), "Дата формирования (UTC): " + contract.get("generatedAt"),
            "Номер заявки: " + contract.get("applicationId"), "Заёмщик: " + borrower.get("fullName"),
            "Компания: " + borrower.get("companyName"), "ИНН: " + borrower.get("inn"),
            "Продукт: " + contract.get("productName"), "Цель: " + contract.get("purpose"),
            "Сумма кредита: " + contract.get("amount") + " руб.", "Срок: " + contract.get("months") + " мес.",
            "Годовая процентная ставка: " + contract.get("annualRate") + "%",
            "Расчётный ежемесячный платёж: " + contract.get("monthlyPayment") + " руб.",
            "Платёж рассчитан по аннуитетной формуле без комиссий и страховки. Для кредитных линий и овердрафтов график является условным.",
            "Условия демонстрационного кредитования: документ создан для учебной демонстрации. Загрузка PDF и подтверждение в кабинете имитируют подписание. Подпись и юридическая подлинность не проверяются. Денежные средства не перечисляются, обязательства не возникают.",
            "Условная подпись заёмщика: ____________________", "Дата условного подписания: ____________________"));
        if ("current-profile".equals(contract.get("borrowerSource"))) paragraphs.add(7,
            "Реквизиты старой заявки взяты из текущей анкеты на дату формирования договора.");
        try (var doc = new PDDocument(); var fontStream = getClass().getResourceAsStream("/fonts/DejaVuSans.ttf")) {
            if (fontStream == null) throw new IOException("Шрифт договора недоступен.");
            var font = PDType0Font.load(doc, fontStream);
            var lines = new ArrayList<String>();
            for (String paragraph : paragraphs) {
                String line = "";
                // Wrap by code point too, so long identifiers never leave the page.
                for (int cp : paragraph.replaceAll("[\\p{Cntrl}]", " ").codePoints().toArray()) {
                    String character = new String(Character.toChars(cp));
                    try { font.getStringWidth(character); } catch (IllegalArgumentException unsupported) { character = "?"; }
                    if (font.getStringWidth(line + character) / 1000 * 11 > 490) { lines.add(line); line = ""; }
                    line += character;
                }
                lines.add(line); lines.add("");
            }
            for (int offset = 0; offset < lines.size(); offset += 45) {
                var page = new PDPage(PDRectangle.A4); doc.addPage(page);
                try (var content = new PDPageContentStream(doc, page)) {
                    content.beginText(); content.setFont(font, 11); content.setLeading(16); content.newLineAtOffset(50, 790);
                    for (String line : lines.subList(offset, Math.min(offset + 45, lines.size()))) {
                        content.showText(line); content.newLine();
                    }
                    content.endText();
                }
            }
            var out = new ByteArrayOutputStream(); doc.save(out); return out.toByteArray();
        }
    }
}
