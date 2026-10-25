package alpha.hack.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import alpha.hack.dto.ApplicationCreatedResponse;
import alpha.hack.dto.ApplicationSubmission;
import alpha.hack.entity.Application;
import alpha.hack.entity.Business;
import alpha.hack.entity.Finances;
import alpha.hack.entity.Person;
import alpha.hack.entity.Product;
import alpha.hack.entity.Reg;
import alpha.hack.enums.ApplicationStatus;
import alpha.hack.repository.ApplicationRepository;
import alpha.hack.repository.BusinessRepository;
import alpha.hack.repository.PersonRepository;
import alpha.hack.repository.ProductRepository;
import alpha.hack.repository.RegRepository;

@Service
public class ApplicationService {
    private final ApplicationRepository applicationRepository;
    private final RegRepository regRepository;
    private final ProductRepository productRepository;
    private final PersonRepository personRepository;
    private final BusinessRepository businessRepository;

    public ApplicationService(
            ApplicationRepository applicationRepository,
            RegRepository regRepository,
            ProductRepository productRepository,
            PersonRepository personRepository,
            BusinessRepository businessRepository) {
        this.applicationRepository = applicationRepository;
        this.regRepository = regRepository;
        this.productRepository = productRepository;
        this.personRepository = personRepository;
        this.businessRepository = businessRepository;
    }

    @Transactional
    public ApplicationCreatedResponse submit(ApplicationSubmission request) {
        if (request == null || request.regId() == null || request.productId() == null
                || request.amount() == null || request.termMonths() == null
                || request.purpose() == null || request.person() == null
                || request.business() == null || request.finances() == null
                || request.finances().isEmpty()
                || request.finances().stream().anyMatch(finance -> finance == null)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Registration, product, amount, term, purpose, person, business and finance records are required");
        }

        Reg reg = regRepository.findById(request.regId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Registration not found"));
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Loan product not found"));
        if (request.amount() < product.getMinAmount()
                || request.amount() > product.getMaxAmount()
                || request.termMonths() < product.getMinTerm()
                || request.termMonths() > product.getMaxTerm()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Amount or term is outside the selected product limits");
        }

        Person person = personRepository.findFirstByReg_Id(reg.getId())
                .orElseGet(Person::new);
        person.setReg(reg);
        copyPerson(request.person(), person);
        personRepository.save(person);

        Business business = businessRepository.findFirstByReg_Id(reg.getId())
                .orElseGet(Business::new);
        business.setReg(reg);
        copyBusiness(request.business(), business);
        businessRepository.save(business);

        Application application = new Application();
        application.setReg(reg);
        application.setProduct(product);
        application.setAmount(request.amount());
        application.setTermMonths(request.termMonths());
        application.setPurpose(request.purpose().name().replace('_', ' '));
        application.setStatus(ApplicationStatus.DRAFT);

        List<Finances> finances = new ArrayList<>();
        for (ApplicationSubmission.FinanceDetails details : request.finances()) {
            Finances finance = new Finances();
            finance.setApplication(application);
            finance.setRevenue(details.revenue());
            finance.setNetProfit(details.netProfit());
            finance.setAccountStatements(details.accountStatements());
            finance.setTaxArrears(details.taxArrears());
            finance.setCurrentLoans(details.currentLoans());
            finances.add(finance);
        }
        application.setFinances(finances);
        Application saved = applicationRepository.save(application);

        return new ApplicationCreatedResponse(
                saved.getId(), reg.getId(), saved.getStatus());
    }

    @Transactional(readOnly = true)
    public List<ApplicationCreatedResponse> getByRegistration(Integer regId) {
        return applicationRepository.findByReg_Id(regId).stream()
                .map(application -> new ApplicationCreatedResponse(
                        application.getId(),
                        application.getReg().getId(),
                        application.getStatus()))
                .toList();
    }

    private void copyPerson(
            ApplicationSubmission.PersonDetails details, Person person) {
        person.setFirstname(details.firstname());
        person.setLastname(details.lastname());
        person.setPatronymic(details.patronymic());
        person.setBirthDate(details.birthDate());
        person.setCitizenship(details.citizenship());
        person.setPassportSeries(details.passportSeries());
        person.setPassportNumber(details.passportNumber());
        person.setPassportIssuedBy(details.passportIssuedBy());
        person.setPassportIssuedDate(details.passportIssuedDate());
        person.setPassportDeptCode(details.passportDeptCode());
        person.setPhone(details.phone());
        person.setEmail(details.email());
    }

    private void copyBusiness(
            ApplicationSubmission.BusinessDetails details, Business business) {
        business.setLegalForm(details.legalForm());
        business.setFullname(details.fullname());
        business.setStatus(details.status());
        business.setInn(details.inn());
        business.setOgrn(details.ogrn());
        business.setRegistrationDate(details.registrationDate());
        business.setAddress(details.address());
        business.setOkved(details.okved());
        business.setSettlementAccount(details.settlementAccount());
    }
}
