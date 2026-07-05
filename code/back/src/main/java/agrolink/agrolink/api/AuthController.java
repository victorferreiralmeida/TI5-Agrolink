package agrolink.agrolink.api;

import agrolink.agrolink.dto.AuthResponse;
import agrolink.agrolink.dto.LoginRequest;
import agrolink.agrolink.dto.RegisterRequest;
import agrolink.agrolink.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;

	public AuthController(AuthService authService) {
		this.authService = authService;
	}

	@PostMapping("/login")
	public AuthResponse login(@RequestBody LoginRequest body) {
		return authService.login(body);
	}

	@PostMapping("/register")
	public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest body) {
		var resposta = authService.register(body);
		return ResponseEntity.status(HttpStatus.CREATED).body(resposta);
	}
}
