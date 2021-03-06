package se.kits.gakusei.controller;

import java.sql.Timestamp;
import java.util.List;

import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import se.kits.gakusei.content.model.Lesson;
import se.kits.gakusei.content.model.UserLesson;
import se.kits.gakusei.content.repository.LessonRepository;
import se.kits.gakusei.content.repository.UserLessonRepository;
import se.kits.gakusei.dto.DeadlineDTO;
import se.kits.gakusei.user.model.User;
import se.kits.gakusei.user.repository.UserRepository;

@RestController
@Api(value="UserLessonController", description="Operations for handling user lessons")
public class UserLessonController {
    @Autowired
    private UserLessonRepository userLessonRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LessonRepository lessonRepository;

    @ApiOperation(value="Get a users lessons", response = ResponseEntity.class)
    @RequestMapping(value = "/api/userLessons", method = RequestMethod.GET,
            produces = MediaType.APPLICATION_JSON_UTF8_VALUE)
    public ResponseEntity<List<UserLesson>> getUserLesson(@RequestParam(value = "username") String username) {

        List<UserLesson> userLessons = userLessonRepository.findUsersStarredLessons(username);
        userLessons.stream().forEach(ul -> ul.getLesson().clearNuggets());
        userLessons.stream().forEach(ul -> ul.getLesson().clearKanjis());
        return new ResponseEntity<>(userLessons, HttpStatus.OK);
    }

    @ApiOperation(value="Add a lesson to a user", response = ResponseEntity.class)
    @RequestMapping(
        value = "/api/userLessons/add",
        method = RequestMethod.POST,
        produces = MediaType.APPLICATION_JSON_UTF8_VALUE,
        consumes = MediaType.APPLICATION_JSON_UTF8_VALUE
    )
    public ResponseEntity<UserLesson> addUserLesson(
            @RequestParam(value = "lessonName") String lessonName,
            @RequestParam(value = "username") String username)
    {
        User user = userRepository.findByUsername(username);
        Lesson lesson = lessonRepository.findByName(lessonName);
        UserLesson userLesson = new UserLesson(user, lesson);
        return new ResponseEntity<UserLesson>(userLessonRepository.save(userLesson), HttpStatus.OK);
    }

    @ApiOperation(value="Remove a lesson from a user", response = ResponseEntity.class)
    @RequestMapping(value = "/api/userLessons/remove", method = RequestMethod.DELETE,
            produces = MediaType.APPLICATION_JSON_UTF8_VALUE)
    public ResponseEntity<UserLesson> removeUserLesson(
        @RequestParam(value = "lessonName") String lessonName,
        @RequestParam(value = "username") String username)
    {
        List<UserLesson> userLesson = userLessonRepository.findUserLessonByUsernameAndLessonName(username, lessonName);
        userLessonRepository.delete(userLesson.get(0));
        return new ResponseEntity<UserLesson>(HttpStatus.OK);
    }

    @ApiOperation(value="Set a first deadline for a users lesson", response = ResponseEntity.class)
    @RequestMapping(value = "/api/userLessons/setFirstDeadline", method = RequestMethod.POST,
            produces = MediaType.APPLICATION_JSON_UTF8_VALUE)
    public ResponseEntity<UserLesson> setFirstDeadlineToUserLesson(@RequestBody DeadlineDTO deadlineDTO) {

        List<UserLesson> userLessons = userLessonRepository.findUserLessonByUsernameAndLessonName(
                deadlineDTO.getUsername(), deadlineDTO.getLessonName());
        UserLesson userLesson = userLessons.get(0);
        userLesson.setFirstDeadline(new Timestamp(deadlineDTO.getDeadline()));
        userLessonRepository.save(userLesson);
        return new ResponseEntity<UserLesson>(HttpStatus.OK);
    }

    @ApiOperation(value="Set a second deadline for a users lesson", response = ResponseEntity.class)
    @RequestMapping(value = "/api/userLessons/setSecondDeadline", method = RequestMethod.POST,
            produces = MediaType.APPLICATION_JSON_UTF8_VALUE)
    public ResponseEntity<UserLesson> setSecondDeadlineToUserLesson(@RequestBody DeadlineDTO deadlineDTO) {

        List<UserLesson> userLessons = userLessonRepository.findUserLessonByUsernameAndLessonName(
            deadlineDTO.getUsername(), deadlineDTO.getLessonName());
        UserLesson userLesson = userLessons.get(0);
        userLesson.setSecondDeadline(new Timestamp(deadlineDTO.getDeadline()));
        userLessonRepository.save(userLesson);
        return new ResponseEntity<UserLesson>(HttpStatus.OK);
    }
}

