package alpha.hack.dto;

import alpha.hack.enums.ApplicationStatus;

public record ApplicationCreatedResponse(
        Integer id,
        Integer regId,
        ApplicationStatus status) {
}
