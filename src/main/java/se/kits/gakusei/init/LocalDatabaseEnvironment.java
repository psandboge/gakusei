package se.kits.gakusei.init;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Profiles;

/** Reject missing local credentials before opening a database connection. */
public class LocalDatabaseEnvironment implements EnvironmentPostProcessor, Ordered {
    @Override
    public int getOrder() {
        return ConfigDataEnvironmentPostProcessor.ORDER + 1;
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (environment.acceptsProfiles(Profiles.of("local-postgres"))) {
            String password = environment.getProperty("LOCAL_DB_PASSWORD");
            if (password == null || password.trim().isEmpty()) {
                throw new IllegalStateException("Local PostgreSQL requires LOCAL_DB_PASSWORD; export .env.local before startup");
            }
        }
    }
}
