import _ from 'lodash';
import pako from 'pako';

////////////////////////////////////////////////////////////////////////////////////////////////////
// General Functionality
////////////////////////////////////////////////////////////////////////////////////////////////////

const supportedFormats = {
  "language-actdiag": { endpoint: "actdiag", png: true },
  "language-blockdiag": { endpoint: "blockdiag", png: true },
  "language-c4plantuml": { endpoint: "c4plantuml", png: true },
  "language-d2": { endpoint: "d2", png: false },
  "language-dbml": { endpoint: "dbml", png: false },
  "language-ditaa": { endpoint: "ditaa", png: true },
  "language-erd": { endpoint: "erd", png: true },
  "language-excalidraw": { endpoint: "excalidraw", png: false },
  "language-graphviz": { endpoint: "graphviz", png: true },
  "language-mermaid": { endpoint: "mermaid", png: true },
  "language-nomnoml": { endpoint: "nomnoml", png: false },
  "language-nwdiag": { endpoint: "nwdiag", png: true },
  "language-packetdiag": { endpoint: "packetdiag", png: true },
  "language-pikchr": { endpoint: "pikchr", png: false },
  "language-plantuml": { endpoint: "plantuml", png: true },
  "language-rackdiag": { endpoint: "rackdiag", png: true },
  "language-seqdiag": { endpoint: "seqdiag", png: true },
  "language-structurizr": { endpoint: "structurizr", png: true },
  "language-svgbob": { endpoint: "svgbob", png: false },
  "language-symbolator": { endpoint: "symbolator", png: false },
  "language-tikz": { endpoint: "tikz", png: true },
  "language-umlet": { endpoint: "umlet", png: true },
  "language-vega": { endpoint: "vega", png: true },
  "language-vegalite": { endpoint: "vegalite", png: true },
  "language-wavedrom": { endpoint: "wavedrom", png: false },
  "language-wireviz": { endpoint: "wireviz", png: true },
};

// Apply dark mode styles
function applyDarkModeStyles() {
  const style = document.createElement('style');
  style.setAttribute('data-extension', 'chatgpt-diagram-renderer');
  style.textContent = `
    @media (prefers-color-scheme: dark) {
      img.chatgpt-diagram-renderer-image,
      img.chatgpt-diagram-renderer-modal-image {
        filter: invert(1) hue-rotate(180deg);
      }
      .chatgpt-diagram-renderer-modal-backdrop {
        background-color: rgba(0, 0, 0, 0.66);
      }
      .chatgpt-diagram-renderer-modal-content {
        background-color: #333;
        color: white;
      }
    }
    @media (prefers-color-scheme: light) {
      .chatgpt-diagram-renderer-modal-backdrop {
        background-color: rgba(0, 0, 0, 0.33);
      }
      .chatgpt-diagram-renderer-modal-content {
        background-color: #f0f0f0;
        color: black;
      }
    }
    img.chatgpt-diagram-renderer-image {
      transition: width 0.2s ease-in-out;
      cursor: pointer;
    }
    .chatgpt-diagram-renderer-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .chatgpt-diagram-renderer-modal-content {
      width: 90%;
      height: 90%;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: 20px;
    }
    .chatgpt-diagram-renderer-modal-image {
      width: calc(100% - 40px);
      height: calc(100% - 40px);
      object-fit: contain;
    }
  `;
  document.head.append(style);
}

// Create modal for image zoom
function createModal(imageUrl) {
  const modal = document.createElement('div');
  modal.classList.add('chatgpt-diagram-renderer-modal-backdrop');
  modal.setAttribute('data-extension', 'chatgpt-diagram-renderer');

  const modalContent = document.createElement('div');
  modalContent.classList.add('chatgpt-diagram-renderer-modal-content');
  modalContent.setAttribute('data-extension', 'chatgpt-diagram-renderer');

  const img = document.createElement('img');
  img.src = imageUrl;
  img.classList.add('chatgpt-diagram-renderer-modal-image');
  img.setAttribute('data-extension', 'chatgpt-diagram-renderer');

  modalContent.appendChild(img);
  modal.appendChild(modalContent);

  modal.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  document.body.appendChild(modal);
}

// Function to encode diagram code for URL
function encodeDiagramCode(diagramCode) {
  const compressed = pako.deflate(diagramCode, { level: 9 });
  const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(compressed)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Process diagram nodes
function processDiagram(node, format) {
  try {
    const codeBlock = node.matches('code') ? node : node.querySelector('code');
    if (!codeBlock) {
      return;
    }
    const diagramCode = codeBlock.textContent.trim();
    const { endpoint, png } = supportedFormats[format];
    const imageUrl = `https://kroki.io/${endpoint}/${png ? 'png' : 'svg'}/${encodeDiagramCode(diagramCode)}`;

    let img = node.previousElementSibling;
    if (!img || img.tagName !== 'IMG' || !img.classList.contains('chatgpt-diagram-renderer-image')) {
      img = document.createElement('img');
      img.className = 'chatgpt-diagram-renderer-image';
      img.style.display = 'none';

      img.onload = () => {
        const originalWidth = img.naturalWidth;
        const maxWidth = originalWidth * 1.75;
        img.style.maxWidth = `${maxWidth}px`;
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
      };

      img.onerror = () => {};

      img.addEventListener('click', () => createModal(img.src));
      node.parentNode.insertBefore(img, node);
    }

    if (img.src !== imageUrl) {
      img.src = imageUrl;
    }
  } catch (error) {}
}

// Periodically check and process code blocks
function periodicCheckAndProcessCodeBlocks() {
  Object.keys(supportedFormats).forEach(format => {
    document.querySelectorAll(`code.${format}`).forEach(block => {
      let previousContent = block.textContent.trim();

      const updateFunction = () => {
        const currentContent = block.textContent.trim();
        if (currentContent !== previousContent) {
          previousContent = currentContent;
          processDiagram(block, format);
        }
      };

      processDiagram(block, format);
      const intervalId = setInterval(updateFunction, 500);

      // Stop observing after 10 seconds
      setTimeout(() => {
        clearInterval(intervalId);
      }, 10000);
    });
  });
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Wiring up
////////////////////////////////////////////////////////////////////////////////////////////////////

applyDarkModeStyles();
setInterval(periodicCheckAndProcessCodeBlocks, 3000);
