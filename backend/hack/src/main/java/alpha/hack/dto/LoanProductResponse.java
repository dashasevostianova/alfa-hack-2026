package alpha.hack.dto;

import java.math.BigDecimal;

public class LoanProductResponse {
        private Integer id;
        private String name;
        private String description;
        private BigDecimal annualRate;
        private Integer minAmount;
        private Integer maxAmount;
        private Integer minMonths;
        private Integer maxMonths;


    public LoanProductResponse(Integer id, String name, String description, BigDecimal annualRate, Integer minAmount, Integer maxAmount, Integer minMonths, Integer maxMonths) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.annualRate = annualRate;
        this.minAmount = minAmount;
        this.maxAmount = maxAmount;
        this.minMonths = minMonths;
        this.maxMonths = maxMonths;
    }

    public Integer getId() {
        return this.id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return this.description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getAnnualRate() {
        return this.annualRate;
    }

    public void setAnnualRate(BigDecimal annualRate) {
        this.annualRate = annualRate;
    }

    public Integer getMinAmount() {
        return this.minAmount;
    }

    public void setMinAmount(Integer minAmount) {
        this.minAmount = minAmount;
    }

    public Integer getMaxAmount() {
        return this.maxAmount;
    }

    public void setMaxAmount(Integer maxAmount) {
        this.maxAmount = maxAmount;
    }

    public Integer getMinMonths() {
        return this.minMonths;
    }

    public void setMinMonths(Integer minMonths) {
        this.minMonths = minMonths;
    }

    public Integer getMaxMonths() {
        return this.maxMonths;
    }

    public void setMaxMonths(Integer maxMonths) {
        this.maxMonths = maxMonths;
    }

}