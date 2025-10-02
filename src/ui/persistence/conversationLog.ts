export interface ConversationLogEntry {
  actor: string;
  timestamp?: string;
  content: string;
}

const CONVERSATION_HEADER_REGEX = /^###\s+(.*?)\s+\[(.*?)\]\s+###$/;

export function parseConversationLog(text: string): ConversationLogEntry[] {
  const entries: ConversationLogEntry[] = [];
  const messageRegex =
    /###\s+(.*?)\s+\[(.*?)\]\s+###\n([\s\S]*?)(?=\n###\s|$)/g;
  let match: RegExpExecArray | null;

  while ((match = messageRegex.exec(text)) !== null) {
    const actor = match[1].trim();
    const timestamp = match[2].trim();
    const content = match[3].trim();

    if (actor && content) {
      entries.push({ actor, timestamp, content });
    }
  }

  return entries;
}

export function extractConversationLogFromDom(
  container: HTMLElement
): ConversationLogEntry[] {
  const entries: ConversationLogEntry[] = [];
  const responseElements =
    container.querySelectorAll<HTMLElement>('.actor-response');

  responseElements.forEach((element) => {
    const headerText = element
      .querySelector('.actor-header')
      ?.textContent?.trim();
    const content = element
      .querySelector('.response-content')
      ?.textContent?.trim();

    if (!headerText || !content) {
      return;
    }

    const headerMatch = headerText.match(CONVERSATION_HEADER_REGEX);
    if (headerMatch) {
      entries.push({
        actor: headerMatch[1],
        timestamp: headerMatch[2],
        content,
      });
    } else {
      entries.push({
        actor: headerText.replace(/^###\s+|\s+###$/g, ''),
        content,
      });
    }
  });

  return entries;
}

export function formatConversationLog(entries: ConversationLogEntry[]): string {
  return entries
    .map((entry) => {
      const header = entry.timestamp
        ? `### ${entry.actor} [${entry.timestamp}] ###`
        : `### ${entry.actor} ###`;
      return `${header}\n${entry.content}\n`;
    })
    .join('\n');
}
