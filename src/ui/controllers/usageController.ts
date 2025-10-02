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
    elements.usageBreakdown.innerHTML = '';
    if (breakdownEntries.length === 0) {
      elements.usageBreakdown.textContent = 'No usage recorded yet.';
      return;
    }

    breakdownEntries.forEach(([model, data]) => {
      const modelContainer = document.createElement('div');
      modelContainer.className = 'model-usage';

      const nameContainer = document.createElement('div');
      nameContainer.className = 'model-name';
      nameContainer.textContent = model;

      const statsContainer = document.createElement('div');
      statsContainer.className = 'model-stats';

      const createStat = (label: string, value: string): HTMLDivElement => {
        const stat = document.createElement('div');
        stat.className = 'model-stat';

        const statLabel = document.createElement('div');
        statLabel.className = 'model-stat-label';
        statLabel.textContent = label;

        const statValue = document.createElement('div');
        statValue.className = 'model-stat-value';
        statValue.textContent = value;

        stat.appendChild(statLabel);
        stat.appendChild(statValue);

        return stat;
      };

      statsContainer.appendChild(
        createStat('Input', data.promptTokens.toLocaleString())
      );
      statsContainer.appendChild(
        createStat('Output', data.completionTokens.toLocaleString())
      );
      statsContainer.appendChild(
        createStat('Total', data.totalTokens.toLocaleString())
      );

      if (data.cost !== undefined) {
        statsContainer.appendChild(
          createStat('Cost', `$${data.cost.toFixed(4)}`)
        );
      }

      modelContainer.appendChild(nameContainer);
      modelContainer.appendChild(statsContainer);

      elements.usageBreakdown.appendChild(modelContainer);
    });
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
