package se.kits.gakusei.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.kits.gakusei.content.model.Lesson;
import se.kits.gakusei.content.model.Nugget;
import se.kits.gakusei.content.repository.LessonRepository;
import se.kits.gakusei.content.repository.NuggetRepository;
import se.kits.gakusei.dto.QuestionDTO;
import se.kits.gakusei.util.QuestionHandler;

import java.util.*;

@RestController
public class QuestionController {

    @Autowired
    private NuggetRepository nuggetRepository;

    @Autowired
    private LessonRepository lessonRepository;

    @Autowired
    private QuestionHandler questionHandler;

    @RequestMapping(
            value = "/api/question",
            method = RequestMethod.GET,
            produces = MediaType.APPLICATION_JSON_UTF8_VALUE
    )
    private ResponseEntity<QuestionDTO> getQuestion(
            @RequestParam(value = "wordType", defaultValue = "") String wordType,
            @RequestParam(name = "questionType", defaultValue = "reading") String questionType,
            @RequestParam(name = "answerType", defaultValue = "english_translation") String answerType) {

        List<Nugget> nuggets;
        if (wordType.equals("")) {
            nuggets = nuggetRepository.getNuggetsWithoutWordType(questionType, answerType);
        } else {
            nuggets = nuggetRepository.getNuggetsWithWordType(wordType, questionType, answerType);
        }

        QuestionDTO question = questionHandler.getQuestion(nuggets, questionType, answerType);

        if (question != null) {
            return new ResponseEntity<QuestionDTO>(question, HttpStatus.OK);
        } else {
            return new ResponseEntity<QuestionDTO>(HttpStatus.NO_CONTENT);
        }
    }

    @RequestMapping(
            value = "/api/questions",
            method = RequestMethod.GET,
            produces = MediaType.APPLICATION_JSON_UTF8_VALUE
    )
    private ResponseEntity<List<QuestionDTO>> getQuestionsFromLesson(
            @RequestParam(value = "lessonName") String lessonName,
            @RequestParam(name = "questionType", defaultValue = "reading") String questionType,
            @RequestParam(name = "answerType", defaultValue = "english_translation") String answerType) {

        Lesson lesson = lessonRepository.findLessonByName(lessonName);

        if (lesson != null) {
            List<Nugget> nuggets = lesson.getNuggets();
            List<QuestionDTO> questions = questionHandler.getQuestions(nuggets, questionType, answerType);
            if (questions.isEmpty()) {
                return new ResponseEntity<List<QuestionDTO>>(HttpStatus.NO_CONTENT);
            } else {
                return new ResponseEntity<List<QuestionDTO>>(questions, HttpStatus.OK);
            }
        } else {
            return new ResponseEntity<List<QuestionDTO>>(HttpStatus.NOT_FOUND);
        }
    }
}