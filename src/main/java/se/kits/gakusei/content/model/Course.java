package se.kits.gakusei.content.model;

import com.fasterxml.jackson.annotation.JsonManagedReference;

import java.io.Serializable;
import java.util.List;

import jakarta.persistence.*;

import io.swagger.v3.oas.annotations.media.Schema;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

@Entity
@Table(name = "courses", schema = "contentschema")
public class Course implements Serializable {
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Id
    @Schema(description="the database generated course id")
    private Long id;

    @Column(nullable = false, unique = true)
    @Schema(description="the course name")
    private String name;

    @Schema(description="the course description")
    private String description;

    @JoinColumn(name = "parent_ref")
    @ManyToOne
    private Course parent;

    @JoinTable(
        name = "prerequisites",
        schema = "contentschema",
        joinColumns = @JoinColumn(
            name = "course_id",
            referencedColumnName = "id"
        )
        ,
        inverseJoinColumns = @JoinColumn(
            name = "prerequisite_id",
            referencedColumnName = "id"
        )

    )
    @ManyToMany
    private List<Course> prerequisites;

    @Schema(description="the course order")
    private int courseOrder;

    @Column(nullable = false, unique = true)
    @Schema(description="the course code")
    private String courseCode;

    @Fetch(value = FetchMode.SUBSELECT)
    @JsonManagedReference(value = "courselesson")
    @OneToMany(mappedBy = "course", fetch = FetchType.LAZY)
    private List<Lesson> lessons;

    public Course() {}

    public Long getId() {
        return id;
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

    public Course getParent() {
        return parent;
    }

    public void setParent(Course parent) {
        this.parent = parent;
    }

    public List<Course> getPrerequisites() {
        return prerequisites;
    }

    public void setPrerequisites(List<Course> prerequisites) {
        this.prerequisites = prerequisites;
    }

    public int getCourseOrder() {
        return courseOrder;
    }

    public void setCourseOrder(int courseOrder) {
        courseOrder = courseOrder;
    }

    public String getCourseCode() {
        return courseCode;
    }

    public void setCourseCode(String courseCode) {
        this.courseCode = courseCode;
    }

    public List<Lesson> getLessons() {
        return lessons;
    }

    public void setLessons(List<Lesson> lessons) {
        this.lessons = lessons;
    }

}

