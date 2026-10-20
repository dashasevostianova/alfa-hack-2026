package alpha.hack.Entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "business")
public class Business {

    @Id
    @Column(name = "business_id", nullable = false)
    private Integer businessId;

    @Enumerated(EnumType.STRING)
    @Column(name = "legal_form", nullable = false,
            columnDefinition = "legal_form_t")
    private LegalForm legalForm;

    @Column(name = "fullname", nullable = false, columnDefinition = "TEXT")
    private String fullname;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false,
            columnDefinition = "status_b")
    private BusinessStatus status;

    @Column(name = "inn", nullable = false, unique = true, length = 12)
    private String inn;

    @Column(name = "ogrn", length = 15)
    private String ogrn;

    @Column(name = "registration_date", nullable = false)
    private LocalDate registrationDate;

    @Column(name = "address", columnDefinition = "TEXT")
    private String address;

    @Column(name = "okved", nullable = false, length = 10)
    private String okved;

    @Column(name = "employees_count", nullable = false)
    private Integer employeesCount = 0;

    @Column(name = "settlement_account", length = 20)
    private String settlementAccount;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Business() {
    }

    public Business(Integer businessId, LegalForm legalForm, String fullname, BusinessStatus status, String inn, String ogrn, LocalDate registrationDate, String address, String okved, Integer employeesCount, String settlementAccount, LocalDateTime createdAt) {
        this.businessId = businessId;
        this.legalForm = legalForm;
        this.fullname = fullname;
        this.status = status;
        this.inn = inn;
        this.ogrn = ogrn;
        this.registrationDate = registrationDate;
        this.address = address;
        this.okved = okved;
        this.employeesCount = employeesCount;
        this.settlementAccount = settlementAccount;
        this.createdAt = createdAt;
    }

    public Integer getBusinessId() {
        return this.businessId;
    }

    public void setBusinessId(Integer businessId) {
        this.businessId = businessId;
    }

    public LegalForm getLegalForm() {
        return this.legalForm;
    }

    public void setLegalForm(LegalForm legalForm) {
        this.legalForm = legalForm;
    }

    public String getFullname() {
        return this.fullname;
    }

    public void setFullname(String fullname) {
        this.fullname = fullname;
    }

    public BusinessStatus getStatus() {
        return this.status;
    }

    public void setStatus(BusinessStatus status) {
        this.status = status;
    }

    public String getInn() {
        return this.inn;
    }

    public void setInn(String inn) {
        this.inn = inn;
    }

    public String getOgrn() {
        return this.ogrn;
    }

    public void setOgrn(String ogrn) {
        this.ogrn = ogrn;
    }

    public LocalDate getRegistrationDate() {
        return this.registrationDate;
    }

    public void setRegistrationDate(LocalDate registrationDate) {
        this.registrationDate = registrationDate;
    }

    public String getAddress() {
        return this.address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getOkved() {
        return this.okved;
    }

    public void setOkved(String okved) {
        this.okved = okved;
    }

    public Integer getEmployeesCount() {
        return this.employeesCount;
    }

    public void setEmployeesCount(Integer employeesCount) {
        this.employeesCount = employeesCount;
    }

    public String getSettlementAccount() {
        return this.settlementAccount;
    }

    public void setSettlementAccount(String settlementAccount) {
        this.settlementAccount = settlementAccount;
    }

    public LocalDateTime getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

}