document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const scanBtn = document.getElementById('scan-btn');
    const urlInput = document.getElementById('url-input');
    const statusText = document.getElementById('status-text');
    const emptyState = document.getElementById('empty-state');
    const scanningState = document.getElementById('scanning-state');
    const resultsState = document.getElementById('results-state');
    const designState = document.getElementById('design-state');
    const inspectState = document.getElementById('inspect-state');
    const downloadPanel = document.getElementById('download-panel');
    const modeBtns = document.querySelectorAll('.mode-btn');
    const progressBar = document.querySelector('.progress-bar');
    const progressPercent = document.querySelector('.progress-percent');

    // State
    let currentMode = 'lite';
    let isScanning = false;

    // Mode Switching
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            if (mode === currentMode) return;

            // Update UI
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = mode;

            // Handle view changes if not scanning
            if (!isScanning) {
                updateViewBasedOnMode();
            }
        });
    });

    function updateViewBasedOnMode() {
        // Clear all views
        emptyState.classList.add('hidden');
        scanningState.classList.add('hidden');
        resultsState.classList.add('hidden');
        inspectState.classList.add('hidden');
        downloadPanel.classList.add('hidden');

        if (currentMode === 'inspect') {
            inspectState.classList.remove('hidden');
        } else if (currentMode === 'lite' || currentMode === 'full') {
            // If no scan results, show empty state
            emptyState.classList.remove('hidden');
        } else if (currentMode === 'design') {
            designState.classList.remove('hidden');
        }
    }

    // Scan Simulation
    scanBtn.addEventListener('click', startScan);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startScan();
    });

    function startScan() {
        const url = urlInput.value.trim();
        if (!url) {
            urlInput.style.borderColor = 'var(--error)';
            setTimeout(() => urlInput.style.borderColor = 'var(--border)', 1500);
            return;
        }

        isScanning = true;
        scanBtn.disabled = true;
        scanBtn.style.opacity = '0.5';

        // Hide initial states
        emptyState.classList.add('hidden');
        resultsState.classList.add('hidden');
        downloadPanel.classList.add('hidden');

        // Show scanning state
        scanningState.classList.remove('hidden');
        statusText.innerText = 'Scanning website...';

        // Progress Simulation
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 15) + 5;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(showResults, 500);
            }

            progressBar.style.width = `${progress}%`;
            progressPercent.innerText = `${progress}%`;

            // Update progress steps based on percentage
            updateProgressSteps(progress);
        }, 400);
    }

    function updateProgressSteps(percent) {
        const steps = document.querySelectorAll('.progress-steps li');
        if (percent > 20) {
            steps[0].classList.add('completed');
            steps[0].querySelector('i').setAttribute('data-lucide', 'check-circle-2');
        }
        if (percent > 45) {
            steps[1].classList.add('completed');
            steps[1].querySelector('i').setAttribute('data-lucide', 'check-circle-2');
        }
        if (percent > 65) {
            steps[2].classList.add('active');
            steps[2].querySelector('i').classList.add('spinning');
        }
        if (percent > 85) {
            steps[2].classList.remove('active');
            steps[2].classList.add('completed');
            steps[2].querySelector('i').classList.remove('spinning');
            steps[2].querySelector('i').setAttribute('data-lucide', 'check-circle-2');

            steps[3].classList.add('active');
            steps[3].querySelector('i').classList.add('spinning');
        }
        lucide.createIcons();
    }

    function showResults() {
        isScanning = false;
        scanBtn.disabled = false;
        scanBtn.style.opacity = '1';

        scanningState.classList.add('hidden');
        resultsState.classList.remove('hidden');
        downloadPanel.classList.remove('hidden');

        statusText.innerText = 'Analysis complete';

        // Add some animation to cards
        const cards = document.querySelectorAll('.stat-card');
        cards.forEach((card, i) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
                card.style.transition = 'all 0.4s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, i * 100);
        });
    }

    // Preset selection
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-preset');
            alert(`Preset "${btn.innerText}" selected. Features adjusted.`);
        });
    });

    // Format chips
    const formatChips = document.querySelectorAll('.format-chip');
    formatChips.forEach(chip => {
        chip.addEventListener('click', () => {
            formatChips.forEach(c => c.style.borderColor = 'var(--border)');
            chip.style.borderColor = 'var(--accent)';
            chip.style.color = 'var(--accent)';
        });
    });
});
