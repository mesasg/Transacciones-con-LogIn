package com.udea.bancommii.config;

import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.beans.factory.annotation.Value;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@Configuration
public class SecurityConfig {

    // Credenciales del usuario en memoria. Se pueden sobrescribir en application.properties
    // con app.security.username / app.security.password
    @Value("${app.security.username:admin}")
    private String appUsername;

    @Value("${app.security.password:admin123}")
    private String appPassword;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CookieCsrfTokenRepository csrfTokenRepository() {
    CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
    repository.setCookieCustomizer(cookie -> cookie.sameSite("Strict"));
    return repository;
}

    @Bean
    public InMemoryUserDetailsManager userDetailsService(PasswordEncoder passwordEncoder) {
        UserDetails user = User.builder()
                .username(appUsername)
                .password(passwordEncoder.encode(appPassword))
                .roles("USER")
                .build();
        return new InMemoryUserDetailsManager(user);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                // Recursos públicos: página de login y assets estáticos
                .requestMatchers(
                        "/login.html",
                        "/login",
                        "/css/**",
                        "/js/**",
                        "/favicon.ico"
                ).permitAll()
                // Todo lo demás (incluida la página principal y la API) requiere sesión
                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                .loginPage("/login.html")
                .loginProcessingUrl("/login")
                .defaultSuccessUrl("/index.html", true)
                .failureUrl("/login.html?error=true")
                .permitAll()
            )
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/login.html?logout=true")
                .permitAll()
            )
            // La API se consume con fetch desde el propio frontend (mismo origen),
            // así que desactivamos CSRF solo para las rutas /api/** y lo dejamos
            // activo para el login/logout. El token se expone en una cookie
            // legible (XSRF-TOKEN) para que el formulario de logout pueda usarlo.
            .csrf(csrf -> csrf
                .ignoringRequestMatchers("/api/**")

                .csrfTokenRepository(csrfTokenRepository())
               // .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())

                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
            )
            // Fuerza que el token CSRF se cargue (y por lo tanto se escriba la
            // cookie XSRF-TOKEN) en CADA request, incluida la carga de login.html.
            // Sin esto, como login.html es un recurso estático (no pasa por un
            // controlador que consulte el token), la cookie nunca se genera y
            // el POST a /login siempre es rechazado con 403 antes de validar
            // usuario/contraseña.
            .addFilterAfter(new OncePerRequestFilter() {
                @Override
                protected void doFilterInternal(HttpServletRequest request,
                                                 HttpServletResponse response,
                                                 FilterChain filterChain) throws ServletException, IOException {
                    CsrfToken csrfToken = (CsrfToken) request.getAttribute("_csrf");
                    if (csrfToken != null) {
                        csrfToken.getToken();
                    }
                    filterChain.doFilter(request, response);
                }
            }, BasicAuthenticationFilter.class);

        return http.build();
    }
}
