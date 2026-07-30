# docs/ — Sof

Esta pasta é a documentação técnica **viva** do monorepo.

**Entrada obrigatória:** [`../AGENTS.md`](../AGENTS.md)

A documentação deve ser atualizada junto com o código. Ver o pacto em `AGENTS.md` e a regra Cursor `.cursor/rules/documentation.mdc`.

**No painel-admin (área logada):** os markdowns desta pasta aparecem em `/docs` (hub + leitor). Após editar qualquer `*.md` aqui, rode em `admin/frontend`:

```bash
npm run sync-docs
```

e faça commit de `admin/frontend/public/internal-docs/`.

Guias HTML para o **cliente final** (públicos, compartilháveis) ficam em [`guides/`](guides/) e sincronizam para `/guides` via `npm run sync-guides`.
