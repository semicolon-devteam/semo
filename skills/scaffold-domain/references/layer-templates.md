# Layer Templates Reference

## Entity Layer

```kotlin
package com.semicolon.backend.domain.{domain}.entity

import org.springframework.data.annotation.Id
import org.springframework.data.relational.core.mapping.Table
import java.time.Instant
import java.util.UUID

@Table("{table_name}")
data class {Domain}(
    @Id val id: UUID? = null,
    // fields...
    val createdAt: Instant = Instant.now(),
    val updatedAt: Instant? = null
)

object {Domain}Status {
    const val ACTIVE = "ACTIVE"
    const val INACTIVE = "INACTIVE"

    val ALL = listOf(ACTIVE, INACTIVE)
}
```

## Repository Layer

```kotlin
package com.semicolon.backend.domain.{domain}.repository

import com.semicolon.backend.domain.{domain}.entity.{Domain}
import kotlinx.coroutines.flow.Flow
import org.springframework.data.repository.kotlin.CoroutineCrudRepository
import java.util.UUID

interface {Domain}Repository : CoroutineCrudRepository<{Domain}, UUID> {
    fun findByStatus(status: String): Flow<{Domain}>
    suspend fun countByStatus(status: String): Long
}
```

## Service Layer

### CommandService

```kotlin
package com.semicolon.backend.domain.{domain}.service

import com.semicolon.backend.domain.{domain}.entity.{Domain}
import com.semicolon.backend.domain.{domain}.exception.{Domain}Exception
import com.semicolon.backend.domain.{domain}.repository.{Domain}Repository
import com.semicolon.backend.domain.{domain}.web.request.*
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

@Service
class {Domain}CommandService(
    private val repository: {Domain}Repository
) {
    suspend fun create(request: Create{Domain}Request): {Domain} {
        val entity = {Domain}(
            // map from request
        )
        return repository.save(entity)
    }

    suspend fun update(id: UUID, request: Update{Domain}Request): {Domain} {
        val existing = repository.findById(id)
            ?: throw {Domain}Exception.NotFound(id)

        val updated = existing.copy(
            // map from request
            updatedAt = Instant.now()
        )
        return repository.save(updated)
    }

    suspend fun delete(id: UUID) {
        val existing = repository.findById(id)
            ?: throw {Domain}Exception.NotFound(id)
        repository.delete(existing)
    }
}
```

### QueryService

```kotlin
package com.semicolon.backend.domain.{domain}.service

import com.semicolon.backend.domain.{domain}.entity.{Domain}
import com.semicolon.backend.domain.{domain}.repository.{Domain}Repository
import kotlinx.coroutines.flow.Flow
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class {Domain}QueryService(
    private val repository: {Domain}Repository
) {
    suspend fun findById(id: UUID): {Domain}? {
        return repository.findById(id)
    }

    fun findAll(): Flow<{Domain}> {
        return repository.findAll()
    }

    suspend fun count(): Long {
        return repository.count()
    }
}
```

## Controller Layer

```kotlin
package com.semicolon.backend.domain.{domain}.web

import com.semicolon.backend.common.response.ApiResponse
import com.semicolon.backend.domain.{domain}.service.*
import com.semicolon.backend.domain.{domain}.web.request.*
import com.semicolon.backend.domain.{domain}.web.response.*
import com.semicolon.backend.security.annotation.RequireRole
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/v1/{domain}s")
class {Domain}Controller(
    private val commandService: {Domain}CommandService,
    private val queryService: {Domain}QueryService
) {
    @PostMapping
    @RequireRole("USER")
    suspend fun create(
        @RequestBody request: Create{Domain}Request
    ): ApiResponse.Success<{Domain}Response> {
        val entity = commandService.create(request)
        return ApiResponse.Success(data = entity.toResponse())
    }

    @GetMapping("/{id}")
    suspend fun getById(
        @PathVariable id: UUID
    ): ApiResponse.Success<{Domain}Response> {
        val entity = queryService.findById(id)
            ?: throw {Domain}Exception.NotFound(id)
        return ApiResponse.Success(data = entity.toResponse())
    }

    @GetMapping
    fun getAll(): Flow<{Domain}Response> {
        return queryService.findAll().map { it.toResponse() }
    }
}
```

## Exception Layer

```kotlin
package com.semicolon.backend.domain.{domain}.exception

import org.springframework.http.HttpStatus
import java.util.UUID

sealed class {Domain}Exception(
    message: String,
    val errorCode: String,
    val httpStatus: HttpStatus = HttpStatus.BAD_REQUEST
) : RuntimeException(message) {

    class NotFound(id: UUID) : {Domain}Exception(
        message = "{Domain} not found: $id",
        errorCode = "{DOMAIN}_NOT_FOUND",
        httpStatus = HttpStatus.NOT_FOUND
    )

    class AlreadyExists(identifier: String) : {Domain}Exception(
        message = "{Domain} already exists: $identifier",
        errorCode = "{DOMAIN}_ALREADY_EXISTS",
        httpStatus = HttpStatus.CONFLICT
    )
}
```
