package se.kits.gakusei.integration;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit4.SpringRunner;
import static org.junit.Assert.*;

/** Real HTTP proofs for starter-review TE-001/002; each test owns its database rows. */
@RunWith(SpringRunner.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"local-postgres", "local-seed"})
public class Boot4ReviewContractTest {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired PasswordEncoder passwords;
    private final HttpClient client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    private String user;
    private String hash;
    private Long course;
    private Long lesson;
    private String lessonName;

    @Before public void createOwnedGraph() {
        String token = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        user = "review" + token;
        hash = passwords.encode("reviewpass");
        jdbc.update("insert into users(username,password,userrole,new_user,site_language) values (?,?, 'ROLE_USER',false,null)", user, hash);
        course = jdbc.queryForObject("insert into contentschema.courses(name,description,course_code,course_order) values (?,null,?,7) returning id", Long.class, "Öva 日本語 " + token, "review" + token);
        lessonName = "review-" + token;
        lesson = jdbc.queryForObject("insert into contentschema.lessons(name,description,course_ref) values (?,?,?) returning id", Long.class, lessonName, "Öva 日本語", course);
        jdbc.update("insert into contentschema.lessons_nuggets(lesson_id,nugget_id) select ?,id from contentschema.nuggets order by id limit 1", lesson);
        jdbc.update("insert into contentschema.lessons_kanjis(lesson_id,kanji_id) select ?,id from contentschema.kanjis order by id limit 1", lesson);
    }

    @After public void removeOwnedGraph() {
        if (user != null) {
            jdbc.update("delete from events where user_ref=?", user);
            jdbc.update("delete from progresstrackinglist where user_ref=?", user);
            jdbc.update("delete from user_lesson where user_ref=?", user);
            jdbc.update("delete from users where username=?", user);
        }
        if (lesson != null) {
            jdbc.update("delete from contentschema.lessons_nuggets where lesson_id=?", lesson);
            jdbc.update("delete from contentschema.lessons_kanjis where lesson_id=?", lesson);
            jdbc.update("delete from contentschema.lessons where id=?", lesson);
        }
        if (course != null) jdbc.update("delete from contentschema.courses where id=?", course);
    }

    private HttpResponse<String> request(String method, String path, String body, String basic) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).timeout(Duration.ofSeconds(30));
        if (basic != null) request.header("Authorization", "Basic " + Base64.getEncoder().encodeToString(basic.getBytes(StandardCharsets.UTF_8)));
        request.header("Content-Type", "application/json;charset=UTF-8");
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private String eventBody(String data) {
        return "{\"username\":\"" + user + "\",\"timestamp\":1700000000000,\"gamemode\":\"guess\",\"type\":\"question\",\"data\":\"" + data + "\"}";
    }

    private void assertEquivalent(HttpResponse<String> plain, HttpResponse<String> slash, int status) {
        assertEquals(status, plain.statusCode());
        assertEquals(plain.statusCode(), slash.statusCode());
        assertEquals(plain.headers().firstValue("content-type"), slash.headers().firstValue("content-type"));
        assertEquals(plain.body(), slash.body());
        assertTrue(plain.headers().firstValue("location").isEmpty());
        assertTrue(slash.headers().firstValue("location").isEmpty());
    }

    @Test public void successfulEventSlashMutationsPersistAndKeepAuthenticationParity() throws Exception {
        assertEquivalent(request("POST", "/api/events", eventBody("denied"), "missing:incorrect"),
                         request("POST", "/api/events/", eventBody("denied"), "missing:incorrect"), 401);
        assertEquals(Integer.valueOf(0), jdbc.queryForObject("select count(*) from events where user_ref=?", Integer.class, user));
        // The retained fallback permits anonymous writes; do not invent a new authorization policy.
        assertEquivalent(request("POST", "/api/events", eventBody("Öva 日本語"), null),
                         request("POST", "/api/events/", eventBody("Öva 日本語"), null), 200);
        assertEquals(Integer.valueOf(2), jdbc.queryForObject("select count(*) from events where user_ref=? and data=? and type='question' and gamemode='guess' and timestamp=?", Integer.class, user, "Öva 日本語", new java.sql.Timestamp(1700000000000L)));
        assertEquivalent(request("POST", "/api/events", eventBody("authenticated"), user + ":reviewpass"),
                         request("POST", "/api/events/", eventBody("authenticated"), user + ":reviewpass"), 200);
        assertEquals(Integer.valueOf(4), jdbc.queryForObject("select count(*) from events where user_ref=?", Integer.class, user));
        assertEquivalent(request("GET", "/api/events", null, null), request("GET", "/api/events/", null, null), 401);
        assertEquivalent(request("GET", "/api/events", null, user + ":reviewpass"), request("GET", "/api/events/", null, user + ":reviewpass"), 403);
    }

    @Test public void successfulDeleteSlashMutationsRemoveOnlyOwnedUserLessons() throws Exception {
        String query = "?lessonName=" + URLEncoder.encode(lessonName, StandardCharsets.UTF_8) + "&username=" + user;
        jdbc.update("insert into user_lesson(user_ref,lesson_ref) values (?,?)", user, lesson);
        assertEquivalent(request("DELETE", "/api/userLessons/remove" + query, null, "missing:incorrect"),
                         request("DELETE", "/api/userLessons/remove/" + query, null, "missing:incorrect"), 401);
        assertEquals(Integer.valueOf(1), jdbc.queryForObject("select count(*) from user_lesson where user_ref=?", Integer.class, user));
        HttpResponse<String> plain = request("DELETE", "/api/userLessons/remove" + query, null, user + ":reviewpass");
        assertEquals(Integer.valueOf(0), jdbc.queryForObject("select count(*) from user_lesson where user_ref=?", Integer.class, user));
        jdbc.update("insert into user_lesson(user_ref,lesson_ref) values (?,?)", user, lesson);
        HttpResponse<String> slash = request("DELETE", "/api/userLessons/remove/" + query, null, user + ":reviewpass");
        assertEquivalent(plain, slash, 200);
        assertEquals(Integer.valueOf(0), jdbc.queryForObject("select count(*) from user_lesson where user_ref=?", Integer.class, user));
    }

    private JsonNode json(String path) throws Exception {
        HttpResponse<String> response = request("GET", path, null, "admin:gakusei");
        assertEquals(200, response.statusCode());
        assertTrue(response.headers().firstValue("content-type").orElse("").startsWith("application/json"));
        assertTrue(response.headers().firstValue("location").isEmpty());
        return mapper.readTree(response.body());
    }

    private void assertProperties(JsonNode node, String... names) {
        assertTrue(node.isObject());
        Set<String> actual = new TreeSet<>();
        node.properties().forEach(entry -> actual.add(entry.getKey()));
        assertEquals(new TreeSet<>(java.util.List.of(names)), actual);
    }

    @Test public void populatedMvcGraphsOmitSecretsAndRecursiveBackReferences() throws Exception {
        assertEquals(200, request("POST", "/api/events/", eventBody("Öva 日本語"), user + ":reviewpass").statusCode());
        jdbc.update("insert into user_lesson(user_ref,lesson_ref) values (?,?)", user, lesson);
        jdbc.update("insert into progresstrackinglist(user_ref,nugget_id,correct_count,incorrect_count,latest_result,retention_factor,retention_interval) values (?,'review',2,1,true,1.5,2.5)", user);
        JsonNode users = json("/api/users");
        assertTrue(users.isArray());
        JsonNode owned = null;
        for (JsonNode candidate : users) {
            assertFalse(candidate.has("password"));
            if (user.equals(candidate.path("username").asText())) owned = candidate;
        }
        assertNotNull(owned);
        assertFalse(owned.toString().contains(hash));
        assertFalse(owned.toString().contains("reviewpass"));
        assertProperties(owned, "username", "role", "events", "kanji_drawings", "progressTrackingList", "usersLessons", "newUser", "siteLanguage");
        assertEquals(user, owned.path("username").asText());
        assertEquals("ROLE_USER", owned.path("role").asText());
        assertTrue(owned.path("newUser").isBoolean());
        assertTrue(owned.has("siteLanguage") && owned.path("siteLanguage").isNull());
        for (String association : java.util.List.of("events", "kanji_drawings", "progressTrackingList", "usersLessons")) {
            assertTrue(owned.path(association).isArray());
            assertEquals(1, owned.path(association).size());
            assertFalse(owned.path(association).get(0).has("user"));
        }
        JsonNode event = owned.path("events").get(0);
        assertProperties(event, "id", "timestamp", "gamemode", "type", "data", "lesson", "nuggetId", "nuggetType");
        assertTrue(event.path("id").isIntegralNumber());
        assertTrue(event.path("timestamp").isTextual());
        assertEquals("Öva 日本語", event.path("data").asText());
        assertTrue(event.path("lesson").isNull());
        assertTrue(event.path("nuggetType").isNull());
        JsonNode progress = owned.path("progressTrackingList").get(0);
        assertProperties(progress, "id", "nuggetType", "nuggetID", "correctCount", "incorrectCount", "latestTimestamp", "latestResult", "retentionFactor", "retentionInterval", "retentionDate");
        assertTrue(progress.path("id").isIntegralNumber());
        assertTrue(progress.path("correctCount").isIntegralNumber());
        assertTrue(progress.path("incorrectCount").isIntegralNumber());
        assertTrue(progress.path("retentionFactor").isNumber());
        assertTrue(progress.path("retentionInterval").isNumber());
        assertEquals(2, progress.path("correctCount").asLong());
        assertTrue(progress.path("latestResult").asBoolean());
        assertTrue(progress.path("retentionDate").isNull());
        JsonNode userLesson = owned.path("usersLessons").get(0);
        assertProperties(userLesson, "id", "lesson", "firstDeadline", "secondDeadline");
        assertTrue(userLesson.path("id").isIntegralNumber());
        assertTrue(userLesson.path("firstDeadline").isNull());
        assertTrue(userLesson.path("secondDeadline").isNull());
        assertLesson(userLesson.path("lesson"));
        // Collection route avoids the pre-existing ambiguous course lookup mappings.
        JsonNode courses = json("/api/courses/");
        assertTrue(courses.isArray());
        JsonNode ownedCourse = null;
        for (JsonNode candidate : courses) if (candidate.path("id").asLong() == course) ownedCourse = candidate;
        assertNotNull(ownedCourse);
        assertProperties(ownedCourse, "id", "name", "description", "parent", "prerequisites", "courseOrder", "courseCode", "lessons");
        assertEquals("Öva 日本語 " + user.substring(6), ownedCourse.path("name").asText());
        assertTrue(ownedCourse.path("description").isNull());
        assertTrue(ownedCourse.path("parent").isNull());
        assertTrue(ownedCourse.path("courseOrder").isIntegralNumber());
        assertTrue(ownedCourse.path("courseCode").isTextual());
        assertTrue(ownedCourse.path("prerequisites").isArray());
        assertTrue(ownedCourse.path("lessons").isArray());
        assertEquals(1, ownedCourse.path("lessons").size());
        assertLesson(ownedCourse.path("lessons").get(0));
    }

    private void assertLesson(JsonNode node) {
        assertProperties(node, "id", "name", "description", "nuggets", "kanjis");
        assertEquals(lesson.longValue(), node.path("id").asLong());
        assertEquals(lessonName, node.path("name").asText());
        assertEquals("Öva 日本語", node.path("description").asText());
        for (String association : java.util.List.of("nuggets", "kanjis")) {
            assertTrue(node.path(association).isArray());
            assertEquals(1, node.path(association).size());
            JsonNode content = node.path(association).get(0);
            assertTrue(content.path("id").isTextual());
            assertFalse(content.has("lessons"));
        }
    }
}
