# Hábitos

Painel de hábitos diários que roda direto no navegador, sem servidor e sem conta. Seus dados ficam guardados no próprio navegador.

## O que tem na pasta

| Arquivo | Pra que serve |
|---|---|
| `index.html` | O app inteiro. Também funciona sozinho, com dois cliques. |
| `manifest.webmanifest` | Permite instalar como app no celular e no PC. |
| `sw.js` | Faz o app abrir sem internet depois da primeira visita. |
| `icon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable.png` | Ícones do app. |

## Jeito 1: usar no PC, sem publicar nada

Abra o `index.html` com dois cliques no Chrome. Tudo funciona, menos a instalação como app e o modo offline. Esses dois só funcionam quando o app está num endereço `https://`.

## Jeito 2: publicar no GitHub Pages (recomendado)

Assim o app ganha um endereço tipo `https://SEU-USUARIO.github.io/habitos/`, instala no celular e abre sem internet.

1. Entre em github.com e crie um repositório novo chamado `habitos`. Pode ser **público** (o GitHub Pages grátis exige isso). Seus registros não vão pra lá: só os arquivos do app.
2. No repositório, clique em **Add file › Upload files** e arraste **todos os arquivos desta pasta**. Clique em **Commit changes**.
3. Vá em **Settings › Pages**. Em **Source**, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**, e salve.
4. Espere 1 ou 2 minutos e abra `https://SEU-USUARIO.github.io/habitos/`.

**Não envie** a folha de sprites do companheiro nem arquivos de backup pro repositório: eles não fazem parte do app e o repositório é público.

### Instalar no celular (Android)

Abra o endereço no Chrome, toque no menu **⋮ › Adicionar à tela inicial** (ou **Instalar app**).

### Instalar no PC

No Chrome, clique no ícone de instalar na barra de endereço, ou em **⋮ › Transmitir, salvar e compartilhar › Instalar página como app**.

## Seus dados

- Ficam **só no navegador** onde você usa o app. Cada endereço tem seus próprios dados: o app aberto pelo arquivo no PC e o app no GitHub Pages **não enxergam os dados um do outro**.
- **Pra mudar de endereço ou de aparelho**, use **Configurações › Sincronização e backup › Exportar backup** e depois **Importar backup** no outro lugar.
- **Pra passar os dias recentes pro celular**, use **Mostrar QR** no PC e aponte a câmera do celular. Com o app no GitHub Pages, a própria câmera do celular abre o link e junta os dados. Os dados se juntam sem apagar nada. Desmarcar uma tarefa num aparelho não desmarca no outro.
- Limpar os dados do site no navegador apaga tudo. Faça backups de vez em quando.

## Lembretes

- As notificações do navegador só aparecem **com o app aberto** (numa aba ou instalado). Sem um servidor, nenhum navegador consegue avisar com o app fechado.
- Pra lembrete garantido no celular, use **Horários pro calendário (.ics)** em Configurações e importe o arquivo no Google Agenda. Se mudar os horários, gere e importe de novo.

## Regras de XP

| Ação | XP |
|---|---|
| Tarefa simples | 10 |
| Tarefa com horário (cada dose conta separado) | 20 |
| Meta de água do dia | +20 |
| Todas as tarefas do dia + meta de água | +30 |
| Passar o seu recorde de sequência | +25 (uma vez por sequência) |

Desmarcar tira o XP e marcar de novo devolve o mesmo valor, então não tem como ganhar duas vezes. Cada dia guarda um retrato das tarefas e da meta daquele dia: mudar tarefas ou metas depois não altera o XP do passado.

Um dia sem registro por semana é coberto pelo **coringa** e não quebra a sequência. Dois dias completos sem registro deixam o companheiro desanimado, e ele volta ao normal na próxima tarefa.

## Créditos

Gerador de QR: qrcode-generator, de Kazuhiko Arase, licença MIT.
