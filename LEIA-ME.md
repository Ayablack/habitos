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

No repositório, clique em **Add file › Upload files**, arraste o `index.html` e o `sw.js` novos e clique em **Commit changes**. Em 1 ou 2 minutos o site atualiza. Seus registros e o companheiro salvo continuam no navegador: a nova versão converte o companheiro antigo sozinha, sem mudar a aparência, e guarda uma cópia do formato antigo. A imagem que você já tinha vira a **imagem 1**, em 100%.

## Painel do Hoje

No PC, clique no **lápis** no topo do Hoje pra entrar no modo de edição:

- **Mudar de lugar:** arraste o quadro ou use ◀ ▶.
- **Tamanho:** **P** (1/4 da linha), **M** (1/3), **G** (metade) ou **Inteira**. Os quadros de uma linha esticam pra ocupar o espaço que sobra.
- **Esconder:** × no quadro. Pra trazer de volta, **+ Adicionar quadro**.
- **Desfazer** e **Restaurar padrão** ficam na barra de cima. Clique em **Concluir** pra sair.
- O quadro **Horários** aparece sozinho quando o dia tem tarefa com horário (remédio, alarme) e some quando não tem. Quando todos os horários do dia foram feitos, ele recolhe numa linha; toque pra abrir.

Em **+ Adicionar quadro** também dá pra criar:

- **Lista nova** (ex.: Trabalho, Estudos): vira um quadro com as tarefas dela. Manhã, Durante o dia e Noite também são listas: dá pra renomear, trocar a cor, mudar a ordem ou apagar em **Configurações › Tarefas › Suas listas**. Ao apagar, o app pergunta pra qual lista vão as tarefas. Lista com todas as tarefas feitas recolhe numa linha.
- **Contador** (ex.: Páginas lidas, meta 30, cada toque soma 10): vira um quadro com + e −. XP ao bater a meta e **Conta pro dia completo** ficam em **Configurações › Rotina e lembretes › Contadores**, junto com a Água.

E trazer dois quadros que começam fora do painel:

- **Agora:** o que precisa de atenção no momento: horário atrasado ou esquecido (com botão **Feito**), água atrasada (com **+1 copo**) e o próximo alarme. Some quando não tem nada.
- **Nota do dia:** uma linha sobre o dia. Salva sozinha e aparece no **Histórico**, em **Notas do dia** e ao passar o mouse no mapa do ano.

O anel do **Seu dia** tem um anel por lista (até 4) e um da água; a legenda mostra todas as listas e os contadores.

O arranjo fica salvo na hora e vai junto no **QR** e no **backup**. O celular não edita: ele mostra os mesmos quadros, na mesma ordem, em uma coluna. Depois de mudar no PC, leia o QR no celular pra atualizar.

Ainda no modo de edição, **Tela deste aparelho** ajusta só o aparelho onde você está:

- **Largura:** "Tela inteira" ocupa o monitor todo; "Centralizada" limita a 1360 px.
- **Tamanho da interface:** "Automático" aumenta em telas largas (2560 px → 130%), ou escolha de 80% a 200%.
- **Altura:**
  - **Preencher a janela** (padrão): a página não rola. As listas de tarefas ganham a altura que sobra e rolam por dentro. Em janelas baixas, Sequência e o mapa somem pra sobrar espaço.
  - **Encaixar tudo:** diminui ou aumenta o tamanho pra caber inteira.
  - **Rolar a página:** o jeito antigo.

## Configurações

Ficam em 5 abas: **Tarefas**, **Rotina e lembretes**, **Companheiro**, **Aparência** e **Dados**. O que se usa pouco fica recolhido em **Mais opções**.

- **Tarefa nova:** nome, **Tipo** (Uma vez, Com horário ou Manhã e noite), **Lista** e dias. Tarefa com horário pode ficar **Pela hora**: cada horário vai pra lista do período dele (Manhã, Durante o dia ou Noite). Manhã e noite escolhe uma lista pra cada vez. Tolerância do horário, **Ao marcar, soma no contador** e temporária ficam em Mais opções.
- **Aparência:** tema, som, confete e **Animar mesmo com "reduzir movimento"** (se o Windows estiver com os efeitos de animação desligados, o companheiro fica parado; ligue essa opção pra animar só no app).
- **Dados:** QR pro outro aparelho e backup.

## Companheiro: importação rápida

A aba **Companheiro** abre num **resumo** com os 4 estados: Repouso, Comemoração, Desânimo e Subida de nível. Em cada um, **Escolher quadros** e **Prévia** levam direto pra etapa certa. As 5 etapas completas ficam em **Modo avançado**. **Importar** e **Exportar** ficam no topo e funcionam mesmo sem nenhum companheiro salvo.


1. Em **Configurações › Companheiro**, clique em **Importação rápida** e escolha a folha de sprites (PNG). Também dá pra arrastar o arquivo na etapa Imagens.
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

## Companheiro: várias imagens

Cada animação pode vir de uma folha diferente (por exemplo, uma pro Repouso e outra pra Comemoração).

- **Adicionar uma imagem:** em **Imagens**, arraste outro PNG ou clique na área de arrastar. A imagem nova entra junto e **nenhum recorte nem sequência é apagado**. Na **Importação rápida**, o app pergunta: **Adicionar ao companheiro atual** (padrão) ou **Começar do zero**. Começar do zero só mexe no rascunho; Desfazer volta tudo.
- **Cada imagem tem o seu fundo e a sua grade.** Clique na imagem na lista pra ajustar. Detectar sprites e gerar por grade agem só na imagem escolhida.
- **Tamanho:** cada imagem pode aparecer em 50%, 100%, 200% ou 300%, sem borrar os pixels. Se uma folha foi desenhada menor, use **Igualar à imagem 1**: o app mede a altura do personagem nas duas e acerta o tamanho.
- **Sequências misturam imagens:** em **Sequência**, use **Todas as imagens / Imagem 1 / Imagem 2** pra filtrar os recortes. As miniaturas mostram o número da imagem.
- **Remover uma imagem** tira só os recortes dela (e esses quadros das sequências). Desfazer traz de volta.
- **Exportar companheiro** e o **backup** levam todas as imagens. Se um backup foi feito sem as imagens, o app mostra a imagem como “arquivo não encontrado”: clique em **Escolher o arquivo** e escolha o mesmo PNG pra recuperar, sem perder os recortes.

Nada vai pro companheiro da tela Hoje até você salvar. **Desfazer** (ou Ctrl+Z) volta as últimas mudanças, e **Descartar** volta pro que estava salvo. Cada estado tem sua própria sequência, velocidade, repetição e alinhamento. Estado sem quadros usa o Repouso com um efeito (partículas, brilho ou tons de cinza).

## Seus dados

- Ficam **só no navegador** onde você usa o app. Cada endereço tem seus próprios dados: o app aberto pelo arquivo no PC e o app no GitHub Pages **não enxergam os dados um do outro**.
- **Pra mudar de endereço ou de aparelho**, use **Configurações › Dados › Exportar backup** e depois **Importar backup** no outro lugar. Deixe marcado **Incluir as imagens do companheiro**: sem elas, o companheiro chega sem as imagens. O app avisa quando o arquivo passa de 5 MB.
- **Pra passar os dias recentes pro celular**, use **Configurações › Dados › Mostrar QR** no PC e aponte a câmera do celular. O QR leva também as tarefas, as listas, os contadores, as notas do dia e o arranjo do painel. Com o app no GitHub Pages, a própria câmera do celular abre o link e junta os dados. Os dados se juntam sem apagar nada. Desmarcar uma tarefa num aparelho não desmarca no outro.
- Limpar os dados do site no navegador apaga tudo. Faça backups de vez em quando.

## Lembretes

- As notificações do navegador só aparecem **com o app aberto** (numa aba ou instalado). Sem um servidor, nenhum navegador consegue avisar com o app fechado.
- Com a página na tela, o aviso aparece também numa faixa no topo do app.
- **Clicou em Testar aviso e não apareceu nada fora da página?** Quem mostra a notificação é o sistema. Confira:
  - **Windows:** Configurações › Sistema › Notificações: ative o Chrome (ou Edge) e desligue o “Não perturbe” / Assistente de foco.
  - **Mac:** Ajustes do Sistema › Notificações › Google Chrome: permitir.
  - **Navegador:** ícone à esquerda do endereço › Notificações › Permitir.
  - **Android:** Configurações › Apps › Chrome › Notificações ligadas.
  - **iPhone:** só com o app na tela de início (Compartilhar › Adicionar à Tela de Início), iOS 16.4 ou mais novo.
- Pra lembrete garantido no celular, use **Horários pro calendário (.ics)** em **Configurações › Rotina e lembretes › Mais opções** e importe o arquivo no Google Agenda. Se mudar os horários, gere e importe de novo.

## Regras de XP

| Ação | XP |
|---|---|
| Tarefa simples | 10 |
| Tarefa com horário (cada dose conta separado) | 20 |
| Meta de água do dia | +20 |
| Tarefa que conta como copo (ex.: “Copo d’água ao acordar”) | 10 da tarefa + 1 copo no contador |
| Meta de um contador seu | o XP que você escolher (0 a 100; começa em 10) |
| Todas as tarefas do dia + metas que contam pro dia completo | +30 |
| Passar o seu recorde de sequência | +25 (uma vez por sequência) |

Desmarcar tira o XP e marcar de novo devolve o mesmo valor, então não tem como ganhar duas vezes.

**Água e tarefas:** marcar “Copo d’água ao acordar” soma 1 copo no contador de água; desmarcar tira. Marcar de novo ou recarregar a página não soma duas vezes. O botão − não tira esse copo: pra isso, desmarque a tarefa. Qualquer tarefa pode somar num contador: ao criar ou editar, em Mais opções, escolha **Ao marcar, soma no contador**: Água soma 1 copo; um contador seu soma o passo dele (ex.: “Ler 10 páginas” soma 10 em Páginas lidas). Isso vale de hoje em diante; dias anteriores não mudam. Se hoje você já tinha somado esse copo à mão antes de atualizar, tire um com o −. **Dia completo:** todas as tarefas feitas e as metas marcadas com **Conta pro dia completo** batidas. A Água vem marcada; os contadores seus, não. O mapa e o anel geral seguem a mesma regra. Cada dia guarda um retrato das tarefas, das metas e dos contadores daquele dia: mudar tarefas ou metas depois não altera o XP do passado.

Um dia sem registro por semana é coberto pelo **coringa** e não quebra a sequência. Dois dias completos sem registro deixam o companheiro desanimado, e ele volta ao normal na próxima tarefa.

## Créditos

Gerador de QR: qrcode-generator, de Kazuhiko Arase, licença MIT.
