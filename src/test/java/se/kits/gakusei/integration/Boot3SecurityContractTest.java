package se.kits.gakusei.integration;

import java.net.URI;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Base64;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit4.SpringRunner;
import static org.junit.Assert.*;

/** Same requests are characterized against the immutable Boot 2 fixture before migration. */
@RunWith(SpringRunner.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"local-postgres", "local-seed"})
public class Boot3SecurityContractTest {
    @LocalServerPort int port;
    @org.springframework.beans.factory.annotation.Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    private String createdUser;
    @org.junit.After public void removeOwnedAccount() {
        if (createdUser != null) jdbc.update("delete from users where username=?", createdUser);
    }
    private HttpResponse<String> request(HttpClient client, String path, String form, String basic) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path));
        if (basic != null) request.header("Authorization", "Basic " + Base64.getEncoder().encodeToString(basic.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        if (form != null) request.header("Content-Type", "application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(form));
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
    @Test public void baselineAccessMatrixAndDispatchRemainEqual() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        assertTrue(request(client, "/username", null, null).body().contains("\"loggedIn\":false"));
        assertEquals(401, request(client, "/api/users", null, null).statusCode());
        assertEquals("Unauthorized", request(client, "/api/users", null, null).body());
        assertEquals(403, request(client, "/api/users", null, "pieru:gakusei").statusCode());
        assertEquals("Forbidden", request(client, "/api/users", null, "pieru:gakusei").body());
        assertEquals(200, request(client, "/api/users", null, "admin:gakusei").statusCode());
        assertEquals(401, request(client, "/api/events", null, null).statusCode());
        assertEquals(403, request(client, "/api/events", null, "pieru:gakusei").statusCode());
        assertEquals(200, request(client, "/api/events", null, "admin:gakusei").statusCode());
        assertEquals(200, request(client, "/v3/api-docs", null, null).statusCode());
        assertEquals(404, request(client, "/missing-contract-route", null, null).statusCode());
        assertEquals("No message available", request(client, "/missing-contract-route", null, null).body());
        assertEquals(400, request(client, "/api/questions", null, null).statusCode());
        assertEquals("Required request parameter 'lessonName' for method parameter type String is not present",
            request(client, "/api/questions", null, null).body());
        assertEquals(200, request(client, "/username/", null, null).statusCode());
        assertEquals(406, request(client, "/registeruser", "username=bad!&password=valid&remember-me=false", null).statusCode());
        assertEquals(403, request(client, "/auth", "username=pieru&password=incorrect", null).statusCode());
    }
    @Test public void registrationThenFormLoginPersistsSessionRememberMeAndLogout() throws Exception {
        String user = "contract" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        createdUser = user;
        CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        HttpClient client = HttpClient.newBuilder().cookieHandler(cookies).build();
        String form = "username=" + user + "&password=contractpass&remember-me=true";
        assertEquals(201, request(client, "/registeruser", form, null).statusCode());
        assertTrue(request(client, "/username", null, null).body().contains("\"loggedIn\":false"));
        assertEquals(200, request(client, "/auth", form, null).statusCode());
        assertTrue(request(client, "/username", null, null).body().contains("\"username\":\"" + user + "\""));
        assertTrue(cookies.getCookieStore().getCookies().stream().anyMatch(c -> c.getName().equals("remember-me")));
        cookies.getCookieStore().getCookies().stream().filter(c -> c.getName().equals("JSESSIONID")).toList()
            .forEach(c -> cookies.getCookieStore().remove(URI.create("http://127.0.0.1:" + port), c));
        assertTrue(request(client, "/username", null, null).body().contains("\"loggedIn\":true"));
        assertEquals(204, request(client, "/logout", "", null).statusCode());
        assertTrue(request(client, "/username", null, null).body().contains("\"loggedIn\":false"));
    }
}
