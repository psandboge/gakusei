package se.kits.gakusei.content.model;

import io.swagger.v3.oas.annotations.media.Schema;

import java.io.Serializable;

import jakarta.persistence.*;

@Entity
@Table(name = "word_types", schema = "contentschema")
public class WordType implements Serializable {
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Id
    @Schema(description="the database generated word type id")
    private Long id;

    @Schema(description="the type")
    @Column(nullable = false, unique = true)
    private String type;

    public WordType() {}

    public Long getId() {
        return id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

}

