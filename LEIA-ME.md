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

## Atualizar o app no GitHub Pages

No repositório, clique em **Add file › Upload files**, arraste o `index.html` e o `sw.js` novos e clique em **Commit changes**. Em 1 ou 2 minutos o site atualiza. Seus registros e o companheiro salvo continuam no navegador: a nova versão converte o companheiro antigo sozinha, sem mudar a aparência, e guarda uma cópia do formato antigo.

## Tela

Em **Configurações › Lembretes e aparência › Tela**:

- **Largura:** "Tela inteira" ocupa o monitor todo; "Centralizada" limita a 1360 px.
- **Tamanho da interface:** "Automático" aumenta em telas largas (2560 px → 130%), ou escolha de 80% a 200%.
- **Altura da tela Hoje:**
  - **Preencher a janela** (padrão): a página não rola; se um período tiver muitas tarefas, só aquele quadro rola. Em janelas baixas, a faixa de sequência e mapa some pra sobrar espaço.
  - **Encaixar tudo:** diminui ou aumenta o tamanho pra caber inteira.
  - **Rolar a página:** o jeito antigo.
- **Animar mesmo com “reduzir movimento”:** se o Windows estiver com os efeitos de animação desligados, o companheiro fica parado. Ligue essa opção pra animar só no app.

Esses ajustes valem só pro aparelho onde foram feitos.

## Companheiro: importação rápida

1. Em **Configurações › Companheiro**, clique em **Importação rápida** e escolha a folha de sprites (PNG). Também dá pra arrastar o arquivo.
2. Se o fundo for de uma cor sólida ou um quadriculado pintado na própria imagem (comum em imagens baixadas que "parecem" transparentes), ele é removido sozinho. Se ficar uma borda clara em volta do personagem, use **Limpar contorno claro**. Na etapa **Imagem** dá pra comparar **Original** e **Processada** e trocar o modo:
   - **Só o fundo ligado às bordas:** protege partes do personagem com a mesma cor do fundo.
   - **Essa cor na imagem toda:** remove também o fundo preso entre braço e corpo.
3. O app detecta os sprites e mostra o relatório na etapa **Recortes**. Pra corrigir:
   - **Recortes:** arraste numa área vazia pra criar, arraste as alças pra redimensionar e ajuste os números X, Y, largura e altura.
   - **Ferramentas:** **Dividir** separa personagens encostados; **Unir**, **Ajustar ao sprite**, **Centralizar** e **Restaurar** fazem o que o nome diz.
4. Em **Sequência**, escolha o estado (Repouso, Comemoração, Desânimo ou Subida de nível), clique nos recortes na ordem da animação e em **Adicionar**. Arraste os quadros pra reordenar.
5. Em **Prévia**, confira a animação:
   - **Controles:** pausar, avançar quadro e mudar a velocidade e a repetição.
   - **Alinhamento:** use **Pelos pés** pra o personagem não pular entre poses de tamanhos diferentes. Com a prévia pausada, arraste o personagem pra ajustar um quadro.
6. Em **Salvar**, dê um nome opcional e clique em **Salvar companheiro**.

Nada vai pro companheiro da tela Hoje até você salvar. **Desfazer** (ou Ctrl+Z) volta as últimas mudanças, e **Descartar** volta pro que estava salvo. Cada estado tem sua própria sequência, velocidade, repetição e alinhamento. Estado sem quadros usa o Repouso com um efeito (partículas, brilho ou tons de cinza).

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
