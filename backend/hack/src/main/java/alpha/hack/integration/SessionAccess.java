package alpha.hack.integration;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Component
public class SessionAccess implements HandlerInterceptor, WebMvcConfigurer {
    public static int user(HttpSession session) {
        Object value = session.getAttribute("regId");
        if (!(value instanceof Integer)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Войдите в кабинет.");
        return (Integer) value;
    }
    public static String csrf(HttpSession session) {
        if (session.getAttribute("csrf") == null) session.setAttribute("csrf", UUID.randomUUID().toString());
        return (String) session.getAttribute("csrf");
    }
    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/api/**");
    }
    @Override public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String path = request.getRequestURI();
        HttpSession session = request.getSession();
        response.setHeader("Cache-Control", "no-store");
        if (!request.getMethod().equals("GET") && !request.getMethod().equals("HEAD")) {
            if (!csrf(session).equals(request.getHeader("X-CSRF-TOKEN")))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Обновите страницу: CSRF-токен недействителен.");
        }
        if (!path.equals("/api/auth/csrf") && !path.equals("/api/auth/login")
                && !path.equals("/api/auth/register") && !path.equals("/api/auth/login-availability")) user(session);
        return true;
    }
}
