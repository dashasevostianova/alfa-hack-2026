package alpha.hack.Entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "decision")
public class Decision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "decision_id", nullable = false)
    private Application application;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "decision", nullable = false,
            columnDefinition = "decision_t")
    private DecisionType decision;

    @Column(name = "reason", nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "approved_amount")
    private Integer approvedAmount;

    @Column(name = "approved_term")
    private Integer approvedTerm;

    @Column(name = "approved_rate", precision = 5, scale = 2)
    private BigDecimal approvedRate;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Decision() {
    }

    public Decision(Integer id, Application application, DecisionType decision, String reason, Integer approvedAmount, Integer approvedTerm, BigDecimal approvedRate, LocalDateTime createdAt) {
        this.id = id;
        this.application = application;
        this.decision = decision;
        this.reason = reason;
        this.approvedAmount = approvedAmount;
        this.approvedTerm = approvedTerm;
        this.approvedRate = approvedRate;
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

    public DecisionType getDecision() {
        return this.decision;
    }

    public void setDecision(DecisionType decision) {
        this.decision = decision;
    }

    public String getReason() {
        return this.reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Integer getApprovedAmount() {
        return this.approvedAmount;
    }

    public void setApprovedAmount(Integer approvedAmount) {
        this.approvedAmount = approvedAmount;
    }

    public Integer getApprovedTerm() {
        return this.approvedTerm;
    }

    public void setApprovedTerm(Integer approvedTerm) {
        this.approvedTerm = approvedTerm;
    }

    public BigDecimal getApprovedRate() {
        return this.approvedRate;
    }

    public void setApprovedRate(BigDecimal approvedRate) {
        this.approvedRate = approvedRate;
    }

    public LocalDateTime getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

}