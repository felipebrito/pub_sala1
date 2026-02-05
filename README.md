# Lumina Mapper

**Software de Video Mapping Web** construído com React, Three.js e Vite.
Simula um fluxo de trabalho profissional de projeção mapeada diretamente pelo navegador.

![Lumina Mapper](https://github.com/user-attachments/assets/placeholder.png)

## Funcionalidades

- **Suporte Multi-Projetor**: Controla 3 saídas independentes de projetores (Outputs Virtuais / Canvas).
- **Warping Avançado (Distorção)**: 
  - Ajuste de cantos (Keystone) para correção de perspectiva.
  - **Interpolação de Malha de Alta Densidade (32x32)**: Utiliza matemática bicúbica para evitar distorção de textura (zig-zag / serrilhado) durante ajustes extremos.
- **Mapeamento de Entrada (Slicing)**: 
  - Recorte dinâmico da entrada de vídeo para cada projetor.
  - Selecione regiões específicas do vídeo fonte (ex: 1/3 Esquerdo, 1/3 Central) para cada saída.
  - Controles ajustáveis de X, Y, Largura e Altura.
- **Referência de Vídeo**:
  - Vídeo de fundo "Ghost" para referência (Opcional) ou modo de saída limpa.
  - Manipulação otimizada de `VideoTexture` via Three.js.
  - Gerenciamento automático de loop e autoplay.
- **Ponte LED (Serial / Adalight)**:
  - **Amostragem em Tempo Real**: Captura cores de uma linha do vídeo (1px height) diretamente do Canvas WebGL.
  - **Integração de Hardware**: Envia dados via Serial ( USB) para controladores ESP32 rodando firmware Adalight.
  - **Assistente de Firmware**: Interface integrada para gravar/flashear a ESP32 direto do navegador.

## 🎥 Lumina Recorder (Novo!)

Uma ferramenta standalone para criar loops de vídeo distorcidos para projeção.
Localizada em `./LuminaRecorder`.

- **Warping**: Ajuste fino de distorção.
- **Gravação Perfect-Loop**: Sincronia exata com o vídeo de entrada.
- **Exportação MP4**: Conversão automática para máxima compatibilidade.

[➡️ Ver Documentação do Recorder](./LuminaRecorder/README.md)

## Tecnologias Utilizadas

- **Frontend**: React 18 + TypeScript + Vite + Three.js
- **Bridge (Ponte)**: Node.js + `serialport` + `ws` (WebSockets) + `socket.io`
- **Protocolos**: Adalight (Serial), WebSocket (Binário), Socket.IO (Controle)

## Arquitetura

### `ThreeRenderer.ts`
O motor central de renderização. Substitui a manipulação DOM padrão por um contexto WebGL de alta performance.
- Gerencia 3 `Scenes` e `Renderers` Three.js paralelos.
- Implementa streaming de `VideoTexture`.
- **Lógica de Warping**: Manipula diretamente as posições dos vértices de uma `PlaneGeometry` de alta densidade (32x32). Usa `WarpMath.ts` para calcular curvas suaves entre os pontos de controle.
- **Mapeamento de Entrada**: Manipula coordenadas UV da malha para "fatiar" a textura do vídeo.
- **Amostragem de Pixel**: Captura dados RGB do canvas a 30-60 FPS para sincronização com os LEDs.

### LED Bridge (`/bridge` & `/server`)
Um serviço Node.js independente que atua como middleware entre o navegador e o hardware LED.
- **WebSocket Server**: Recebe dados binários de pixels do navegador.
- **Serial Manager**: Empacota dados no protocolo Adalight e envia via porta USB selecionada.
- **OSC/Socket Server**: Gerencia comandos de reprodução, upload de firmware e descoberta de portas.

## Como Usar (Getting Started)

1. **Instalar Dependências**
   Na raiz do projeto:
   ```bash
   npm install
   ```

2. **Rodar o Sistema Completo**
   Para iniciar Frontend + Bridge Serial + Bridge OSC com um único comando:
   ```bash
   npm start
   ```
   *Isso irá abrir o Vite (porta 5173), o Bridge Serial (porta 3002) e o Servidor OSC (porta 3001/4444)*

3. **Acessar no Navegador**
   Interaja com a interface em `http://localhost:5173`.
   
4. **Configurar LEDs**
   - Vá até a aba "LED Bridge" na lateral direita.
   - Ative o "Enable Output".
   - Se sua ESP32 não estiver configurada, clique no ícone do "Mágico" (Wizard) para gravar o firmware.

## Roadmap & Changelog

### ✅ Concluído
- [x] **Reescrita do Motor Central**: Transição para estado unificado `ProjectorConfig`.
- [x] **Modos de Warping**: Linear (Quad) e Bicúbico (Bezier).
- [x] **Protocolo LED**:
    - [x] Middleware Node.js (WebSocket para Serial/Adalight).
    - [x] Lógica de amostragem no Browser (30 FPS).
    - [x] Suporte a 120-300 LEDs.
- [x] **Assistente de Firmware**: Upload de binário para ESP32 via WebSerial/Esptool backend.
- [x] **Verificação de Hardware**: Feedback visual (LEDs piscam) após gravação.

### 🚧 Roadmap (Prioridade Atual)
- [ ] **Ferramentas de Mapeamento**:
    - [ ] **Padrões de Teste**: Grid de Alinhamento, Barras de Cor, Foco e UV Map.
    - [ ] **Crop & Mask**:
        - [ ] Ferramenta de Crop de Entrada (Input Slicing) aprimorada visualmente.
        - [ ] Sistema de Máscaras (Masking) vetorial para ocultar áreas indesejadas.
- [ ] **Edge Blending**: 
    - [ ] Interface visual para controle de Gamma e Largura do blend.
- [ ] **Grid Personalizado**: Subdivisão dinâmica da malha (subdivide & collapse).
- [ ] **Gerenciamento de Presets**: Salvar/Carregar mapas completos.

## Licença

MIT
