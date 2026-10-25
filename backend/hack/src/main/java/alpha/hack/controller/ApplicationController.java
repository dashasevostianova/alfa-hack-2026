package alpha.hack.controller;

import java.util.List;
import alpha.hack.dto.ApplicationCreatedResponse;
import alpha.hack.dto.ApplicationSubmission;
import alpha.hack.service.ApplicationService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/api/applications")
public class ApplicationController {
    private final ApplicationService applicationService;

    public ApplicationController(ApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @GetMapping("")
    public List<ApplicationCreatedResponse> getApplications(
            @RequestParam Integer regId) {
        return applicationService.getByRegistration(regId);
    }

    @PostMapping("")
    @ResponseStatus(HttpStatus.CREATED)
    public ApplicationCreatedResponse createApplication(
            @RequestBody ApplicationSubmission application) {
        return applicationService.submit(application);
    }
}
