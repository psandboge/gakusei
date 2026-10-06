package se.kits.gakusei.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import se.kits.gakusei.content.model.Book;
import se.kits.gakusei.content.repository.BookRepository;

@RestController
@Tag(name="BookController", description="Operations for handling books")
public class BookController {
    @Autowired
    BookRepository bookRepository;

    @Operation(summary="Getting all books")
    @RequestMapping(
        value = "api/books",
        method = RequestMethod.GET,
        produces = "application/json;charset=UTF-8"
    )
    public ResponseEntity<Iterable<Book>> getAllBooks() {
        Iterable<Book> allBooks = bookRepository.findAll();
        if (allBooks != null) {
            return new ResponseEntity<>(allBooks, HttpStatus.OK);
        } else {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Operation(summary="Getting one book with a specific id")
    @RequestMapping(
        value = "api/books/{bookId}",
        method = RequestMethod.GET,
        produces = "application/json;charset=UTF-8"
    )
    public ResponseEntity<Book> getBookById(
        @PathVariable(value = "bookId")
        Long bookId
    ) {
        Book book = bookRepository.findById(bookId).get();

        if (book != null) {
            return new ResponseEntity<>(book, HttpStatus.OK);
        } else {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }

    @Operation(summary="Getting one book with a specific title")
    @RequestMapping(
        value = "api/books/{bookTitle}",
        method = RequestMethod.GET,
        produces = "application/json;charset=UTF-8"
    )
    public ResponseEntity<Book> getBookByTitle(
        @PathVariable(value = "bookTitle")
        String bookTitle
    ) {
        Book book = bookRepository.findByTitle(bookTitle);
        if (book != null) {
            return new ResponseEntity<>(book, HttpStatus.OK);
        } else {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }

}

