package se.kits.gakusei.init;

import org.junit.Before;
import org.junit.Test;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import se.kits.gakusei.user.repository.UserRepository;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class LocalSeedSafetyTest {
    private DataInit seed;
    private Environment environment;
    private JdbcTemplate jdbc;
    private UserRepository users;

    @Before
    public void setup() {
        seed = new DataInit();
        environment = mock(Environment.class);
        jdbc = mock(JdbcTemplate.class);
        users = mock(UserRepository.class);
        ReflectionTestUtils.setField(seed, "environment", environment);
        ReflectionTestUtils.setField(seed, "jdbc", jdbc);
        ReflectionTestUtils.setField(seed, "userRepository", users);
        ReflectionTestUtils.setField(seed, "localSeed", true);
        when(environment.getActiveProfiles()).thenReturn(new String[]{"local-postgres", "local-seed"});
    }

    @Test
    public void rejectsSeedOutsideDedicatedPostgresProfile() throws Exception {
        when(environment.getActiveProfiles()).thenReturn(new String[]{"local"});
        try { seed.run(null); fail("must reject unsafe profile"); }
        catch (IllegalStateException expected) { assertTrue(expected.getMessage().contains("requires local-postgres")); }
        verifyNoInteractions(jdbc, users);
    }

    @Test
    public void completedSeedNeverTouchesPersistentUsers() throws Exception {
        when(jdbc.queryForObject(anyString(), eq(Long.class))).thenReturn(1L);
        seed.run(null);
        verify(jdbc).execute("LOCK TABLE public.local_sample_seed IN EXCLUSIVE MODE");
        verifyNoInteractions(users);
        verify(jdbc, never()).update(anyString());
    }

    @Test
    public void refusesUnmarkedNonemptyDatabase() throws Exception {
        when(jdbc.queryForObject(anyString(), eq(Long.class))).thenReturn(0L);
        when(users.count()).thenReturn(1L);
        try { seed.run(null); fail("must reject existing data"); }
        catch (IllegalStateException expected) { assertTrue(expected.getMessage().contains("nonempty database")); }
        verify(users, never()).saveAll(any());
        verify(jdbc, never()).update(anyString());
    }
}
