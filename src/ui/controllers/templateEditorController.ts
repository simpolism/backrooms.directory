import {
  getCustomTemplate,
  saveCustomTemplate,
  listCustomTemplates,
  deleteCustomTemplate,
  getAvailableTemplates,
  extractCustomTemplateId,
  buildCustomTemplateValue,
  formatCustomTemplateLabel,
} from '../../templates';
import type { CustomTemplate, CustomTemplateInput, Message } from '../../types';

type MessageRole = Message['role'];

interface MessageState {
  id: string;
  role: MessageRole;
  content: string;
}

interface TemplateSegmentState {
  id: string;
  systemPrompt: string;
  messages: MessageState[];
}

interface EditorTemplateState {
  id?: string;
  name: string;
  description: string;
  content: string;
  originalName?: string;
}

const VALID_ROLES: MessageRole[] = [
  'system',
  'user',
  'assistant',
  'developer',
  'tool',
];
const JSONL_PREVIEW_PLACEHOLDER =
  '// JSONL preview updates as you edit the template.';

function generateId(): string {
  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyMessage(role: MessageRole = 'user'): MessageState {
  return {
    id: generateId(),
    role,
    content: '',
  };
}

function createEmptySegment(): TemplateSegmentState {
  return {
    id: generateId(),
    systemPrompt: '',
    messages: [createEmptyMessage()],
  };
}

function createDefaultSegments(): TemplateSegmentState[] {
  return [createEmptySegment(), createEmptySegment()];
}

export function initializeTemplateEditor(
  templateSelect: HTMLSelectElement
): void {
  const editCurrentTemplateBtn = document.getElementById(
    'edit-current-template'
  ) as HTMLButtonElement | null;
  const importTemplateBtn = document.getElementById(
    'import-template'
  ) as HTMLButtonElement | null;
  const newCustomTemplateBtn = document.getElementById(
    'new-custom-template'
  ) as HTMLButtonElement | null;
  const templateFileInput = document.getElementById(
    'template-file-input'
  ) as HTMLInputElement | null;
  const templateEditorForm = document.getElementById(
    'template-editor-form'
  ) as HTMLDivElement | null;
  const templateEditorActions = document.getElementById(
    'template-editor-actions'
  ) as HTMLDivElement | null;
  const templateNameInput = document.getElementById(
    'template-name'
  ) as HTMLInputElement | null;
  const templateDescriptionInput = document.getElementById(
    'template-description'
  ) as HTMLInputElement | null;
  const saveTemplateBtn = document.getElementById(
    'save-template'
  ) as HTMLButtonElement | null;
  const exportTemplateBtn = document.getElementById(
    'export-template'
  ) as HTMLButtonElement | null;
  const cancelEditBtn = document.getElementById(
    'cancel-edit'
  ) as HTMLButtonElement | null;
  const customTemplatesList = document.getElementById(
    'custom-template-list'
  ) as HTMLDivElement | null;
  const templateConfigList = document.getElementById(
    'template-config-list'
  ) as HTMLDivElement | null;
  const jsonlPreview = document.getElementById(
    'template-jsonl-preview'
  ) as HTMLElement | null;
  const copyJsonlBtn = document.getElementById(
    'copy-jsonl'
  ) as HTMLButtonElement | null;
  const templateEditorModal = document.getElementById(
    'template-editor-modal'
  ) as HTMLDivElement | null;
  const templateEditorModalContainer = templateEditorModal?.querySelector(
    '.template-editor-modal__container'
  ) as HTMLDivElement | null;
  const templateEditorModalBody = templateEditorModal?.querySelector(
    '.template-editor-modal__body'
  ) as HTMLDivElement | null;
  const closeTemplateEditorBtn = document.getElementById(
    'close-template-editor'
  ) as HTMLButtonElement | null;

  if (
    !editCurrentTemplateBtn ||
    !importTemplateBtn ||
    !newCustomTemplateBtn ||
    !templateFileInput ||
    !templateEditorForm ||
    !templateEditorActions ||
    !templateNameInput ||
    !templateDescriptionInput ||
    !saveTemplateBtn ||
    !exportTemplateBtn ||
    !cancelEditBtn ||
    !customTemplatesList ||
    !templateConfigList ||
    !jsonlPreview ||
    !copyJsonlBtn ||
    !templateEditorModal ||
    !templateEditorModalContainer ||
    !templateEditorModalBody ||
    !closeTemplateEditorBtn
  ) {
    console.warn('Template editor controls are missing from the DOM.');
    return;
  }

  const modal = templateEditorModal;
  const modalContainer = templateEditorModalContainer;
  const modalBody = templateEditorModalBody;

  modalContainer.setAttribute('tabindex', '-1');

  const templateMessageContainer = document.createElement('div');
  templateMessageContainer.className = 'template-editor-message';

  const messageElement = document.createElement('div');
  messageElement.className = 'template-editor-message-text';

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'template-editor-message-dismiss';
  dismissButton.title = 'Dismiss';
  dismissButton.setAttribute('aria-label', 'Dismiss message');
  dismissButton.textContent = '×';

  templateMessageContainer.appendChild(messageElement);
  templateMessageContainer.appendChild(dismissButton);
  templateEditorForm!.insertBefore(
    templateMessageContainer,
    templateEditorActions
  );

  dismissButton.addEventListener('click', () => {
    hideTemplateMessage();
  });

  function showTemplateMessage(
    message: string,
    variant: 'info' | 'error' = 'error'
  ): void {
    messageElement.textContent = message;
    templateMessageContainer.classList.add('visible');
    if (variant === 'info') {
      templateMessageContainer.classList.add('info');
    } else {
      templateMessageContainer.classList.remove('info');
    }
  }

  function hideTemplateMessage(): void {
    templateMessageContainer.classList.remove('visible');
    templateMessageContainer.classList.remove('info');
    messageElement.textContent = '';
  }

  function openModal(): void {
    lastActiveElement = document.activeElement as HTMLElement | null;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    modalContainer.focus();
  }

  function closeModal(): void {
    modalContainer.blur();
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
    lastActiveElement = null;
  }

  let editingTemplateId: string | null = null;
  let editingOriginalName: string | undefined;
  let segments: TemplateSegmentState[] = createDefaultSegments();
  let lastActiveElement: HTMLElement | null = null;

  function parseJsonl(content: string): {
    segments: TemplateSegmentState[];
    lineCount: number;
  } {
    if (!content.trim()) {
      return { segments: createDefaultSegments(), lineCount: 0 };
    }

    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return { segments: createDefaultSegments(), lineCount: 0 };
    }

    const parsedSegments: TemplateSegmentState[] = [];

    lines.slice(0, 2).forEach((line) => {
      const data = JSON.parse(line) as {
        system_prompt?: string;
        context?: Array<{ role?: string; content?: string }>;
      };

      const systemPrompt =
        typeof data.system_prompt === 'string' ? data.system_prompt : '';
      const rawMessages = Array.isArray(data.context) ? data.context : [];
      const messages: MessageState[] = rawMessages
        .map((raw) => {
          const role = VALID_ROLES.includes(raw.role as MessageRole)
            ? (raw.role as MessageRole)
            : 'user';
          const content = typeof raw.content === 'string' ? raw.content : '';
          return {
            id: generateId(),
            role,
            content,
          };
        })
        .filter((message) => message.content.length > 0);
      parsedSegments.push({
        id: generateId(),
        systemPrompt,
        messages: messages.length > 0 ? messages : [createEmptyMessage()],
      });
    });

    while (parsedSegments.length < 2) {
      parsedSegments.push(createEmptySegment());
    }

    return { segments: parsedSegments.slice(0, 2), lineCount: lines.length };
  }

  function toTemplateConfig(segment: TemplateSegmentState) {
    return {
      system_prompt: segment.systemPrompt,
      context: segment.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    };
  }

  function serializeSegments(options?: { pretty?: boolean }): string {
    const spacing = options?.pretty ? 2 : undefined;
    return segments
      .slice(0, 2)
      .map((segment) =>
        JSON.stringify(toTemplateConfig(segment), null, spacing)
      )
      .join('\n');
  }

  function renderJsonlPreview(): void {
    const jsonl = serializeSegments({ pretty: true });
    jsonlPreview!.textContent = jsonl || JSONL_PREVIEW_PLACEHOLDER;
    copyJsonlBtn!.disabled = jsonl.length === 0;
  }

  function moveItem<T>(items: T[], from: number, to: number): void {
    if (to < 0 || to >= items.length) {
      return;
    }
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
  }

  function renderSegments(): void {
    templateConfigList!.innerHTML = '';

    segments.forEach((segment, segmentIndex) => {
      const card = document.createElement('div');
      card.className = 'template-segment-card';

      const header = document.createElement('div');
      header.className = 'template-segment-header';

      const title = document.createElement('h4');
      title.textContent = segmentIndex === 0 ? 'Model 1' : 'Model 2';
      header.appendChild(title);

      card.appendChild(header);

      const systemPromptGroup = document.createElement('div');
      systemPromptGroup.className = 'input-group';

      const systemPromptHeader = document.createElement('div');
      systemPromptHeader.className = 'input-label-row';

      const systemPromptLabel = document.createElement('label');
      systemPromptLabel.textContent = 'System Prompt (optional)';
      systemPromptHeader.appendChild(systemPromptLabel);

      const systemPromptTextarea = document.createElement('textarea');
      systemPromptTextarea.value = segment.systemPrompt;
      systemPromptTextarea.rows = 3;
      const systemPromptCopyButton = document.createElement('button');
      systemPromptCopyButton.className = 'secondary-button icon-button small';
      systemPromptCopyButton.textContent = '📋';
      systemPromptCopyButton.title = 'Copy system prompt';
      systemPromptCopyButton.setAttribute('aria-label', 'Copy system prompt');
      const updateSystemPromptCopyState = () => {
        systemPromptCopyButton.disabled =
          segment.systemPrompt.trim().length === 0;
      };
      systemPromptCopyButton.addEventListener('click', async () => {
        if (!segment.systemPrompt.trim()) {
          return;
        }
        try {
          await window.navigator.clipboard.writeText(segment.systemPrompt);
          showTemplateMessage('System prompt copied.', 'info');
        } catch (error) {
          console.error('Failed to copy system prompt:', error);
          showTemplateMessage('Unable to copy system prompt.');
        }
      });
      systemPromptHeader.appendChild(systemPromptCopyButton);
      systemPromptGroup.appendChild(systemPromptHeader);

      systemPromptTextarea.addEventListener('input', (event) => {
        segment.systemPrompt = (event.target as HTMLTextAreaElement).value;
        updateSystemPromptCopyState();
        renderJsonlPreview();
      });
      systemPromptGroup.appendChild(systemPromptTextarea);
      updateSystemPromptCopyState();
      card.appendChild(systemPromptGroup);

      const messagesContainer = document.createElement('div');
      messagesContainer.className = 'template-message-container';

      const messagesTitle = document.createElement('h5');
      messagesTitle.textContent = 'Context Messages';
      messagesContainer.appendChild(messagesTitle);

      const messagesHint = document.createElement('p');
      messagesHint.className = 'template-context-hint';
      if (segmentIndex === 0) {
        messagesHint.textContent =
          'Model 1 reads this history. Label roles from Model 2\'s perspective: for example, mark Model 2\'s replies as "user".';
      } else {
        messagesHint.textContent =
          'Model 2 reads this history. Label roles from Model 1\'s perspective: use "user" for things Model 1 has said.';
      }
      messagesContainer.appendChild(messagesHint);

      segment.messages.forEach((message, messageIndex) => {
        const messageCard = document.createElement('div');
        messageCard.className = 'template-message-card';

        const roleLabel = document.createElement('label');
        roleLabel.textContent = 'Role';
        messageCard.appendChild(roleLabel);

        const roleSelect = document.createElement('select');
        VALID_ROLES.forEach((role) => {
          const option = document.createElement('option');
          option.value = role;
          option.textContent = role.charAt(0).toUpperCase() + role.slice(1);
          roleSelect.appendChild(option);
        });
        roleSelect.value = message.role;
        roleSelect.addEventListener('change', (event) => {
          const value = (event.target as HTMLSelectElement)
            .value as MessageRole;
          message.role = VALID_ROLES.includes(value) ? value : 'user';
          renderJsonlPreview();
        });
        messageCard.appendChild(roleSelect);

        const contentLabel = document.createElement('label');
        contentLabel.textContent = 'Content';
        messageCard.appendChild(contentLabel);

        let copyButton: HTMLButtonElement | null = null;
        const updateCopyButtonState = () => {
          if (copyButton) {
            copyButton.disabled = message.content.trim().length === 0;
          }
        };
        const contentTextarea = document.createElement('textarea');
        contentTextarea.rows = 3;
        contentTextarea.value = message.content;
        contentTextarea.addEventListener('input', (event) => {
          message.content = (event.target as HTMLTextAreaElement).value;
          updateCopyButtonState();
          renderJsonlPreview();
        });
        messageCard.appendChild(contentTextarea);

        const messageActions = document.createElement('div');
        messageActions.className = 'template-message-actions';

        const messageMoveUpBtn = document.createElement('button');
        messageMoveUpBtn.className = 'secondary-button icon-button';
        messageMoveUpBtn.textContent = '↑';
        messageMoveUpBtn.title = 'Move message up';
        messageMoveUpBtn.setAttribute('aria-label', 'Move message up');
        messageMoveUpBtn.disabled = messageIndex === 0;
        messageMoveUpBtn.addEventListener('click', () => {
          moveItem(segment.messages, messageIndex, messageIndex - 1);
          renderSegments();
        });
        messageActions.appendChild(messageMoveUpBtn);

        const messageMoveDownBtn = document.createElement('button');
        messageMoveDownBtn.className = 'secondary-button icon-button';
        messageMoveDownBtn.textContent = '↓';
        messageMoveDownBtn.title = 'Move message down';
        messageMoveDownBtn.setAttribute('aria-label', 'Move message down');
        messageMoveDownBtn.disabled =
          messageIndex === segment.messages.length - 1;
        messageMoveDownBtn.addEventListener('click', () => {
          moveItem(segment.messages, messageIndex, messageIndex + 1);
          renderSegments();
        });
        messageActions.appendChild(messageMoveDownBtn);

        const duplicateMessageBtn = document.createElement('button');
        duplicateMessageBtn.className = 'secondary-button icon-button';
        duplicateMessageBtn.textContent = '⧉';
        duplicateMessageBtn.title = 'Duplicate message';
        duplicateMessageBtn.setAttribute('aria-label', 'Duplicate message');
        duplicateMessageBtn.addEventListener('click', () => {
          const clonedMessage: MessageState = {
            id: generateId(),
            role: message.role,
            content: message.content,
          };
          segment.messages.splice(messageIndex + 1, 0, clonedMessage);
          renderSegments();
        });
        messageActions.appendChild(duplicateMessageBtn);

        copyButton = document.createElement('button');
        copyButton.className = 'secondary-button icon-button small';
        copyButton.textContent = '📋';
        copyButton.title = 'Copy message content';
        copyButton.setAttribute('aria-label', 'Copy message content');
        copyButton.addEventListener('click', async () => {
          if (!message.content.trim()) {
            return;
          }
          try {
            await window.navigator.clipboard.writeText(message.content);
            showTemplateMessage('Message content copied.', 'info');
          } catch (error) {
            console.error('Failed to copy message content:', error);
            showTemplateMessage('Unable to copy message content.');
          }
        });
        messageActions.appendChild(copyButton);
        updateCopyButtonState();

        const removeMessageBtn = document.createElement('button');
        removeMessageBtn.className = 'secondary-button icon-button';
        removeMessageBtn.textContent = '🗑';
        removeMessageBtn.title = 'Delete message';
        removeMessageBtn.setAttribute('aria-label', 'Delete message');
        removeMessageBtn.disabled = segment.messages.length === 1;
        removeMessageBtn.addEventListener('click', () => {
          segment.messages.splice(messageIndex, 1);
          renderSegments();
        });
        messageActions.appendChild(removeMessageBtn);

        messageCard.appendChild(messageActions);
        messagesContainer.appendChild(messageCard);
      });

      const addMessageBtn = document.createElement('button');
      addMessageBtn.className = 'secondary-button';
      addMessageBtn.textContent = 'Add Message';
      addMessageBtn.addEventListener('click', () => {
        segment.messages.push(createEmptyMessage());
        renderSegments();
      });
      messagesContainer.appendChild(addMessageBtn);

      card.appendChild(messagesContainer);
      templateConfigList!.appendChild(card);
    });

    renderJsonlPreview();
  }

  function syncTemplateSelectOptions(templates: CustomTemplate[]): void {
    const currentValue = templateSelect.value;
    const validCustomValues = new Set(
      templates.map((template) => buildCustomTemplateValue(template.id))
    );

    Array.from(templateSelect.options)
      .filter((option) => option.value.startsWith('custom:'))
      .forEach((option) => option.remove());

    templates.forEach((template) => {
      const option = document.createElement('option');
      option.value = buildCustomTemplateValue(template.id);
      option.textContent = formatCustomTemplateLabel(template);
      templateSelect.appendChild(option);
    });

    if (validCustomValues.has(currentValue)) {
      templateSelect.value = currentValue;
    }
  }

  function renderCustomTemplatesList(): void {
    const templates = listCustomTemplates();
    syncTemplateSelectOptions(templates);

    customTemplatesList!.innerHTML = '';

    if (templates.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.textContent =
        'No custom templates saved yet. Save a template to see it here.';
      customTemplatesList!.appendChild(emptyState);
      return;
    }

    templates.forEach((template) => {
      const item = document.createElement('div');
      item.className = 'custom-template-item';

      const label = document.createElement('span');
      label.className = 'custom-template-label';
      label.textContent = template.description
        ? `${template.name} - ${template.description}`
        : template.name;

      const actions = document.createElement('div');
      actions.className = 'custom-template-actions';

      const editButton = document.createElement('button');
      editButton.className = 'secondary-button';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => {
        const latest = getCustomTemplate(template.id);
        if (!latest) {
          showTemplateMessage('Custom template could not be loaded.');
          return;
        }

        openEditorForm({
          id: latest.id,
          name: latest.name,
          description: latest.description,
          content: latest.content,
          originalName: latest.originalName,
        });
      });

      const deleteButton = document.createElement('button');
      deleteButton.className = 'secondary-button';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => {
        const confirmed = window.confirm(
          `Delete custom template "${template.name}"?`
        );
        if (!confirmed) {
          return;
        }

        const templateValue = buildCustomTemplateValue(template.id);
        const wasSelected = templateSelect.value === templateValue;
        deleteCustomTemplate(template.id);
        renderCustomTemplatesList();

        if (wasSelected) {
          if (templateSelect.options.length > 0) {
            templateSelect.selectedIndex = 0;
          } else {
            templateSelect.value = '';
          }
          templateSelect.dispatchEvent(new Event('change'));
        }

        showTemplateMessage(
          `Custom template "${template.name}" deleted.`,
          'info'
        );
      });

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);

      item.appendChild(label);
      item.appendChild(actions);
      customTemplatesList!.appendChild(item);
    });
  }

  function openEditorForm(state: EditorTemplateState): void {
    editingTemplateId = state.id ?? null;
    editingOriginalName = state.originalName;
    saveTemplateBtn!.textContent = editingTemplateId
      ? 'Update Template'
      : 'Save Template';

    templateNameInput!.value = state.name;
    templateDescriptionInput!.value = state.description || '';

    hideTemplateMessage();
    try {
      const result = parseJsonl(state.content || '');
      segments = result.segments;
      if (result.lineCount > 2) {
        showTemplateMessage(
          'Only the first two lines were loaded. Additional lines were ignored.',
          'info'
        );
      } else if (result.lineCount === 1) {
        showTemplateMessage(
          'Template contains one line. A second blank entry was added for Model 2.',
          'info'
        );
      } else {
        hideTemplateMessage();
      }
    } catch (error) {
      console.error('Error parsing template content:', error);
      showTemplateMessage(
        'Unable to parse template content. Starting with a blank template.'
      );
      segments = createDefaultSegments();
    }

    openModal();
    renderSegments();
    modalBody.scrollTo({ top: 0 });
  }

  function closeEditorForm(): void {
    editingTemplateId = null;
    editingOriginalName = undefined;
    hideTemplateMessage();
    closeModal();
    saveTemplateBtn!.textContent = 'Save Template';
    segments = createDefaultSegments();
  }

  function validateSegments(): string | null {
    if (segments.length !== 2) {
      return 'Template must include exactly two lines (Model 1 and Model 2).';
    }

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.messages.length === 0) {
        return `Model ${i + 1} must include at least one message.`;
      }

      for (let j = 0; j < segment.messages.length; j++) {
        const message = segment.messages[j];
        if (!message.content.trim()) {
          return `Message ${j + 1} for Model ${i + 1} requires content.`;
        }
      }
    }

    return null;
  }

  newCustomTemplateBtn.addEventListener('click', () => {
    openEditorForm({
      name: '',
      description: '',
      content: '',
    });
    templateNameInput?.focus();
  });

  editCurrentTemplateBtn.addEventListener('click', async () => {
    const currentTemplate = templateSelect.value;

    try {
      const customTemplateId = extractCustomTemplateId(currentTemplate);
      if (customTemplateId) {
        const customTemplate = getCustomTemplate(customTemplateId);
        if (!customTemplate) {
          throw new Error('Custom template not found');
        }

        openEditorForm({
          id: customTemplate.id,
          name: customTemplate.name,
          description: customTemplate.description,
          content: customTemplate.content,
          originalName: customTemplate.originalName,
        });
        return;
      }

      const response = await fetch(
        `./public/templates/${currentTemplate}.jsonl`
      );
      if (!response.ok) {
        throw new Error(`Template '${currentTemplate}' not found.`);
      }
      const content = await response.text();

      const templates = await getAvailableTemplates();
      const templateInfo = templates.find((t) => t.name === currentTemplate);

      openEditorForm({
        name: `${currentTemplate} (Custom)`,
        description: templateInfo?.description || '',
        content,
        originalName: currentTemplate,
      });
    } catch (error) {
      console.error('Error loading template for editing:', error);
      showTemplateMessage(
        `Error loading template: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });

  importTemplateBtn.addEventListener('click', () => {
    templateFileInput.value = '';
    templateFileInput.click();
  });

  templateFileInput.addEventListener('change', (event) => {
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';

      try {
        parseJsonl(content);
        const defaultName = file.name.replace(/\.jsonl$/i, '');

        openEditorForm({
          name: defaultName,
          description: '',
          content,
        });
      } catch (error) {
        console.error('Invalid JSONL file:', error);
        showTemplateMessage(
          'Invalid JSONL file. Please check the file format.'
        );
      }
    };

    reader.onerror = () => {
      showTemplateMessage('Failed to read the file.');
    };

    reader.readAsText(file);
  });

  saveTemplateBtn.addEventListener('click', () => {
    const name = templateNameInput!.value.trim();

    if (!name) {
      showTemplateMessage('Template name is required.');
      return;
    }

    const validationError = validateSegments();
    if (validationError) {
      showTemplateMessage(validationError);
      return;
    }

    const description = templateDescriptionInput!.value.trim();
    const payload: CustomTemplateInput = {
      id: editingTemplateId ?? undefined,
      name,
      description,
      content: serializeSegments(),
      originalName: editingOriginalName,
      lastModified: Date.now(),
    };

    const savedTemplate = saveCustomTemplate(payload);

    renderCustomTemplatesList();
    closeEditorForm();
    const savedValue = buildCustomTemplateValue(savedTemplate.id);
    templateSelect.value = savedValue;
    templateSelect.dispatchEvent(new Event('change'));
    showTemplateMessage(
      `Custom template "${name}" saved successfully.`,
      'info'
    );
  });

  exportTemplateBtn.addEventListener('click', () => {
    const validationError = validateSegments();
    if (validationError) {
      showTemplateMessage(validationError);
      return;
    }

    const name = templateNameInput!.value.trim() || 'template';
    const jsonl = serializeSegments();

    if (!jsonl) {
      showTemplateMessage('No content to export.');
      return;
    }

    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.jsonl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  copyJsonlBtn.addEventListener('click', async () => {
    const jsonl = serializeSegments();
    if (!jsonl) {
      return;
    }
    try {
      await window.navigator.clipboard.writeText(jsonl);
      showTemplateMessage('JSONL copied to clipboard.', 'info');
    } catch (error) {
      console.error('Failed to copy JSONL:', error);
      showTemplateMessage('Unable to copy JSONL to clipboard.');
    }
  });

  cancelEditBtn.addEventListener('click', () => {
    closeEditorForm();
  });

  closeTemplateEditorBtn.addEventListener('click', () => {
    closeEditorForm();
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeEditorForm();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      event.preventDefault();
      closeEditorForm();
    }
  });

  renderCustomTemplatesList();
  renderJsonlPreview();
}
