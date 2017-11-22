package se.kits.gakusei.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.kits.gakusei.content.model.Nugget;
import se.kits.gakusei.content.repository.LessonRepository;
import se.kits.gakusei.util.QuestionHandler;

import java.util.*;

@RestController
public class QuestionController {

    private LessonRepository lessonRepository;

    private QuestionHandler questionHandler;

    @Value("${gakusei.questions-quantity}")
    private int quantity;

    @Autowired
    public QuestionController(LessonRepository lessonRepository, QuestionHandler questionHandler) {
        this.lessonRepository = lessonRepository;
        this.questionHandler = questionHandler;
    }

    @RequestMapping(
            value = "/api/questions",
            method = RequestMethod.GET,
            produces = MediaType.APPLICATION_JSON_UTF8_VALUE
    )
    ResponseEntity<List<HashMap<String, Object>>> getQuestionsFromLesson(
            @RequestParam(value = "lessonName") String lessonName,
            @RequestParam(value = "lessonType", defaultValue = "vocabulary") String lessonType,
            @RequestParam(name = "questionType", defaultValue = "reading") String questionType,
            @RequestParam(name = "answerType", defaultValue = "swedish") String answerType,
            @RequestParam(name = "username") String username) {

        List<HashMap<String, Object>> questions = getCachedQuestionsFromLesson(lessonName, lessonType, questionType, answerType, username);

        return questions.isEmpty() ?
                new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR) :
                new ResponseEntity<>(questions, HttpStatus.OK);
    }

    private List<HashMap<String, Object>> getCachedQuestionsFromLesson(String lessonName, String lessonType, String questionType, String answerType, String username) {
        List<Nugget> nuggetsWithLowSuccessrate = lessonRepository.findNuggetsBySuccessrate(username, lessonName);
        List<Nugget> unansweredNuggets = lessonRepository.findUnansweredNuggets(username, lessonName);
        List<Nugget> allLessonNuggets;
        if (lessonType.equals("kanji")) {
            allLessonNuggets = cachedFindKanjiNuggetsByFactType(lessonName, questionType, answerType);

        } else if(lessonType.equals("grammar")) {
            allLessonNuggets = cachedFindVerbNuggets(lessonName);
        } else {
            allLessonNuggets = cachedFindKanjiLessNuggetsByFactType(lessonName, questionType, answerType);
        }

        List<Nugget> nuggets = questionHandler.chooseNuggetsByProgress(nuggetsWithLowSuccessrate, unansweredNuggets,
                allLessonNuggets, quantity);

        return questionHandler.createQuestions(nuggets, quantity, questionType,
                answerType);
    }

    @Cacheable("kanjiNuggets")
    public List<Nugget> cachedFindKanjiNuggetsByFactType(String lessonName, String questionType, String answerType) {
        return lessonRepository.findKanjiNuggetsByFactType(lessonName, questionType, answerType);
    }

    @Cacheable("otherNuggets")
    public List<Nugget> cachedFindKanjiLessNuggetsByFactType(String lessonName, String questionType, String answerType) {
        return lessonRepository.findKanjiLessNuggetsByFactType(lessonName, questionType, answerType);
    }

    @Cacheable("verbNuggets")
    private List<Nugget> cachedFindVerbNuggets(String lessonName){
        return lessonRepository.findVerbNuggets(lessonRepository.findByName(lessonName).getId());
    }
}
