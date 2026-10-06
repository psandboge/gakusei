package se.kits.gakusei.config;

import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.error.ErrorAttributes;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.context.request.WebRequest;

@RequestMapping("/error")
@RestController
public class ErrorHandler implements ErrorController {
    @Autowired
    private ErrorAttributes errorAttributes;


    @RequestMapping
    public ResponseEntity<String> error(HttpServletRequest request, WebRequest webRequest) {
        RequestAttributes requestAttributes = new ServletRequestAttributes(
            request
        );
        final Map<
                String,
                Object
                > errorAttributes = this.errorAttributes.getErrorAttributes(webRequest,
                org.springframework.boot.web.error.ErrorAttributeOptions.of(org.springframework.boot.web.error.ErrorAttributeOptions.Include.MESSAGE, org.springframework.boot.web.error.ErrorAttributeOptions.Include.STATUS)
        );
        final int status = (int) errorAttributes.get("status");
        // Framework 6 reports missing static resources as an exception. Boot 2
        // returned the default message for the same unmatched URL.
        Throwable error = this.errorAttributes.getError(webRequest);
        final String message;
        if (error instanceof org.springframework.web.servlet.resource.NoResourceFoundException) {
            message = "No message available";
        } else if (error instanceof org.springframework.web.bind.MissingServletRequestParameterException) {
            // Boot 3 selects ErrorResponse.detail; the retained client body was
            // the exception's detailed parameter/type message.
            message = error.getMessage();
        } else {
            message = (String) errorAttributes.get("message");
        }
        return ResponseEntity.status(status).body(message);
    }

}

