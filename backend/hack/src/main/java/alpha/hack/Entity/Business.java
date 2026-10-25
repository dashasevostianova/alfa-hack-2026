package alpha.hack.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

import alpha.hack.enums.BusinessStatus;
import alpha.hack.enums.LegalForm;
import com.fasterxml.jackson.annotation.JsonIgnore;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "business")
public class Business {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reg_id", nullable = false)
    @JsonIgnore
    private Reg reg;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "legal_form", nullable = false,
            columnDefinition = "legal_form_t")
    private LegalForm legalForm;

    @Column(name = "fullname", nullable = false, columnDefinition = "TEXT")
    private String fullname;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false,
            columnDefinition = "status_t")
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

    @Column(name = "settlement_account", length = 20)
    private String settlementAccount;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Business() {
    }

    public Business(Integer id, Reg reg, LegalForm legalForm, String fullname, BusinessStatus status, String inn, String ogrn, LocalDate registrationDate, String address, String okved, String settlementAccount, LocalDateTime createdAt) {
        this.id = id;
        this.reg = reg;
        this.legalForm = legalForm;
        this.fullname = fullname;
        this.status = status;
        this.inn = inn;
        this.ogrn = ogrn;
        this.registrationDate = registrationDate;
        this.address = address;
        this.okved = okved;
        this.settlementAccount = settlementAccount;
        this.createdAt = createdAt;
    }

    public Integer getId() {
        return this.id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Reg getReg() {
        return reg;
    }

    public void setReg(Reg reg) {
        this.reg = reg;
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