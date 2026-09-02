document.addEventListener('DOMContentLoaded', () => {
  setupCoverLetterGenerator();
  setupCoverLetterNavigation();
});

let coverLetterLoginModalPromise = null;

function ensureCoverLetterLoginModal() {
  if (document.getElementById('loginModal')) return Promise.resolve();
  if (coverLetterLoginModalPromise) return coverLetterLoginModalPromise;

  coverLetterLoginModalPromise = fetch('login-modal.html')
    .then(response => {
      if (!response.ok) throw new Error(`Unable to load login modal (${response.status}).`);
      return response.text();
    })
    .then(html => {
      const modalContainer = document.getElementById('modalContainer');
      if (modalContainer) modalContainer.innerHTML = html;
    })
    .catch(error => {
      coverLetterLoginModalPromise = null;
      throw error;
    });

  return coverLetterLoginModalPromise;
}

function setupCoverLetterNavigation() {
  const menuToggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('menu');
  const adminLink = document.getElementById('adminLink');

  menuToggle?.addEventListener('click', () => {
    menu?.classList.toggle('hidden');
  });

  ensureCoverLetterLoginModal()
    .catch(error => console.error('Login modal failed to load:', error));

  adminLink?.addEventListener('click', event => {
    event.preventDefault();
    window.coverLetterLoginIntent = 'admin-page';
    ensureCoverLetterLoginModal()
      .then(() => checkAndEnterAdminPage())
      .catch(error => console.error('Login modal failed to open:', error));
  });
}

function setupCoverLetterGenerator() {
  const cvInput = document.getElementById('cover-letter-cv');
  const cvName = document.getElementById('cover-letter-cv-name');
  const cvError = document.getElementById('cover-letter-cv-error');
  const jobSelect = document.getElementById('cover-letter-job');
  const jobStatus = document.getElementById('cover-letter-job-status');
  const listModeButton = document.getElementById('cover-letter-job-mode-list');
  const manualModeButton = document.getElementById('cover-letter-job-mode-manual');
  const listPanel = document.getElementById('cover-letter-job-list-panel');
  const manualPanel = document.getElementById('cover-letter-job-manual-panel');
  const manualTitle = document.getElementById('cover-letter-manual-title');
  const manualCompany = document.getElementById('cover-letter-manual-company');
  const christchurchLocationButton = document.getElementById('cover-letter-location-christchurch');
  const elsewhereLocationButton = document.getElementById('cover-letter-location-elsewhere');
  const manualDescription = document.getElementById('cover-letter-manual-description');
  const manualDescriptionCount = document.getElementById('cover-letter-manual-description-count');
  const companyResearch = document.getElementById('cover-letter-company-research');
  const accessBanner = document.getElementById('cover-letter-access-banner');
  const adminLoginButton = document.getElementById('cover-letter-admin-login');
  const inputFieldset = document.getElementById('cover-letter-inputs');
  const extraPrompt = document.getElementById('cover-letter-extra-prompt');
  const extraPromptCount = document.getElementById('cover-letter-extra-prompt-count');
  const extraPromptToggle = document.getElementById('cover-letter-extra-prompt-toggle');
  const extraPromptBody = document.getElementById('cover-letter-extra-prompt-body');
  const extraPromptChevron = document.getElementById('cover-letter-extra-prompt-chevron');
  const referenceInput = document.getElementById('cover-letter-reference');
  const referenceName = document.getElementById('cover-letter-reference-name');
  const referenceError = document.getElementById('cover-letter-reference-error');
  const generateButton = document.getElementById('generate-cover-letter');
  const generationStatus = document.getElementById('cover-letter-generation-status');
  const preview = document.getElementById('cover-letter-preview');
  const previewPlaceholder = document.getElementById('cover-letter-preview-placeholder');
  const previewContent = document.getElementById('cover-letter-preview-content');
  const previewFileName = document.getElementById('cover-letter-preview-file-name');
  const downloadButton = document.getElementById('download-cover-letter');

  if (!cvInput || !cvName || !cvError || !jobSelect || !jobStatus
    || !listModeButton || !manualModeButton || !listPanel || !manualPanel
    || !manualTitle || !manualCompany || !christchurchLocationButton
    || !elsewhereLocationButton || !manualDescription || !manualDescriptionCount
    || !companyResearch || !accessBanner || !adminLoginButton || !inputFieldset
    || !extraPrompt || !extraPromptCount
    || !extraPromptToggle || !extraPromptBody
    || !extraPromptChevron || !referenceInput || !referenceName
    || !referenceError || !generateButton || !generationStatus
    || !preview || !previewPlaceholder || !previewContent
    || !previewFileName || !downloadButton) return;

  let jobInputMode = 'list';
  let manualJobLocation = 'Christchurch';
  let generatedDocument = null;
  let hasAdminAccess = false;

  const clearPreview = () => {
    generatedDocument = null;
    previewContent.textContent = '';
    previewFileName.textContent = 'Preview your generated letter here.';
    preview.classList.add('hidden');
    previewPlaceholder.classList.remove('hidden');
    downloadButton.classList.add('hidden');
  };

  const updateGenerateButton = () => {
    const hasJobDetails = jobInputMode === 'list'
      ? Boolean(jobSelect.value)
      : Boolean(manualTitle.value.trim() && manualDescription.value.trim());
    const isReady = Boolean(hasAdminAccess && cvInput.files?.[0] && hasJobDetails);
    generateButton.disabled = !isReady;
    generateButton.classList.toggle('cursor-not-allowed', !isReady);
    generateButton.classList.toggle('bg-gray-300', !isReady);
    generateButton.classList.toggle('opacity-80', !isReady);
    generateButton.classList.toggle('bg-blue-600', isReady);
    generateButton.classList.toggle('hover:bg-blue-700', isReady);
  };

  const setAccessState = isAdmin => {
    hasAdminAccess = isAdmin;
    inputFieldset.disabled = !isAdmin;
    accessBanner.classList.toggle('hidden', isAdmin);
    updateGenerateButton();
  };

  const verifyAdminAccess = async () => {
    const token = sessionStorage.getItem('jwt');
    if (!token) {
      setAccessState(false);
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE}/api/account/check`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        sessionStorage.removeItem('jwt');
        sessionStorage.removeItem('isAdmin');
        sessionStorage.removeItem('Username');
        updateAdminNavLabel();
      }
      setAccessState(response.ok);
    } catch (error) {
      console.error('Cover letter access check failed:', error);
      setAccessState(false);
    }
  };

  adminLoginButton.addEventListener('click', () => {
    window.coverLetterLoginIntent = 'unlock';
    ensureCoverLetterLoginModal()
      .then(() => document.getElementById('loginModal')?.classList.remove('hidden'))
      .catch(error => console.error('Login modal failed to open:', error));
  });

  window.handleAdminLoginSuccess = () => {
    updateAdminNavLabel();
    setAccessState(true);
  };

  const setJobInputMode = mode => {
    jobInputMode = mode;
    const usesList = mode === 'list';

    listPanel.classList.toggle('hidden', !usesList);
    manualPanel.classList.toggle('hidden', usesList);
    listModeButton.setAttribute('aria-pressed', String(usesList));
    manualModeButton.setAttribute('aria-pressed', String(!usesList));

    [listModeButton, manualModeButton].forEach((button, index) => {
      const isActive = usesList ? index === 0 : index === 1;
      button.classList.toggle('border-blue-600', isActive);
      button.classList.toggle('border-transparent', !isActive);
      button.classList.toggle('text-blue-600', isActive);
      button.classList.toggle('font-semibold', isActive);
      button.classList.toggle('text-gray-400', !isActive);
      button.classList.toggle('font-medium', !isActive);
      button.classList.toggle('hover:text-gray-600', !isActive);
    });

    updateGenerateButton();
  };

  const setManualJobLocation = location => {
    manualJobLocation = location;
    const isChristchurch = location === 'Christchurch';

    christchurchLocationButton.setAttribute('aria-pressed', String(isChristchurch));
    elsewhereLocationButton.setAttribute('aria-pressed', String(!isChristchurch));

    [christchurchLocationButton, elsewhereLocationButton].forEach((button, index) => {
      const isActive = isChristchurch ? index === 0 : index === 1;
      button.classList.toggle('border-blue-600', isActive);
      button.classList.toggle('border-transparent', !isActive);
      button.classList.toggle('text-blue-600', isActive);
      button.classList.toggle('font-semibold', isActive);
      button.classList.toggle('text-gray-400', !isActive);
      button.classList.toggle('font-medium', !isActive);
      button.classList.toggle('hover:text-gray-600', !isActive);
    });

    clearPreview();
  };

  cvInput.addEventListener('change', () => {
    const file = cvInput.files?.[0];
    cvError.classList.add('hidden');

    if (!file) {
      cvName.textContent = 'No CV selected';
      clearPreview();
      updateGenerateButton();
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'docx') {
      cvInput.value = '';
      cvName.textContent = 'No CV selected';
      cvError.textContent = 'Select a DOCX CV file.';
      cvError.classList.remove('hidden');
      clearPreview();
      updateGenerateButton();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      cvInput.value = '';
      cvName.textContent = 'No CV selected';
      cvError.textContent = 'The uploaded CV must not exceed 5 MB.';
      cvError.classList.remove('hidden');
      clearPreview();
      updateGenerateButton();
      return;
    }

    cvName.textContent = `${file.name} · ${formatFileSize(file.size)}`;
    clearPreview();
    updateGenerateButton();
  });

  listModeButton.addEventListener('click', () => {
    setJobInputMode('list');
    clearPreview();
  });
  manualModeButton.addEventListener('click', () => {
    setJobInputMode('manual');
    clearPreview();
  });
  jobSelect.addEventListener('change', () => {
    clearPreview();
    updateGenerateButton();
  });
  manualTitle.addEventListener('input', () => {
    clearPreview();
    updateGenerateButton();
  });
  manualCompany.addEventListener('input', clearPreview);
  christchurchLocationButton.addEventListener('click', () => {
    setManualJobLocation('Christchurch');
  });
  elsewhereLocationButton.addEventListener('click', () => {
    setManualJobLocation('Outside Christchurch');
  });
  manualDescription.addEventListener('input', () => {
    manualDescriptionCount.textContent = `${manualDescription.value.length} / 30000`;
    clearPreview();
    updateGenerateButton();
  });
  companyResearch.addEventListener('change', clearPreview);
  extraPrompt.addEventListener('input', () => {
    extraPromptCount.textContent = `${extraPrompt.value.length} / 2000`;
  });

  extraPromptToggle.addEventListener('click', () => {
    const isExpanded = extraPromptToggle.getAttribute('aria-expanded') === 'true';
    extraPromptToggle.setAttribute('aria-expanded', String(!isExpanded));
    extraPromptBody.classList.toggle('hidden', isExpanded);
    extraPromptChevron.classList.toggle('rotate-180', !isExpanded);
  });

  referenceInput.addEventListener('change', () => {
    const file = referenceInput.files?.[0];
    referenceError.classList.add('hidden');

    if (!file) {
      referenceName.textContent = 'No reference selected';
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'docx') {
      referenceInput.value = '';
      referenceName.textContent = 'No reference selected';
      referenceError.textContent = 'Select a DOCX reference letter.';
      referenceError.classList.remove('hidden');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      referenceInput.value = '';
      referenceName.textContent = 'No reference selected';
      referenceError.textContent = 'The reference file must not exceed 5 MB.';
      referenceError.classList.remove('hidden');
      return;
    }

    referenceName.textContent = `${file.name} · ${formatFileSize(file.size)}`;
  });

  generateButton.addEventListener('click', async () => {
    const cv = cvInput.files?.[0];
    const usesMatchedJob = jobInputMode === 'list';
    const jobId = usesMatchedJob ? jobSelect.value : '';
    const pastedTitle = usesMatchedJob ? '' : manualTitle.value.trim();
    const pastedCompany = usesMatchedJob ? '' : manualCompany.value.trim();
    const pastedDescription = usesMatchedJob ? '' : manualDescription.value.trim();
    if (!cv || (usesMatchedJob ? !jobId : !pastedTitle || !pastedDescription)) return;

    generateButton.disabled = true;
    generateButton.classList.add('cursor-not-allowed', 'bg-gray-300', 'opacity-80');
    generateButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    generationStatus.textContent = companyResearch.checked
      ? 'Researching company and role context, then generating a grounded draft — this may take a moment...'
      : 'Generating a grounded cover-letter draft — this may take a moment...';
    generationStatus.className = 'mt-3 text-center text-xs text-gray-500';

    try {
      const formData = new FormData();
      formData.append('cv', cv);
      const referenceCoverLetter = referenceInput.files?.[0];
      if (referenceCoverLetter) {
        formData.append('referenceCoverLetter', referenceCoverLetter);
      }
      if (usesMatchedJob) {
        formData.append('jobId', jobId);
      } else {
        formData.append('jobTitle', pastedTitle);
        if (pastedCompany) formData.append('companyName', pastedCompany);
        formData.append('jobLocation', manualJobLocation);
        formData.append('jobDescription', pastedDescription);
      }
      if (extraPrompt.value.trim()) {
        formData.append('extraPrompt', extraPrompt.value.trim());
      }
      if (companyResearch.checked) {
        formData.append('includeCompanyResearch', 'true');
      }

      const response = await fetch(`${window.API_BASE}/api/cover-letter/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('jwt') || ''}`
        },
        body: formData
      });

      if (response.status === 401) {
        sessionStorage.removeItem('jwt');
        sessionStorage.removeItem('isAdmin');
        setAccessState(false);
        throw new Error('The admin session has expired. Sign in again to continue.');
      }

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || `Generation failed (${response.status}).`);
      }

      const result = await response.json();
      if (!result.coverLetter || !result.documentBase64 || !result.fileName) {
        throw new Error('The generated cover letter response is incomplete.');
      }

      generatedDocument = {
        base64: result.documentBase64,
        contentType: result.contentType,
        fileName: result.fileName
      };
      renderCoverLetterPreview(
        previewContent,
        result.coverLetter,
        result.allowedProjectLinks
      );
      previewFileName.textContent = result.fileName;
      previewPlaceholder.classList.add('hidden');
      preview.classList.remove('hidden');
      downloadButton.classList.remove('hidden');

      if (result.companyResearchWarning) {
        generationStatus.textContent = result.companyResearchWarning;
        generationStatus.className = 'mt-3 text-center text-xs text-amber-600';
      } else {
        generationStatus.textContent = '';
        generationStatus.className = 'hidden';
      }
    } catch (error) {
      generationStatus.textContent = error.message || 'Unable to generate the cover letter.';
      generationStatus.className = 'mt-3 text-center text-xs text-red-500';
    } finally {
      updateGenerateButton();
    }
  });

  downloadButton.addEventListener('click', () => {
    if (!generatedDocument) return;

    const binary = window.atob(generatedDocument.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }

    const documentBlob = new Blob([bytes], {
      type: generatedDocument.contentType
        || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    const downloadUrl = URL.createObjectURL(documentBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = generatedDocument.fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  });

  loadCoverLetterJobs(jobSelect, jobStatus, updateGenerateButton);
  verifyAdminAccess();
}

function renderCoverLetterPreview(container, coverLetter, projectLinks) {
  const allowedProjectLinks = new Set(
    Array.isArray(projectLinks)
      ? projectLinks.filter(link => typeof link === 'string' && link.startsWith('https://'))
      : []
  );
  const markdownLinkPattern = /\[([^\]\r\n]+)\]\((https:\/\/[^)\s]+)\)/g;
  let currentIndex = 0;

  container.textContent = '';

  for (const match of coverLetter.matchAll(markdownLinkPattern)) {
    if (!allowedProjectLinks.has(match[2])) continue;

    container.append(document.createTextNode(
      coverLetter.slice(currentIndex, match.index)
    ));

    const link = document.createElement('a');
    link.href = match[2];
    link.textContent = match[1];
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'text-blue-600 underline hover:text-blue-700';
    container.append(link);

    currentIndex = match.index + match[0].length;
  }

  container.append(document.createTextNode(coverLetter.slice(currentIndex)));
}

async function loadCoverLetterJobs(jobSelect, jobStatus, updateGenerateButton) {
  try {
    const response = await fetch(`${window.API_BASE}/api/cover-letter/jobs`);

    if (!response.ok) throw new Error(`Unable to load jobs (${response.status}).`);

    const jobs = await response.json();
    jobSelect.innerHTML = '<option value="">Select a screened role</option>';

    jobs.forEach(job => {
      const option = document.createElement('option');
      option.value = job.jobId;
      option.textContent = `${job.jobTitle} — ${job.companyName || 'Unknown company'}`;
      jobSelect.appendChild(option);
    });

    jobSelect.disabled = false;
    jobStatus.textContent = `${jobs.length} matching role${jobs.length === 1 ? '' : 's'} found.`;
    jobStatus.className = 'mt-3 text-sm leading-2 text-gray-400';
    updateGenerateButton();
  } catch (error) {
    jobSelect.innerHTML = '<option value="">Unable to load roles</option>';
    jobStatus.textContent = error.message || 'Unable to load screened roles.';
    jobStatus.className = 'mt-3 text-sm leading-2 text-red-500';
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
