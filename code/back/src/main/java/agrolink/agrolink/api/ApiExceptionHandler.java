package agrolink.agrolink.api;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@RestControllerAdvice
public class ApiExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiErrorBody> handleValidation(
			MethodArgumentNotValidException ex,
			HttpServletRequest request) {
		String message = ex.getBindingResult().getFieldErrors().stream()
				.findFirst()
				.map(err -> err.getField() + ": " + err.getDefaultMessage())
				.orElse("Dados inválidos.");
		return build(HttpStatus.BAD_REQUEST, message, request);
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	public ResponseEntity<ApiErrorBody> handleDataIntegrity(
			DataIntegrityViolationException ex,
			HttpServletRequest request) {
		log.warn("Violação de integridade em {}: {}", request.getRequestURI(), ex.getMostSpecificCause().getMessage());
		return build(HttpStatus.CONFLICT, "Não foi possível salvar: registro duplicado ou referência inválida.", request);
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiErrorBody> handleGeneric(Exception ex, HttpServletRequest request) {
		log.error("Erro não tratado em {}", request.getRequestURI(), ex);
		String message = ex.getMessage();
		if (message == null || message.isBlank()) {
			message = "Erro interno no servidor.";
		}
		return build(HttpStatus.INTERNAL_SERVER_ERROR, message, request);
	}

	@ExceptionHandler(ResponseStatusException.class)
	public ResponseEntity<ApiErrorBody> handleResponseStatusException(
			ResponseStatusException ex,
			HttpServletRequest request) {
		HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
		if (status == null) {
			status = HttpStatus.INTERNAL_SERVER_ERROR;
		}
		String message = ex.getReason();
		if (message == null || message.isBlank()) {
			message = status.getReasonPhrase();
		}
		return build(status, message, request);
	}

	private static ResponseEntity<ApiErrorBody> build(HttpStatus status, String message, HttpServletRequest request) {
		ApiErrorBody body = new ApiErrorBody(
				Instant.now(),
				status.value(),
				status.getReasonPhrase(),
				message,
				request.getRequestURI());
		return ResponseEntity.status(status).body(body);
	}

	public record ApiErrorBody(
			Instant timestamp,
			int status,
			String error,
			String message,
			String path) {
	}
}
