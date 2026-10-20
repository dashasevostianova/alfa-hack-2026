package alpha.hack.Entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "person")
public class Person {

    @Id
    @Column(name = "person_id", nullable = false)
    private Integer personId;

    @Column(name = "firstname", nullable = false, columnDefinition = "TEXT")
    private String firstname;

    @Column(name = "lastname", nullable = false, columnDefinition = "TEXT")
    private String lastname;

    @Column(name = "patronymic", nullable = false, columnDefinition = "TEXT")
    private String patronymic;

    @Column(name = "birth_date", nullable = false)
    private LocalDate birthDate;

    @Column(name = "citizenship", nullable = false)
    private String citizenship = "RU";

    @Column(name = "passport_series", nullable = false, length = 4)
    private String passportSeries;

    @Column(name = "passport_number", nullable = false, length = 6)
    private String passportNumber;

    @Column(name = "passport_issued_by", columnDefinition = "TEXT")
    private String passportIssuedBy;

    @Column(name = "passport_issued_date")
    private LocalDate passportIssuedDate;

    @Column(name = "passport_dept_code")
    private String passportDeptCode;

    @Column(name = "phone", nullable = false, columnDefinition = "TEXT")
    private String phone;

    @Column(name = "email", columnDefinition = "TEXT")
    private String email;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Person() {
    }

    public Person(Integer personId, String firstname, String lastname, String patronymic, LocalDate birthDate, String citizenship, String passportSeries, String passportNumber, String passportIssuedBy, LocalDate passportIssuedDate, String passportDeptCode, String phone, String email, LocalDateTime createdAt) {
        this.personId = personId;
        this.firstname = firstname;
        this.lastname = lastname;
        this.patronymic = patronymic;
        this.birthDate = birthDate;
        this.citizenship = citizenship;
        this.passportSeries = passportSeries;
        this.passportNumber = passportNumber;
        this.passportIssuedBy = passportIssuedBy;
        this.passportIssuedDate = passportIssuedDate;
        this.passportDeptCode = passportDeptCode;
        this.phone = phone;
        this.email = email;
        this.createdAt = createdAt;
    }

    public Integer getPersonId() {
        return this.personId;
    }

    public void setPersonId(Integer personId) {
        this.personId = personId;
    }

    public String getFirstname() {
        return this.firstname;
    }

    public void setFirstname(String firstname) {
        this.firstname = firstname;
    }

    public String getLastname() {
        return this.lastname;
    }

    public void setLastname(String lastname) {
        this.lastname = lastname;
    }

    public String getPatronymic() {
        return this.patronymic;
    }

    public void setPatronymic(String patronymic) {
        this.patronymic = patronymic;
    }

    public LocalDate getBirthDate() {
        return this.birthDate;
    }

    public void setBirthDate(LocalDate birthDate) {
        this.birthDate = birthDate;
    }

    public String getCitizenship() {
        return this.citizenship;
    }

    public void setCitizenship(String citizenship) {
        this.citizenship = citizenship;
    }

    public String getPassportSeries() {
        return this.passportSeries;
    }

    public void setPassportSeries(String passportSeries) {
        this.passportSeries = passportSeries;
    }

    public String getPassportNumber() {
        return this.passportNumber;
    }

    public void setPassportNumber(String passportNumber) {
        this.passportNumber = passportNumber;
    }

    public String getPassportIssuedBy() {
        return this.passportIssuedBy;
    }

    public void setPassportIssuedBy(String passportIssuedBy) {
        this.passportIssuedBy = passportIssuedBy;
    }

    public LocalDate getPassportIssuedDate() {
        return this.passportIssuedDate;
    }

    public void setPassportIssuedDate(LocalDate passportIssuedDate) {
        this.passportIssuedDate = passportIssuedDate;
    }

    public String getPassportDeptCode() {
        return this.passportDeptCode;
    }

    public void setPassportDeptCode(String passportDeptCode) {
        this.passportDeptCode = passportDeptCode;
    }

    public String getPhone() {
        return this.phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return this.email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public LocalDateTime getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

}