package agrolink.agrolink.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

@Configuration
public class WebConfig implements WebMvcConfigurer {

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		// Padrões (não só origens fixas): se o Vite usar outra porta (ex. 5174) ou [::1],
		// allowedOrigins("http://localhost:5173") faz o CorsFilter responder 403 no preflight.
		registry.addMapping("/api/**")
				.allowedOriginPatterns(
						"http://localhost:*",
						"http://127.0.0.1:*",
						"http://[::1]:*",
						"https://zoom-gallstone-bootleg.ngrok-free.dev",
						"https://*.ngrok-free.dev",
						"https://*.ngrok-free.app")
				.allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD")
				.allowedHeaders("*");
	}

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		var uploadPath = Path.of("uploads").toAbsolutePath().normalize().toUri().toString();
		registry.addResourceHandler("/uploads/**").addResourceLocations(uploadPath);
	}
}
