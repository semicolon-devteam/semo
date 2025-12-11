# Platform: Spring

> Spring Boot 프로젝트 코드 구현 가이드

---

## 감지 조건

```bash
[ -f "pom.xml" ] || [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]
```

---

## 프로젝트 구조

```
src/main/java/com/example/
├── controller/           # REST Controllers
├── service/              # Business Logic
├── repository/           # Data Access
├── domain/               # Entities
├── dto/                  # Data Transfer Objects
├── config/               # Configuration
└── exception/            # Exception Handling
```

---

## 핵심 패턴

### 1. Layered Architecture

```java
// Controller → Service → Repository
@RestController
@RequestMapping("/api/v1/posts")
public class PostController {
    private final PostService postService;

    @GetMapping
    public List<PostDto> getPosts() {
        return postService.findAll();
    }
}
```

### 2. Service Layer

```java
@Service
@Transactional(readOnly = true)
public class PostService {
    private final PostRepository postRepository;

    @Transactional
    public PostDto create(CreatePostRequest request) {
        Post post = Post.create(request);
        return PostDto.from(postRepository.save(post));
    }
}
```

### 3. Repository (JPA)

```java
public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findByAuthorId(Long authorId);

    @Query("SELECT p FROM Post p WHERE p.status = :status")
    List<Post> findByStatus(@Param("status") PostStatus status);
}
```

---

## 구현 체크리스트

- [ ] REST API 설계 (RESTful)
- [ ] DTO 분리 (Entity 직접 노출 금지)
- [ ] 예외 처리 (@ControllerAdvice)
- [ ] 트랜잭션 관리
- [ ] 테스트 코드

---

## 참조

- [implement SKILL.md](../SKILL.md)
- [Spring Boot 공식 문서](https://spring.io/projects/spring-boot)
