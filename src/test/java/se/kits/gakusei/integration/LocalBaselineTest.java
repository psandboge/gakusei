package se.kits.gakusei.integration;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit4.SpringRunner;
import se.kits.gakusei.content.repository.LessonRepository;
import se.kits.gakusei.user.repository.UserRepository;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.Assert.*;

@RunWith(SpringRunner.class)
@org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"local-postgres", "local-seed"})
public class LocalBaselineTest {
    @Autowired LessonRepository lessons;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired TestRestTemplate http;

    @Test
    @Transactional
    public void bundledSeedSupportsRealVocabularyAndRetentionQueries() {
        assertEquals(6, users.count());
        assertNotNull(users.findByUsername("nulluser"));
        assertTrue(lessons.count() > 1);
        assertTrue(lessons.findNumberOfNuggetsByName("Verbs") >= 4);
        assertFalse(lessons.findUnansweredNuggets("pieru", "Verbs").isEmpty());
        assertTrue(lessons.findNuggetsBySuccessrate("pieru", "Verbs").isEmpty());
        assertTrue(lessons.findNuggetsByRetentionDate("pieru", "Verbs").isEmpty());
        assertFalse(lessons.findUnansweredRetentionNuggets("pieru", "Verbs").isEmpty());
        assertEquals(7, jdbc.queryForObject("select count(*) from public.nugget_category", Integer.class).intValue());
        assertEquals(0, jdbc.queryForObject("select count(*) from events", Integer.class).intValue());
    }

    @Test
    public void authenticatedQuestionsAndOpenApiAreServed() {
        TestRestTemplate learner = http.withBasicAuth("pieru", "gakusei");
        org.springframework.http.ResponseEntity<String> questions = learner.getForEntity(
            "/api/questions?lessonName=Verbs&username=pieru&questionType=reading&answerType=swedish", String.class);
        assertEquals(200, questions.getStatusCode().value());
        assertTrue(questions.getBody().startsWith("["));
        assertFalse(questions.getBody().equals("[]"));
        assertEquals(200, learner.getForEntity("/v3/api-docs", String.class).getStatusCode().value());
    }
}
