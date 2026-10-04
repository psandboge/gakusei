package se.kits.gakusei.init;

import org.junit.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.junit.Assert.*;

public class LocalDatabaseEnvironmentTest {
    @Test
    public void defaultLocalProfileRejectsMissingCredentialsBeforeConnecting() {
        MockEnvironment env = new MockEnvironment();
        env.setDefaultProfiles("local-postgres");
        try {
            new LocalDatabaseEnvironment().postProcessEnvironment(env, null);
            fail("Missing local password must fail");
        } catch (IllegalStateException expected) {
            assertTrue(expected.getMessage().contains("LOCAL_DB_PASSWORD"));
        }
    }

    @Test
    public void blankLocalCredentialsAreRejected() {
        MockEnvironment env = new MockEnvironment().withProperty("LOCAL_DB_PASSWORD", " ");
        env.setActiveProfiles("local-postgres");
        try {
            new LocalDatabaseEnvironment().postProcessEnvironment(env, null);
            fail("Blank local password must fail");
        } catch (IllegalStateException expected) {
            assertTrue(expected.getMessage().contains("LOCAL_DB_PASSWORD"));
        }
    }

    @Test
    public void providedCredentialsAreAccepted() {
        MockEnvironment env = new MockEnvironment().withProperty("LOCAL_DB_PASSWORD", "test-only");
        env.setActiveProfiles("local-postgres");
        new LocalDatabaseEnvironment().postProcessEnvironment(env, null);
    }

    @Test
    public void productionConfigurationIsUnaffected() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("postgres", "heroku");
        new LocalDatabaseEnvironment().postProcessEnvironment(env, null);
    }
}
