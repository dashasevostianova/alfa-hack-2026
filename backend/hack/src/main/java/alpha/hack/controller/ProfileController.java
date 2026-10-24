package alpha.hack.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import alpha.hack.entity.Person;
import alpha.hack.repository.PersonRepository;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {
    private final PersonRepository profileRepository;

    public ProfileController(PersonRepository profileRepository) {
        this.profileRepository = profileRepository;
    }

    @GetMapping("/{regId}")
    public Person getProfile(@PathVariable Integer regId) {
        return profileRepository.findFirstByReg_Id(regId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND,
                        "Profile not found"));
    }
}
