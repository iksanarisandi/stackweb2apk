# Best Practices & Lessons Learned - Web2APK Project

## Overview
This document captures best practices and lessons learned from building and debugging the Web2APK SaaS platform.

---

## 1. GitHub Actions Integration

### ✅ DO: Ensure Payload Field Names Match Exactly

**Problem:** API sends `enable_gps` but workflow expects `features.gps`

**Solution:** Keep field names consistent between API and workflow.

```typescript
// API (admin.ts) - CORRECT
client_payload: {
  enable_gps: Boolean(payment.enable_gps),
  enable_camera: Boolean(payment.enable_camera),
}
```

```yaml
# Workflow (build-apk.yml) - CORRECT
env:
  ENABLE_GPS: ${{ github.event.client_payload.enable_gps }}
  ENABLE_CAMERA: ${{ github.event.client_payload.enable_camera }}
```

### ❌ DON'T: Nest Unnecessary Fields

```typescript
// WRONG - Creates mismatch with workflow
client_payload: {
  features: {
    gps: Boolean(payment.enable_gps),
    camera: Boolean(payment.enable_camera),
  }
}
```

---

## 2. Boolean Handling in TypeScript

### ✅ DO: Use Explicit Boolean Conversion

```typescript
// Database stores 0 or 1 (SQLite doesn't have native boolean)
const enableGps = result.enable_gps as number; // 0 or 1
const boolValue = Boolean(enableGps); // Converts correctly

// When sending to GitHub Actions
client_payload: {
  enable_gps: Boolean(payment.enable_gps),
}
```

### ❌ DON'T: Send Database Values Directly

```typescript
// WRONG - Sends 0/1 instead of false/true
client_payload: {
  enable_gps: payment.enable_gps, // Could be 0
}
```

---

## 3. Cloudflare Workers Deployment

### ✅ DO: Verify Deployment After Changes

```bash
# Deploy API
pnpm run deploy

# Verify deployment
curl https://web2apk-api.threadsauto.workers.dev/api/health

# Check version/logs
npx wrangler tail
```

### ❌ DON'T: Assume Push = Deploy

Git push ≠ Automatic deployment for Workers. Always run `wrangler deploy` separately.

---

## 4. Cloudflare Pages Compatibility

### ✅ DO: Set Compatibility Flags for Next.js

**Required Flags:**
- `nodejs_compat` - Basic Node.js APIs compatibility
- `nodejs_compat_populate_process_env` - Environment variables access

**Via Dashboard:**
1. Workers & Pages → Project → Settings → Compatibility Flags
2. Add both flags for Production and Preview

**Via API:**
```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects/{PROJECT_NAME}" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -d '{
    "production_environment": {
      "compatibility_flags": ["nodejs_compat", "nodejs_compat_populate_process_env"]
    }
  }'
```

### ❌ DON'T: Use `_headers` File for Compatibility Flags

The `_headers` file only sets HTTP headers, NOT compatibility flags.

---

## 5. GitHub Actions Permissions

### ✅ DO: Set Explicit Permissions in Workflows

```yaml
# Add at workflow level
permissions:
  contents: read
  deployments: write  # Required for Cloudflare Pages action
  id-token: write
```

### Common Errors Without Permissions:
- `403 Resource not accessible by integration`
- Deploy actions silently fail

---

## 6. API URL Handling in GitHub Actions

### ✅ DO: Send Base URL, Not Full URLs

```typescript
// CORRECT - Workflow constructs URLs
const baseUrl = new URL(c.req.url).origin;
client_payload: {
  api_url: baseUrl,
  // Workflow uses: ${API_URL}/api/icon/${GENERATE_ID}
}
```

```yaml
# Workflow
- name: Download icon
  run: curl "${API_URL}/api/icon/${GENERATE_ID}"
```

### ❌ DON'T: Send Pre-constructed URLs

```typescript
// WRONG - Adds unnecessary fields
client_payload: {
  icon_url: `${baseUrl}/api/icon/${generateId}`,
  html_files_url: `${baseUrl}/api/html-files/${generateId}`,
}
```

---

## 7. Database Schema Design

### ✅ DO: Use Boolean for Binary States

```sql
-- SQLite doesn't have boolean, use INTEGER
enable_gps INTEGER DEFAULT 0,  -- 0 = false, 1 = true
enable_camera INTEGER DEFAULT 0
```

### ✅ DO: Convert in Application Layer

```typescript
// When reading from DB
const enableGps = Boolean(result.enable_gps);

// When writing to DB
enableGps ? 1 : 0
```

---

## 8. Error Handling in External API Calls

### ✅ DO: Log But Don't Fail

```typescript
try {
  const response = await fetch('https://api.github.com/...', { ... });
  if (!response.ok) {
    console.error('Failed to trigger:', await response.text());
    // Don't throw - payment already confirmed
  }
} catch (error) {
  console.error('Error:', error);
  // Log error but continue
}
```

### Rationale:
- GitHub Actions dispatch failures shouldn't block payment confirmation
- Admin can retry builds manually
- Better UX: Payment succeeds, build can be retried

---

## 9. Type Safety Across Boundaries

### ✅ DO: Assert Types at API Boundaries

```typescript
// Type assertion for extended database fields
const buildType = (generate as { build_type?: BuildType }).build_type;
const aabKey = (generate as { aab_key?: string | null }).aab_key;
```

### ✅ DO: Use Shared Types

```typescript
// In packages/shared/src/types/index.ts
export type BuildType = 'webview' | 'html';

export interface Generate {
  build_type: BuildType;
  enable_gps: boolean;
  enable_camera: boolean;
}
```

---

## 10. Monorepo Dependency Management

### ✅ DO: Build Dependencies First

```json
// packages/shared/package.json
{
  "scripts": {
    "build": "tsc"
  }
}

// apps/web/package.json
{
  "scripts": {
    "build": "pnpm --filter @web2apk/shared build && next build"
  }
}
```

### ✅ DO: Use Workspace References

```json
{
  "dependencies": {
    "@web2apk/shared": "workspace:*"
  }
}
```

---

## 11. Debugging Workflow Issues

### ✅ DO: Check These Things First

1. **Payload Structure**
   ```bash
   # Add debug output in workflow
   - name: Debug payload
     run: |
       echo "Payload: ${{ toJson(github.event.client_payload) }}"
   ```

2. **API Deployment**
   ```bash
   curl https://api-url/api/health
   ```

3. **GitHub Actions Logs**
   - Check for "403" → Permissions issue
   - Check for "undefined" → Payload mismatch

4. **Database Values**
   ```bash
   # Query to see actual stored values
   SELECT enable_gps, enable_camera FROM generates WHERE id = ?
   ```

---

## 12. Testing Strategy

### ✅ DO: Test All Checkbox Combinations

| GPS | Camera | Expected Result |
|-----|--------|-----------------|
| ❌ | ❌ | Build succeeds (no permissions) |
| ✅ | ❌ | Build succeeds (GPS only) |
| ❌ | ✅ | Build succeeds (Camera only) |
| ✅ | ✅ | Build succeeds (both permissions) |

### ✅ DO: Test Edge Cases

1. **Empty values** → Should default to false/disabled
2. **Null values** → Should handle gracefully
3. **Boolean conversion** → Test 0, 1, false, true

---

## 13. Cloudflare Workers-Specific Issues

### fflate vs jszip

**Problem:** `jszip` uses browser APIs not available in Workers

**Solution:** Use `fflate` instead

```typescript
// CORRECT for Cloudflare Workers
import * as fflate from 'fflate';
const unzipped = fflate.unzipSync(buffer);

// WRONG - fails in Workers
import JSZip from 'jszip';
```

---

## 14. File Naming Conventions

### ✅ DO: Use Consistent Naming

| Purpose | Pattern | Example |
|---------|---------|---------|
| Migrations | `####_description.sql` | `0005_nullable_url.sql` |
| Features | `feat(scope): description` | `feat(api): add retry endpoint` |
| Fixes | `fix(scope): description` | `fix(workflow): correct payload fields` |
| Chores | `chore(scope): description` | `chore: update dependencies` |

---

## 15. Security Considerations

### ✅ DO: Validate File Uploads

```typescript
// Validate ZIP file
async function validateHtmlZip(file: File) {
  // Check file size
  if (file.size > MAX_SIZE) return { valid: false, error: 'Too large' };

  // Check file type
  if (!file.name.endsWith('.zip')) return { valid: false, error: 'Must be ZIP' };

  // Validate contents
  const entries = fflate.unzipSync(await file.arrayBuffer());
  if (!entries['index.html']) return { valid: false, error: 'Missing index.html' };

  // Check for dangerous files
  const dangerous = ['.exe', '.bat', '.sh'];
  for (const name of Object.keys(entries)) {
    if (dangerous.some(ext => name.endsWith(ext))) {
      return { valid: false, error: 'Dangerous file found' };
    }
  }

  return { valid: true };
}
```

### ✅ DO: Use Rate Limiting

```typescript
// Different limits for different endpoints
const generalRateLimit = rateLimit({ requests: 100, duration: 60 * 1000 });
const generateRateLimit = rateLimit({ requests: 50, duration: 60 * 60 * 1000 });
const initRateLimit = rateLimit({ requests: 3, duration: 60 * 60 * 1000 });
```

---

## 16. Common Pitfalls Summary

| Issue | Cause | Solution |
|-------|-------|----------|
| Build not triggering | Payload field mismatch | Keep names consistent |
| 403 on GitHub API | Missing permissions | Add `permissions:` block |
| Boolean not working | Database 0/1 vs boolean | Use `Boolean()` conversion |
| Pages error | Missing compatibility flags | Add `nodejs_compat` |
| jszip fails in Workers | Browser APIs used | Switch to `fflate` |
| Workflow skips steps | Undefined env vars | Check payload structure |

---

## 17. Quick Reference Checklist

### Before Deploying API Changes:
- [ ] Run `pnpm run deploy` to upload to Workers
- [ ] Test health endpoint: `curl /api/health`
- [ ] Verify payload structure matches workflow
- [ ] Check console for deployment errors

### Before Merging Workflow Changes:
- [ ] Test all field name references
- [ ] Verify required permissions are set
- [ ] Check env variable names match payload
- [ ] Test with minimal payload (all false)

### For New Features:
- [ ] Update shared types
- [ ] Add database migration
- [ ] Update validation schemas
- [ ] Test all checkbox/value combinations
- [ ] Document in README

---

## 18. Useful Commands

```bash
# API
pnpm run deploy           # Deploy to Workers
npx wrangler tail         # View real-time logs
wrangler d1 migrations apply DB --remote  # Run migrations

# GitHub
gh run list --workflow=build-apk.yml    # List workflow runs
gh run view <run-id>                    # View run details
gh workflow run deploy-web.yml          # Trigger workflow

# Database
wrangler d1 execute DB --remote --command="SELECT * FROM generates LIMIT 5"

# Testing
curl -X POST https://api-url/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass"}'
```

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-08 | 1.0 | Initial version - lessons from HTML View feature and debugging |

---

## Contributing

When you learn a new lesson or fix a bug, update this document:
1. Add/update relevant section
2. Include before/after code examples
3. Document the root cause
4. Add to Version History
