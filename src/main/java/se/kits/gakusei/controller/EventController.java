package se.kits.gakusei.controller;

import java.sql.Timestamp;
import java.util.List;
import java.util.stream.Collectors;

import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import se.kits.gakusei.content.model.Kanji;
import se.kits.gakusei.content.model.Lesson;
import se.kits.gakusei.content.model.Nugget;
import se.kits.gakusei.content.repository.LessonRepository;
import se.kits.gakusei.content.repository.NuggetRepository;
import se.kits.gakusei.dto.EventDTO;
import se.kits.gakusei.user.model.Event;
import se.kits.gakusei.user.model.User;
import se.kits.gakusei.user.repository.EventRepository;
import se.kits.gakusei.user.repository.NuggetTypeRepository;
import se.kits.gakusei.user.repository.UserRepository;
import se.kits.gakusei.util.LessonHandler;
import se.kits.gakusei.util.ProgressHandler;

@RestController
@Api(value="EventController", description="Operations for handling events")
public class EventController {
    private Logger logger = LoggerFactory.getLogger(EventController.class);

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProgressHandler progressHandler;

    @Autowired
    private NuggetTypeRepository nuggetTypeRepository;

    @Autowired
    private NuggetRepository nuggetRepository;

    @Autowired
    private LessonRepository lessonRepository;

    @Autowired
    private LessonHandler lessonHandler;

    @Value("${gakusei.event-logging}")
    private boolean eventLogging;

    @ApiOperation(value="Getting all the events", response = ResponseEntity.class)
    @RequestMapping(
            value = "/api/events",
            method = RequestMethod.GET,
            produces = MediaType.APPLICATION_JSON_UTF8_VALUE
    )
    public ResponseEntity<Iterable<Event>> getEvents() {
        Iterable events = eventRepository.findAll();
        return (events != null) ? new ResponseEntity<Iterable<Event>>(
            events, HttpStatus.OK
        ) : new ResponseEntity<>(HttpStatus.FORBIDDEN);
    }

    @ApiOperation(value="Add an event", response = ResponseEntity.class)
    @RequestMapping(
            value = "/api/events2",
            method = RequestMethod.POST,
            consumes = MediaType.APPLICATION_JSON_UTF8_VALUE,
            produces = MediaType.APPLICATION_JSON_UTF8_VALUE)
    public ResponseEntity<Event> addEvents(@RequestBody EventDTO[] eventDTOs) {

        for (EventDTO eventDTO : eventDTOs) {
            ResponseEntity<Event> response = this.addEvent(eventDTO);
            if (!response.getStatusCode().is2xxSuccessful()) {
                // Stop iterating if we run into errors

                return response;
            }
        }
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @ApiOperation(value="Add an event", response = ResponseEntity.class)
    @RequestMapping(
            value = "/api/events",
            method = RequestMethod.POST,
            consumes = MediaType.APPLICATION_JSON_UTF8_VALUE,
            produces = MediaType.APPLICATION_JSON_UTF8_VALUE)
    public ResponseEntity<Event> addEvent(@RequestBody EventDTO eventDTO) {
        if (!eventLogging) {
            return new ResponseEntity<>(HttpStatus.NO_CONTENT);
        }

        Event event = new Event();
        User user = userRepository.findByUsername(eventDTO.getUsername());

        if (user == null) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        event.setUser(user);
        event.setGamemode(eventDTO.getGamemode());
        event.setLesson(eventDTO.getLesson());
        event.setType(eventDTO.getType());
        event.setData(eventDTO.getData());
        event.setNuggetId(eventDTO.getNuggetid());

        if(eventDTO.getNuggetcategory()!=null){
            event.setNuggetType(nuggetTypeRepository.findById(eventDTO.getNuggetcategoryAsInt()));
        }
        event.setTimestamp(new Timestamp(eventDTO.getTimestamp()));

        logger.info(
                event.getTimestamp().toString() + " / " + event.getGamemode() + " / " + event.getType() +
                        " / " + event.getData() + " / " + event.getNuggetId() + " / " + user.getUsername());

        event = eventRepository.save(event);

        if (event.getType().equalsIgnoreCase("answeredCorrectly")) {
            progressHandler.trackProgress(event);
        }

        if (event.getType().equalsIgnoreCase("updateRetention")) {
            progressHandler.updateRetention(event);

            List<Lesson> tmpLessons;
            tmpLessons = lessonRepository.findAllByOrderByName();

            if(nuggetRepository.findById(event.getNuggetId()).isPresent()) {

                tmpLessons = tmpLessons.stream().filter(
                        lesson -> lesson.getKanjis().isEmpty()
                ).collect(Collectors.toList());
                for (Lesson tmpLesson : tmpLessons) {
                    List<Nugget> tmpNuggets = tmpLesson.getNuggets();
                    for (Nugget tmpNugget : tmpNuggets) {
                        if (tmpNugget.getId().equals(event.getNuggetId())) {
                            lessonHandler.evictCacheNuggets(event.getUser().getUsername(), tmpLesson.getName());
                        }
                    }
                }
            }else{
                tmpLessons = tmpLessons.stream().filter(
                        lesson -> lesson.getNuggets().isEmpty()
                ).collect(Collectors.toList());

                for (Lesson tmpLesson : tmpLessons) {
                    List<Kanji> tmpKanjis = tmpLesson.getKanjis();
                    for (Kanji tmpKanji: tmpKanjis) {
                        if (tmpKanji.getId().equals(event.getNuggetId())) {
                            lessonHandler.evictCacheKanjis(event.getUser().getUsername(), tmpLesson.getName());
                        }
                    }
                }
            }
        }
        return new ResponseEntity<>(HttpStatus.OK);
    }
}

