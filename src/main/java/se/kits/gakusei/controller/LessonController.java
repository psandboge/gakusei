package se.kits.gakusei.controller;

import java.util.*;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import se.kits.gakusei.content.model.FavoriteLesson;
import se.kits.gakusei.content.model.Lesson;
import se.kits.gakusei.content.model.Nugget;
import se.kits.gakusei.content.model.UserLesson;
import se.kits.gakusei.content.repository.InflectionRepository;
import se.kits.gakusei.content.repository.KanjiRepository;
import se.kits.gakusei.content.repository.LessonRepository;
import se.kits.gakusei.content.repository.UserLessonRepository;

@RestController
public class LessonController {
    private Logger logger = LoggerFactory.getLogger(LessonController.class);

    @Autowired
    private LessonRepository lessonRepository;

    @Autowired
    private InflectionRepository inflectionRepository;

    @Autowired
    private KanjiRepository kanjiRepository;

    @Autowired
    private UserLessonRepository userLessonRepository;

    @RequestMapping(
        value = "/api/lessons",
        method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_UTF8_VALUE
    )
    public ResponseEntity<List<Lesson>> getLessons(
        @RequestParam(value = "lessonType")
        String lessonType
    ) {
        if (lessonType.equals("grammar")) {
            return new ResponseEntity<>(getGrammarLessons(), HttpStatus.OK);
        } else if (lessonType.equals("kanji")) {
            return new ResponseEntity<>(getKanjiLessons(), HttpStatus.OK);
        }
        return new ResponseEntity<>(
            getLessonsWithEnoughNuggets(),
            HttpStatus.OK
        );
    }

    @RequestMapping(
        value = "/api/lessonInfo",
        method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_UTF8_VALUE
    )
    public ResponseEntity<
        HashMap<String, HashMap<String, Integer>>
    > getQuestionInfo(
        @RequestParam(name = "questionType", defaultValue = "reading")
        String questionType,
        @RequestParam(name = "answerType", defaultValue = "swedish")
        String answerType,
        @RequestParam(name = "username")
        String username
    ) {
        HashMap<
            String,
            HashMap<String, Integer>
        > values = getStringHashMapHashMap(username);
        return new ResponseEntity<>(values, HttpStatus.OK);
    }

    @RequestMapping(
        value = "/api/lessons/favorite",
        method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_UTF8_VALUE
    )
    public ResponseEntity<FavoriteLesson> getFavoriteLesson(
        @RequestParam(value = "lessonType", required = false)
        String lessonType,
        @RequestParam(value = "username")
        String username
    ) {
        return new ResponseEntity<>(
            getLessonFromFavorites(username),
            HttpStatus.OK
        );
    }

    private HashMap<String, HashMap<String, Integer>> getStringHashMapHashMap(
        String username
    ) {
        long mark = System.currentTimeMillis();

        HashMap<String, HashMap<String, Integer>> values = new HashMap<>();
        List<Lesson> tmpLessons = getLessonsWithEnoughNuggets();
        logger.info(
            "Getting vocabulary lessons took {} ms.",
            System.currentTimeMillis() - mark
        );
        mark = System.currentTimeMillis();
        for (Lesson tmpLesson : tmpLessons) {
            Integer numCorrectlyAnswered = lessonRepository.findNumberOfCorrectlyAnsweredNuggets(username, tmpLesson.getName());
            Integer numUnansweredRetention = lessonRepository.findNumberOfUnansweredRetentionNuggets(username, tmpLesson.getName());
            Integer numRetentionNuggets = lessonRepository.findNumberOfNuggetsByRetentionDate(username, tmpLesson.getName());

            logger.info(
                "Un count for {}: {}",
                tmpLesson.getName(),
                numUnansweredRetention
            );
            HashMap<String, Integer> lessonData = new HashMap<>();
            lessonData.put("all", tmpLesson.getNuggets().size());
            lessonData.put("unanswered", numUnansweredRetention);
            lessonData.put(
                "correctlyAnswered",
                numCorrectlyAnswered
            );
            lessonData.put("retention", numRetentionNuggets);

            values.put(tmpLesson.getName(), lessonData);
//            logger.info(
//                    "Correct: {} Lesson: {}",
//                    lessonRepository.findNumberOfCorrectlyAnsweredNuggets(username, tmpLesson.getName()),
//                    tmpLesson.getName());
        }
        logger.info(
            "Collecting lesson nuggets took {} ms",
            System.currentTimeMillis() - mark
        );
        return values;
    }

    @Cacheable("lessonInfoNuggets")
    public List<Nugget> getNuggets(Lesson tmpLesson) {
        return tmpLesson.getNuggets().stream().filter(
            n -> !n.isHidden()
        ).collect(Collectors.toList());
    }

    @Cacheable("lessons")
    public List<Lesson> getLessonsWithEnoughNuggets() {
        return lessonRepository.findAllByOrderByName().stream().filter(
            lesson -> lesson.getNuggets().size() >= 4
        ).collect(Collectors.toList());
    }

    @Cacheable("grammarLessons")
    public List<Lesson> getGrammarLessons() {
        return getLessonsWithEnoughNuggets().stream().filter(
            lesson -> !inflectionRepository.findByLessonId(
                lesson.getId()
            ).isEmpty()
        ).collect(Collectors.toList());
    }

    @Cacheable("kanjiLessons")
    public List<Lesson> getKanjiLessons() {
        return lessonRepository.findAllByOrderByName().stream().filter(
            lesson -> !lesson.getKanjis().isEmpty()
        ).collect(Collectors.toList());
    }

    private HashMap<String, Integer> getFavoriteDataHashMap(String username) {
        List<
            Lesson
        > favoriteLessons = userLessonRepository.findUsersStarredLessons(
            username
        ).stream().map(UserLesson::getLesson).collect(Collectors.toList());
        HashMap<String, Integer> lessonData = new HashMap<>();
        List<Nugget> correctlyAnsweredNuggets = favoriteLessons.stream().map(
            lesson -> lessonRepository.findCorrectlyAnsweredNuggets(
                username,
                lesson.getName()
            )
        ).flatMap(nuggets -> nuggets.stream()).filter(
            nugget -> !nugget.isHidden()
        ).distinct().collect(Collectors.toList());
        List<Nugget> unansweredNuggets = favoriteLessons.stream().map(
            lesson -> lessonRepository.findUnansweredRetentionNuggets(
                username,
                lesson.getName()
            )
        ).flatMap(nuggets -> nuggets.stream()).filter(
            nugget -> !nugget.isHidden()
        ).distinct().collect(Collectors.toList());
        List<Nugget> allLessonNuggets = favoriteLessons.stream().map(
            lesson -> lesson.getNuggets()
        ).flatMap(nuggets -> nuggets.stream()).filter(
            nugget -> !nugget.isHidden()
        ).distinct().collect(Collectors.toList());
        List<Nugget> retentionNuggets = favoriteLessons.stream().map(
            lesson -> lessonRepository.findNuggetsByRetentionDate(
                username,
                lesson.getName()
            )
        ).flatMap(nuggets -> nuggets.stream()).filter(
            nugget -> !nugget.isHidden()
        ).distinct().collect(Collectors.toList());
        lessonData.put("unanswered", unansweredNuggets.size());
        lessonData.put("correctlyAnswered", correctlyAnsweredNuggets.size());
        lessonData.put("all", allLessonNuggets.size());
        lessonData.put("retention", retentionNuggets.size());

        return lessonData;
    }

    @Cacheable("favoriteLesson")
    public FavoriteLesson getLessonFromFavorites(String username) {
        FavoriteLesson favoriteLesson = new FavoriteLesson();
        favoriteLesson.setName("Favoriter");
        favoriteLesson.setId(1337L);
        favoriteLesson.setNuggetData(getFavoriteDataHashMap(username));

        return favoriteLesson;
    }

}

