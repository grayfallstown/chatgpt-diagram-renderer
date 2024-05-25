import plantumlEncoder from 'plantuml-encoder';
import _ from 'lodash';
import pako from 'pako';

////////////////////////////////////////////////////////////////////////////////////////////////////
// General Functionality
////////////////////////////////////////////////////////////////////////////////////////////////////

const supportedFormats = {
  "language-plantuml": { endpoint: "plantuml", png: true },
  "language-mermaid": { endpoint: "mermaid", png: true },
  "language-blockdiag": { endpoint: "blockdiag", png: true },
  "language-seqdiag": { endpoint: "seqdiag", png: true },
  "language-actdiag": { endpoint: "actdiag", png: true },
  "language-nwdiag": { endpoint: "nwdiag", png: true },
  "language-packetdiag": { endpoint: "packetdiag", png: true },
  "language-rackdiag": { endpoint: "rackdiag", png: true },
  "language-c4plantuml": { endpoint: "c4plantuml", png: true },
  "language-d2": { endpoint: "d2", png: false },
  "language-dbml": { endpoint: "dbml", png: false },
  "language-ditaa": { endpoint: "ditaa", png: true },
  "language-erd": { endpoint: "erd", png: true },
  "language-excalidraw": { endpoint: "excalidraw", png: false },
  "language-graphviz": { endpoint: "graphviz", png: true },
  "language-nomnoml": { endpoint: "nomnoml", png: false },
  "language-pikchr": { endpoint: "pikchr", png: false },
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

// Logging function
function log(message) {
  console.log(`[ChatGPT Diagram Renderer] ${message}`);
}

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
      display: none;
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

// Throttled function to handle mutations
const handleMutationsThrottled = _.throttle(handleMutations, 200);

// Initialize MutationObserver
const observer = new MutationObserver(handleMutationsThrottled);
observer.observe(document.body, { childList: true, subtree: true });

log('content.js running');

// Handle DOM mutations
function handleMutations(mutationsList) {
  try {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processNode(node);
          }
        });
      }
    }
  } catch (error) {
    log(`Error processing mutations: ${error.message}`);
  }
}

// Process added nodes
function processNode(node) {
  Object.keys(supportedFormats).forEach(format => {
    if (node.matches && node.matches(`code.${format}`)) {
      processDiagram(node, format);
    }

    node.querySelectorAll(`code.${format}`).forEach(childNode => {
      processDiagram(childNode, format);
    });
  });
}

// Open modal with larger image
function openModal(event) {
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'chatgpt-diagram-renderer-modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'chatgpt-diagram-renderer-modal-content';

  const modalImage = document.createElement('img');
  modalImage.src = event.target.src;
  modalImage.className = 'chatgpt-diagram-renderer-modal-image';

  modal.appendChild(modalImage);
  modalBackdrop.appendChild(modal);
  document.body.appendChild(modalBackdrop);

  modalBackdrop.addEventListener('click', () => {
    document.body.removeChild(modalBackdrop);
  });
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Diagram Processing Functionality
////////////////////////////////////////////////////////////////////////////////////////////////////

// Process diagram nodes
function processDiagram(node, format) {
  try {
    const diagramCode = node.textContent.trim();
    const { endpoint, png } = supportedFormats[format];
    const imageUrl = `https://kroki.io/${endpoint}/${png ? 'png' : 'svg'}/${encodeDiagramCode(diagramCode)}`;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'chatgpt-diagram-renderer-image';

    img.onload = () => {
      const originalWidth = img.naturalWidth;
      const maxWidth = originalWidth * 1.75;
      img.style.maxWidth = `${maxWidth}px`;
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
    };

    img.onerror = () => {
      log(`Error loading image: ${imageUrl}`);
    };

    img.addEventListener('click', openModal);

    if (!node.classList.contains('chatgpt-diagram-renderer-processed')) {
      node.classList.add('chatgpt-diagram-renderer-processed');
      node.parentNode.insertBefore(img, node);
    }
  } catch (error) {
    log(`Error processing diagram for ${format}: ${error.message}`);
  }
}

// Function to encode diagram code for URL
function encodeDiagramCode(diagramCode) {
  const compressed = pako.deflate(diagramCode, { level: 9 });
  const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(compressed)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Apply initial styles and start observing
applyDarkModeStyles();
document.querySelectorAll('code').forEach(node => {
  processNode(node);
});
