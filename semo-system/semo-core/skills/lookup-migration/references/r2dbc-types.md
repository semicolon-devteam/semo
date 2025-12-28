# R2DBC Type Mapping Reference

## Type Mapping Table

| PostgreSQL | Kotlin | Notes |
|------------|--------|-------|
| `uuid` | `UUID` | `java.util.UUID` |
| `text` | `String` | |
| `varchar(n)` | `String` | |
| `integer` | `Int` | |
| `bigint` | `Long` | |
| `smallint` | `Short` | |
| `boolean` | `Boolean` | |
| `real` | `Float` | |
| `double precision` | `Double` | |
| `numeric` | `BigDecimal` | |
| `timestamptz` | `Instant` | UTC |
| `timestamp` | `LocalDateTime` | |
| `date` | `LocalDate` | |
| `time` | `LocalTime` | |
| `jsonb` | `String` | JSON as String |
| `bytea` | `ByteArray` | |
| `enum` | `String` | String const |

## Entity Annotations

```kotlin
@Table("table_name")  // 테이블 이름
data class Entity(
    @Id val id: UUID? = null,  // Primary key
    @Column("column_name") val field: String  // 컬럼 매핑
)
```

## Nullable Handling

```kotlin
// PostgreSQL NULL → Kotlin nullable
val updatedAt: Instant? = null

// PostgreSQL NOT NULL → Kotlin non-null
val createdAt: Instant = Instant.now()
```

## JSON Handling

```kotlin
// jsonb 컬럼을 String으로 받아서 파싱
@Table("settings")
data class Setting(
    @Id val id: UUID? = null,
    val config: String  // jsonb → String
)

// 사용 시
val parsed = objectMapper.readValue<Config>(setting.config)
```
