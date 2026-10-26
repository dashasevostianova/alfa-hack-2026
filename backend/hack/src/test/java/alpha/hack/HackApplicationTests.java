package alpha.hack;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
		"spring.datasource.url=jdbc:h2:mem:hack-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
		"spring.datasource.username=sa",
		"spring.jpa.hibernate.ddl-auto=none",
		"spring.datasource.password=",
		"spring.datasource.driver-class-name=org.h2.Driver"
})
class HackApplicationTests {

	@Test
	void contextLoads() {
	}
}
