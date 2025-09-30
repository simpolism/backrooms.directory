import { ConversationUsage, UsageData } from '../../types';

export interface UsageElements {
  usageStats: HTMLDivElement;
  totalInputTokens: HTMLSpanElement;
  totalOutputTokens: HTMLSpanElement;
  totalTokens: HTMLSpanElement;
  totalCost: HTMLSpanElement;
  usageBreakdown: HTMLDivElement;
}

export interface UsageController {
  reset(): void;
  track(modelDisplayName: string, usage: UsageData): void;
  getUsage(): ConversationUsage;
}

export function createUsageController(
  elements: UsageElements
): UsageController {
  let usage: ConversationUsage = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    modelBreakdown: {},
  };

  function render(): void {
    const { totalInputTokens, totalOutputTokens, totalTokens, totalCost } = usage;
    elements.totalInputTokens.textContent = totalInputTokens.toLocaleString();
    elements.totalOutputTokens.textContent = totalOutputTokens.toLocaleString();
    elements.totalTokens.textContent = totalTokens.toLocaleString();
    elements.totalCost.textContent = totalCost.toFixed(4);

    const breakdownEntries = Object.entries(usage.modelBreakdown);
    if (breakdownEntries.length === 0) {
      elements.usageBreakdown.textContent = 'No usage recorded yet.';
      return;
    }

    const breakdownList = document.createElement('ul');
    breakdownList.className = 'usage-breakdown-list';

    breakdownEntries.forEach(([model, data]) => {
      const item = document.createElement('li');
      const description = [
        `${model}:`,
        `${data.promptTokens} prompt`,
        `${data.completionTokens} completion`,
        `${data.totalTokens} total`,
      ];

      if (data.cost !== undefined) {
        description.push(`$${data.cost.toFixed(4)}`);
      }

      item.textContent = description.join(' | ');
      breakdownList.appendChild(item);
    });

    elements.usageBreakdown.innerHTML = '';
    elements.usageBreakdown.appendChild(breakdownList);
  }

  return {
    reset() {
      usage = {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        modelBreakdown: {},
      };
      render();
    },
    track(modelDisplayName: string, data: UsageData) {
      usage.totalInputTokens += data.promptTokens;
      usage.totalOutputTokens += data.completionTokens;
      usage.totalTokens += data.totalTokens;
      if (data.cost) {
        usage.totalCost += data.cost;
      }

      usage.modelBreakdown[modelDisplayName] = {
        promptTokens:
          (usage.modelBreakdown[modelDisplayName]?.promptTokens || 0) +
          data.promptTokens,
        completionTokens:
          (usage.modelBreakdown[modelDisplayName]?.completionTokens || 0) +
          data.completionTokens,
        totalTokens:
          (usage.modelBreakdown[modelDisplayName]?.totalTokens || 0) +
          data.totalTokens,
        cost:
          data.cost !== undefined
            ? (usage.modelBreakdown[modelDisplayName]?.cost || 0) + data.cost
            : usage.modelBreakdown[modelDisplayName]?.cost,
      };

      render();
    },
    getUsage() {
      return {
        totalInputTokens: usage.totalInputTokens,
        totalOutputTokens: usage.totalOutputTokens,
        totalTokens: usage.totalTokens,
        totalCost: usage.totalCost,
        modelBreakdown: { ...usage.modelBreakdown },
      };
    },
  };
}
