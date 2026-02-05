# Lumina Recorder

Uma aplicação web especializada para criar loops de vídeo distorcidos e "frame-perfect" para projeção mapeada.

![Lumina Recorder](../media/recorder-ui.png)

## Visão Geral

O Lumina Recorder foi projetado para resolver o desafio de preparar conteúdo para superfícies de projeção físicas (como paredes curvas ou características arquitetônicas específicas) sem a necessidade de softwares de mapping complexos durante a reprodução. Ele permite que você:

1.  **Carregue** um loop de vídeo padrão.
2.  **Distorça (Warp)** usando uma malha Bezier/Quad para ajustar à sua superfície física.
3.  **Grave** a saída pré-distorcida como um novo arquivo de vídeo.
4.  **Reproduza** o arquivo resultante em qualquer player de média padrão (VLC, QuickTime, BrightSign, etc.) e ele se alinhará perfeitamente com sua projeção.

## Funcionalidades

-   **Carregamento Drag & Drop**: Suporta formatos MP4, WebM e MOV.
-   **Engine de Warping Avançada**:
    -   Resoluções de Grid 2x2 (Corner Pin), 3x3 (Bezier) ou Customizadas.
    -   Distorção WebGL em tempo real usando `three.js`.
    -   Interpolação Bicúbica para curvas suaves.
-   **Gravação Frame-Perfect**:
    -   Sincroniza automaticamente o início/fim da gravação com a reprodução do vídeo.
    -   Captura a duração exata para garantir loops contínuos (seamless).
    -   Grava a 60 FPS (dependente de hardware).
-   **Conversão Inteligente**:
    -   Grava streams brutos de alta qualidade (WebM/VP9).
    -   **Auto-Converte para MP4 (H.264)** usando FFmpeg no navegador (WASM) para máxima compatibilidade.
    -   Fallback gracioso para WebM caso limites de memória sejam atingidos.

## Tecnologias

-   **Framework**: React 19 + Vite
-   **Linguagem**: TypeScript
-   **Gráficos**: Three.js + React Three Fiber
-   **Estilo**: TailwindCSS
-   **Processamento de Vídeo**:
    -   `MediaRecorder` API (Captura)
    -   `@ffmpeg/ffmpeg` (Conversão WASM)

## Começando

### Pré-requisitos

-   Node.js (v18 ou superior)
-   npm

### Instalação

1.  Navegue até o diretório do projeto:
    ```bash
    cd LuminaRecorder
    ```
2.  Instale as dependências:
    ```bash
    npm install
    ```

### Rodando Localmente

 Inicie o servidor de desenvolvimento:
 ```bash
 npm run dev
 ```
 Abra `http://localhost:5173` no seu navegador (Google Chrome é recomendado para melhor suporte ao `MediaRecorder`).

### Build para Produção

Para criar um build estático:
```bash
npm run build
```
Os arquivos gerados estarão na pasta `dist/`.

## Fluxo de Trabalho

1.  **Carregar Vídeo**: Arraste seu arquivo de vídeo fonte.
2.  **Ajustar Distorção**: Use os pontos de controle para mapear o vídeo na superfície física. Clique duplo em um ponto para resetá-lo.
3.  **Gravar**: Clique em "Start Recording". O app tocará o vídeo uma vez e capturará a saída automaticamente.
4.  **Salvar**: Baixe o arquivo `.mp4` final.
