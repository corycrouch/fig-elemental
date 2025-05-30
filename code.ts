// Elemental Plugin - Advanced Figma Tools
// This plugin provides various tools for export, color copying, and text utilities

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// Show the UI panel
figma.showUI(__html__, { width: 320, height: 500 });

// Helper function to convert RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (value: number) => {
    const hex = Math.round(value * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Helper function to convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

// Function to get color from a fill
function getColorFromFill(fill: any): { hex: string, hsl: string, rgb: string } | null {
  if (fill.type === 'SOLID' && fill.color) {
    const { r, g, b } = fill.color;
    return {
      hex: rgbToHex(r, g, b),
      hsl: rgbToHsl(r, g, b),
      rgb: `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
    };
  }
  return null;
}

// Function to analyze current selection
function analyzeSelection() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    return { hasSelection: false };
  }

  const node = selection[0]; // For now, analyze first selected node
  const analysis: any = {
    hasSelection: true,
    selectionCount: selection.length,
    nodeType: node.type,
    hasFill: false,
    hasStroke: false,
    hasText: false,
    fillColors: [],
    strokeColors: []
  };

  // Check for fills
  if ('fills' in node && node.fills && Array.isArray(node.fills)) {
    const solidFills = node.fills.filter((fill: any) => fill.type === 'SOLID');
    if (solidFills.length > 0) {
      analysis.hasFill = true;
      analysis.fillColors = solidFills.map((fill: any) => getColorFromFill(fill)).filter(Boolean);
    }
  }

  // Check for strokes
  if ('strokes' in node && node.strokes && Array.isArray(node.strokes)) {
    const solidStrokes = node.strokes.filter((stroke: any) => stroke.type === 'SOLID');
    if (solidStrokes.length > 0) {
      analysis.hasStroke = true;
      analysis.strokeColors = solidStrokes.map((stroke: any) => getColorFromFill(stroke)).filter(Boolean);
    }
  }

  // Check for text
  if (node.type === 'TEXT') {
    analysis.hasText = true;
    analysis.textContent = (node as TextNode).characters;
  }

  return analysis;
}

// Send initial selection data to UI
figma.ui.postMessage({ type: 'selection-changed', data: analyzeSelection() });

// Listen for selection changes
figma.on('selectionchange', () => {
  figma.ui.postMessage({ type: 'selection-changed', data: analyzeSelection() });
});

// Handle messages from UI
figma.ui.onmessage = (msg: any) => {
  switch (msg.type) {
    case 'copy-fill-color':
      const selection = figma.currentPage.selection;
      if (selection.length > 0) {
        const node = selection[0];
        if ('fills' in node && node.fills && Array.isArray(node.fills)) {
          const solidFill = node.fills.find((fill: any) => fill.type === 'SOLID');
          if (solidFill) {
            const colorData = getColorFromFill(solidFill);
            if (colorData) {
              const format = msg.format || 'hex';
              const colorValue = colorData[format as keyof typeof colorData];
              figma.ui.postMessage({ type: 'copy-to-clipboard', value: colorValue });
            }
          }
        }
      }
      break;

    case 'close-plugin':
      figma.closePlugin();
      break;
  }
};
