package alpha.hack.entity;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;

@Entity
@Table(name = "finances")
public class Finances {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    @JsonIgnore
    private Application application;

    @Column(name = "revenue", nullable = false)
    private Integer revenue;

    @Column(name = "net_profit", nullable = false)
    private Integer netProfit;

    @Column(name = "account_statements", columnDefinition = "TEXT")
    private String accountStatements;

    @Column(name = "tax_arrears")
    private Integer taxArrears;

    @Column(name = "current_loans")
    private Integer currentLoans;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Finances() {
    }

    public Finances(Integer id, Application application, Integer revenue, Integer netProfit, String accountStatements, Integer taxArrears, Integer currentLoans, LocalDateTime createdAt) {
        this.id = id;
        this.application = application;
        this.revenue = revenue;
        this.netProfit = netProfit;
        this.accountStatements = accountStatements;
        this.taxArrears = taxArrears;
        this.currentLoans = currentLoans;
        this.createdAt = createdAt;
    }

    public Integer getId() {
        return this.id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Application getApplication() {
        return this.application;
    }

    public void setApplication(Application application) {
        this.application = application;
    }

    public Integer getRevenue() {
        return this.revenue;
    }

    public void setRevenue(Integer revenue) {
        this.revenue = revenue;
    }

    public Integer getNetProfit() {
        return this.netProfit;
    }

    public void setNetProfit(Integer netProfit) {
        this.netProfit = netProfit;
    }

    public String getAccountStatements() {
        return this.accountStatements;
    }

    public void setAccountStatements(String accountStatements) {
        this.accountStatements = accountStatements;
    }

    public Integer getTaxArrears() {
        return this.taxArrears;
    }

    public void setTaxArrears(Integer taxArrears) {
        this.taxArrears = taxArrears;
    }

    public Integer getCurrentLoans() {
        return this.currentLoans;
    }

    public void setCurrentLoans(Integer currentLoans) {
        this.currentLoans = currentLoans;
    }

    public LocalDateTime getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}