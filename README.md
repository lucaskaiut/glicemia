# Glicemia

Acompanhamento das medições do glicosímetro **OK Meter Match II**: um leitor no Windows lê o
aparelho pelo cabo USB e envia as medições para a API; o painel mostra médias, tempo em cada
faixa, A1c estimada (GMI), variabilidade e o perfil por hora do dia.

Derivado do [nox-skeleton](../nox-skeleton) (ACL, tokens de API com escopo).

**Contas:** cadastro gratuito (nome, e-mail, senha). Cada conta é **independente** — uma pessoa,
um glicosímetro. Não há contas filhas, usuário "master" nem billing: as rotas desses módulos do
skeleton não são expostas, e ninguém (nem o administrador do servidor, pelo painel) vê dados de
outra conta.
Identidade visual própria — "Papel & Tinta" — documentada em
`nox-skeleton/docs/visual-identities.md`.

## Em produção

| | |
|---|---|
| Painel | https://glicosimetro.noxtecnologias.com.br (Vercel, projeto `glicemia`, deploy a cada push) |
| API | https://glicosimetro-api.noxtecnologias.com.br (Swarm `infra-app-glicemia`, deploy pelo Jenkins `deploy-glicemia-webhook` a cada push em `main` que altere `api/`) |
| Leitor | [última release](https://github.com/lucaskaiut/glicemia/releases/latest) — `glicemia-leitor.exe` |
| Infra | `lucaskaiut/infra` → `stacks/apps/glicemia`, `ci/apps/glicemia.sh` |

```
glicemia/
├── api/      Laravel — módulo App\Modules\Glucose
├── web/      React + Vite — módulo src/modules/glucose
├── reader/   Leitor Windows (Node/TypeScript → glicemia-leitor.exe)
└── docker/   Ambiente de desenvolvimento
```

## Desenvolvimento

```bash
docker compose -p glicemia up -d --build
# API:    http://localhost/api      Painel: http://localhost:5173
# Login:  admin@glicemia.localhost / password   (seed, só em APP_ENV=local)
```

Testes da API: `docker compose -p glicemia exec api php artisan test`

## API do módulo de glicemia

| Método | Rota | Permissão |
|---|---|---|
| POST | `/api/glucose/import` | `glucose.import` — usada pelo leitor |
| GET | `/api/glucose/summary?from=&to=` | `glucose.read` |
| GET | `/api/glucose/readings?from=&to=&range=&meal_tag=` | `glucose.read` |
| POST | `/api/glucose/readings` (manual) | `glucose.create` |
| PATCH/DELETE | `/api/glucose/readings/{id}` | `glucose.update` / `glucose.delete` |
| GET | `/api/glucose/devices` | `glucose.read` |
| PATCH | `/api/glucose/devices/{id}` (nome, ajuste de relógio) | `glucose.device.manage` |

**Importação idempotente:** o aparelho reenvia a memória inteira a cada leitura e o índice
dele muda a cada medição nova, então a deduplicação é por *(aparelho, horário do aparelho,
valor)*. Reenviar tudo é seguro.

**Relógio do aparelho:** cada medição guarda o horário original (`device_measured_at`) e o
corrigido (`measured_at` = original + `clock_offset_seconds` do aparelho). Alterar o ajuste
em *Aparelhos* recalcula todas as medições daquele aparelho.

**Login com Google:** defina `GOOGLE_CLIENT_ID` (Client ID OAuth do tipo *Aplicativo da Web*)
no `.env` da API. O painel lê o Client ID em `GET /api/auth/providers` — não há variável na
Vercel. Origens JavaScript autorizadas no Google Cloud: `https://glicosimetro.noxtecnologias.com.br`
e `http://localhost:5173`. Vínculo: conta já ligada ao Google entra; conta com o mesmo e-mail é
vinculada (se o e-mail nunca foi confirmado, a senha antiga e os códigos do leitor são revogados);
e-mail novo cria a conta após o aceite do termo.

Faixas configuráveis por env: `GLUCOSE_VERY_LOW` (54), `GLUCOSE_LOW` (70), `GLUCOSE_HIGH`
(180), `GLUCOSE_VERY_HIGH` (250).

## Produção

- **API:** como os demais derivados do skeleton. Ajuste `APP_URL`, `FRONTEND_URL`,
  `SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN`, banco, `APP_ENV=production` e `APP_DEBUG=false`.
  O seed (conta `admin@glicemia.localhost`) só roda com `APP_ENV=local`.
- **Painel:** `npm run build` em `web/` e defina `VITE_API_BASE_URL` com a URL da API.
- **Leitor:** o `.exe` já aponta para a API de produção; cada pessoa o vincula à própria conta
  colando o código gerado em *Aparelhos → Gerar código do leitor*. Nova versão: `npm run package`
  no Windows e anexar o `.exe` a uma nova release (o painel baixa sempre a `latest`).
- Dados de saúde: sirva tudo só por HTTPS.

## Leitor

Ver [reader/README.md](reader/README.md).
