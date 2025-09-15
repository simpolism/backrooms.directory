export function generateDistinctColors() {
  let hue = 0;
  const goldenRatioConjugate = 0.618033988749895;

  return {
    next: () => {
      hue += goldenRatioConjugate;
      hue %= 1;
      const rgb = hsvToRgb(hue, 0.95, 0.95);
      return rgb;
    },
  };
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  let r: number, g: number, b: number;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
    default:
      r = 0;
      g = 0;
      b = 0;
  }

  return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
}

export function getRgbColor(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function formatTimestamp(): string {
  const now = new Date();
  return now
    .toISOString()
    .replace(/T/, '_')
    .replace(/\..+/, '')
    .replace(/:/g, '');
}

export function formatLogFilename(models: string[], template: string): string {
  const timestamp = formatTimestamp();
  return `${models.join('_')}_${template}_${timestamp}.txt`;
}

export function saveToLocalStorage(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving to local storage: ${error}`);
  }
}

export function loadFromLocalStorage(
  key: string,
  defaultValue: any = null
): any {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (error) {
    console.error(`Error loading from local storage: ${error}`);
    return defaultValue;
  }
}

export function getModelDisplayName(
  model: string,
  modelIndex: number,
  modelInfo: any
): string {
  if (modelInfo.is_custom_selector) {
    const savedModel = loadFromLocalStorage(
      `openrouter_custom_model_${modelIndex}`,
      null
    );
    if (savedModel) {
      try {
        const savedModelData = JSON.parse(savedModel);
        if (savedModelData.name) {
          // Remove the "Provider: " prefix if it exists
          const name = savedModelData.name;
          const colonIndex = name.indexOf(': ');
          return colonIndex >= 0 ? name.substring(colonIndex + 2) : name;
        }
      } catch (e) {
        console.error('Error parsing saved model:', e);
      }
    }
    return 'OpenRouter Custom';
  }
  return modelInfo.display_name;
}
