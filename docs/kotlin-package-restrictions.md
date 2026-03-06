# Kotlin Package Name Restrictions

## Problem

Android apps built with Kotlin cannot use package names that contain Kotlin reserved keywords as segments. This is because Kotlin treats these keywords as special language tokens and cannot use them as package identifiers.

## Example

❌ **Invalid:** `com.dibayar.in` - `in` is a Kotlin keyword
✅ **Valid:** `com.dibayar.app` - No keywords used

## Kotlin Reserved Keywords

The following keywords cannot be used as package segments:

### Soft Keywords (can be used with backticks in code, but NOT in packages)
- `in`, `is`, `as`, `if`, `else`, `for`, `while`, `do`, `when`, `return`
- `break`, `continue`, `object`, `package`, `import`, `class`, `interface`, `enum`
- `open`, `override`, `public`, `private`, `protected`, `internal`
- `abstract`, `final`, `companion`, `init`, `this`, `super`
- `true`, `false`, `null`, `it`, `typealias`, `val`, `var`, `fun`
- `try`, `catch`, `finally`, `throw`, `volatile`, `transient`, `constructor`
- `suspend`, `tailrec`, `operator`, `infix`, `out`, `reified`, `vararg`
- `crossinline`, `lateinit`, `actual`, `expect`, `sealed`, `inner`, `data`

## Validation

Our system automatically validates package names and rejects any containing Kotlin keywords.

### API Validation
The API will return a validation error:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Package name cannot contain Kotlin reserved keywords: in, is, as, if, ..."
}
```

### Workflow Validation
GitHub Actions will fail early with a clear message:
```
Error: Package name 'com.dibayar.in' contains 'in' which is a reserved keyword in Kotlin
Package segments cannot be: in|is|as|if|else|...
```

## Solution for Users

If your domain ends with a Kotlin keyword (like `.in`, `.is`, `.as`), use an alternative:

| Domain | Invalid Package | Valid Alternatives |
|--------|----------------|-------------------|
| dibayar.in | com.dibayar.in | com.dibayar.app, com.dibayar.mobile |
| example.is | com.example.is | com.example.app, com.example.web |
| site.as | com.site.as | com.site.app, com.site.android |

Good alternatives for TLD conflicts:
- `.app`
- `.mobile`
- `.android`
- `.web`
- `.appname` (where appname is your actual app name)

## Technical Details

### Why This Happens

Kotlin source files contain package declarations:
```kotlin
package com.dibayar.in  // ❌ Compiler error: 'in' is a soft keyword
```

The package name becomes part of the file path:
```
src/main/java/com/dibayar/in/MainActivity.kt
```

Kotlin's compiler cannot distinguish between the keyword `in` and an identifier `in` in package declarations.

### Build Error Example

```
e: Package name must be a '.'-separated identifier list
e: file:///.../webviewCatatUang/app/src/main/java/com/dibayar/in/MainActivity.kt:1:21
```

## Implementation

- **API Layer**: `packages/shared/src/validation/schemas.ts`
- **Workflow Layer**: `.github/workflows/build-apk.yml`
- **Error Messages**: Clear, actionable feedback with keyword list

## References

- [Kotlin Keywords Documentation](https://kotlinlang.org/docs/keyword-reference.html)
- [Android Package Naming Guidelines](https://developer.android.com/studio/build/application-id)
