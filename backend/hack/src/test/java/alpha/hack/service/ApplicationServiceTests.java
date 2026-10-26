package alpha.hack.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import alpha.hack.dto.ApplicationSubmission;
import alpha.hack.entity.Application;
import alpha.hack.entity.Product;
import alpha.hack.entity.Reg;
import alpha.hack.enums.ApplicationStatus;
import alpha.hack.enums.BusinessStatus;
import alpha.hack.enums.LegalForm;
import alpha.hack.enums.Purpose;
import alpha.hack.repository.ApplicationRepository;
import alpha.hack.repository.BusinessRepository;
import alpha.hack.repository.PersonRepository;
import alpha.hack.repository.ProductRepository;
import alpha.hack.repository.RegRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ApplicationServiceTests {

    @Test
    void submitSavesApplicationWithAssociatedPersonBusinessAndFinances() {
        ApplicationRepository applicationRepository = mock(ApplicationRepository.class);
        RegRepository regRepository = mock(RegRepository.class);
        ProductRepository productRepository = mock(ProductRepository.class);
        PersonRepository personRepository = mock(PersonRepository.class);
        BusinessRepository businessRepository = mock(BusinessRepository.class);

        Reg reg = new Reg();
        reg.setId(1);
        Product product = new Product();
        product.setId(2);
        product.setMinAmount(1000);
        product.setMaxAmount(100000);
        product.setMinTerm(1);
        product.setMaxTerm(36);
        when(regRepository.findById(1)).thenReturn(Optional.of(reg));
        when(productRepository.findById(2)).thenReturn(Optional.of(product));
        when(personRepository.findFirstByReg_Id(1)).thenReturn(Optional.empty());
        when(businessRepository.findFirstByReg_Id(1)).thenReturn(Optional.empty());
        when(applicationRepository.save(any(Application.class))).thenAnswer(invocation -> {
            Application application = invocation.getArgument(0);
            application.setId(3);
            return application;
        });

        ApplicationService service = new ApplicationService(
                applicationRepository,
                regRepository,
                productRepository,
                personRepository,
                businessRepository);
        ApplicationSubmission request = new ApplicationSubmission(
                1, 2, 10000, 12, Purpose.BUSINESS_DEVELOPMENT,
                new ApplicationSubmission.PersonDetails(
                        "Иван", "Иванов", null, LocalDate.of(1985, 1, 1), "RU",
                        "1234", "123456", null, null, null, "+70000000000", null),
                new ApplicationSubmission.BusinessDetails(
                        LegalForm.OOO, "ООО Пример", BusinessStatus.ACTIVE,
                        "1234567890", "1234567890123", LocalDate.of(2020, 1, 1),
                        "Москва", "62.01", null),
                List.of(new ApplicationSubmission.FinanceDetails(
                        50000, 10000, null, 0, 5000)));

        var response = service.submit(request);

        ArgumentCaptor<Application> applicationCaptor =
                ArgumentCaptor.forClass(Application.class);
        verify(applicationRepository).save(applicationCaptor.capture());
        Application saved = applicationCaptor.getValue();
        assertEquals(3, response.id());
        assertEquals(1, response.regId());
        assertEquals(ApplicationStatus.DRAFT, response.status());
        assertEquals("BUSINESS DEVELOPMENT", saved.getPurpose());
        assertEquals(reg, saved.getReg());
        assertEquals(product, saved.getProduct());
        assertEquals(1, saved.getFinances().size());
        assertSame(saved, saved.getFinances().getFirst().getApplication());
        verify(personRepository).save(any());
        verify(businessRepository).save(any());
    }
}
