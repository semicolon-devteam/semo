# Check Items Reference

## Code Style

| Item | Command | Severity |
|------|---------|----------|
| ktlint | `./gradlew ktlintCheck` | 🔴 |
| Compile | `./gradlew compileKotlin` | 🔴 |

## Reactive Patterns

| Item | Command | Severity |
|------|---------|----------|
| .block() | `grep -r "\.block()" src/main/` | 🔴 |
| blockFirst | `grep -r "blockFirst" src/main/` | 🔴 |
| Thread.sleep | `grep -r "Thread\.sleep" src/main/` | 🔴 |

## Debug Code

| Item | Command | Severity |
|------|---------|----------|
| println | `grep -r "println" src/main/` | 🟡 |
| TODO | `grep -r "TODO" src/main/` | 🟡 |
| FIXME | `grep -r "FIXME" src/main/` | 🟡 |

## Anti-patterns

| Item | Command | Severity |
|------|---------|----------|
| enum class | `grep -r "enum class" src/` | 🟡 |
| @Suppress | `grep -r "@Suppress" src/` | 🟡 |

## Testing

| Item | Command | Severity |
|------|---------|----------|
| Test execution | `./gradlew test` | 🔴 |
