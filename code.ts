// Elemental Plugin - Productivity Figma Tools
// This plugin provides various tools for export, color copying, and text utilities

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// Settings keys for persistence
const SETTINGS_KEYS = {
  SCALE: 'elemental_scale',
  FORMAT: 'elemental_format',
  FILL_FORMAT: 'elemental_fill_format',
  STROKE_FORMAT: 'elemental_stroke_format'
};

// Default settings
const DEFAULT_SETTINGS = {
  scale: 2,
  format: 'PNG',
  fillFormat: 'hex',
  strokeFormat: 'hex'
};

// Global settings cache
let currentSettings = { ...DEFAULT_SETTINGS };

// Load settings from client storage
async function loadSettings() {
  try {
    const scale = await figma.clientStorage.getAsync(SETTINGS_KEYS.SCALE);
    const format = await figma.clientStorage.getAsync(SETTINGS_KEYS.FORMAT);
    const fillFormat = await figma.clientStorage.getAsync(SETTINGS_KEYS.FILL_FORMAT);
    const strokeFormat = await figma.clientStorage.getAsync(SETTINGS_KEYS.STROKE_FORMAT);
    
    currentSettings = {
      scale: scale !== undefined ? Number(scale) : DEFAULT_SETTINGS.scale,
      format: format || DEFAULT_SETTINGS.format,
      fillFormat: fillFormat || DEFAULT_SETTINGS.fillFormat,
      strokeFormat: strokeFormat || DEFAULT_SETTINGS.strokeFormat
    };
    
    console.log('Loaded settings:', currentSettings);
  } catch (error) {
    console.error('Error loading settings:', error);
    currentSettings = { ...DEFAULT_SETTINGS };
  }
}

// Save settings to client storage
async function saveSettings(settings: Partial<typeof currentSettings>) {
  try {
    // Update current settings
    currentSettings = { ...currentSettings, ...settings };
    
    // Save to storage
    if (settings.scale !== undefined) {
      await figma.clientStorage.setAsync(SETTINGS_KEYS.SCALE, settings.scale);
    }
    if (settings.format !== undefined) {
      await figma.clientStorage.setAsync(SETTINGS_KEYS.FORMAT, settings.format);
    }
    if (settings.fillFormat !== undefined) {
      await figma.clientStorage.setAsync(SETTINGS_KEYS.FILL_FORMAT, settings.fillFormat);
    }
    if (settings.strokeFormat !== undefined) {
      await figma.clientStorage.setAsync(SETTINGS_KEYS.STROKE_FORMAT, settings.strokeFormat);
    }
    
    console.log('Saved settings:', currentSettings);
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Command handler
if (figma.command) {
  handleCommand(figma.command);
} else {
  // Show UI panel by default (when opened without command)
  openPanel();
}

// Handle specific commands
async function handleCommand(command: string) {
  console.log('Handling command:', command);
  
  // Load settings first
  await loadSettings();
  
  switch (command) {
    case 'open-panel':
      openPanel();
      break;
      
    case 'quick-export':
      await quickExport();
      break;
      
    case 'quick-copy-fill':
      await quickCopyFill();
      break;
      
    case 'quick-copy-stroke':
      await quickCopyStroke();
      break;
      
    case 'quick-copy-shadow':
      await quickCopyShadow();
      break;
      
    default:
      console.log('Unknown command:', command);
      openPanel();
  }
}

// Open the main panel
function openPanel() {
  figma.showUI(__html__, { width: 240, height: 294, themeColors: true });
  
  // Set up event listeners for UI interactions
  setupUIEventListeners();
  
  // Load and send settings to UI
  loadSettings().then(() => {
    sendSettingsToUI();
    updateSelectionInfo();
    sendThemeToUI();
  });
}

// Send current settings to UI
function sendSettingsToUI() {
  figma.ui.postMessage({
    type: 'settings-loaded',
    settings: currentSettings
  });
}

// Quick export function
async function quickExport() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.notify('Please select a layer to export');
    return;
  }
  
  if (selection.length === 1) {
    await exportSelection(currentSettings.scale, currentSettings.format);
  } else {
    figma.notify(`Exporting ${selection.length} layers...`);
    await batchExportForZip(currentSettings.scale, currentSettings.format);
  }
}

// Quick copy fill function
async function quickCopyFill() {
  const selection = figma.currentPage.selection;
  
  if (selection.length !== 1) {
    figma.notify('Please select exactly one layer');
    return;
  }
  
  const node = selection[0];
  
  // Check for fills
  if (!('fills' in node) || !node.fills || !Array.isArray(node.fills)) {
    figma.notify('Selected layer has no fill');
    return;
  }
  
  const solidFills = node.fills.filter((fill: any) => fill.type === 'SOLID');
  
  if (solidFills.length === 0) {
    figma.notify('Selected layer has no solid fill');
    return;
  }
  
  if (solidFills.length > 1) {
    figma.notify('Selected layer has multiple fills - please select a layer with one fill');
    return;
  }
  
  const fill = solidFills[0];
  if (!fill.color) {
    figma.notify('Fill color not available');
    return;
  }
  
  const colorData = getColorFromFill(fill);
  if (!colorData) {
    figma.notify('Unable to extract fill color');
    return;
  }
  
  const format = currentSettings.fillFormat;
  const colorValue = colorData[format as keyof typeof colorData];
  
  // Show UI briefly to handle clipboard copy
  figma.showUI(__html__, { width: 1, height: 1, visible: false });
  
  figma.ui.postMessage({
    type: 'quick-copy-to-clipboard',
    value: colorValue,
    label: `Fill (${format})`
  });
  
  // Close UI after a short delay
  setTimeout(() => {
    figma.closePlugin();
  }, 100);
}

// Quick copy stroke function
async function quickCopyStroke() {
  const selection = figma.currentPage.selection;
  
  if (selection.length !== 1) {
    figma.notify('Please select exactly one layer');
    return;
  }
  
  const node = selection[0];
  
  // Check for strokes
  if (!('strokes' in node) || !node.strokes || !Array.isArray(node.strokes)) {
    figma.notify('Selected layer has no stroke');
    return;
  }
  
  const solidStrokes = node.strokes.filter((stroke: any) => stroke.type === 'SOLID');
  
  if (solidStrokes.length === 0) {
    figma.notify('Selected layer has no solid stroke');
    return;
  }
  
  if (solidStrokes.length > 1) {
    figma.notify('Selected layer has multiple strokes - please select a layer with one stroke');
    return;
  }
  
  const stroke = solidStrokes[0];
  if (!stroke.color) {
    figma.notify('Stroke color not available');
    return;
  }
  
  const colorData = getColorFromFill(stroke);
  if (!colorData) {
    figma.notify('Unable to extract stroke color');
    return;
  }
  
  const format = currentSettings.strokeFormat;
  const colorValue = colorData[format as keyof typeof colorData];
  
  // Show UI briefly to handle clipboard copy
  figma.showUI(__html__, { width: 1, height: 1, visible: false });
  
  figma.ui.postMessage({
    type: 'quick-copy-to-clipboard',
    value: colorValue,
    label: `Stroke (${format})`
  });
  
  // Close UI after a short delay
  setTimeout(() => {
    figma.closePlugin();
  }, 100);
}

// Quick copy shadow function
async function quickCopyShadow() {
  const selection = figma.currentPage.selection;
  
  if (selection.length !== 1) {
    figma.notify('Please select exactly one layer');
    return;
  }
  
  const node = selection[0];
  
  // Check for shadow effects
  if (!('effects' in node) || !node.effects || !Array.isArray(node.effects)) {
    figma.notify('Selected layer has no effects');
    return;
  }
  
  const shadowEffects = node.effects.filter((effect: any) => 
    (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') && 
    effect.visible !== false && 
    effect.color
  );
  
  if (shadowEffects.length === 0) {
    figma.notify('Selected layer has no visible shadows');
    return;
  }
  
  // Convert shadows to CSS format
  const shadows = shadowEffects.map((shadowEffect: any) => {
    const { r, g, b } = shadowEffect.color;
    const x = shadowEffect.offset?.x || 0;
    const y = shadowEffect.offset?.y || 0;
    const blur = shadowEffect.radius || 0;
    const spread = shadowEffect.spread || 0;
    
    const color = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${shadowEffect.color.a !== undefined ? shadowEffect.color.a : 1})`;
    
    if (shadowEffect.type === 'INNER_SHADOW') {
      return `inset ${x}px ${y}px ${blur}px ${spread}px ${color}`;
    } else {
      return `${x}px ${y}px ${blur}px ${spread}px ${color}`;
    }
  });
  
  const cssValue = shadows.join(', ');
  
  // Show UI briefly to handle clipboard copy
  figma.showUI(__html__, { width: 1, height: 1, visible: false });
  
  figma.ui.postMessage({
    type: 'quick-copy-to-clipboard',
    value: cssValue,
    label: 'Shadow (CSS)'
  });
  
  // Close UI after a short delay
  setTimeout(() => {
    figma.closePlugin();
  }, 100);
}

// Show the UI panel with the new compact size
figma.showUI(__html__, { width: 240, height: 294, themeColors: true });

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

// Function to get color from a fill with CSS format support
function getColorFromFill(fill: any): { hex: string, hsl: string, rgb: string, css: string } | null {
  if (fill.type === 'SOLID' && fill.color) {
    const { r, g, b } = fill.color;
    const hex = rgbToHex(r, g, b);
    const hsl = rgbToHsl(r, g, b);
    const rgb = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
    
    return {
      hex,
      hsl,
      rgb,
      css: hex // For CSS, we'll use hex as the default
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

// Export functionality
async function exportSelection(scale: number, format: string) {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.notify('Please select a layer to export');
    return;
  }

  try {
    const nodes = selection.slice(); // Copy the selection
    let successCount = 0;
    let errorNodes: string[] = [];
    
    for (const node of nodes) {
      try {
        // Check if node can be exported
        if (!canExportNode(node)) {
          errorNodes.push(`${node.name} (${node.type})`);
          continue;
        }

        // Set export settings based on format
        let exportSetting: ExportSettings;
        
        if (format === 'SVG') {
          exportSetting = {
            format: 'SVG'
          };
        } else if (format === 'PDF') {
          exportSetting = {
            format: 'PDF'
          };
        } else {
          // PNG or JPG - properly cast the format
          const exportFormat = format.toUpperCase() as 'PNG' | 'JPG';
          exportSetting = {
            format: exportFormat,
            constraint: {
              type: 'SCALE',
              value: scale
            }
          };
        }

        // Actually perform the export
        const bytes = await node.exportAsync(exportSetting);
        
        // Create filename
        const nodeName = node.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${nodeName}_${scale}x.${format.toLowerCase()}`;
        
        // Send the file data to UI for download
        figma.ui.postMessage({
          type: 'file-ready',
          filename: filename,
          bytes: Array.from(bytes),
          format: format
        });
        
        successCount++;
        
      } catch (nodeError) {
        console.error(`Error exporting node ${node.name}:`, nodeError);
        errorNodes.push(`${node.name} (${node.type})`);
      }
    }

    // Provide detailed feedback
    if (successCount > 0) {
      figma.notify(`Exported ${successCount} file(s) successfully!`);
    }
    
    if (errorNodes.length > 0) {
      console.warn('Failed to export:', errorNodes);
      if (successCount === 0) {
        figma.notify(`Cannot export selected layer type(s). Try selecting frames, groups, or components.`);
      }
    }
    
  } catch (error) {
    console.error('Export error:', error);
    figma.notify('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Helper function to check if a node can be exported
function canExportNode(node: SceneNode): boolean {
  // These node types can typically be exported
  const exportableTypes = [
    'FRAME',
    'GROUP', 
    'COMPONENT',
    'COMPONENT_SET',
    'INSTANCE',
    'RECTANGLE',
    'ELLIPSE',
    'POLYGON',
    'STAR',
    'VECTOR',
    'TEXT',
    'LINE'
  ];
  
  return exportableTypes.includes(node.type);
}

// Batch export for zip functionality
async function batchExportForZip(scale: number, format: string) {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.notify('Please select layers to export as zip');
    return;
  }

  if (selection.length === 1) {
    figma.notify('Select multiple layers to create a zip file');
    return;
  }

  try {
    const nodes = selection.slice(); // Copy the selection
    const exportableNodes = nodes.filter(canExportNode);
    
    if (exportableNodes.length === 0) {
      figma.notify('No exportable layers selected');
      return;
    }

    // Notify UI to start collecting files for zip
    figma.ui.postMessage({
      type: 'zip-batch-start',
      expectedFiles: exportableNodes.length,
      zipName: `figma-export-${exportableNodes.length}-items.zip`
    });

    let successCount = 0;
    let errorNodes: string[] = [];
    
    for (const node of exportableNodes) {
      try {
        // Set export settings based on format
        let exportSetting: ExportSettings;
        
        if (format === 'SVG') {
          exportSetting = {
            format: 'SVG'
          };
        } else if (format === 'PDF') {
          exportSetting = {
            format: 'PDF'
          };
        } else {
          // PNG or JPG
          const exportFormat = format.toUpperCase() as 'PNG' | 'JPG';
          exportSetting = {
            format: exportFormat,
            constraint: {
              type: 'SCALE',
              value: scale
            }
          };
        }

        // Export the node
        const bytes = await node.exportAsync(exportSetting);
        
        // Create filename
        const nodeName = node.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${nodeName}_${scale}x.${format.toLowerCase()}`;
        
        // Send file data to UI for zip collection
        figma.ui.postMessage({
          type: 'zip-file-ready',
          filename: filename,
          bytes: Array.from(bytes),
          format: format
        });
        
        successCount++;
        
      } catch (nodeError) {
        console.error(`Error exporting node ${node.name}:`, nodeError);
        errorNodes.push(`${node.name} (${node.type})`);
      }
    }

    // Signal that batch export is complete
    figma.ui.postMessage({
      type: 'zip-batch-complete',
      successCount: successCount,
      errorCount: errorNodes.length
    });
    
    if (successCount > 0) {
      figma.notify(`Prepared ${successCount} files for zip download!`);
    }
    
    if (errorNodes.length > 0) {
      console.warn('Failed to export for zip:', errorNodes);
    }
    
  } catch (error) {
    console.error('Batch export error:', error);
    figma.notify('Batch export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Update selection info
function updateSelectionInfo() {
  const selection = figma.currentPage.selection;
  const selectionCount = selection.length;
  
  // Filter for exportable formats
  const formats = ['PNG', 'JPG', 'SVG', 'PDF'];
  
  // Analyze selection for color data
  let fillColor = null;
  let strokeColor = null;
  let shadow = null;
  let fillCount = 0;
  let strokeCount = 0;
  
  if (selectionCount === 1) {
    const node = selection[0];
    
    // Check for fills
    if ('fills' in node && node.fills && Array.isArray(node.fills)) {
      const solidFills = node.fills.filter((fill: any) => fill.type === 'SOLID');
      fillCount = solidFills.length;
      
      // Only provide fillColor if there's exactly one solid fill
      if (fillCount === 1) {
        const fill = solidFills[0];
        if (fill.color) {
          const { r, g, b } = fill.color;
          fillColor = {
            r: r,
            g: g, 
            b: b,
            hex: rgbToHex(r, g, b)
          };
        }
      }
    }
    
    // Check for strokes
    if ('strokes' in node && node.strokes && Array.isArray(node.strokes)) {
      const solidStrokes = node.strokes.filter((stroke: any) => stroke.type === 'SOLID');
      strokeCount = solidStrokes.length;
      
      // Only provide strokeColor if there's exactly one solid stroke
      if (strokeCount === 1) {
        const stroke = solidStrokes[0];
        if (stroke.color) {
          const { r, g, b } = stroke.color;
          strokeColor = {
            r: r,
            g: g, 
            b: b,
            hex: rgbToHex(r, g, b)
          };
        }
      }
    }
    
    // Check for shadows (effects)
    if ('effects' in node && node.effects && Array.isArray(node.effects)) {
      const shadowEffects = node.effects.filter((effect: any) => 
        effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
      );
      if (shadowEffects.length > 0) {
        // Collect all shadow effects, not just the first one
        shadow = shadowEffects
          .filter((effect: any) => effect.visible !== false && effect.color)
          .map((shadowEffect: any) => {
            const { r, g, b } = shadowEffect.color;
            return {
              x: shadowEffect.offset?.x || 0,
              y: shadowEffect.offset?.y || 0,
              blur: shadowEffect.radius || 0,
              spread: shadowEffect.spread || 0,
              color: { r, g, b },
              type: shadowEffect.type === 'INNER_SHADOW' ? 'INNER' : 'OUTER'
            };
          });
        
        // Only set shadow if we have valid shadow effects
        if (shadow.length === 0) {
          shadow = null;
        }
      }
    }
  }
  
  const messageData = {
    type: 'selection-change',
    selectionCount: selectionCount,
    formats: formats,
    fillColor: fillColor,
    strokeColor: strokeColor,
    shadow: shadow,
    fillCount: fillCount,
    strokeCount: strokeCount
  };
  
  figma.ui.postMessage(messageData);
}

// Message handler for UI communication
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'export':
      await exportSelection(msg.scale, msg.format);
      // Save scale and format settings
      await saveSettings({ scale: msg.scale, format: msg.format });
      break;
      
    case 'batch-export':
      await batchExportForZip(msg.scale, msg.format);
      // Save scale and format settings
      await saveSettings({ scale: msg.scale, format: msg.format });
      break;
      
    case 'copy-color':
      // This is handled in the UI, no backend action needed
      break;
      
    case 'get-selection':
      updateSelectionInfo();
      break;
      
    case 'save-settings':
      // Save user settings to persistence
      await saveSettings(msg.settings);
      break;
      
    case 'load-settings':
      // Load and send settings to UI
      await loadSettings();
      sendSettingsToUI();
      break;
      
    case 'quick-copy-to-clipboard':
      // Handle quick copy from commands - show notification and close
      figma.notify(`✓ Copied ${msg.label}: ${msg.value}`);
      setTimeout(() => {
        figma.closePlugin();
      }, 50);
      break;
      
    case 'get-theme':
      // Get current theme from Figma and send to UI
      const currentTheme = figma.currentUser?.color === 'DARK' ? 'dark' : 'light';
      figma.ui.postMessage({
        type: 'theme-changed',
        theme: currentTheme
      });
      break;
      
    case 'notification':
      // Handle notification requests from UI
      figma.notify(msg.message);
      break;
      
    default:
      console.log('Unknown message type:', msg.type);
  }
};

// Function to detect and send theme changes
function sendThemeToUI() {
  const currentTheme = figma.currentUser?.color === 'DARK' ? 'dark' : 'light';
  figma.ui.postMessage({
    type: 'theme-changed',
    theme: currentTheme
  });
}

// Listen for user color mode changes (when available)
// Note: Figma doesn't provide a direct theme change listener, but we can check periodically
let lastKnownTheme = figma.currentUser?.color;

// Only set up periodic theme checking and selection updates when UI is showing
function setupUIEventListeners() {
  // Update UI when selection changes
  figma.on('selectionchange', updateSelectionInfo);
  
  // Check for theme changes periodically
  const themeCheckInterval = setInterval(() => {
    const currentTheme = figma.currentUser?.color;
    if (currentTheme !== lastKnownTheme) {
      lastKnownTheme = currentTheme;
      sendThemeToUI();
    }
  }, 1000); // Check every second
  
  // Clean up interval when plugin closes
  figma.on('close', () => {
    clearInterval(themeCheckInterval);
  });
}

// Note: Event listeners are set up in openPanel() function when UI is displayed 