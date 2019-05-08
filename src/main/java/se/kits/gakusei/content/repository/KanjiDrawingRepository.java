package se.kits.gakusei.content.repository;

import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

import se.kits.gakusei.content.model.KanjiDrawing;

public interface KanjiDrawingRepository
    extends CrudRepository<KanjiDrawing, Long> {

    @Query("select ul from KanjiDrawing ul where ul.user.username = :username")
    List<KanjiDrawing> findKanjiDrawingByUsername(
        @Param("username")
        String username
    );

}

