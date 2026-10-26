package alpha.hack.dto;

import java.time.LocalDate;
import java.util.List;

import alpha.hack.enums.BusinessStatus;
import alpha.hack.enums.LegalForm;
import alpha.hack.enums.Purpose;

public record ApplicationSubmission(
        Integer regId,
        Integer productId,
        Integer amount,
        Integer termMonths,
        Purpose purpose,
        PersonDetails person,
        BusinessDetails business,
        List<FinanceDetails> finances) {

    public record PersonDetails(
            String firstname,
            String lastname,
            String patronymic,
            LocalDate birthDate,
            String citizenship,
            String passportSeries,
            String passportNumber,
            String passportIssuedBy,
            LocalDate passportIssuedDate,
            String passportDeptCode,
            String phone,
            String email) {
    }

    public record BusinessDetails(
            LegalForm legalForm,
            String fullname,
            BusinessStatus status,
            String inn,
            String ogrn,
            LocalDate registrationDate,
            String address,
            String okved,
            String settlementAccount) {
    }

    public record FinanceDetails(
            Integer revenue,
            Integer netProfit,
            String accountStatements,
            Integer taxArrears,
            Integer currentLoans) {
    }
}
