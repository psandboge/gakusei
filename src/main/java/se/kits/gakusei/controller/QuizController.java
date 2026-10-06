package se.kits.gakusei.controller;

import java.util.HashMap;
import java.util.List;

import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import se.kits.gakusei.content.model.Lesson;
import se.kits.gakusei.content.model.Quiz;
import se.kits.gakusei.content.repository.LessonRepository;
import se.kits.gakusei.content.repository.QuizRepository;
import se.kits.gakusei.util.QuestionHandler;
import se.kits.gakusei.util.QuizHandler;

@RestController
@Tag(name="QuizController", description="Operations for handling quiz")
public class QuizController {
    @Autowired
    LessonRepository lessonRepository;

    @Autowired
    QuestionHandler questionHandler;

    @Autowired
    QuizRepository quizRepository;

    @Autowired
    QuizHandler quizHandler;

    @Operation(summary="Getting questions for one quiz")
    @RequestMapping(
        value = {"/api/quiz", "/api/quiz/"},
        method = RequestMethod.GET,
        produces = "application/json;charset=UTF-8"
    )
    public ResponseEntity<List<HashMap<String, Object>>> getQuizQuestions(
        @RequestParam(value = "lessonName")
        String lessonName
    ) {
        Quiz quiz = quizRepository.findByName(lessonName);

        if (quiz == null) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        final List<
            HashMap<String, Object>
        > correctFormat = quizHandler.getQuizNuggets(quiz.getId());
        return new ResponseEntity<>(correctFormat, HttpStatus.OK);
    }

    @Operation(summary="Getting all the quizzes")
    @RequestMapping(
        value = {"/api/quizes", "/api/quizes/"},
        method = RequestMethod.GET,
        produces = "application/json;charset=UTF-8"
    )
    public ResponseEntity<Iterable<Quiz>> getQuizzes() {
        return new ResponseEntity<>(quizRepository.findAll(), HttpStatus.OK);
    }

    @Operation(summary="Get one quiz with a specific id")
    @RequestMapping(
        value = {"/api/quiz/{quizId}", "/api/quiz/{quizId}/"},
        method = RequestMethod.GET,
        produces = "application/json;charset=UTF-8"
    )
    public ResponseEntity<Quiz> getQuiz(
        @PathVariable(value = "quizId")
        Long quizId
    ) {
        return ResponseEntity.ok(quizRepository.findById(quizId).get());
    }

    @Operation(summary="Get quizzes by a specific name")
    @RequestMapping(
        value = {"/api/quizes/{offset}/{name}", "/api/quizes/{offset}/{name}/"},
        method = RequestMethod.GET,
        produces = "application/json;charset=UTF-8"
    )
    public ResponseEntity<Iterable<Quiz>> getQuizzesByName(
        @PathVariable(value = "name")
        String name,
        @PathVariable(value = "offset")
        int offset
    ) {
        Pageable pageRequest;
        if (offset < 0){
        pageRequest = PageRequest.of(0, 10); }
        else{
        pageRequest = PageRequest.of(offset, 10);}

        return new ResponseEntity<>(
            quizRepository.findByNameContainingIgnoreCase(name, pageRequest),
            HttpStatus.OK
        );
    }

    @Operation(summary="Getting the specific page for quizes")
    @RequestMapping(
        value = {"/api/quizes/{offset}", "/api/quizes/{offset}/"},
        method = RequestMethod.GET,
        produces = "application/json;charset=UTF-8"
    )
    public ResponseEntity<Iterable<Quiz>> getQuizzesPage(
        @PathVariable(value = "offset")
        int offset
    ) {
        Pageable pageRequest;
        if (offset < 0)
        pageRequest = PageRequest.of(0, 10); else
        pageRequest = PageRequest.of(offset, 10);
        return new ResponseEntity<>(
            quizRepository.findAll(pageRequest).getContent(),
            HttpStatus.OK
        );
    }

    @Operation(summary="Get nugget for quiz")
    @RequestMapping(
        value = {"/api/quiz/nugget/{quizNuggetId}", "/api/quiz/nugget/{quizNuggetId}/"},
        method = RequestMethod.GET,
        produces = "application/json;charset=UTF-8"
    )
    public HashMap<String, Object> getQuizNugget(
        @PathVariable(value = "quizNuggetId")
        Long quizNuggetId
    ) {
        return quizHandler.getQuizNugget(quizNuggetId);
    }

    @RequestMapping(
            value={"/api/quiz/nugget/correctAnswer/{correctAnswer}", "/api/quiz/nugget/correctAnswer/{correctAnswer}/"},
            method = RequestMethod.GET,
            produces = "application/json;charset=UTF-8"
    )
    public HashMap<String, Object> getQuizImage(
            @PathVariable(value="correctAnswer")
            String correctAnswer
    ){
        return quizHandler.getQuizImage(correctAnswer);
    }

}

