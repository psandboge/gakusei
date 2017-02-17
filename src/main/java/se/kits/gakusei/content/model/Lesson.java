package se.kits.gakusei.content.model;

import com.fasterxml.jackson.annotation.JsonManagedReference;

import javax.persistence.*;
import java.io.Serializable;
import java.util.List;

@Entity
@Table(name = "lessons", schema = "contentschema")
@NamedNativeQuery(
        name = "Lesson.findNuggetsByTwoFactTypes",
        query = "select * from contentschema.nuggets where id in " +
                "(select filtered.nugget_id from contentschema.facts " +
                "inner join (select nugget_id from contentschema.lessons_nuggets where lesson_id = " +
                "(select distinct id from contentschema.lessons where name = :lessonName)) as filtered " +
                "on nuggetid = nugget_id " +
                "where facts.type IN (:factType1, :factType2) " +
                "GROUP BY filtered.nugget_id HAVING count(filtered.nugget_id) > 1)",
        resultClass = Nugget.class)
public class Lesson implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    private String description;

    @ManyToMany
    @JsonManagedReference
    @JoinTable(
            name = "lessons_nuggets",
            schema = "contentschema",
            joinColumns = @JoinColumn(name = "lesson_id", referencedColumnName = "id"),
            inverseJoinColumns = @JoinColumn(name = "nugget_id", referencedColumnName = "id"))
    private List<Nugget> nuggets;

    @OneToMany
    @JoinTable(name = "users_lessons", joinColumns = @JoinColumn(name = "lessonName", referencedColumnName = "name"))
    private List<UserLesson> userLessons;

    public Lesson() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<Nugget> getNuggets() {
        return nuggets;
    }

    public void setNuggets(List<Nugget> nuggets) {
        this.nuggets = nuggets;
    }

    public List<UserLesson> getUsers() {
        return userLessons;
    }

    public void setUsers(List<UserLesson> userLessons) {
        this.userLessons = userLessons;
    }
}
