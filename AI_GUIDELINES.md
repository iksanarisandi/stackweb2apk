# AI Agent Guidelines - StackWeb2APK

File ini berisi aturan dan batasan penting yang harus dipatuhi oleh AI agent saat bekerja pada project ini.

## GitHub Actions Workflow Restrictions

### `workflow_dispatch` Input Limits

Ketika membuat GitHub Actions workflow dengan event `workflow_dispatch`, perhatikan batasan berikut:

| Batasan | Nilai Maksimal |
|---------|---------------|
| **Jumlah input parameters** | **10** |
| **Ukuran payload total** | 65,535 karakter |

### Cara Mengatasi Batasan 10 Inputs

Jika membutuhkan lebih dari 10 parameter:

1. **Group related parameters** - Gabungkan parameter terkait menjadi satu input format JSON:
   ```yaml
   inputs:
     build_config:
       description: 'Build configuration (JSON)'
       required: true
       type: string
       default: '{"app_name":"MyApp","package":"com.example","version":"1.0"}'
   ```

2. **Use environment variables** - Simpan nilai di repository secrets atau variables

3. **Split workflows** - Buat beberapa workflow terpisah untuk use case berbeda

### Contoh Implementasi yang Benar

```yaml
on:
  workflow_dispatch:
    inputs:
      # ✅ Benar - maksimal 10 inputs
      app_name:
        description: 'Application name'
        required: true
        type: string
      website_url:
        description: 'Website URL'
        required: true
        type: string
      build_type:
        description: 'Build type'
        required: true
        type: choice
        options:
          - apk
          - aab
      # ... maksimal 10 inputs total
```

```yaml
on:
  workflow_dispatch:
    inputs:
      # ❌ Salah - lebih dari 10 inputs akan menyebabkan error
      input_1: # ...
      input_2: # ...
      input_3: # ...
      input_4: # ...
      input_5: # ...
      input_6: # ...
      input_7: # ...
      input_8: # ...
      input_9: # ...
      input_10: # ...
      input_11: # ❌ Error! Melebihi batas
```

## Project-Specific Rules

### Building Android APK/AAB

- Gunakan workflow yang sudah ada di `.github/workflows/`
- Untuk build dengan banyak parameter, gunakan format JSON untuk menggabungkan beberapa parameter

### Cloudflare Workers API

- API berjalan di Cloudflare Workers
- Environment variables diset via `wrangler secret put`
- Jangan commit secrets ke repository

---

**Last Updated**: 2026-02-25

**Sources**:
- [GitHub Documentation - Triggering a workflow](https://docs.github.com/zh/actions/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow)
- [GitHub Documentation - Manually running a workflow](https://docs.github.com/zh/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/manually-running-a-workflow)
