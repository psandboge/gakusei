package se.kits.gakusei.test_tools;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import se.kits.gakusei.content.model.*;
import se.kits.gakusei.util.QuizHandler;

import java.util.*;

public class TestTools {

    public static List<Nugget> generateNuggets() {
        List<Nugget> nuggets = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            WordType type = new WordType();
            type.setType("verb");
            Nugget n = new Nugget("verb");
            n.setSwedish("swe_test" + i);
            n.setEnglish("eng_test" + i);
            n.setJpRead("read_test" + i);
            n.setJpWrite("write_test" + i);
            n.setDescription("desc_test" + i);
            n.setWordType(type);
            if (i % 3 == 0) {
                n.setHidden(true);
            }
            nuggets.add(n);
        }
        return nuggets;
    }

    public static Nugget generateQuizNugget(String description, String correctData, String incorrectData) {
        Nugget n = new Nugget("quiz");
        n.setDescription(description);
        Fact correctFact = new Fact();
        correctFact.setType("correct");
        correctFact.setData(correctData);
        correctFact.setNugget(n);
        List<Fact> facts = new ArrayList<>();
        facts.add(correctFact);
        for (int i = 0; i < 5; i++) {
            Fact incorrectFact = new Fact();
            incorrectFact.setType("incorrect");
            incorrectFact.setData(incorrectData + i);
            incorrectFact.setNugget(n);
            facts.add(incorrectFact);
        }
        n.setFacts(facts);
        return n;
    }

    public static Lesson generateQuizLesson(String lessonName, String description, String correctData, String incorrectData) {
        Lesson lesson = new Lesson();
        lesson.setName(lessonName);
        List<Nugget> nuggets = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            Nugget n = generateQuizNugget(description, correctData, incorrectData);
            n.setLessons(Collections.singletonList(lesson));
            nuggets.add(n);
        }
        return lesson;
    }

    public static HashMap<String, Object> generateQuestion() {
        List<String> question = new ArrayList<>();
        question.add("question");
        List<String> alt1 = Arrays.asList("alternative1");
        List<String> alt2 = Arrays.asList("alternative2");
        List<String> alt3 = Arrays.asList("alternative3");
        List<String> altCorrect = Arrays.asList("alternativeCorrect");
        HashMap<String, Object> dto = new HashMap<>();
        dto.put("question", question);
        dto.put("alternative1", alt1);
        dto.put("alternative2", alt2);
        dto.put("alternative3", alt3);
        dto.put("correctAlternative", altCorrect);
        return dto;
    }

    public static List<Course> generateCourses(){
        List<Course> courses = new ArrayList<>();

        for(int i = 1; i <= 10; i++){
            courses.add(createCourse(Integer.toString(i)));
        }

        return courses;
    }

    public static Course generateCourse(){
        return createCourse("");
    }

    private static Course createCourse(String suffix){
        Course course = new Course();
        course.setName("Test course" + suffix);
        course.setCourseCode("TC");
        return course;
    }

    public static Quiz generateQuiz() { return createQuiz("", "Testquiz", "description"); }

    public static List<Quiz> generateQuizzes(int nbrOfQuizzes, String namePrefix, String descrPrefix) {
        List<Quiz> quizzes = new ArrayList<>();
       for (int i = 1; i <= nbrOfQuizzes; i++ ) {
           quizzes.add(createQuiz(Integer.toString(i), namePrefix, descrPrefix));
       }

       return quizzes;
    }

    private static Quiz createQuiz(String suffix, String namePrefix, String descrPrefix) {
        Quiz quiz = new Quiz();
        quiz.setName(namePrefix + suffix);
        quiz.setDescription(descrPrefix + suffix);
        return quiz;
    }

    public static Page<Quiz> generateQuizzesPage(List<Quiz> quizzes, Pageable pageRequest) {
        Page<Quiz> page = new PageImpl<>(quizzes, pageRequest, quizzes.size());
        return page;
    }

    public static HashMap<String, Object> createQuestion(Quiz quiz, int nbrOfIncorrectAnswers) {
        HashMap<String, Object> question = new HashMap<>();
        QuizNugget quizNugget = createQuizNugget(quiz, "");
        question.put(QuizHandler.QN_QUESTION, quizNugget.getQuestion());
        question.put(QuizHandler.QN_CORRECT_ANSWER, quizNugget.getCorrectAnswer());
        question.put(QuizHandler.QN_QUIZ_REF, quiz.getId());
        question.put(QuizHandler.QN_INCORRECT_ANSWERS, createIncorrectAnswers(quizNugget, nbrOfIncorrectAnswers));
        return question;
    }

    private static QuizNugget createQuizNugget(Quiz quiz, String suffix) {
        QuizNugget nugget = new QuizNugget();
        nugget.setQuiz(quiz);
        nugget.setQuestion("Question " + suffix);
        nugget.setCorrectAnswer("correct alternative");
        return nugget;
    }

    private static List<HashMap<String, Object>> createIncorrectAnswers(QuizNugget quizNugget, int
            nbrOfIncorrectAnswers) {
        List<HashMap<String, Object>> incorrectAnswers = new ArrayList<>();
        for (int i = 1; i <= nbrOfIncorrectAnswers; i++) {
            incorrectAnswers.add(convertIncorrectAnswer(createIncorrectAnswer(quizNugget, Integer.toString(i))));
        }
        return incorrectAnswers;
    }

    private static HashMap<String, Object> convertIncorrectAnswer(IncorrectAnswers incorrectAnswer) {
        HashMap<String, Object> convertedIncorrectAnswer = new HashMap<>();
        convertedIncorrectAnswer.put(QuizHandler.IA_INCORRECT_ANSWERS, incorrectAnswer.getIncorrectAnswer());
        return convertedIncorrectAnswer;
    }

    private static IncorrectAnswers createIncorrectAnswer(QuizNugget nugget, String suffix) {
        IncorrectAnswers incorrectAnswer = new IncorrectAnswers();
        incorrectAnswer.setQuizNugget(nugget);
        incorrectAnswer.setIncorrectAnswer("incorrect alternative " + suffix);
        return incorrectAnswer;
    }

}
