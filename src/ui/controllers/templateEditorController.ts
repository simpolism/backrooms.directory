import {
  getCustomTemplate,
  saveCustomTemplate,
  clearCustomTemplate,
  getAvailableTemplates,
} from '../../templates';

export function initializeTemplateEditor(
  templateSelect: HTMLSelectElement
): void {
  const editCurrentTemplateBtn = document.getElementById(
    'edit-current-template'
  ) as HTMLButtonElement;
  const importTemplateBtn = document.getElementById(
    'import-template'
  ) as HTMLButtonElement;
  const templateFileInput = document.getElementById(
    'template-file-input'
  ) as HTMLInputElement;
  const templateEditorForm = document.getElementById(
    'template-editor-form'
  ) as HTMLDivElement;
  const templateNameInput = document.getElementById(
    'template-name'
  ) as HTMLInputElement;
  const templateDescriptionInput = document.getElementById(
    'template-description'
  ) as HTMLInputElement;
  const templateContentTextarea = document.getElementById(
    'template-content'
  ) as HTMLTextAreaElement;
  const saveTemplateBtn = document.getElementById(
    'save-template'
  ) as HTMLButtonElement;
  const exportTemplateBtn = document.getElementById(
    'export-template'
  ) as HTMLButtonElement;
  const clearCustomTemplateBtn = document.getElementById(
    'clear-custom-template'
  ) as HTMLButtonElement;
  const clearCustomTemplateStatusBtn = document.getElementById(
    'clear-custom-template-status'
  ) as HTMLButtonElement;
  const cancelEditBtn = document.getElementById(
    'cancel-edit'
  ) as HTMLButtonElement;
  const customTemplateStatus = document.getElementById(
    'custom-template-status'
  ) as HTMLDivElement;
  const customTemplateName = document.getElementById(
    'custom-template-name'
  ) as HTMLSpanElement;
  const editCustomTemplateBtn = document.getElementById(
    'edit-custom-template'
  ) as HTMLButtonElement;

  if (
    !editCurrentTemplateBtn ||
    !importTemplateBtn ||
    !templateFileInput ||
    !templateEditorForm ||
    !templateNameInput ||
    !templateDescriptionInput ||
    !templateContentTextarea ||
    !saveTemplateBtn ||
    !exportTemplateBtn ||
    !clearCustomTemplateBtn ||
    !clearCustomTemplateStatusBtn ||
    !cancelEditBtn ||
    !customTemplateStatus ||
    !customTemplateName ||
    !editCustomTemplateBtn
  ) {
    console.warn('Template editor controls are missing from the DOM.');
    return;
  }

  const templateErrorContainer = document.createElement('div');
  templateErrorContainer.className = 'template-error-container';
  templateErrorContainer.style.display = 'none';
  templateErrorContainer.style.marginTop = '15px';
  templateErrorContainer.style.marginBottom = '15px';
  templateErrorContainer.style.padding = '8px 10px';
  templateErrorContainer.style.border = '1px solid #000000';
  templateErrorContainer.style.fontSize = '14px';
  templateErrorContainer.style.fontFamily = 'Times New Roman, serif';
  templateErrorContainer.style.backgroundColor = '#EEEEEE';
  templateErrorContainer.style.color = '#FF0000';
  templateErrorContainer.style.position = 'relative';
  templateErrorContainer.style.width = '100%';
  templateErrorContainer.style.boxSizing = 'border-box';

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

  templateErrorContainer.appendChild(dismissButton);
  templateErrorContainer.appendChild(messageElement);
  templateEditorForm.appendChild(templateErrorContainer);

  dismissButton.addEventListener('click', () => {
    templateErrorContainer.style.display = 'none';
  });

  function showTemplateError(message: string) {
    messageElement.textContent = message;
    templateErrorContainer.style.display = 'block';
  }

  function updateCustomTemplateStatus() {
    const customTemplate = getCustomTemplate();

    if (customTemplate) {
      customTemplateName.textContent = customTemplate.name;
      customTemplateStatus.style.display = 'block';

      let customOptionExists = false;
      for (let i = 0; i < templateSelect.options.length; i++) {
        if (templateSelect.options[i].value === 'custom') {
          customOptionExists = true;
          break;
        }
      }

      const label = customTemplate.description
        ? `Custom: ${customTemplate.name} - ${customTemplate.description}`
        : `Custom: ${customTemplate.name}`;

      if (!customOptionExists) {
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = label;
        templateSelect.appendChild(customOption);
      } else {
        for (let i = 0; i < templateSelect.options.length; i++) {
          if (templateSelect.options[i].value === 'custom') {
            templateSelect.options[i].textContent = label;
            break;
          }
        }
      }
    } else {
      customTemplateStatus.style.display = 'none';

      for (let i = 0; i < templateSelect.options.length; i++) {
        if (templateSelect.options[i].value === 'custom') {
          templateSelect.remove(i);
          break;
        }
      }
    }
  }

  editCurrentTemplateBtn.addEventListener('click', async () => {
    const currentTemplate = templateSelect.value;

    try {
      let templateContent: string;
      let templateName: string;
      let templateDescription = '';

      if (currentTemplate === 'custom') {
        const customTemplate = getCustomTemplate();
        if (!customTemplate) {
          throw new Error('Custom template not found');
        }

        templateContent = customTemplate.content;
        templateName = customTemplate.name;
        templateDescription = customTemplate.description || '';
      } else {
        const response = await fetch(`./public/templates/${currentTemplate}.jsonl`);
        if (!response.ok) {
          throw new Error(`Template '${currentTemplate}' not found.`);
        }
        templateContent = await response.text();
        templateName = `${currentTemplate} (Custom)`;

        const templates = await getAvailableTemplates();
        const templateInfo = templates.find((t) => t.name === currentTemplate);
        if (templateInfo) {
          templateDescription = templateInfo.description || '';
        }
      }

      templateNameInput.value = templateName;
      templateDescriptionInput.value = templateDescription;
      templateContentTextarea.value = templateContent;
      templateEditorForm.style.display = 'block';
    } catch (error) {
      console.error('Error loading template for editing:', error);
      showTemplateError(
        `Error loading template: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  importTemplateBtn.addEventListener('click', () => {
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
      const content = e.target?.result as string;

      try {
        const lines = content.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            JSON.parse(line);
          }
        }

        templateNameInput.value = file.name.replace('.jsonl', '');
        templateDescriptionInput.value = '';
        templateContentTextarea.value = content;
        templateEditorForm.style.display = 'block';
      } catch (error) {
        console.error('Invalid JSONL file:', error);
        showTemplateError('Invalid JSONL file. Please check the file format.');
      }
    };

    reader.onerror = () => {
      showTemplateError('Failed to read the file.');
    };

    reader.readAsText(file);
    templateFileInput.value = '';
  });

  saveTemplateBtn.addEventListener('click', () => {
    const name = templateNameInput.value.trim();
    const content = templateContentTextarea.value.trim();

    if (!name) {
      showTemplateError('Template name is required.');
      return;
    }

    if (!content) {
      showTemplateError('Template content is required.');
      return;
    }

    try {
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          JSON.parse(line);
        }
      }

      const description = templateDescriptionInput.value.trim();

      saveCustomTemplate({
        name,
        description,
        content,
        originalName:
          templateSelect.value !== 'custom' ? templateSelect.value : undefined,
        lastModified: Date.now(),
      });

      templateEditorForm.style.display = 'none';
      updateCustomTemplateStatus();

      for (let i = 0; i < templateSelect.options.length; i++) {
        if (templateSelect.options[i].value === 'custom') {
          templateSelect.selectedIndex = i;
          break;
        }
      }

      templateSelect.dispatchEvent(new Event('change'));
      showTemplateError(`Custom template "${name}" saved successfully.`);
    } catch (error) {
      console.error('Invalid JSONL content:', error);
      showTemplateError('Invalid JSONL content. Please check the format.');
    }
  });

  exportTemplateBtn.addEventListener('click', () => {
    const name = templateNameInput.value.trim() || 'template';
    const content = templateContentTextarea.value.trim();

    if (!content) {
      showTemplateError('No content to export.');
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

  clearCustomTemplateBtn.addEventListener('click', () => {
    clearCustomTemplate();
    templateEditorForm.style.display = 'none';
    updateCustomTemplateStatus();
    showTemplateError('Custom template cleared.');
  });

  clearCustomTemplateStatusBtn.addEventListener('click', () => {
    templateEditorForm.style.display = 'none';
  });

  cancelEditBtn.addEventListener('click', () => {
    templateEditorForm.style.display = 'none';
  });

  editCustomTemplateBtn.addEventListener('click', () => {
    const customTemplate = getCustomTemplate();
    if (!customTemplate) {
      showTemplateError('No custom template found to edit.');
      return;
    }

    templateNameInput.value = customTemplate.name;
    templateDescriptionInput.value = customTemplate.description || '';
    templateContentTextarea.value = customTemplate.content;
    templateEditorForm.style.display = 'block';
  });

  updateCustomTemplateStatus();
}
