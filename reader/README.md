# Glicemia — app para Windows

App desktop (Electron) que fica perto do relógio do Windows: quando o **OK Meter Match II** é
ligado no cabo USB, lê a memória do aparelho e envia as medições novas para a conta do Glicemia.

- **Instalar:** baixe `Glicemia-Setup.exe` na [última release](https://github.com/lucaskaiut/glicemia/releases/latest)
  (instalação por usuário, sem administrador; atalho no Menu Iniciar e na Área de Trabalho).
- **Conectar à conta:** botão *Conectar à minha conta* → o navegador abre o painel → a pessoa entra
  (Google ou e-mail) e clica em *Permitir*. Ninguém copia código.
- **Fechar a janela** mantém o app rodando no ícone perto do relógio; *Sair* fica no menu desse ícone.
- **Iniciar com o Windows** é ligado ao conectar (pode desligar na janela).

## Como a conexão funciona (OAuth para apps nativos)

RFC 8252 + PKCE (RFC 7636):

1. O app abre um servidor só em `127.0.0.1:<porta aleatória>` e abre no navegador
   `https://glicosimetro.noxtecnologias.com.br/conectar-app?redirect_uri=http://127.0.0.1:<porta>/callback&code_challenge=…&code_challenge_method=S256&state=…`.
2. Logada, a pessoa permite: a API (`POST /api/reader/authorize`, sessão) emite um código de uso
   único (5 min, guardado só como hash) e o navegador volta para o endereço local do app.
3. O app troca código + `code_verifier` em `POST /api/reader/token` por um token com escopo **só**
   `glucose.import` (aparece em *Ajustes → Tokens de API*, onde pode ser revogado).

Só redirecionamentos de loopback são aceitos, e o código não serve sem o verificador PKCE.

## Arquivos

Configuração, log e fila offline em `%APPDATA%\Glicemia` (`glicemia-leitor.json`,
`glicemia-leitor.log`, `pending.json`) — a mesma pasta da versão de terminal, cuja conexão é
aproveitada (o atalho oculto e o executável antigos são removidos na primeira execução).

Para apontar para outro ambiente: `GLICEMIA_API_URL` e `GLICEMIA_PANEL_URL` (ou `apiUrl`/`panelUrl`
no JSON). Para testes: `GLICEMIA_NO_BROWSER=1` registra a URL de conexão no log em vez de abrir o
navegador; `GLICEMIA_NO_AUTOSTART=1` não registra a inicialização com o Windows.

## Protocolo do aparelho (resumo)

HID `04D9:B564` (ponte USB→UART Holtek).
1. Feature report `00 01 00 E1 00 00 00 00 08` (57600 8N1).
2. Output report `[00, 01, 05]` — **ENQ**: o aparelho responde uma mensagem *vazia* de apresentação.
3. Output report `[00, 01, 06]` — **ACK**: o aparelho envia a memória inteira (~12 s para 500 registros).
4. Input reports de 32 bytes `[tamanho, dados…]`. Mensagem: `SOH "Glucose" CRLF STX` + linhas
   `índice,ano,mês,dia,hora,min,valor,unidade,refeição[,D]` + `ETX EOT`.

## Desenvolvimento e build (no Windows)

O `node-hid` é nativo (N-API, funciona no Electron sem recompilar); instale e empacote **no Windows**:

```powershell
npm install
npm test        # testes do protocolo
npm start       # abre o app
npm run dist    # gera release\Glicemia-Setup.exe
```

Publicar: anexe `Glicemia-Setup.exe` a uma nova release — o painel baixa sempre a `latest`.
