package se.kits.gakusei.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.transaction.annotation.Transactional;
import se.kits.gakusei.util.LessonHandler;
import static org.junit.Assert.*;

@RunWith(SpringRunner.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {"spring.cache.type=jcache", "spring.cache.jcache.config=classpath:ehcache.xml"})
@ActiveProfiles({"local-postgres", "local-seed", "enable-resource-caching"})
public class Boot3IntegrationTest {
    @Autowired TestRestTemplate http;
    @Autowired CacheManager caches;
    @Autowired LessonHandler lessons;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired org.springframework.web.context.WebApplicationContext application;

    @Test public void documentationSpecAssetsAndSecurityTemplateRender() throws Exception {
        JsonNode spec = mapper.readTree(http.getForObject("/v3/api-docs", String.class));
        assertTrue(spec.path("openapi").asText().startsWith("3."));
        assertTrue(spec.path("paths").has("/api/questions"));
        assertEquals("Getting questions from a lesson", spec.at("/paths/~1api~1questions/get/summary").asText());
        assertTrue(spec.at("/components/schemas/User/properties/password/writeOnly").asBoolean());
        assertEquals(200, http.getForEntity("/swagger-ui/index.html", String.class).getStatusCode().value());
        assertTrue(http.getForObject("/swagger-ui/swagger-ui-bundle.js", String.class).contains("SwaggerUIBundle"));
        assertEquals("/v3/api-docs", mapper.readTree(http.getForObject("/v3/api-docs/swagger-config", String.class)).path("url").asText());
        org.thymeleaf.spring6.SpringTemplateEngine engine = new org.thymeleaf.spring6.SpringTemplateEngine();
        engine.setTemplateResolver(new org.thymeleaf.templateresolver.StringTemplateResolver());
        engine.addDialect(new org.thymeleaf.extras.springsecurity6.dialect.SpringSecurityDialect());
        org.springframework.mock.web.MockServletContext servlet = new org.springframework.mock.web.MockServletContext();
        servlet.setAttribute(org.springframework.web.context.WebApplicationContext.ROOT_WEB_APPLICATION_CONTEXT_ATTRIBUTE, application);
        org.thymeleaf.web.servlet.JakartaServletWebApplication web = org.thymeleaf.web.servlet.JakartaServletWebApplication.buildApplication(servlet);
        org.thymeleaf.context.WebContext context = new org.thymeleaf.context.WebContext(web.buildExchange(
            new org.springframework.mock.web.MockHttpServletRequest(servlet), new org.springframework.mock.web.MockHttpServletResponse()));
        String template = "<span xmlns:sec='http://www.thymeleaf.org/extras/spring-security' sec:authorize=\"hasAuthority('ROLE_ADMIN')\">secret</span>";
        org.springframework.security.core.context.SecurityContext original = org.springframework.security.core.context.SecurityContextHolder.getContext();
        try {
            org.springframework.security.core.context.SecurityContext security = org.springframework.security.core.context.SecurityContextHolder.createEmptyContext();
            org.springframework.security.core.context.SecurityContextHolder.setContext(security);
            assertFalse(engine.process(template, context).contains("secret"));
            security.setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                "template-admin", "unused", java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))));
            assertTrue(engine.process(template, context).contains("secret"));
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.setContext(original);
        }
    }
    @Test @Transactional public void actualJcacheOperationAndLessonInvalidation() {
        org.springframework.cache.Cache cache = caches.getCache("lessons.retention.correct");
        assertNotNull(cache);
        cache.put("contract-probe", 42);
        assertEquals(Integer.valueOf(42), cache.get("contract-probe", Integer.class));
        cache.evict("contract-probe");
        assertNull(cache.get("contract-probe"));
        lessons.evictCacheNuggets("pieru", "Verbs");
        int before = lessons.getNumberOfCorrectNuggets("pieru", "Verbs");
        String nugget = jdbc.queryForObject("select nugget_id from contentschema.lessons_nuggets where lesson_id=(select id from contentschema.lessons where name='Verbs') limit 1", String.class);
        jdbc.update("insert into progresstrackinglist(user_ref,nugget_type_ref,nugget_id,correct_count,incorrect_count,latest_result) values ('pieru',2,?,1,0,true)", nugget);
        assertEquals(Integer.valueOf(before), lessons.getNumberOfCorrectNuggets("pieru", "Verbs"));
        lessons.evictCacheNuggets("pieru", "Verbs");
        assertEquals(Integer.valueOf(before + 1), lessons.getNumberOfCorrectNuggets("pieru", "Verbs"));
        lessons.evictCacheNuggets("pieru", "Verbs");
    }
}
