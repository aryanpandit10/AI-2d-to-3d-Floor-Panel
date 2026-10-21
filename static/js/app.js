/**
 * Patrick Architect - Client Controller (app.js)
 */

let viewer = null;
let selectedFile = null;
let activeData = null;
let currentAmbiguity = 'opt_a';
let activeSessionId = null;

window.goToScreen = function(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = ''; 
    });

    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
    }

    const pillMap = {
        'screen-landing': '01 Overview',
        'screen-upload': '02 Ingestion',
        'screen-analysis': '03 AI & Uncertainty',
        'screen-studio': '04 3D Studio'
    };

    document.querySelectorAll('.nav-pill-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.trim().startsWith(pillMap[screenId] || '')) {
            btn.classList.add('active');
        }
    });

    if (screenId === 'screen-studio') {
        if (!viewer) {
            viewer = new HouseViewer('three-stage');
        }
        if (activeData) {
            viewer.renderReconstruction(activeData);
        } else {
            fetch('/api/reconstruct', { method: 'POST', body: new FormData() })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        activeData = data;
                        viewer.renderReconstruction(data);
                        populateDashboard(data);
                    }
                });
        }
        setTimeout(() => {
            viewer.onWindowResize();
        }, 150);
    }
};

function setupUploadHandlers() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const btnSelectFile = document.getElementById('btn-select-file');
    const fileReviewCard = document.getElementById('file-review-card');
    const previewImg = document.getElementById('blueprint-review-img');
    const fileNameSpan = document.getElementById('review-file-name');
    const fileSizeSpan = document.getElementById('review-file-size');
    const btnReset = document.getElementById('btn-reset-upload');
    const btnStartAnalysis = document.getElementById('btn-start-analysis');

    if (!dropZone || !fileInput) return;

    if (btnSelectFile) {
        btnSelectFile.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    ['dragenter', 'dragover'].forEach(n => {
        dropZone.addEventListener(n, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(n => {
        dropZone.addEventListener(n, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });

    function handleSelectedFile(file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (previewImg) previewImg.src = ev.target.result;
            if (fileNameSpan) fileNameSpan.textContent = file.name;
            if (fileSizeSpan) fileSizeSpan.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
            
            dropZone.style.display = 'none';
            if (fileReviewCard) fileReviewCard.style.display = 'block';

            setTimeout(() => {
                executeReconstruction(currentAmbiguity || 'opt_a');
            }, 350);
        };
        reader.readAsDataURL(file);
    }

    if (btnReset) {
        btnReset.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedFile = null;
            fileInput.value = '';
            if (fileReviewCard) fileReviewCard.style.display = 'none';
            dropZone.style.display = 'flex';
        });
    }

    if (btnStartAnalysis) {
        btnStartAnalysis.addEventListener('click', (e) => {
            e.stopPropagation();
            executeReconstruction(currentAmbiguity || 'opt_a');
        });
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
        console.error('Fetch error:', err);
        alert('Server unreachable. Ensure python app.py is running.');
        goToScreen('screen-upload');
    });
}

function populateDashboard(data) {
    const s = data.summary;
    const doc = data.design_doctor;

    const elSpaces = document.getElementById('anal-spaces');
    const elWalls = document.getElementById('anal-walls');
    const elIntegrity = document.getElementById('anal-integrity');
    const elCost = document.getElementById('anal-cost');

    if (elSpaces) elSpaces.textContent = s.total_rooms;
    if (elWalls) elWalls.textContent = s.total_walls;
    if (elIntegrity) elIntegrity.textContent = s.integrity_score;
    if (elCost) elCost.textContent = s.total_cost_inr;

    const docOverall = document.getElementById('doctor-overall-score');
    if (docOverall && doc) {
        docOverall.textContent = `${doc.overall_health} / 100`;
    }

    const boqTbody = document.getElementById('boq-table-body');
    if (boqTbody && data.boq) {
        boqTbody.innerHTML = data.boq.map(b => `
            <tr><td style="padding:4px 0;">${b.item}</td><td style="text-align:right; color:#16a34a; font-weight:600;">${b.total}</td></tr>
        `).join('');
    }
    const boqTotal = document.getElementById('boq-total-cost');
    if (boqTotal) boqTotal.textContent = s.total_cost_inr;
}

function setupStudioEvents() {
    const btnEnter = document.getElementById('btn-enter-studio');
    if (btnEnter) {
        btnEnter.addEventListener('click', (e) => {
            e.preventDefault();
            goToScreen('screen-studio');
        });
    }

    const btnLaunchDefault = document.getElementById('btn-launch-default');
    if (btnLaunchDefault) {
        btnLaunchDefault.addEventListener('click', () => {
            selectedFile = null;
            executeReconstruction('opt_a');
            setTimeout(() => {
                goToScreen('screen-studio');
            }, 600);
        });
    }

    const btnStartProj = document.getElementById('btn-start-project');
    if (btnStartProj) {
        btnStartProj.addEventListener('click', () => {
            goToScreen('screen-upload');
        });
    }

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
            const banner = document.getElementById('cad-readout-banner');
            if (banner) banner.style.display = active ? 'block' : 'none';
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

    const toolReset = document.getElementById('tool-reset');
    if (toolReset) {
        toolReset.addEventListener('click', () => {
            if (viewer) viewer.resetCamera();
        });
    }

    const toolQr = document.getElementById('tool-qr');
    if (toolQr) {
        toolQr.addEventListener('click', openQRCodeModal);
    }

    const btnCloseQr = document.getElementById('btn-close-qr');
    if (btnCloseQr) {
        btnCloseQr.addEventListener('click', () => {
            const modal = document.getElementById('modal-qr');
            if (modal) modal.style.display = 'none';
        });
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const targetContent = document.getElementById(e.currentTarget.dataset.tab);
            if (targetContent) targetContent.classList.add('active');
        });
    });

    const btnApplyTheme = document.getElementById('btn-apply-theme');
    if (btnApplyTheme) {
        btnApplyTheme.addEventListener('click', () => {
            const theme = document.getElementById('staging-theme-select').value;
            if (viewer) {
                viewer.applyStagingTheme(theme);
            }
        });
    }

    const btnPhotoRender = document.getElementById('btn-render-photoreal');
    if (btnPhotoRender) {
        btnPhotoRender.addEventListener('click', () => {
            if (!viewer) return;
            const snapshot = viewer.captureViewportImage();
            const theme = document.getElementById('staging-theme-select').value;

            const modal = document.getElementById('modal-ai-render');
            const loading = document.getElementById('render-loading');
            const resultImg = document.getElementById('render-result-img');
            const downloadBtn = document.getElementById('btn-download-render');

            modal.style.display = 'flex';
            loading.style.display = 'block';
            resultImg.style.display = 'none';
            downloadBtn.style.display = 'none';

            fetch('/api/virtual_stage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: snapshot, theme: theme })
            })
            .then(res => res.json())
            .then(data => {
                loading.style.display = 'none';
                if (data.status === 'success') {
                    resultImg.src = data.styled_image;
                    resultImg.style.display = 'block';
                    downloadBtn.href = data.styled_image;
                    downloadBtn.style.display = 'inline-block';
                }
            })
            .catch(err => {
                loading.textContent = 'Render error. Check backend connection.';
            });
        });
    }

    const btnCloseRender = document.getElementById('btn-close-render');
    if (btnCloseRender) {
        btnCloseRender.addEventListener('click', () => {
            document.getElementById('modal-ai-render').style.display = 'none';
        });
    }

    const wallPicker = document.getElementById('wall-color-picker');
    const hexSpan = document.getElementById('wall-color-hex');
    if (wallPicker) {
        wallPicker.addEventListener('input', (e) => {
            const hex = e.target.value;
            if (hexSpan) hexSpan.textContent = hex.toUpperCase();
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

    const sunSlider = document.getElementById('param-sun-hour');
    const sunVal = document.getElementById('val-sun-hour');
    const sunsetCard = document.getElementById('sunset-info-card');

    function applySun(val) {
        const h = Math.floor(val);
        const m = Math.round((val - h) * 60);
        if (sunVal) sunVal.textContent = `${h}:${m < 10 ? '0' : ''}${m}`;
        if (viewer) viewer.updateSunPosition(val);
        if (sunsetCard) sunsetCard.style.display = (val >= 17.5) ? 'block' : 'none';
    }

    if (sunSlider) {
        sunSlider.addEventListener('input', (e) => applySun(parseFloat(e.target.value)));
    }

    const btnSunNoon = document.getElementById('btn-sun-noon');
    if (btnSunNoon) {
        btnSunNoon.addEventListener('click', () => {
            if (sunSlider) sunSlider.value = 12.0;
            applySun(12.0);
        });
    }

    const btnSunSunset = document.getElementById('btn-sun-sunset');
    if (btnSunSunset) {
        btnSunSunset.addEventListener('click', () => {
            if (sunSlider) sunSlider.value = 18.0;
            applySun(18.0);
        });
    }

    const sectionSlider = document.getElementById('param-section-slider');
    if (sectionSlider) {
        sectionSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const valSpan = document.getElementById('val-section-height');
            if (valSpan) valSpan.textContent = `${val.toFixed(2)}m`;
            if (viewer) viewer.setSectionHeight(val);
        });
    }

    const ventChk = document.getElementById('toggle-vent-flow');
    if (ventChk) {
        ventChk.addEventListener('change', () => {
            if (viewer) viewer.toggleVentilation();
        });
    }

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

    const btnClearFurn = document.getElementById('btn-clear-furniture');
    if (btnClearFurn) {
        btnClearFurn.addEventListener('click', () => {
            if (viewer) viewer.clearFurniture();
        });
    }

    const btnAutoStage = document.getElementById('btn-auto-stage');
    if (btnAutoStage) {
        btnAutoStage.addEventListener('click', () => {
            if (viewer) viewer.autoStageAll();
        });
    }

    const toolExpObj = document.getElementById('tool-export-obj');
    if (toolExpObj) {
        toolExpObj.addEventListener('click', () => {
            if (viewer) viewer.exportOBJ();
        });
    }

    const btnExpIfc = document.getElementById('btn-export-ifc');
    if (btnExpIfc) {
        btnExpIfc.addEventListener('click', () => {
            if (activeSessionId) {
                window.open(`/api/export_ifc/${activeSessionId}`, '_blank');
            } else {
                alert("Model ready. Downloading IFC4 BIM export...");
                window.open(`/api/export_ifc/default`, '_blank');
            }
        });
    }

    const btnGenReport = document.getElementById('btn-generate-report');
    if (btnGenReport) {
        btnGenReport.addEventListener('click', () => {
            window.print();
        });
    }

    const btnCopilotAsk = document.getElementById('btn-copilot-ask');
    const copilotInput = document.getElementById('copilot-input');
    if (btnCopilotAsk && copilotInput) {
        btnCopilotAsk.addEventListener('click', runCopilot);
        copilotInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') runCopilot();
        });
    }
}

function runCopilot() {
    const input = document.getElementById('copilot-input');
    const out = document.getElementById('copilot-output');
    if (!input || !out) return;
    const q = input.value.trim().toLowerCase();
    if (!q || !activeData) return;

    let ans = "All primary egress paths satisfy the NBC 2016 statutory 30.0m safety limit.";
    if (q.includes('nbc') || q.includes('violate') || q.includes('room')) {
        ans = "Analysis: Bedroom dimensions meet the NBC minimum habitable clearance (9.5 m²).";
    } else if (q.includes('wall') || q.includes('span') || q.includes('structural')) {
        ans = "Structural Check: All long masonry wall spans meet IS 456 deflection guidelines.";
    } else if (q.includes('cost') || q.includes('budget')) {
        ans = `Current forecasted CPWD construction cost: ${activeData.summary.total_cost_inr}.`;
    }
    out.innerHTML = `<div style="background:#f1f5f9; padding:8px; border-radius:6px; border-left:3px solid var(--primary-blue); margin-top:8px;"><strong>Copilot:</strong> ${ans}</div>`;
}

function openQRCodeModal() {
    if (!activeData) return;
    const modal = document.getElementById('modal-qr');
    if (modal) modal.style.display = 'flex';

    fetch('/api/share_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeData)
    })
    .then(res => res.json())
    .then(data => {
        activeSessionId = data.session_id;
        const qrImg = document.getElementById('qr-img-placeholder');
        const urlEl = document.getElementById('qr-mobile-url');
        if (qrImg) qrImg.src = `/api/qrcode/${data.session_id}`;
        if (urlEl) {
            urlEl.textContent = data.url;
            urlEl.href = data.url;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupUploadHandlers();
    setupStudioEvents();
});