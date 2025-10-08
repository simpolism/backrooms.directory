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
import type { CustomTemplate, CustomTemplateInput } from '../../types';

interface EditorTemplateState {
  id?: string;
  name: string;
  description: string;
  content: string;
  originalName?: string;
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
  const templateNameInput = document.getElementById(
    'template-name'
  ) as HTMLInputElement | null;
  const templateDescriptionInput = document.getElementById(
    'template-description'
  ) as HTMLInputElement | null;
  const templateContentTextarea = document.getElementById(
    'template-content'
  ) as HTMLTextAreaElement | null;
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

  if (
    !editCurrentTemplateBtn ||
    !importTemplateBtn ||
    !newCustomTemplateBtn ||
    !templateFileInput ||
    !templateEditorForm ||
    !templateNameInput ||
    !templateDescriptionInput ||
    !templateContentTextarea ||
    !saveTemplateBtn ||
    !exportTemplateBtn ||
    !cancelEditBtn ||
    !customTemplatesList
  ) {
    console.warn('Template editor controls are missing from the DOM.');
    return;
  }

  const templateMessageContainer = document.createElement('div');
  templateMessageContainer.className = 'template-message-container';
  templateMessageContainer.style.display = 'none';
  templateMessageContainer.style.marginTop = '15px';
  templateMessageContainer.style.marginBottom = '15px';
  templateMessageContainer.style.padding = '8px 10px';
  templateMessageContainer.style.border = '1px solid #000000';
  templateMessageContainer.style.fontSize = '14px';
  templateMessageContainer.style.fontFamily = 'Times New Roman, serif';
  templateMessageContainer.style.backgroundColor = '#EEEEEE';
  templateMessageContainer.style.color = '#FF0000';
  templateMessageContainer.style.position = 'relative';
  templateMessageContainer.style.width = '100%';
  templateMessageContainer.style.boxSizing = 'border-box';

  const dismissButton = document.createElement('button');
  dismissButton.textContent = '×';
  dismissButton.style.position = 'absolute';
  dismissButton.style.right = '5px';
  dismissButton.style.top = '5px';
  dismissButton.style.background = 'none';
  dismissButton.style.border = 'none';
  dismissButton.style.fontSize = '16px';
  dismissButton.style.fontWeight = 'bold';
  dismissButton.style.cursor = 'pointer';
  dismissButton.style.padding = '0 5px';
  dismissButton.style.lineHeight = '1';
  dismissButton.title = 'Dismiss';

  const messageElement = document.createElement('div');
  messageElement.style.paddingRight = '20px';

  templateMessageContainer.appendChild(dismissButton);
  templateMessageContainer.appendChild(messageElement);
  templateEditorForm.appendChild(templateMessageContainer);

  dismissButton.addEventListener('click', () => {
    templateMessageContainer.style.display = 'none';
  });

  function showTemplateMessage(
    message: string,
    variant: 'info' | 'error' = 'error'
  ): void {
    messageElement.textContent = message;
    templateMessageContainer.style.display = 'block';
    templateMessageContainer.style.color =
      variant === 'error' ? '#FF0000' : '#2E7D32';
    templateMessageContainer.style.border =
      variant === 'error' ? '1px solid #FF0000' : '1px solid #2E7D32';
  }

  function hideTemplateMessage(): void {
    templateMessageContainer.style.display = 'none';
  }

  let editingTemplateId: string | null = null;
  let editingOriginalName: string | undefined;

  function openEditorForm(state: EditorTemplateState): void {
    if (!templateEditorForm || !templateNameInput || !templateDescriptionInput || !templateContentTextarea) {
      return;
    }
    editingTemplateId = state.id ?? null;
    editingOriginalName = state.originalName;
    templateNameInput.value = state.name;
    templateDescriptionInput.value = state.description || '';
    templateContentTextarea.value = state.content;
    hideTemplateMessage();
    templateEditorForm.style.display = 'block';
  }

  function closeEditorForm(): void {
    editingTemplateId = null;
    editingOriginalName = undefined;
    if (templateEditorForm) {
      templateEditorForm.style.display = 'none';
    }
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

    if (!customTemplatesList) {
      return;
    }

    customTemplatesList.innerHTML = '';

    if (templates.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.textContent =
        'No custom templates saved yet. Save a template to see it here.';
      customTemplatesList.appendChild(emptyState);
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
      customTemplatesList.appendChild(item);
    });
  }

  function validateTemplateContent(content: string): void {
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        JSON.parse(line);
      }
    }
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
        validateTemplateContent(content);
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
    const name = templateNameInput.value.trim();
    const content = templateContentTextarea.value.trim();

    if (!name) {
      showTemplateMessage('Template name is required.');
      return;
    }

    if (!content) {
      showTemplateMessage('Template content is required.');
      return;
    }

    try {
      validateTemplateContent(content);

      const description = templateDescriptionInput.value.trim();
      const payload: CustomTemplateInput = {
        id: editingTemplateId ?? undefined,
        name,
        description,
        content,
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
    } catch (error) {
      console.error('Invalid JSONL content:', error);
      showTemplateMessage('Invalid JSONL content. Please check the format.');
    }
  });

  exportTemplateBtn.addEventListener('click', () => {
    const name = templateNameInput.value.trim() || 'template';
    const content = templateContentTextarea.value.trim();

    if (!content) {
      showTemplateMessage('No content to export.');
      return;
    }

    const blob = new Blob([content], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.jsonl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  cancelEditBtn.addEventListener('click', () => {
    closeEditorForm();
  });

  renderCustomTemplatesList();
}
