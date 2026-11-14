# glicemia-leitor

Programa para Windows que fica em segundo plano: quando o **OK Meter Match II** é conectado
no cabo USB, lê a memória do aparelho e envia as medições para `POST /api/glucose/import`.

## Uso

1. Baixe o `glicemia-leitor.exe` (link em **Aparelhos** no painel, ou na
   [última release](https://github.com/lucaskaiut/glicemia/releases/latest)).
2. No painel, em **Aparelhos**, clique em **Gerar código do leitor** — cria um token que só
   pode *enviar* medições para a sua conta.
3. Abra o `.exe` e cole o código. Ele mostra o nome da conta vinculada e pergunta se deve iniciar
   com o Windows (copia-se para `%LOCALAPPDATA%\Programs\Glicemia` e roda oculto).

| Comando | Faz |
|---|---|
| `glicemia-leitor.exe` | 1ª vez: vincula e instala. Depois: fica rodando e sincroniza a cada conexão |
| `glicemia-leitor.exe --vincular` | troca o código (outra conta ou código novo) |
| `glicemia-leitor.exe --uma-vez` | lê o aparelho uma vez, envia e sai |
| `glicemia-leitor.exe --instalar` / `--desinstalar` | inicialização com o Windows |

Configuração, log e fila offline ficam em `%APPDATA%\Glicemia` (`glicemia-leitor.json`,
`glicemia-leitor.log`, `pending.json`). A API padrão é a de produção
(`https://glicosimetro-api.noxtecnologias.com.br/api`); para outra, defina `"apiUrl"` no JSON ou a
variável `GLICEMIA_API_URL`.

**Requisito do aparelho:** a tela precisa mostrar **"USb"** (conecte o cabo com o glicosímetro
desligado). A leitura completa leva ~20s; se falhar, o leitor tenta de novo na próxima reconexão.

## Protocolo (resumo)

HID `04D9:B564` (ponte USB→UART Holtek).
1. Feature report `00 01 00 E1 00 00 00 00 08` (57600 8N1).
2. Output report `[00, 01, 05]` — **ENQ**: o aparelho responde uma mensagem *vazia* de apresentação.
3. Output report `[00, 01, 06]` — **ACK**: o aparelho envia a memória inteira (~12s para 500 registros).
4. Input reports de 32 bytes `[tamanho, dados…]`. Mensagem: `SOH "Glucose" CRLF STX` + linhas
   `índice,ano,mês,dia,hora,min,valor,unidade,refeição[,D]` + `ETX EOT`.

Quem só envia ENQ recebe a mensagem vazia e parece que o aparelho "travou" — falta o ACK.

## Build (no Windows)

O `node-hid` é nativo, então instale e empacote **no Windows** (não no WSL):

```powershell
npm install
npm test          # testes do parser
npm run package   # gera bin\glicemia-leitor.exe (Node 24 embutido)
```
