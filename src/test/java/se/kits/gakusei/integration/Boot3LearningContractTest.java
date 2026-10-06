package se.kits.gakusei.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit4.SpringRunner;
import se.kits.gakusei.util.InflectionUtil;
import se.kits.gakusei.content.model.Inflection;
import static org.junit.Assert.*;

@RunWith(SpringRunner.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"local-postgres", "local-seed"})
public class Boot3LearningContractTest {
    @Autowired TestRestTemplate http;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    private JsonNode get(String path) throws Exception {
        org.springframework.http.ResponseEntity<String> response = http.withBasicAuth("pieru", "gakusei").getForEntity(path, String.class);
        assertEquals(path, 200, response.getStatusCode().value());
        assertTrue(response.getHeaders().getContentType().toString().startsWith("application/json"));
        return mapper.readTree(response.getBody());
    }
    @Test public void realQuestionAndKanjiShapesRemainConsumable() throws Exception {
        JsonNode questions = get("/api/questions?lessonName=Verbs&username=pieru&questionType=reading&answerType=swedish");
        assertTrue(questions.isArray() && questions.size() >= 4);
        for (JsonNode question : questions) {
            assertTrue(question.path("question").isArray());
            assertTrue(question.path("correctAlternative").isArray());
            assertTrue(question.path("questionNuggetId").isTextual());
        }
        String lesson = jdbc.queryForObject("select name from contentschema.lessons where id in (select lesson_id from contentschema.lessons_kanjis) limit 1", String.class);
        JsonNode kanjis = get("/api/questions/kanji?lessonName=" + URLEncoder.encode(lesson, StandardCharsets.UTF_8) + "&username=pieru");
        assertTrue(kanjis.isArray() && kanjis.size() > 0);
        assertTrue(kanjis.get(0).path("question").size() >= 3);
        assertTrue(kanjis.get(0).path("correctAlternative").get(0).get(0).isTextual());
        assertEquals(204, http.withBasicAuth("pieru", "gakusei").getForEntity("/api/wrongquestions/kanji?userName=pieru", String.class).getStatusCode().value());
    }
    @Test public void quizAlternativesImagesAndGrammarLibraryRemainUsable() throws Exception {
        String quiz = jdbc.queryForObject("select name from contentschema.quiz limit 1", String.class);
        JsonNode questions = get("/api/quiz?lessonName=" + URLEncoder.encode(quiz, StandardCharsets.UTF_8));
        assertTrue(questions.isArray() && questions.size() > 0);
        JsonNode question = questions.get(0);
        assertTrue(question.path("correctAlternative").isArray());
        assertTrue(question.path("alternative1").isArray());
        JsonNode nugget = get("/api/quiz/nugget/" + question.path("questionNuggetId").asLong());
        assertTrue(nugget.has("quizImage"));
        assertTrue(nugget.path("incorrectAnswers").size() > 0);
        assertEquals(404, http.getForEntity("/api/quiz?lessonName=missing-contract-quiz", String.class).getStatusCode().value());
        assertTrue(Inflection.getAllInflectionMethods().contains("asPoliteForm"));
        assertEquals("Artig", InflectionUtil.getInflectionNameAndTextLink("asPoliteForm").get(0));
        se.sandboge.japanese.conjugation.Verb verb = new se.sandboge.japanese.conjugation.Verb("たべる");
        assertEquals("たべます", verb.asPoliteForm());
    }

    @Test public void drawingJsonAndPersistenceRetainCoordinatesAndTimestamp() throws Exception {
        String id = jdbc.queryForObject("select id from contentschema.kanjis limit 1", String.class);
        String coordinates = "contract-coordinates-" + java.util.UUID.randomUUID();
        try {
            se.kits.gakusei.dto.KanjiDrawingDTO drawing = new se.kits.gakusei.dto.KanjiDrawingDTO();
            drawing.setUsername("pieru"); drawing.setNuggetid(id); drawing.setData(coordinates);
            drawing.setDifficulty("easy"); drawing.setTimestamp(1700000000000L);
            assertEquals(200, http.withBasicAuth("pieru", "gakusei").postForEntity("/api/kanji-drawings", drawing, String.class).getStatusCode().value());
            JsonNode drawings = get("/api/kanji-drawings?name=pieru");
            assertTrue(drawings.isArray() && drawings.size() > 0);
            JsonNode found = null;
            for (JsonNode node : drawings) if (coordinates.equals(node.path("imageData").asText())) found = node;
            assertNotNull(found);
            assertEquals(id, found.path("nuggetID").asText());
            assertEquals("easy", found.path("difficulty").asText());
            assertFalse(found.has("user"));
            assertEquals(1700000000000L, jdbc.queryForObject("select timestamp from kanji_drawings where image_data=?", java.sql.Timestamp.class, coordinates).getTime());
        } finally {
            jdbc.update("delete from kanji_drawings where user_ref='pieru' and image_data=?", coordinates);
        }
    }

    @Test public void localizedUnicodeResourcesKeepJsonStructure() throws Exception {
        String abbreviation = "contract" + java.util.UUID.randomUUID().toString().replace("-", "");
        try {
            jdbc.update("insert into internationalization(abbreviation,language,sentence) values (?, 'se', 'Öva 日本語')", abbreviation);
            JsonNode resources = get("/api/internationalization/resources");
            assertEquals("Öva 日本語", resources.path("se").path("Translations").path(abbreviation).asText());
            JsonNode filtered = get("/api/internationalization?language=se&abbreviation=" + abbreviation);
            assertEquals(1, filtered.size());
            assertEquals("Öva 日本語", filtered.get(0).path("sentence").asText());
        } finally {
            jdbc.update("delete from internationalization where abbreviation=?", abbreviation);
        }
    }
}
