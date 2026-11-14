# Glicemia — API

API Laravel do Glicemia (derivada do nox-skeleton). Módulo de domínio em
`app/Modules/Glucose` (importação idempotente do glicosímetro, períodos de relógio
por aparelho, resumo estatístico). Visão geral e rotas no [README do projeto](../README.md).

```bash
php artisan test   # ou: docker compose -p glicemia exec api php artisan test
```

Produção: `https://glicosimetro-api.noxtecnologias.com.br` — deploy automático pelo
Jenkins a cada push em `main` que altere `api/`.
