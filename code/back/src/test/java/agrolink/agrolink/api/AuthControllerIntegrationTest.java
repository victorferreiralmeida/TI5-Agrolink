package agrolink.agrolink.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void fluxoRegisterDepoisLogin() throws Exception {
		var email = "integracao.teste@agrolink.demo";
		var registerBody = """
				{
				  "nome": "Teste Integração",
				  "email": "%s",
				  "password": "SenhaIntegracao1!",
				  "papel": "GERENTE"
				}
				""".formatted(email);

		mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content(registerBody))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.token").value(startsWith("agrolink-")))
				.andExpect(jsonPath("$.usuario.email").value(email));

		var loginBody = """
				{ "email": "%s", "password": "SenhaIntegracao1!" }
				""".formatted(email);

		mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content(loginBody))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.token").value(startsWith("agrolink-")))
				.andExpect(jsonPath("$.usuario.nome").value("Teste Integração"));
	}

	@Test
	void loginComSenhaErradaRetorna401() throws Exception {
		var email = "login.errado@agrolink.demo";
		var registerBody = """
				{
				  "nome": "Usuário Login",
				  "email": "%s",
				  "password": "SenhaCorreta1!",
				  "papel": "FUNCIONARIO"
				}
				""".formatted(email);

		mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content(registerBody))
				.andExpect(status().isCreated());

		var loginBody = """
				{ "email": "%s", "password": "senha-incorreta" }
				""".formatted(email);

		mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content(loginBody))
				.andExpect(status().isUnauthorized());
	}
}
