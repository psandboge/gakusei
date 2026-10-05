package se.kits.gakusei.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.DelegatingSecurityContextRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

@Configuration
@EnableMethodSecurity(prePostEnabled = true)
@EnableWebSecurity
public class SecurityConfiguration {
    @Value("${gakusei.remember-me-key:uniqueAndSecret}")
    private String rememberMeKey;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider(UserDetailsService users, PasswordEncoder passwords) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(users);
        provider.setPasswordEncoder(passwords);
        return provider;
    }

    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        return web -> web.ignoring().requestMatchers("/js/**");
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, DaoAuthenticationProvider provider) throws Exception {
        SecurityContextRepository contexts = new DelegatingSecurityContextRepository(
            new RequestAttributeSecurityContextRepository(), new HttpSessionSecurityContextRepository());
        http.authenticationProvider(provider)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/registeruser", "/registeruser/", "/username", "/username/",
                                 "/js/*", "/license/*", "/img/logo/*").permitAll()
                .requestMatchers("/logout").hasAnyAuthority("ROLE_USER", "ROLE_ADMIN")
                // Boot 2's unmatched URLs had no FilterSecurityInterceptor attributes.
                // Preserve that fallback; repository method guards still protect admin reads.
                .anyRequest().permitAll())
            .formLogin(form -> form.loginPage("/").loginProcessingUrl("/auth")
                .failureHandler(new CustomAuthenticationFailureHandler())
                .successHandler(new CustomAuthenticationSuccessHandler()).permitAll())
            .httpBasic(basic -> basic.securityContextRepository(contexts))
            .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
            // The old cookie token repository was followed by csrf().disable().
            .csrf(csrf -> csrf.disable())
            // Authentication filters save explicitly; a late read-only response
            // must not recreate an authenticated session after logout.
            .securityContext(context -> context.requireExplicitSave(true).securityContextRepository(contexts))
            .logout(logout -> logout.logoutSuccessUrl("/").deleteCookies("JSESSIONID"))
            .rememberMe(remember -> remember.key(rememberMeKey));
        return http.build();
    }
}
