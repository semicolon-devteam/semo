# Quality Gates Reference

## Pre-commit

```bash
./gradlew ktlintCheck && ./gradlew compileKotlin
```

## Pre-PR

```bash
./gradlew ktlintCheck && ./gradlew compileKotlin && ./gradlew test
```

## Checks

| Check | Command | Pass Condition |
|-------|---------|----------------|
| ktlint | `./gradlew ktlintCheck` | 0 violations |
| Compile | `./gradlew compileKotlin` | BUILD SUCCESSFUL |
| Tests | `./gradlew test` | All passed |
| Reactive | `grep -r ".block()" src/main/` | No matches |

## Severity

| Level | Items |
|-------|-------|
| 🔴 CRITICAL | .block(), compile error, test failure |
| 🟡 WARNING | println, TODO, @Suppress |
| 🟢 INFO | Style suggestions |
