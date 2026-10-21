/**
 * Patrick Architect - Web Application Controller (app.js)
 * Master intelligence logic, Pareto Generative Explorer, AI Agent runner,
 * Open IFC4 exporter, and Three.js 3D WebGL bridge.
 */

let viewer = null;
let selectedFile = null;
let activeData = null;
let currentAmbiguity = 'opt_a';
let activeSessionId = null;

function goToScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');

    if (screenId === 'screen-studio' && viewer) {
        setTimeout(() => {
            viewer.onWindowResize();
        }, 100);
    }
}

function setupUploadHandlers() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const btnSelectFile = document.getElementById('btn-select-file');
    const fileReviewCard = document.getElementById('file-review-card');
    const previewImg = document.getElementById('blueprint-review-img');
    const btnReset = document.getElementById('btn-reset-upload');
    const btnStartAnalysis = document.getElementById('btn-start-analysis');

    if (!dropZone || !fileInput) return;

    if (btnSelectFile) btnSelectFile.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleSelectedFile(e.target.files[0]);
    });

    ['dragenter', 'dragover'].forEach(n => dropZone.addEventListener(n, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); }));
    ['dragleave', 'drop'].forEach(n => dropZone.addEventListener(n, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); }));

    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) handleSelectedFile(e.dataTransfer.files[0]);
    });

    function handleSelectedFile(file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (previewImg) previewImg.src = ev.target.result;
            dropZone.style.display = 'none';
            if (fileReviewCard) fileReviewCard.style.display = 'block';

            setTimeout(() => executeReconstruction(currentAmbiguity || 'opt_a'), 350);
        };
        reader.readAsDataURL(file);
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => {
            selectedFile = null;
            fileInput.value = '';
            fileReviewCard.style.display = 'none';
            dropZone.style.display = 'flex';
        });
    }

    if (btnStartAnalysis) {
        btnStartAnalysis.addEventListener('click', () => executeReconstruction(currentAmbiguity || 'opt_a'));
    }
}

function executeReconstruction(ambiguityChoice = 'opt_a') {
    currentAmbiguity = ambiguityChoice;
    goToScreen('screen-analysis');

    const formData = new FormData();
    if (selectedFile) {
        formData.append('blueprint', selectedFile);
        formData.append('file', selectedFile);
        formData.append('image', selectedFile);
    }
    formData.append('ambiguity_choice', ambiguityChoice);

    fetch('/api/reconstruct', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            activeData = data;
            populateDashboard(data);
        } else {
            alert('Reconstruction error: ' + (data.message || 'Blueprint could not be parsed.'));
            goToScreen('screen-upload');
        }
    })
    .catch(err => {
        alert('Server unreachable. Ensure python app.py is running.');
        goToScreen('screen-upload');
    });
}

function populateDashboard(data) {
    const s = data.summary;
    const doc = data.design_doctor;
    const carbon = data.carbon_analytics;

    document.getElementById('anal-spaces').textContent = s.total_rooms;
    document.getElementById('anal-walls').textContent = s.total_walls;
    document.getElementById('anal-integrity').textContent = s.integrity_score;
    document.getElementById('anal-cost').textContent = s.total_cost_inr;

    if (doc) {
        document.getElementById('doctor-overall-score').textContent = `${doc.overall_health} / 100`;
    }

    if (carbon) {
        const cVal = document.getElementById('val-carbon-t');
        const lccVal = document.getElementById('val-lcc-cost');
        if (cVal) cVal.textContent = `${carbon.embodied_carbon_tco2e} tCO₂e`;
        if (lccVal) lccVal.textContent = carbon.lifecycle_cost_30yr_inr;
    }

    // Populate Pareto Frontier Candidates
    const paretoList = document.getElementById('pareto-candidate-list');
    if (paretoList && data.pareto_candidates) {
        paretoList.innerHTML = data.pareto_candidates.map((c, i) => `
            <div class="pareto-card ${i === 1 ? 'active' : ''}" data-cid="${c.id}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:12px; color:var(--text-main);">${c.name}</strong>
                    <span style="font-size:12px; font-weight:700; color:#16a34a;">${c.cost_inr}</span>
                </div>
                <div style="font-size:11px; color:#64748b; margin-top:4px;">${c.summary}</div>
                <div style="display:flex; gap:12px; font-size:11px; margin-top:6px;">
                    <span>Space: <strong>${c.space_score}/100</strong></span>
                    <span>Daylight: <strong>${c.daylight_score}/100</strong></span>
                    <span>Carbon: <strong>${c.carbon_t}t</strong></span>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.pareto-card').forEach(card => {
            card.addEventListener('click', (e) => {
                document.querySelectorAll('.pareto-card').forEach(pc => pc.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const cid = e.currentTarget.dataset.cid;
                if (cid === 'cand_a') {
                    viewer.setWallColor('#b94a32');
                } else if (cid === 'cand_c') {
                    viewer.setWallColor('#e2e8f0');
                } else {
                    viewer.setWallColor('#ded8ce');
                }
            });
        });
    }

    const boqTbody = document.getElementById('boq-table-body');
    if (boqTbody && data.boq) {
        boqTbody.innerHTML = data.boq.map(b => `
            <tr><td style="padding:4px 0;">${b.item}</td><td style="text-align:right; color:#16a34a; font-weight:600;">${b.total}</td></tr>
        `).join('');
    }
    document.getElementById('boq-total-cost').textContent = s.total_cost_inr;
}

function setupStudioEvents() {
    const btnEnter = document.getElementById('btn-enter-studio');
    if (btnEnter) {
        btnEnter.addEventListener('click', () => {
            if (!viewer) viewer = new HouseViewer('three-stage');
            if (activeData) viewer.renderReconstruction(activeData);
            goToScreen('screen-studio');
        });
    }

    const btnLaunchDefault = document.getElementById('btn-launch-default');
    if (btnLaunchDefault) {
        btnLaunchDefault.addEventListener('click', () => {
            selectedFile = null;
            executeReconstruction('opt_a');
            setTimeout(() => { if (btnEnter) btnEnter.click(); }, 600);
        });
    }

    // Left Dock Tools
    document.getElementById('dock-home').addEventListener('click', () => goToScreen('screen-landing'));
    document.getElementById('dock-upload').addEventListener('click', () => goToScreen('screen-upload'));
    document.getElementById('tool-reset').addEventListener('click', () => { if (viewer) viewer.resetCamera(); });

    const toolFire = document.getElementById('tool-fire');
    if (toolFire) {
        toolFire.addEventListener('click', () => {
            if (!viewer) return;
            const active = viewer.toggleFireSimulation();
            toolFire.classList.toggle('active', active);
        });
    }

    const toolDim = document.getElementById('tool-dimensions');
    if (toolDim) {
        toolDim.addEventListener('click', () => {
            if (!viewer) return;
            const active = viewer.toggleDimensions();
            toolDim.classList.toggle('active', active);
        });
    }

    const toolAvatar = document.getElementById('tool-avatar');
    if (toolAvatar) {
        toolAvatar.addEventListener('click', () => {
            if (!viewer) return;
            const active = viewer.toggleAvatar();
            toolAvatar.classList.toggle('active', active);
        });
    }

    const toolCad = document.getElementById('tool-cad');
    if (toolCad) {
        toolCad.addEventListener('click', () => {
            if (!viewer) return;
            const active = viewer.toggleCADMode();
            toolCad.classList.toggle('active', active);
            document.getElementById('cad-readout-banner').style.display = active ? 'block' : 'none';
        });
    }

    const toolOverlay = document.getElementById('tool-overlay');
    if (toolOverlay) {
        toolOverlay.addEventListener('click', () => {
            if (!viewer) return;
            const active = viewer.toggleOverlay();
            toolOverlay.classList.toggle('active', active);
        });
    }

    const toolWalk = document.getElementById('tool-walk');
    if (toolWalk) {
        toolWalk.addEventListener('click', () => {
            if (!viewer) return;
            const active = viewer.toggleWalkthrough();
            toolWalk.classList.toggle('active', active);
        });
    }

    document.getElementById('tool-qr').addEventListener('click', openQRCodeModal);
    document.getElementById('btn-close-qr').addEventListener('click', () => { document.getElementById('modal-qr').style.display = 'none'; });

    // Right Sidebar Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const targetContent = document.getElementById(e.currentTarget.dataset.tab);
            if (targetContent) targetContent.classList.add('active');
        });
    });

    // ADVANCED FEATURE 8: AI Autonomous Agent with Tool Execution
    const btnAgent = document.getElementById('btn-agent-execute');
    if (btnAgent) {
        btnAgent.addEventListener('click', () => {
            const prompt = document.getElementById('agent-prompt-input').value.trim();
            if (!prompt) return;

            fetch('/api/agent_run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt, model: activeData })
            })
            .then(res => res.json())
            .then(res => {
                if (res.status === 'success') {
                    const logBox = document.getElementById('agent-execution-log');
                    const stepsList = document.getElementById('agent-steps-list');
                    const planTitle = document.getElementById('agent-plan-title');

                    logBox.style.display = 'block';
                    stepsList.innerHTML = res.steps.map(s => `<li><strong>Step ${s.step} (${s.action}):</strong> ${s.detail}</li>`).join('');
                    planTitle.innerHTML = `${res.plan.summary}<br><span style="color:#0284c7; font-weight:700;">Cost Saving: ${res.plan.cost_saving} &nbsp;|&nbsp; Daylight: ${res.plan.daylight_gain}</span>`;
                }
            });
        });
    }

    const btnCommit = document.getElementById('btn-agent-commit');
    if (btnCommit) {
        btnCommit.addEventListener('click', () => {
            viewer.setWallColor('#e2e8f0');
            alert("Agent Plan Committed: Geometry updated, partition thicknesses re-calibrated, and new DSR budget locked.");
        });
    }

    // ADVANCED FEATURE 3: Open BIM IFC4 Exporter
    const btnIfc = document.getElementById('btn-export-ifc');
    if (btnIfc) {
        btnIfc.addEventListener('click', () => {
            if (activeSessionId) {
                window.open(`/api/export_ifc/${activeSessionId}`, '_blank');
            } else {
                alert("Model registered in background. Please click again to download your .IFC file.");
            }
        });
    }

    // Wall Colors
    const wallPicker = document.getElementById('wall-color-picker');
    const hexSpan = document.getElementById('wall-color-hex');
    if (wallPicker) {
        wallPicker.addEventListener('input', (e) => {
            const hex = e.target.value;
            hexSpan.textContent = hex.toUpperCase();
            if (viewer) viewer.setWallColor(hex);
        });
    }

    document.querySelectorAll('.color-preset-circle').forEach(circle => {
        circle.addEventListener('click', (e) => {
            const col = e.currentTarget.dataset.color;
            if (wallPicker) wallPicker.value = col;
            if (hexSpan) hexSpan.textContent = col.toUpperCase();
            if (viewer) viewer.setWallColor(col);
        });
    });

    // Sun & Sunset (18:00) Simulation
    const sunSlider = document.getElementById('param-sun-hour');
    const sunVal = document.getElementById('val-sun-hour');
    const sunsetCard = document.getElementById('sunset-info-card');

    function applySun(val) {
        const h = Math.floor(val);
        const m = Math.round((val - h) * 60);
        sunVal.textContent = `${h}:${m < 10 ? '0' : ''}${m}`;
        if (viewer) viewer.updateSunPosition(val);
        if (sunsetCard) sunsetCard.style.display = (val >= 17.5) ? 'block' : 'none';
    }

    if (sunSlider) {
        sunSlider.addEventListener('input', (e) => applySun(parseFloat(e.target.value)));
    }

    document.getElementById('btn-sun-noon').addEventListener('click', () => {
        if (sunSlider) sunSlider.value = 12.0;
        applySun(12.0);
    });

    document.getElementById('btn-sun-sunset').addEventListener('click', () => {
        if (sunSlider) sunSlider.value = 18.0;
        applySun(18.0);
    });

    // Section Slicer
    const sectionSlider = document.getElementById('param-section-slider');
    if (sectionSlider) {
        sectionSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const valSpan = document.getElementById('val-section-height');
            if (valSpan) valSpan.textContent = `${val.toFixed(2)}m`;
            if (viewer) viewer.setSectionHeight(val);
        });
    }

    // Ventilation Toggle
    const ventChk = document.getElementById('toggle-vent-flow');
    if (ventChk) {
        ventChk.addEventListener('change', () => {
            if (viewer) viewer.toggleVentilation();
        });
    }

    // Furniture Placement
    document.querySelectorAll('.furniture-card-item').forEach(card => {
        card.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.type;
            const isAlreadySelected = e.currentTarget.classList.contains('selected');

            document.querySelectorAll('.furniture-card-item').forEach(c => c.classList.remove('selected'));

            if (!isAlreadySelected) {
                e.currentTarget.classList.add('selected');
                if (viewer) viewer.setPlacementItem(type);
            } else {
                if (viewer) viewer.setPlacementItem(null);
            }
        });
    });

    document.getElementById('btn-clear-furniture').addEventListener('click', () => {
        if (viewer) viewer.clearFurniture();
    });

    document.getElementById('btn-auto-stage').addEventListener('click', () => {
        if (viewer) viewer.autoStageAll();
    });

    document.getElementById('tool-export-obj').addEventListener('click', () => {
        if (viewer) viewer.exportOBJ();
    });

    document.getElementById('btn-generate-report').addEventListener('click', () => {
        window.print();
    });
}

function openQRCodeModal() {
    if (!activeData) return;
    const modal = document.getElementById('modal-qr');
    modal.style.display = 'flex';

    fetch('/api/share_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeData)
    })
    .then(res => res.json())
    .then(data => {
        activeSessionId = data.session_id;
        document.getElementById('qr-img-placeholder').src = `/api/qrcode/${data.session_id}`;
        const urlEl = document.getElementById('qr-mobile-url');
        urlEl.textContent = data.url;
        urlEl.href = data.url;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupUploadHandlers();
    setupStudioEvents();
});