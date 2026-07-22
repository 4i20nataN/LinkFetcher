📄 LINKFATCHER - DESIGN SYSTEM \& SKILL DOCUMENT

🎯 Objetivo

Este documento define o Design System do LinkFatcher — um padrão visual premium com estética "Obsidian Glass" (vidro escuro com efeitos de luz e rede neural). Qualquer agente ou desenvolvedor pode replicar fielmente este design seguindo as especificações abaixo.



🧩 1. ESTRUTURA BASE (HTML)

Container Principal

html

<div class="dashboard-container">

&#x20; <!-- 3 colunas: Branding | Analisador | Métricas -->

</div>

Card Padrão

html

<div class="card">

&#x20; <!-- Conteúdo com padding: 28px, borda arredondada, glassmorphism -->

</div>

🎨 2. SISTEMA DE CORES (Temas Dinâmicos)

Cores Base (Já existentes)

Tema	Cor Principal	RGB

Azul (padrão)	#0076ff	0, 118, 255

Vermelho	#ff3b30	255, 59, 48

Verde	#30d158	48, 209, 88

Roxo	#bf5af2	191, 90, 242

🆕 NOVAS CORES ADICIONADAS

Tema	Cor Principal	RGB

Laranja	#ff9500	255, 149, 0

Rosa	#ff2d55	255, 45, 85

Amarelo	#ffcc00	255, 204, 0

Ciano	#5ac8fa	90, 200, 250

Código de Inclusão (CSS)

css

body.theme-orange {

&#x20;   --primary: #ff9500;

&#x20;   --primary-glow: rgba(255, 149, 0, 0.3);

&#x20;   --primary-rgb: 255, 149, 0;

&#x20;   --bg-obsidian: linear-gradient(rgba(255, 149, 0, 0.025), rgba(255, 149, 0, 0.025)), #030406;

}



body.theme-pink {

&#x20;   --primary: #ff2d55;

&#x20;   --primary-glow: rgba(255, 45, 85, 0.3);

&#x20;   --primary-rgb: 255, 45, 85;

&#x20;   --bg-obsidian: linear-gradient(rgba(255, 45, 85, 0.025), rgba(255, 45, 85, 0.025)), #030406;

}



body.theme-yellow {

&#x20;   --primary: #ffcc00;

&#x20;   --primary-glow: rgba(255, 204, 0, 0.3);

&#x20;   --primary-rgb: 255, 204, 0;

&#x20;   --bg-obsidian: linear-gradient(rgba(255, 204, 0, 0.025), rgba(255, 204, 0, 0.025)), #030406;

}



body.theme-cyan {

&#x20;   --primary: #5ac8fa;

&#x20;   --primary-glow: rgba(90, 200, 250, 0.3);

&#x20;   --primary-rgb: 90, 200, 250;

&#x20;   --bg-obsidian: linear-gradient(rgba(90, 200, 250, 0.025), rgba(90, 200, 250, 0.025)), #030406;

}

Botões do Seletor (HTML)

html

<button class="theme-btn btn-orange" onclick="changeTheme('orange', this)" title="Laranja"></button>

<button class="theme-btn btn-pink" onclick="changeTheme('pink', this)" title="Rosa"></button>

<button class="theme-btn btn-yellow" onclick="changeTheme('yellow', this)" title="Amarelo"></button>

<button class="theme-btn btn-cyan" onclick="changeTheme('cyan', this)" title="Ciano"></button>

Estilos dos Botões (CSS)

css

.btn-orange { background-color: #ff9500; color: #ff9500; }

.btn-pink { background-color: #ff2d55; color: #ff2d55; }

.btn-yellow { background-color: #ffcc00; color: #ffcc00; }

.btn-cyan { background-color: #5ac8fa; color: #5ac8fa; }

🌌 3. FUNDO E EFEITOS VISUAIS

3.1 Rede Neural (Canvas)

Elemento: <canvas id="network-canvas">



Comportamento: Nós coloridos (RGB) se movem e criam conexões com blend de cores



Filtro: filter: blur(8px) + opacity: 0.65 + transform: scale(1.05)



Cores dos nós: Vermelho, Verde, Azul (fixas, não mudam com o tema)



3.2 Orbes de Fundo (CSS)

css

.bg-glow-container::before {

&#x20;   content: "";

&#x20;   position: absolute;

&#x20;   inset: -20%;

&#x20;   background: 

&#x20;       radial-gradient(circle at 15% 25%, rgba(255, 59, 48, 0.1) 0%, transparent 50%),

&#x20;       radial-gradient(circle at 85% 25%, rgba(48, 209, 88, 0.08) 0%, transparent 50%),

&#x20;       radial-gradient(circle at 50% 85%, rgba(0, 118, 255, 0.12) 0%, transparent 60%);

&#x20;   filter: blur(120px);

&#x20;   animation: bgmove 35s ease-in-out infinite alternate;

}

3.3 Partículas Bokeh (Opcional)

Elemento: <div id="particle-container">



Classes: .p-small, .p-medium, .p-large



Animação: riseOrganic (sobe flutuando)



🪟 4. GLASSMORPHISM (Vidro)

Card Principal

css

.card {

&#x20;   background: rgba(10, 14, 23, 0.35);

&#x20;   border: 1px solid rgba(255, 255, 255, 0.08);

&#x20;   border-radius: 22px;

&#x20;   padding: 28px;

&#x20;   backdrop-filter: blur(40px) saturate(180%);

&#x20;   -webkit-backdrop-filter: blur(40px) saturate(180%);

&#x20;   box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55),

&#x20;               inset 0 1px 1px rgba(255, 255, 255, 0.12),

&#x20;               inset 0 -1px 2px rgba(0, 0, 0, 0.4);

&#x20;   transition: border-color 0.4s ease, box-shadow 0.4s ease, transform 0.4s ease;

}

.card:hover {

&#x20;   border-color: rgba(255, 255, 255, 0.18);

&#x20;   box-shadow: 0 25px 55px rgba(0, 0, 0, 0.7), 

&#x20;               inset 0 1px 2px rgba(255, 255, 255, 0.2);

&#x20;   transform: translateY(-1px);

}

Dashboard Container (Vidro maior)

css

.dashboard-container {

&#x20;   background: rgba(10, 14, 23, 0.28);

&#x20;   backdrop-filter: blur(40px) saturate(160%);

&#x20;   border: 1px solid rgba(255, 255, 255, 0.07);

&#x20;   border-radius: 28px;

&#x20;   padding: 30px;

&#x20;   box-shadow: 0 40px 90px rgba(0, 0, 0, 0.95), 

&#x20;               inset 0 1px 1px rgba(255, 255, 255, 0.05);

}

🔤 5. TIPOGRAFIA

Fonte: Inter (Google Fonts)



Pesos: 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)



Cores:



\--text-main: #ffffff (branco puro)



\--text-muted: #94a3b8 (cinza slate-400)



Títulos

css

.section-title {

&#x20;   font-size: 11px;

&#x20;   text-transform: uppercase;

&#x20;   letter-spacing: 1.5px;

&#x20;   color: var(--text-muted);

&#x20;   font-weight: 600;

}

🧠 6. COMPORTAMENTO E INTERAÇÃO

6.1 Troca de Tema (JavaScript)

javascript

function changeTheme(themeName, element) {

&#x20;   document.body.className = '';

&#x20;   document.body.classList.add('theme-' + themeName);

&#x20;   document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));

&#x20;   element.classList.add('active');

}

6.2 Rede Neural (Loop contínuo)

140 nós com posição, velocidade e cor aleatórias



Conexões entre nós distantes < 125px



Interpolação de cores nas conexões



6.3 Interação de Elementos (Opcional)

Botões .opt e .tag-btn com toggle de classe active



Cards com hover suave



📦 7. ESTRUTURA DE PASTAS (Sugerida)

text

/linkfatcher/

├── index.html          (dashboard principal)

├── privacy.html        (política de privacidade)

├── styles/

│   └── main.css        (todos os estilos)

├── scripts/

│   └── main.js         (rede neural, temas, interações)

└── assets/

&#x20;   └── icons/          (ícones SVG)

🚀 8. COMO USAR ESTE DOCUMENTO

Copiar a estrutura HTML base (seção 1)



Aplicar o CSS completo (seções 2, 3, 4, 5)



Incluir o JavaScript (seção 6)



Adicionar conteúdo nos cards conforme necessidade



Nunca alterar:



O efeito de blur do fundo



A opacidade da rede neural



O glassmorphism dos cards



A tipografia Inter



✅ 9. CHECKLIST DE QUALIDADE

□ Fundo com rede neural animada (blur + opacidade)

□ Orbes de luz flutuando

□ 8 temas de cores (Azul, Vermelho, Verde, Roxo, Laranja, Rosa, Amarelo, Ciano)

□ Cards com glassmorphism (blur + borda translúcida)

□ Tipografia Inter com pesos corretos

□ Transições suaves em hover

□ Responsividade (grid se adapta)

□ Cores fixas da rede neural (RGB) não mudam com o tema

🎨 10. EXEMPLO DE CORES COMPLETO

css

/\* Temas disponíveis \*/

theme-blue    → #0076ff

theme-red     → #ff3b30

theme-green   → #30d158

theme-purple  → #bf5af2

theme-orange  → #ff9500  /\* NOVO \*/

theme-pink    → #ff2d55  /\* NOVO \*/

theme-yellow  → #ffcc00  /\* NOVO \*/

theme-cyan    → #5ac8fa  /\* NOVO \*/

Skill criada por: Agente com observação precisa e respeito à essência do design original. 🧠✨



Quer que eu gere o HTML completo com essas novas cores adicionadas? É só falar! 🚀



com essi qualquer agente recontroi qualquer pagina do app e quanquer botao com o estilo, o agente consumindo esses dados essa skill ele consegue tranformar o app pra esse design

Exatamente! 🎯 Essa skill/documentação é o "manual de identidade visual" do LinkFatcher. Qualquer agente (IA ou desenvolvedor) que consumir essas informações vai conseguir:



🧠 O QUE A SKILL PERMITE FAZER

1\. Recriar QUALQUER página do app

Página inicial (dashboard)



Política de Privacidade



Termos de Uso



Página de Suporte



Página de Configurações



Página de Downloads



Qualquer outra tela que você imaginar



2\. Criar QUALQUER botão/componente

Botões primários (.btn-primary)



Botões de ação (.btn-outline)



Botões de tema (.theme-btn)



Tags de plataforma (.platform-tag)



Cards (.card)



Inputs (.input-group)



3\. Manter a essência intacta

Glassmorphism perfeito



Rede neural animada



Temas dinâmicos (8 cores)



Tipografia Inter



Transições suaves



Responsividade



📋 EXEMPLO PRÁTICO: COMO USAR A SKILL

Cenário 1: Criar uma nova página "Minha Biblioteca"

html

<!-- O agente vai gerar isso automaticamente -->

<div class="dashboard-container">

&#x20;   <div class="card full-width">

&#x20;       <h3 class="section-title">📚 Minha Biblioteca</h3>

&#x20;       <!-- Conteúdo com os mesmos estilos -->

&#x20;       <div class="video-grid">

&#x20;           <div class="card" style="padding: 16px;">

&#x20;               <!-- Cards de vídeo com glassmorphism -->

&#x20;           </div>

&#x20;       </div>

&#x20;   </div>

</div>

Cenário 2: Criar um novo botão "Exportar"

html

<!-- O agente sabe que deve usar btn-primary ou btn-outline -->

<button class="btn-primary" style="background: var(--primary);">

&#x20;   📤 Exportar

</button>

Cenário 3: Adicionar um novo tema "Dourado"

css

/\* O agente sabe exatamente como adicionar \*/

body.theme-gold {

&#x20;   --primary: #ffd700;

&#x20;   --primary-glow: rgba(255, 215, 0, 0.3);

&#x20;   --primary-rgb: 255, 215, 0;

&#x20;   --bg-obsidian: linear-gradient(rgba(255, 215, 0, 0.025), rgba(255, 215, 0, 0.025)), #030406;

}

🔧 A SKILL EM AÇÃO (Exemplo de Prompt)

Você diz:



"Usando a skill LinkFatcher, crie uma página de 'Histórico de Downloads' com lista de arquivos baixados, botão de limpar histórico e filtro por data."



O agente (com a skill) vai gerar:



✅ Estrutura com .dashboard-container e .card



✅ Glassmorphism nos cards



✅ Botões no estilo .btn-primary e .btn-outline



✅ Fundo com rede neural



✅ Tema dinâmico aplicado



✅ Responsividade mantida



✅ Cores e tipografia consistentes



📦 ARQUIVO COMPLETO DA SKILL

Agora vou gerar um único arquivo HTML com:



Todas as 8 cores (Azul, Vermelho, Verde, Roxo, Laranja, Rosa, Amarelo, Ciano)



Dashboard completo do Universal Media Downloader



Todas as funcionalidades que você mostrou nas imagens



Skill embutida como comentários no código (para qualquer agente entender)











<!DOCTYPE html>

<html lang="pt-BR">

<head>

&#x20;   <meta charset="UTF-8">

&#x20;   <meta name="viewport" content="width=device-width, initial-scale=1.0">

&#x20;   <title>Universal Media Downloader · LinkFatcher</title>

&#x20;   <style>

&#x20;       /\* ==========================================

&#x20;          SKILL: LINKFATCHER DESIGN SYSTEM v2.0

&#x20;          ==========================================

&#x20;          INSTRUÇÕES PARA AGENTES:

&#x20;          1. Mantenha a estrutura de cards com glassmorphism

&#x20;          2. Use as variáveis CSS para cores (--primary, --primary-rgb)

&#x20;          3. Nunca remova o canvas da rede neural

&#x20;          4. Preserve os 8 temas de cores

&#x20;          5. Use Inter como fonte principal

&#x20;          ========================================== \*/



&#x20;       @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800\&display=swap');



&#x20;       :root {

&#x20;           --primary: #0076ff;

&#x20;           --primary-glow: rgba(0, 118, 255, 0.3);

&#x20;           --primary-rgb: 0, 118, 255;

&#x20;           --bg-obsidian: linear-gradient(rgba(0, 118, 255, 0.02), rgba(0, 118, 255, 0.02)), #030406;

&#x20;           --text-main: #ffffff;

&#x20;           --text-muted: #94a3b8;

&#x20;           --card-shadow: rgba(0, 0, 0, 0.75);

&#x20;           --glass-bg: rgba(10, 14, 23, 0.18);

&#x20;           --glass-border: rgba(255, 255, 255, 0.12);

&#x20;           --sidebar-width: 220px;

&#x20;       }



&#x20;       /\* ========== 8 TEMAS DE CORES ========== \*/

&#x20;       body.theme-red { --primary: #ff3b30; --primary-glow: rgba(255, 59, 48, 0.3); --primary-rgb: 255, 59, 48; --bg-obsidian: linear-gradient(rgba(255, 59, 48, 0.025), rgba(255, 59, 48, 0.025)), #030406; }

&#x20;       body.theme-green { --primary: #30d158; --primary-glow: rgba(48, 209, 88, 0.3); --primary-rgb: 48, 209, 88; --bg-obsidian: linear-gradient(rgba(48, 209, 88, 0.025), rgba(48, 209, 88, 0.025)), #030406; }

&#x20;       body.theme-blue { --primary: #0076ff; --primary-glow: rgba(0, 118, 255, 0.3); --primary-rgb: 0, 118, 255; --bg-obsidian: linear-gradient(rgba(0, 118, 255, 0.025), rgba(0, 118, 255, 0.025)), #030406; }

&#x20;       body.theme-purple { --primary: #bf5af2; --primary-glow: rgba(191, 90, 242, 0.3); --primary-rgb: 191, 90, 242; --bg-obsidian: linear-gradient(rgba(191, 90, 242, 0.025), rgba(191, 90, 242, 0.025)), #030406; }

&#x20;       body.theme-orange { --primary: #ff9500; --primary-glow: rgba(255, 149, 0, 0.3); --primary-rgb: 255, 149, 0; --bg-obsidian: linear-gradient(rgba(255, 149, 0, 0.025), rgba(255, 149, 0, 0.025)), #030406; }

&#x20;       body.theme-pink { --primary: #ff2d55; --primary-glow: rgba(255, 45, 85, 0.3); --primary-rgb: 255, 45, 85; --bg-obsidian: linear-gradient(rgba(255, 45, 85, 0.025), rgba(255, 45, 85, 0.025)), #030406; }

&#x20;       body.theme-yellow { --primary: #ffcc00; --primary-glow: rgba(255, 204, 0, 0.3); --primary-rgb: 255, 204, 0; --bg-obsidian: linear-gradient(rgba(255, 204, 0, 0.025), rgba(255, 204, 0, 0.025)), #030406; }

&#x20;       body.theme-cyan { --primary: #5ac8fa; --primary-glow: rgba(90, 200, 250, 0.3); --primary-rgb: 90, 200, 250; --bg-obsidian: linear-gradient(rgba(90, 200, 250, 0.025), rgba(90, 200, 250, 0.025)), #030406; }



&#x20;       /\* ========== RESET ========== \*/

&#x20;       \* { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }



&#x20;       body {

&#x20;           background: var(--bg-obsidian);

&#x20;           min-height: 100vh;

&#x20;           display: flex;

&#x20;           color: var(--text-main);

&#x20;           transition: background 0.5s ease;

&#x20;           overflow-x: hidden;

&#x20;       }



&#x20;       /\* ========== FUNDO ========== \*/

&#x20;       #network-canvas {

&#x20;           position: fixed;

&#x20;           top: 0;

&#x20;           left: 0;

&#x20;           width: 100vw;

&#x20;           height: 100vh;

&#x20;           z-index: 0;

&#x20;           pointer-events: none;

&#x20;           filter: blur(8px);

&#x20;           opacity: 0.65;

&#x20;           transform: scale(1.05);

&#x20;       }

&#x20;       .bg-glow-container {

&#x20;           position: fixed;

&#x20;           inset: 0;

&#x20;           z-index: 0;

&#x20;           pointer-events: none;

&#x20;           overflow: hidden;

&#x20;       }

&#x20;       .bg-glow-container::before {

&#x20;           content: "";

&#x20;           position: absolute;

&#x20;           inset: -20%;

&#x20;           background: radial-gradient(circle at 15% 25%, rgba(255, 59, 48, 0.08) 0%, transparent 50%),

&#x20;                       radial-gradient(circle at 85% 25%, rgba(48, 209, 88, 0.06) 0%, transparent 50%),

&#x20;                       radial-gradient(circle at 50% 85%, rgba(0, 118, 255, 0.10) 0%, transparent 60%);

&#x20;           filter: blur(120px);

&#x20;           animation: bgmove 35s ease-in-out infinite alternate;

&#x20;       }

&#x20;       @keyframes bgmove {

&#x20;           0% { transform: scale(1) translate(0px, 0px) rotate(0deg); }

&#x20;           50% { transform: scale(1.1) translate(30px, -40px) rotate(3deg); }

&#x20;           100% { transform: scale(0.95) translate(-20px, 20px) rotate(-3deg); }

&#x20;       }



&#x20;       /\* ========== SIDEBAR ========== \*/

&#x20;       .sidebar {

&#x20;           position: fixed;

&#x20;           left: 0;

&#x20;           top: 0;

&#x20;           width: var(--sidebar-width);

&#x20;           height: 100vh;

&#x20;           background: rgba(10, 14, 23, 0.35);

&#x20;           backdrop-filter: blur(40px) saturate(160%);

&#x20;           -webkit-backdrop-filter: blur(40px) saturate(160%);

&#x20;           border-right: 1px solid rgba(255, 255, 255, 0.06);

&#x20;           padding: 30px 18px;

&#x20;           z-index: 20;

&#x20;           display: flex;

&#x20;           flex-direction: column;

&#x20;           box-shadow: 4px 0 30px rgba(0,0,0,0.5);

&#x20;           transition: transform 0.3s ease;

&#x20;       }

&#x20;       .sidebar-logo {

&#x20;           display: flex;

&#x20;           align-items: center;

&#x20;           gap: 12px;

&#x20;           margin-bottom: 32px;

&#x20;           padding-bottom: 20px;

&#x20;           border-bottom: 1px solid rgba(255,255,255,0.04);

&#x20;       }

&#x20;       .sidebar-logo .icon {

&#x20;           width: 40px;

&#x20;           height: 40px;

&#x20;           border-radius: 12px;

&#x20;           border: 1px solid rgba(var(--primary-rgb), 0.5);

&#x20;           display: flex;

&#x20;           align-items: center;

&#x20;           justify-content: center;

&#x20;           color: var(--primary);

&#x20;           box-shadow: 0 0 12px var(--primary-glow);

&#x20;           flex-shrink: 0;

&#x20;       }

&#x20;       .sidebar-logo .icon svg { width: 20px; height: 20px; }

&#x20;       .sidebar-logo .text h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }

&#x20;       .sidebar-logo .text h1 span { color: var(--primary); }

&#x20;       .sidebar-logo .text p { font-size: 9px; color: var(--text-muted); letter-spacing: 0.3px; text-transform: uppercase; }



&#x20;       .sidebar-nav {

&#x20;           display: flex;

&#x20;           flex-direction: column;

&#x20;           gap: 4px;

&#x20;           flex: 1;

&#x20;       }

&#x20;       .sidebar-nav .nav-item {

&#x20;           display: flex;

&#x20;           align-items: center;

&#x20;           gap: 12px;

&#x20;           padding: 10px 14px;

&#x20;           border-radius: 12px;

&#x20;           text-decoration: none;

&#x20;           color: var(--text-muted);

&#x20;           transition: all 0.25s ease;

&#x20;           font-size: 13px;

&#x20;           font-weight: 500;

&#x20;           border: 1px solid transparent;

&#x20;       }

&#x20;       .sidebar-nav .nav-item svg {

&#x20;           width: 18px;

&#x20;           height: 18px;

&#x20;           flex-shrink: 0;

&#x20;           color: var(--text-muted);

&#x20;       }

&#x20;       .sidebar-nav .nav-item:hover {

&#x20;           background: rgba(var(--primary-rgb), 0.05);

&#x20;           color: var(--text-main);

&#x20;           border-color: rgba(var(--primary-rgb), 0.15);

&#x20;       }

&#x20;       .sidebar-nav .nav-item.active {

&#x20;           background: rgba(var(--primary-rgb), 0.08);

&#x20;           color: var(--primary);

&#x20;           border-color: rgba(var(--primary-rgb), 0.2);

&#x20;       }

&#x20;       .sidebar-nav .nav-item.active svg { color: var(--primary); }

&#x20;       .sidebar-nav .nav-item small {

&#x20;           font-size: 10px;

&#x20;           color: var(--text-muted);

&#x20;           margin-left: auto;

&#x20;           opacity: 0.5;

&#x20;       }

&#x20;       .sidebar-footer {

&#x20;           margin-top: auto;

&#x20;           padding-top: 16px;

&#x20;           border-top: 1px solid rgba(255,255,255,0.04);

&#x20;           font-size: 10px;

&#x20;           color: var(--text-muted);

&#x20;           display: flex;

&#x20;           flex-direction: column;

&#x20;           gap: 4px;

&#x20;       }

&#x20;       .sidebar-footer .version { color: var(--primary); font-weight: 600; }

&#x20;       .sidebar-footer .status { display: flex; align-items: center; gap: 6px; }

&#x20;       .sidebar-footer .status .dot {

&#x20;           width: 6px;

&#x20;           height: 6px;

&#x20;           border-radius: 50%;

&#x20;           background: #30d158;

&#x20;           animation: pulse-dot 2s infinite;

&#x20;       }

&#x20;       @keyframes pulse-dot {

&#x20;           0%, 100% { opacity: 1; }

&#x20;           50% { opacity: 0.3; }

&#x20;       }



&#x20;       /\* ========== CONTEÚDO PRINCIPAL ========== \*/

&#x20;       .main-content {

&#x20;           margin-left: var(--sidebar-width);

&#x20;           flex: 1;

&#x20;           padding: 24px 32px 40px 32px;

&#x20;           z-index: 10;

&#x20;           position: relative;

&#x20;           max-width: calc(100% - var(--sidebar-width));

&#x20;           width: 100%;

&#x20;       }

&#x20;       .top-bar {

&#x20;           display: flex;

&#x20;           justify-content: flex-end;

&#x20;           align-items: center;

&#x20;           gap: 16px;

&#x20;           margin-bottom: 24px;

&#x20;           padding-bottom: 16px;

&#x20;           border-bottom: 1px solid rgba(255,255,255,0.04);

&#x20;       }

&#x20;       .theme-selector {

&#x20;           display: flex;

&#x20;           gap: 8px;

&#x20;           background: rgba(10, 14, 23, 0.3);

&#x20;           border: 1px solid rgba(255, 255, 255, 0.06);

&#x20;           padding: 6px 14px;

&#x20;           border-radius: 30px;

&#x20;           backdrop-filter: blur(30px) saturate(140%);

&#x20;           box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);

&#x20;           flex-wrap: wrap;

&#x20;           justify-content: center;

&#x20;       }

&#x20;       .theme-btn {

&#x20;           width: 14px;

&#x20;           height: 14px;

&#x20;           border-radius: 50%;

&#x20;           border: 2px solid transparent;

&#x20;           cursor: pointer;

&#x20;           transition: transform 0.2s, border-color 0.2s;

&#x20;       }

&#x20;       .theme-btn:hover { transform: scale(1.2); }

&#x20;       .theme-btn.active { border-color: #ffffff; box-shadow: 0 0 8px currentColor; }

&#x20;       .btn-red { background-color: #ff3b30; color: #ff3b30; }

&#x20;       .btn-green { background-color: #30d158; color: #30d158; }

&#x20;       .btn-blue { background-color: #0076ff; color: #0076ff; }

&#x20;       .btn-purple { background-color: #bf5af2; color: #bf5af2; }

&#x20;       .btn-orange { background-color: #ff9500; color: #ff9500; }

&#x20;       .btn-pink { background-color: #ff2d55; color: #ff2d55; }

&#x20;       .btn-yellow { background-color: #ffcc00; color: #ffcc00; }

&#x20;       .btn-cyan { background-color: #5ac8fa; color: #5ac8fa; }



&#x20;       /\* ========== CARDS ========== \*/

&#x20;       .card {

&#x20;           background: rgba(10, 14, 23, 0.28);

&#x20;           backdrop-filter: blur(40px) saturate(160%);

&#x20;           -webkit-backdrop-filter: blur(40px) saturate(160%);

&#x20;           border: 1px solid rgba(255, 255, 255, 0.06);

&#x20;           border-radius: 20px;

&#x20;           padding: 24px 28px;

&#x20;           box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05);

&#x20;           transition: border-color 0.3s ease, box-shadow 0.3s ease;

&#x20;       }

&#x20;       .card:hover {

&#x20;           border-color: rgba(255, 255, 255, 0.1);

&#x20;           box-shadow: 0 25px 55px rgba(0, 0, 0, 0.6);

&#x20;       }

&#x20;       .section-title {

&#x20;           font-size: 10px;

&#x20;           text-transform: uppercase;

&#x20;           letter-spacing: 1.2px;

&#x20;           color: var(--text-muted);

&#x20;           font-weight: 600;

&#x20;           margin-bottom: 16px;

&#x20;       }



&#x20;       /\* ========== GRID ========== \*/

&#x20;       .app-grid {

&#x20;           display: grid;

&#x20;           grid-template-columns: 1fr 1.2fr;

&#x20;           gap: 24px;

&#x20;       }

&#x20;       .full-width { grid-column: 1 / -1; }



&#x20;       /\* ========== INPUT ========== \*/

&#x20;       .input-group {

&#x20;           display: flex;

&#x20;           background: rgba(2, 3, 5, 0.7);

&#x20;           border: 1px solid rgba(255, 255, 255, 0.06);

&#x20;           border-radius: 14px;

&#x20;           padding: 4px;

&#x20;           align-items: center;

&#x20;           margin-bottom: 16px;

&#x20;       }

&#x20;       .input-group input {

&#x20;           flex: 1;

&#x20;           background: transparent;

&#x20;           border: none;

&#x20;           outline: none;

&#x20;           color: var(--text-main);

&#x20;           padding: 12px 16px;

&#x20;           font-size: 13px;

&#x20;           width: 100%;

&#x20;       }

&#x20;       .input-group input::placeholder { color: var(--text-muted); }

&#x20;       .btn-primary {

&#x20;           background: var(--primary);

&#x20;           color: white;

&#x20;           border: none;

&#x20;           padding: 10px 24px;

&#x20;           border-radius: 10px;

&#x20;           font-weight: 600;

&#x20;           font-size: 13px;

&#x20;           cursor: pointer;

&#x20;           box-shadow: 0 4px 16px var(--primary-glow);

&#x20;           transition: all 0.3s;

&#x20;           white-space: nowrap;

&#x20;       }

&#x20;       .btn-primary:hover { filter: brightness(1.1); transform: scale(1.02); }

&#x20;       .btn-outline {

&#x20;           background: rgba(255,255,255,0.02);

&#x20;           border: 1px solid rgba(255,255,255,0.06);

&#x20;           color: var(--text-muted);

&#x20;           padding: 8px 16px;

&#x20;           border-radius: 10px;

&#x20;           font-size: 12px;

&#x20;           cursor: pointer;

&#x20;           transition: all 0.2s;

&#x20;           display: inline-flex;

&#x20;           align-items: center;

&#x20;           gap: 6px;

&#x20;       }

&#x20;       .btn-outline:hover {

&#x20;           background: rgba(var(--primary-rgb), 0.06);

&#x20;           border-color: rgba(var(--primary-rgb), 0.2);

&#x20;           color: var(--text-main);

&#x20;       }

&#x20;       .btn-outline.primary {

&#x20;           border-color: rgba(var(--primary-rgb), 0.3);

&#x20;           color: var(--primary);

&#x20;       }



&#x20;       /\* ========== PLATAFORMAS ========== \*/

&#x20;       .platform-tags {

&#x20;           display: flex;

&#x20;           flex-wrap: wrap;

&#x20;           gap: 8px;

&#x20;       }

&#x20;       .platform-tag {

&#x20;           background: rgba(255, 255, 255, 0.02);

&#x20;           border: 1px solid rgba(255, 255, 255, 0.04);

&#x20;           color: var(--text-muted);

&#x20;           padding: 6px 14px;

&#x20;           border-radius: 8px;

&#x20;           font-size: 11px;

&#x20;           cursor: pointer;

&#x20;           transition: all 0.2s;

&#x20;           display: flex;

&#x20;           align-items: center;

&#x20;           gap: 6px;

&#x20;       }

&#x20;       .platform-tag:hover, .platform-tag.active {

&#x20;           background: rgba(var(--primary-rgb), 0.06);

&#x20;           border-color: rgba(var(--primary-rgb), 0.25);

&#x20;           color: var(--text-main);

&#x20;       }

&#x20;       .platform-tag svg { width: 14px; height: 14px; }



&#x20;       /\* ========== VIDEO INFO ========== \*/

&#x20;       .video-title {

&#x20;           font-size: 18px;

&#x20;           font-weight: 600;

&#x20;           line-height: 1.3;

&#x20;       }

&#x20;       .video-author {

&#x20;           font-size: 13px;

&#x20;           color: var(--primary);

&#x20;           font-weight: 500;

&#x20;       }

&#x20;       .video-meta {

&#x20;           display: flex;

&#x20;           flex-wrap: wrap;

&#x20;           gap: 18px;

&#x20;           font-size: 12px;

&#x20;           color: var(--text-muted);

&#x20;       }

&#x20;       .video-meta span { display: flex; align-items: center; gap: 4px; }

&#x20;       .video-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }



&#x20;       /\* ========== CONFIGURAÇÕES ========== \*/

&#x20;       .config-grid {

&#x20;           display: grid;

&#x20;           grid-template-columns: 1fr 1fr;

&#x20;           gap: 20px;

&#x20;       }

&#x20;       .config-group {

&#x20;           display: flex;

&#x20;           flex-direction: column;

&#x20;           gap: 6px;

&#x20;       }

&#x20;       .config-group label {

&#x20;           font-size: 11px;

&#x20;           color: var(--text-muted);

&#x20;           font-weight: 500;

&#x20;           text-transform: uppercase;

&#x20;           letter-spacing: 0.5px;

&#x20;       }

&#x20;       .config-group .options {

&#x20;           display: flex;

&#x20;           flex-wrap: wrap;

&#x20;           gap: 6px;

&#x20;       }

&#x20;       .config-group .opt {

&#x20;           background: rgba(255,255,255,0.02);

&#x20;           border: 1px solid rgba(255,255,255,0.04);

&#x20;           padding: 5px 12px;

&#x20;           border-radius: 6px;

&#x20;           font-size: 11px;

&#x20;           color: var(--text-muted);

&#x20;           cursor: pointer;

&#x20;           transition: all 0.2s;

&#x20;       }

&#x20;       .config-group .opt:hover {

&#x20;           background: rgba(var(--primary-rgb), 0.04);

&#x20;           border-color: rgba(var(--primary-rgb), 0.15);

&#x20;       }

&#x20;       .config-group .opt.active {

&#x20;           background: rgba(var(--primary-rgb), 0.08);

&#x20;           border-color: var(--primary);

&#x20;           color: var(--primary);

&#x20;       }

&#x20;       .config-group select {

&#x20;           background: rgba(2,3,5,0.6);

&#x20;           border: 1px solid rgba(255,255,255,0.06);

&#x20;           color: var(--text-main);

&#x20;           padding: 6px 12px;

&#x20;           border-radius: 8px;

&#x20;           font-size: 12px;

&#x20;           outline: none;

&#x20;       }

&#x20;       .config-group select option { background: #0a0e17; }

&#x20;       .checkbox-group {

&#x20;           display: flex;

&#x20;           align-items: center;

&#x20;           gap: 10px;

&#x20;           font-size: 12px;

&#x20;           color: var(--text-muted);

&#x20;       }

&#x20;       .checkbox-group input\[type="checkbox"] {

&#x20;           accent-color: var(--primary);

&#x20;           width: 16px;

&#x20;           height: 16px;

&#x20;           cursor: pointer;

&#x20;       }

&#x20;       .filename-group {

&#x20;           display: flex;

&#x20;           flex-wrap: wrap;

&#x20;           gap: 6px;

&#x20;           align-items: center;

&#x20;       }

&#x20;       .filename-group .opt { font-size: 10px; padding: 3px 10px; }



&#x20;       /\* ========== RESULTADO ========== \*/

&#x20;       .result-display {

&#x20;           display: flex;

&#x20;           align-items: center;

&#x20;           justify-content: space-between;

&#x20;           flex-wrap: wrap;

&#x20;           gap: 16px;

&#x20;           padding: 16px 20px;

&#x20;           background: rgba(2,3,5,0.4);

&#x20;           border-radius: 14px;

&#x20;           border: 1px solid rgba(255,255,255,0.04);

&#x20;       }

&#x20;       .result-display .info {

&#x20;           display: flex;

&#x20;           gap: 24px;

&#x20;           font-size: 13px;

&#x20;       }

&#x20;       .result-display .info span { color: var(--text-muted); }

&#x20;       .result-display .info strong { color: var(--text-main); font-weight: 600; }

&#x20;       .btn-download {

&#x20;           background: var(--primary);

&#x20;           color: white;

&#x20;           border: none;

&#x20;           padding: 12px 32px;

&#x20;           border-radius: 12px;

&#x20;           font-weight: 700;

&#x20;           font-size: 15px;

&#x20;           cursor: pointer;

&#x20;           box-shadow: 0 4px 20px var(--primary-glow);

&#x20;           transition: all 0.3s;

&#x20;       }

&#x20;       .btn-download:hover { filter: brightness(1.1); transform: scale(1.02); }



&#x20;       /\* ========== RESPONSIVIDADE ========== \*/

&#x20;       .hamburger { display: none; }

&#x20;       @media (max-width: 1200px) {

&#x20;           .app-grid { grid-template-columns: 1fr; }

&#x20;           .config-grid { grid-template-columns: 1fr; }

&#x20;       }

&#x20;       @media (max-width: 768px) {

&#x20;           .sidebar {

&#x20;               transform: translateX(-100%);

&#x20;               width: 260px;

&#x20;           }

&#x20;           .sidebar.open { transform: translateX(0); }

&#x20;           .main-content {

&#x20;               margin-left: 0;

&#x20;               padding: 16px;

&#x20;               max-width: 100%;

&#x20;           }

&#x20;           .top-bar { justify-content: center; }

&#x20;           .hamburger {

&#x20;               display: flex !important;

&#x20;               position: fixed;

&#x20;               top: 16px;

&#x20;               left: 16px;

&#x20;               z-index: 30;

&#x20;               background: rgba(10,14,23,0.6);

&#x20;               backdrop-filter: blur(20px);

&#x20;               border: 1px solid rgba(255,255,255,0.06);

&#x20;               padding: 8px 12px;

&#x20;               border-radius: 10px;

&#x20;               color: var(--text-main);

&#x20;               cursor: pointer;

&#x20;               font-size: 20px;

&#x20;           }

&#x20;           .result-display { flex-direction: column; align-items: stretch; }

&#x20;           .result-display .info { justify-content: space-around; }

&#x20;           .theme-selector { gap: 6px; padding: 6px 10px; }

&#x20;           .theme-btn { width: 12px; height: 12px; }

&#x20;       }

&#x20;       ::-webkit-scrollbar { width: 4px; }

&#x20;       ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }

&#x20;       ::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 10px; }

&#x20;   </style>

</head>

<body class="theme-blue">



&#x20;   <!-- FUNDO -->

&#x20;   <canvas id="network-canvas"></canvas>

&#x20;   <div class="bg-glow-container"></div>



&#x20;   <!-- HAMBURGER -->

&#x20;   <button class="hamburger" onclick="toggleSidebar()">☰</button>



&#x20;   <!-- SIDEBAR -->

&#x20;   <aside class="sidebar" id="sidebar">

&#x20;       <div class="sidebar-logo">

&#x20;           <div class="icon">

&#x20;               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">

&#x20;                   <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>

&#x20;                   <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>

&#x20;               </svg>

&#x20;           </div>

&#x20;           <div class="text">

&#x20;               <h1>Link<span>Fatcher</span></h1>

&#x20;               <p>Media Downloader</p>

&#x20;           </div>

&#x20;       </div>

&#x20;       <nav class="sidebar-nav">

&#x20;           <a href="#" class="nav-item active">

&#x20;               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>

&#x20;               Analisar Link

&#x20;               <small>⚡</small>

&#x20;           </a>

&#x20;           <a href="#" class="nav-item">

&#x20;               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>

&#x20;               Busca Online

&#x20;               <small>🔍</small>

&#x20;           </a>

&#x20;           <a href="#" class="nav-item">

&#x20;               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>

&#x20;               Downloads

&#x20;               <small>📥</small>

&#x20;           </a>

&#x20;           <a href="#" class="nav-item">

&#x20;               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>

&#x20;               Favoritos

&#x20;               <small>⭐</small>

&#x20;           </a>

&#x20;           <a href="#" class="nav-item">

&#x20;               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>

&#x20;               Baixar Depois

&#x20;               <small>⏰</small>

&#x20;           </a>

&#x20;           <a href="#" class="nav-item">

&#x20;               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>

&#x20;               Configurações

&#x20;               <small>⚙️</small>

&#x20;           </a>

&#x20;       </nav>

&#x20;       <div class="sidebar-footer">

&#x20;           <div class="status"><span class="dot"></span><span>Motor Ativo</span></div>

&#x20;           <span class="version">Versão 2.4.0 (Pro)</span>

&#x20;       </div>

&#x20;   </aside>



&#x20;   <!-- CONTEÚDO PRINCIPAL -->

&#x20;   <main class="main-content">

&#x20;       <div class="top-bar">

&#x20;           <div class="theme-selector">

&#x20;               <button class="theme-btn btn-red" onclick="changeTheme('red', this)" title="Vermelho"></button>

&#x20;               <button class="theme-btn btn-green" onclick="changeTheme('green', this)" title="Verde"></button>

&#x20;               <button class="theme-btn btn-blue active" onclick="changeTheme('blue', this)" title="Azul"></button>

&#x20;               <button class="theme-btn btn-purple" onclick="changeTheme('purple', this)" title="Roxo"></button>

&#x20;               <button class="theme-btn btn-orange" onclick="changeTheme('orange', this)" title="Laranja"></button>

&#x20;               <button class="theme-btn btn-pink" onclick="changeTheme('pink', this)" title="Rosa"></button>

&#x20;               <button class="theme-btn btn-yellow" onclick="changeTheme('yellow', this)" title="Amarelo"></button>

&#x20;               <button class="theme-btn btn-cyan" onclick="changeTheme('cyan', this)" title="Ciano"></button>

&#x20;           </div>

&#x20;       </div>



&#x20;       <div class="app-grid">

&#x20;           <!-- COLUNA 1: ANALISAR LINK -->

&#x20;           <div class="card">

&#x20;               <div class="section-title">📎 Analisar Link</div>

&#x20;               <div class="input-group">

&#x20;                   <input type="text" placeholder="Cole o link aqui..." value="https://www.youtube.com/watch?v=lvNmf5VxlfA">

&#x20;                   <button class="btn-primary">Analisar</button>

&#x20;               </div>

&#x20;               <div class="platform-tags">

&#x20;                   <span class="platform-tag active"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> YouTube</span>

&#x20;                   <span class="platform-tag">Kick</span>

&#x20;                   <span class="platform-tag">Vimeo</span>

&#x20;                   <span class="platform-tag">Pinterest</span>

&#x20;                   <span class="platform-tag">LinkedIn</span>

&#x20;                   <span class="platform-tag">GitHub</span>

&#x20;                   <span class="platform-tag">Patreon</span>

&#x20;                   <span class="platform-tag">Telegram</span>

&#x20;               </div>

&#x20;               <div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 20px;">

&#x20;                   <div class="video-info">

&#x20;                       <div class="video-title">What If Every Doorway Opened Into a Different Realm? | 4K Celestial Fantasy \& Serenity Music</div>

&#x20;                       <div class="video-author">Clever Spaces Girl</div>

&#x20;                       <div class="video-meta">

&#x20;                           <span>👁️ 3.666</span>

&#x20;                           <span>📅 14/07/2026</span>

&#x20;                           <span>📁 31 formatos</span>

&#x20;                           <span>⏱️ 2:05:05</span>

&#x20;                       </div>

&#x20;                       <div class="video-actions">

&#x20;                           <button class="btn-outline primary">⭐ Favoritar</button>

&#x20;                           <button class="btn-outline">⏰ Baixar Depois</button>

&#x20;                           <button class="btn-outline">🖼️ Baixar Capa</button>

&#x20;                           <button class="btn-outline">🔗 Link Original</button>

&#x20;                       </div>

&#x20;                   </div>

&#x20;               </div>

&#x20;           </div>



&#x20;           <!-- COLUNA 2: CONFIGURAÇÕES -->

&#x20;           <div class="card">

&#x20;               <div class="section-title">⚙️ Configurações de Download</div>

&#x20;               <div class="config-grid">

&#x20;                   <div class="config-group">

&#x20;                       <label>Nome do Arquivo</label>

&#x20;                       <div class="filename-group">

&#x20;                           <span class="opt active">Título</span>

&#x20;                           <span class="opt">Canal</span>

&#x20;                           <span class="opt">Data</span>

&#x20;                           <span class="opt">Duração</span>

&#x20;                           <span class="opt">Sem Espaço</span>

&#x20;                           <span class="opt">Nome Limpo</span>

&#x20;                       </div>

&#x20;                   </div>

&#x20;                   <div class="config-group">

&#x20;                       <label>Resolução</label>

&#x20;                       <div class="options">

&#x20;                           <span class="opt active">Melhor</span>

&#x20;                           <span class="opt">4K Ultra</span>

&#x20;                           <span class="opt">1440 QHD</span>

&#x20;                           <span class="opt">1080 Full HD</span>

&#x20;                           <span class="opt">720 HD</span>

&#x20;                           <span class="opt">480 SD</span>

&#x20;                           <span class="opt">360 Baixa</span>

&#x20;                       </div>

&#x20;                       <span style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">Este vídeo está disponível até 3840p.</span>

&#x20;                   </div>

&#x20;                   <div class="config-group">

&#x20;                       <label>Formatos</label>

&#x20;                       <div class="options">

&#x20;                           <span class="opt active">MP4</span>

&#x20;                           <span class="opt">MKV</span>

&#x20;                           <span class="opt">WEBM</span>

&#x20;                           <span class="opt">AVI</span>

&#x20;                           <span class="opt">FLV</span>

&#x20;                           <span class="opt">MOV</span>

&#x20;                           <span class="opt">TS</span>

&#x20;                       </div>

&#x20;                   </div>

&#x20;                   <div class="config-group">

&#x20;                       <label>Código de Vídeo</label>

&#x20;                       <div class="options">

&#x20;                           <span class="opt active">Auto</span>

&#x20;                           <span class="opt">H.264</span>

&#x20;                           <span class="opt">H.265</span>

&#x20;                           <span class="opt">VP9</span>

&#x20;                           <span class="opt">AV1</span>

&#x20;                       </div>

&#x20;                   </div>

&#x20;                   <div class="config-group">

&#x20;                       <label>Áudio</label>

&#x20;                       <div class="checkbox-group">

&#x20;                           <input type="checkbox" id="extract-audio">

&#x20;                           <label for="extract-audio">Extrair apenas áudio</label>

&#x20;                       </div>

&#x20;                       <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">

&#x20;                           <select><option>MP3</option><option>AAC</option><option>M4A</option><option>FLAC</option><option>OPUS</option></select>

&#x20;                           <select><option>Melhor</option><option>320 kbps</option><option>256 kbps</option><option>192 kbps</option><option>128 kbps</option><option>64 kbps</option></select>

&#x20;                       </div>

&#x20;                   </div>

&#x20;                   <div class="config-group">

&#x20;                       <label>Legendas</label>

&#x20;                       <div class="checkbox-group">

&#x20;                           <input type="checkbox" id="subtitles" checked>

&#x20;                           <label for="subtitles">Baixar legendas</label>

&#x20;                       </div>

&#x20;                       <span style="font-size: 10px; color: var(--text-muted);">Baixar e opcionalmente embutir</span>

&#x20;                   </div>

&#x20;               </div>

&#x20;           </div>



&#x20;           <!-- RESULTADO -->

&#x20;           <div class="card full-width">

&#x20;               <div class="section-title">📊 Resultado</div>

&#x20;               <div class="result-display">

&#x20;                   <div class="info">

&#x20;                       <span>Resolução: <strong>3840×2160</strong></span>

&#x20;                       <span>Duração: <strong>2:05:05</strong></span>

&#x20;                       <span>Formato: <strong>MP4</strong></span>

&#x20;                       <span>Tamanho: <strong>\~4.2 GB</strong></span>

&#x20;                   </div>

&#x20;                   <button class="btn-download">⬇ Baixar</button>

&#x20;               </div>

&#x20;           </div>

&#x20;       </div>

&#x20;   </main>



&#x20;   <script>

&#x20;       // =============================================

&#x20;       // 1. REDE NEURAL (background)

&#x20;       // =============================================

&#x20;       const canvas = document.getElementById('network-canvas');

&#x20;       const ctx = canvas.getContext('2d');

&#x20;       let w, h;



&#x20;       function resize() {

&#x20;           w = canvas.width = window.innerWidth;

&#x20;           h = canvas.height = window.innerHeight;

&#x20;       }

&#x20;       window.addEventListener('resize', resize);

&#x20;       resize();



&#x20;       const colors = \[

&#x20;           { rgb: "255, 59, 48", r: 255, g: 59, b: 48 },

&#x20;           { rgb: "48, 209, 88", r: 48, g: 209, b: 88 },

&#x20;           { rgb: "0, 118, 255", r: 0, g: 118, b: 255 }

&#x20;       ];



&#x20;       const nodes = \[...Array(140)].map(() => {

&#x20;           const c = colors\[Math.floor(Math.random() \* colors.length)];

&#x20;           return {

&#x20;               x: Math.random() \* w,

&#x20;               y: Math.random() \* h,

&#x20;               vx: (Math.random() - .5) \* 0.95,

&#x20;               vy: (Math.random() - .5) \* 0.95,

&#x20;               color: c,

&#x20;               size: Math.random() \* 2 + 2.5

&#x20;           };

&#x20;       });



&#x20;       function animateNetwork() {

&#x20;           ctx.fillStyle = 'rgba(3, 4, 6, 1)';

&#x20;           ctx.fillRect(0, 0, w, h);



&#x20;           for (const n of nodes) {

&#x20;               n.x += n.vx;

&#x20;               n.y += n.vy;

&#x20;               if (n.x < 0 || n.x > w) n.vx \*= -1;

&#x20;               if (n.y < 0 || n.y > h) n.vy \*= -1;

&#x20;           }



&#x20;           for (let i = 0; i < nodes.length; i++) {

&#x20;               for (let j = i + 1; j < nodes.length; j++) {

&#x20;                   const a = nodes\[i], b = nodes\[j];

&#x20;                   const dx = a.x - b.x, dy = a.y - b.y;

&#x20;                   const d = Math.hypot(dx, dy);

&#x20;                   if (d < 125) {

&#x20;                       const mixR = Math.round((a.color.r + b.color.r) / 2);

&#x20;                       const mixG = Math.round((a.color.g + b.color.g) / 2);

&#x20;                       const mixB = Math.round((a.color.b + b.color.b) / 2);

&#x20;                       const alpha = (1 - d / 125) \* 0.75;

&#x20;                       ctx.strokeStyle = `rgba(${mixR}, ${mixG}, ${mixB}, ${alpha})`;

&#x20;                       ctx.lineWidth = 1.2;

&#x20;                       ctx.beginPath();

&#x20;                       ctx.moveTo(a.x, a.y);

&#x20;                       ctx.lineTo(b.x, b.y);

&#x20;                       ctx.stroke();

&#x20;                   }

&#x20;               }

&#x20;           }



&#x20;           for (const n of nodes) {

&#x20;               ctx.fillStyle = `rgb(${n.color.rgb})`;

&#x20;               ctx.beginPath();

&#x20;               ctx.arc(n.x, n.y, n.size, 0, Math.PI \* 2);

&#x20;               ctx.fill();

&#x20;               ctx.shadowColor = `rgb(${n.color.rgb})`;

&#x20;               ctx.shadowBlur = 10;

&#x20;               ctx.beginPath();

&#x20;               ctx.arc(n.x, n.y, n.size \* 0.7, 0, Math.PI \* 2);

&#x20;               ctx.fill();

&#x20;               ctx.shadowBlur = 0;

&#x20;           }

&#x20;           requestAnimationFrame(animateNetwork);

&#x20;       }

&#x20;       animateNetwork();



&#x20;       // =============================================

&#x20;       // 2. TEMA DINÂMICO (8 cores)

&#x20;       // =============================================

&#x20;       function changeTheme(themeName, element) {

&#x20;           document.body.className = '';

&#x20;           document.body.classList.add('theme-' + themeName);

&#x20;           document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));

&#x20;           element.classList.add('active');

&#x20;       }



&#x20;       // =============================================

&#x20;       // 3. MOBILE SIDEBAR

&#x20;       // =============================================

&#x20;       function toggleSidebar() {

&#x20;           document.getElementById('sidebar').classList.toggle('open');

&#x20;       }



&#x20;       document.addEventListener('click', function(e) {

&#x20;           const sidebar = document.getElementById('sidebar');

&#x20;           const hamburger = document.querySelector('.hamburger');

&#x20;           if (window.innerWidth <= 768) {

&#x20;               if (!sidebar.contains(e.target) \&\& !hamburger.contains(e.target)) {

&#x20;                   sidebar.classList.remove('open');

&#x20;               }

&#x20;           }

&#x20;       });



&#x20;       // =============================================

&#x20;       // 4. INTERATIVIDADE (opções e tags)

&#x20;       // =============================================

&#x20;       document.querySelectorAll('.opt, .platform-tag').forEach(el => {

&#x20;           el.addEventListener('click', function() {

&#x20;               const parent = this.closest('.options') || this.closest('.platform-tags') || this.closest('.filename-group');

&#x20;               if (parent) {

&#x20;                   parent.querySelectorAll('.opt, .platform-tag').forEach(btn => btn.classList.remove('active'));

&#x20;                   this.classList.add('active');

&#x20;               } else {

&#x20;                   this.classList.toggle('active');

&#x20;               }

&#x20;           });

&#x20;       });

&#x20;   </script>

</body>

</html>

