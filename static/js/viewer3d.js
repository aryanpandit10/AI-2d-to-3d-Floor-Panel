/**
 * Patrick Architect - Core 3D WebGL Rendering Engine (viewer3d.js)
 * Includes TransformControls for interactive Scaling, Rotation, Elevation, and Dragging.
 */

class HouseViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.orbitControls = null;
        this.transformControls = null;
        this.pointerLockControls = null;

        this.houseGroup = new THREE.Group();
        this.furnitureGroup = new THREE.Group();
        this.dimensionGroup = new THREE.Group();
        this.fireGroup = new THREE.Group();
        this.avatarGroup = new THREE.Group();
        this.ventGroup = new THREE.Group();

        this.dirLight = null;
        this.hemiLight = null;
        this.sunSphere = null;

        this.currentData = null;
        this.wallMaterial = null;
        this.capMaterial = null;
        this.clippingPlane = null;
        this.selectedFurniture = null;

        this.isFireActive = false;
        this.isDimensionsActive = false;
        this.isAvatarActive = false;
        this.isCadMode = false;
        this.isOverlayActive = false;
        this.isWalkthrough = false;
        this.isVentActive = false;
        this.placementItemType = null;
        this.cadPoints = [];

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.prevTime = performance.now();

        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf6f6f4);

        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(24, 28, 26);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.localClippingEnabled = true;
        this.container.appendChild(this.renderer.domElement);

        this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.08;
        this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;

        this.transformControls = new THREE.TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.size = 0.75;
        this.scene.add(this.transformControls);

        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.orbitControls.enabled = !event.value;
        });

        this.pointerLockControls = new THREE.PointerLockControls(this.camera, document.body);

        this.clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 4.0);

        this.wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xded8ce,
            roughness: 0.8,
            metalness: 0.05,
            clippingPlanes: [this.clippingPlane],
            clipShadows: true
        });

        this.capMaterial = new THREE.MeshStandardMaterial({
            color: 0x2b2d42,
            roughness: 0.5,
            metalness: 0.1,
            clippingPlanes: [this.clippingPlane]
        });

        this.setupLights();
        this.setupEnvironment();
        this.setupInteraction();

        this.scene.add(this.houseGroup);
        this.scene.add(this.furnitureGroup);
        this.scene.add(this.dimensionGroup);
        this.scene.add(this.fireGroup);
        this.scene.add(this.avatarGroup);
        this.scene.add(this.ventGroup);

        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    setupLights() {
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xd4d8d1, 0.85);
        this.scene.add(this.hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xfff7e6, 1.25);
        this.dirLight.position.set(20, 32, 18);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.bias = -0.0001;
        this.scene.add(this.dirLight);

        const sunGeo = new THREE.SphereGeometry(1.2, 16, 16);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
        this.sunSphere = new THREE.Mesh(sunGeo, sunMat);
        this.sunSphere.position.copy(this.dirLight.position);
        this.scene.add(this.sunSphere);
    }

    setupEnvironment() {
        const grid = new THREE.GridHelper(70, 70, 0x0284c7, 0xe2e8f0);
        grid.position.y = -0.16;
        this.scene.add(grid);

        const groundGeo = new THREE.PlaneGeometry(160, 160);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0xfbfbf9, roughness: 0.9 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.18;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    setupInteraction() {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        this.renderer.domElement.addEventListener('click', (event) => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, this.camera);

            if (this.placementItemType) {
                const intersects = raycaster.intersectObjects(this.houseGroup.children, true);
                if (intersects.length > 0) {
                    const pt = intersects[0].point;
                    this.addFurnitureItem(this.placementItemType, pt.x, pt.z);
                    this.setPlacementItem(null);
                }
                return;
            }

            const furnitureIntersects = raycaster.intersectObjects(this.furnitureGroup.children, true);
            if (furnitureIntersects.length > 0) {
                let rootObj = furnitureIntersects[0].object;
                while (rootObj.parent && rootObj.parent !== this.furnitureGroup) {
                    rootObj = rootObj.parent;
                }
                this.selectedFurniture = rootObj;
                this.transformControls.attach(rootObj);
                return;
            }

            if (this.isCadMode) {
                const intersects = raycaster.intersectObjects(this.houseGroup.children, true);
                if (intersects.length > 0) {
                    const pt = intersects[0].point;
                    this.cadPoints.push(pt);
                    const banner = document.getElementById('cad-readout-banner');
                    if (this.cadPoints.length === 1) {
                        if (banner) banner.textContent = `Point A: [${pt.x.toFixed(2)}m, ${pt.z.toFixed(2)}m]. Click Point B.`;
                    } else if (this.cadPoints.length === 2) {
                        const distM = this.cadPoints[0].distanceTo(this.cadPoints[1]);
                        const distFt = distM * 3.28084;
                        if (banner) banner.textContent = `📏 Measured Distance: ${distM.toFixed(2)} m (${distFt.toFixed(2)} ft)`;
                        this.drawCadMeasureLine(this.cadPoints[0], this.cadPoints[1]);
                        this.cadPoints = [];
                    }
                }
                return;
            }

            const intersects = raycaster.intersectObjects(this.houseGroup.children, true);
            if (intersects.length > 0) {
                const obj = intersects[0].object;
                if (obj.userData && obj.userData.info) {
                    this.showInspector(obj.userData.info);
                }
            }
        });

        window.addEventListener('keydown', (event) => {
            switch (event.code) {
                case 'KeyG':
                    this.transformControls.setMode('translate');
                    break;
                case 'KeyR':
                    this.transformControls.setMode('rotate');
                    break;
                case 'KeyS':
                    this.transformControls.setMode('scale');
                    break;
                case 'Escape':
                    this.transformControls.detach();
                    this.selectedFurniture = null;
                    break;
            }
        });

        const onKeyDown = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = true; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = true; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = true; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = true; break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = false; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = false; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = false; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        this.pointerLockControls.addEventListener('unlock', () => {
            this.isWalkthrough = false;
            document.getElementById('walk-crosshair').style.display = 'none';
            document.getElementById('walk-instruction-banner').style.display = 'none';
            const btn = document.getElementById('tool-walk');
            if (btn) btn.classList.remove('active');
            this.orbitControls.enabled = true;
        });
    }

    renderReconstruction(data) {
        this.currentData = data;
        this.transformControls.detach();
        this.clearGroup(this.houseGroup);
        this.clearGroup(this.furnitureGroup);
        this.clearGroup(this.dimensionGroup);
        this.clearGroup(this.fireGroup);
        this.clearGroup(this.avatarGroup);
        this.clearGroup(this.ventGroup);

        const slabMesh = new THREE.Mesh(
            new THREE.BoxGeometry(42, 0.3, 34),
            new THREE.MeshStandardMaterial({ color: 0xefede8, roughness: 0.9 })
        );
        slabMesh.position.set(0, -0.15, 0);
        slabMesh.receiveShadow = true;
        this.houseGroup.add(slabMesh);

        data.walls.forEach(w => {
            const dx = w.p2[0] - w.p1[0];
            const dz = w.p2[1] - w.p1[1];
            const len = Math.hypot(dx, dz);
            const angle = Math.atan2(dz, dx);
            const midX = (w.p1[0] + w.p2[0]) / 2;
            const midZ = (w.p1[1] + w.p2[1]) / 2;

            const wallGeom = new THREE.BoxGeometry(len, 2.8, 0.23);
            const wallMesh = new THREE.Mesh(wallGeom, this.wallMaterial);
            wallMesh.position.set(midX, 1.4, midZ);
            wallMesh.rotation.y = -angle;
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            wallMesh.userData = { info: { type: 'Wall', data: w } };
            this.houseGroup.add(wallMesh);

            const capGeom = new THREE.BoxGeometry(len, 0.05, 0.26);
            const capMesh = new THREE.Mesh(capGeom, this.capMaterial);
            capMesh.position.set(midX, 2.82, midZ);
            capMesh.rotation.y = -angle;
            this.houseGroup.add(capMesh);
        });

        if (data.rooms) {
            const palette = [0xeae2b7, 0xfdf0d5, 0xe8e8e4, 0xd8e2dc, 0xf5ebe0];
            data.rooms.forEach((r, idx) => {
                const b = r.bounds;
                const floorGeom = new THREE.PlaneGeometry(b.w, b.d);
                const floorMat = new THREE.MeshStandardMaterial({
                    color: palette[idx % palette.length],
                    roughness: 0.7,
                    clippingPlanes: [this.clippingPlane]
                });
                const floorMesh = new THREE.Mesh(floorGeom, floorMat);
                floorMesh.rotation.x = -Math.PI / 2;
                floorMesh.position.set(b.x + b.w / 2, 0.02, b.z + b.d / 2);
                floorMesh.receiveShadow = true;
                floorMesh.userData = { info: { type: 'Room', data: r } };
                this.houseGroup.add(floorMesh);
            });
        }
    }

    setWallColor(colorHex) {
        if (this.wallMaterial) {
            this.wallMaterial.color.set(colorHex);
        }
    }

    setSectionHeight(val) {
        if (this.clippingPlane) {
            this.clippingPlane.constant = val;
        }
    }

    updateSunPosition(hour) {
        const angle = ((hour - 6) / 12) * Math.PI;
        const radius = 35;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const z = 18;

        if (this.dirLight) {
            this.dirLight.position.set(x, Math.max(y, 2), z);
            if (this.sunSphere) this.sunSphere.position.copy(this.dirLight.position);

            if (hour >= 17.5) {
                this.dirLight.color.setHex(0xf97316);
                this.hemiLight.color.setHex(0xfde68a);
                this.scene.background.setHex(0xfde68a);
            } else if (hour <= 7.5) {
                this.dirLight.color.setHex(0xfb923c);
                this.hemiLight.color.setHex(0xfef3c7);
                this.scene.background.setHex(0xfef3c7);
            } else {
                this.dirLight.color.setHex(0xfff7e6);
                this.hemiLight.color.setHex(0xffffff);
                this.scene.background.setHex(0xf6f6f4);
            }
        }
    }

    toggleFireSimulation() {
        this.isFireActive = !this.isFireActive;
        const banner = document.getElementById('emergency-banner');
        if (banner) banner.style.display = this.isFireActive ? 'block' : 'none';

        if (this.isFireActive && this.currentData && this.currentData.egress) {
            this.clearGroup(this.fireGroup);
            const pts = this.currentData.egress.path.map(p => new THREE.Vector3(p.pos[0], p.pos[1] + 0.1, p.pos[2]));
            const curve = new THREE.CatmullRomCurve3(pts);
            const tubeGeo = new THREE.TubeGeometry(curve, 40, 0.12, 8, false);
            const tubeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
            const tube = new THREE.Mesh(tubeGeo, tubeMat);
            this.fireGroup.add(tube);
        } else {
            this.clearGroup(this.fireGroup);
        }
        return this.isFireActive;
    }

    toggleDimensions() {
        this.isDimensionsActive = !this.isDimensionsActive;
        if (this.isDimensionsActive && this.currentData) {
            this.clearGroup(this.dimensionGroup);
            this.currentData.walls.forEach(w => {
                const p1 = new THREE.Vector3(w.p1[0], 2.9, w.p1[1]);
                const p2 = new THREE.Vector3(w.p2[0], 2.9, w.p2[1]);
                const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
                const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0x0284c7 }));
                this.dimensionGroup.add(line);
            });
        } else {
            this.clearGroup(this.dimensionGroup);
        }
        return this.isDimensionsActive;
    }

    toggleAvatar() {
        this.isAvatarActive = !this.isAvatarActive;
        if (this.isAvatarActive) {
            this.clearGroup(this.avatarGroup);
            const avatar = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.4), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
            body.position.y = 0.7;
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshStandardMaterial({ color: 0xfde047 }));
            head.position.y = 1.55;
            avatar.add(body);
            avatar.add(head);
            avatar.position.set(0, 0, 0);
            this.avatarGroup.add(avatar);
        } else {
            this.clearGroup(this.avatarGroup);
        }
        return this.isAvatarActive;
    }

    toggleCADMode() {
        this.isCadMode = !this.isCadMode;
        this.cadPoints = [];
        return this.isCadMode;
    }

    drawCadMeasureLine(p1, p2) {
        const geom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(p1.x, p1.y + 0.05, p1.z),
            new THREE.Vector3(p2.x, p2.y + 0.05, p2.z)
        ]);
        const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3 }));
        this.houseGroup.add(line);
    }

    toggleOverlay() {
        this.isOverlayActive = !this.isOverlayActive;
        return this.isOverlayActive;
    }

    toggleWalkthrough() {
        this.isWalkthrough = !this.isWalkthrough;
        if (this.isWalkthrough) {
            this.transformControls.detach();
            this.orbitControls.enabled = false;
            this.camera.position.set(0, 1.65, 0);
            this.pointerLockControls.lock();
            document.getElementById('walk-crosshair').style.display = 'block';
            document.getElementById('walk-instruction-banner').style.display = 'block';
        } else {
            this.pointerLockControls.unlock();
        }
        return this.isWalkthrough;
    }

    toggleVentilation() {
        this.isVentActive = !this.isVentActive;
        if (this.isVentActive && this.currentData && this.currentData.rooms) {
            this.clearGroup(this.ventGroup);
            this.currentData.rooms.forEach(r => {
                const b = r.bounds;
                const arrow = new THREE.ArrowHelper(
                    new THREE.Vector3(1, 0, 0),
                    new THREE.Vector3(b.x + 0.5, 1.2, b.z + b.d / 2),
                    b.w - 1,
                    0x38bdf8
                );
                this.ventGroup.add(arrow);
            });
        } else {
            this.clearGroup(this.ventGroup);
        }
        return this.isVentActive;
    }

    resetCamera() {
        this.camera.position.set(24, 28, 26);
        this.orbitControls.target.set(0, 0, 0);
    }

    setPlacementItem(type) {
        this.placementItemType = type;
        const banner = document.getElementById('placing-banner');
        if (banner) banner.style.display = type ? 'block' : 'none';
    }

    addFurnitureItem(type, x, z) {
        const item = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 });
        const fabricMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });

        if (type === 'bed') {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 1.8), woodMat);
            frame.position.y = 0.2;
            const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.6), fabricMat);
            mattress.position.y = 0.5;
            item.add(frame);
            item.add(mattress);
        } else if (type === 'sofa') {
            const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 0.9), fabricMat);
            base.position.y = 0.2;
            const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.3), fabricMat);
            back.position.set(0, 0.55, -0.3);
            item.add(base);
            item.add(back);
        } else if (type === 'dining') {
            const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 1.0), woodMat);
            table.position.y = 0.375;
            item.add(table);
        } else {
            const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.6), woodMat);
            box.position.y = 0.6;
            item.add(box);
        }

        item.position.set(x, 0, z);
        this.furnitureGroup.add(item);

        this.selectedFurniture = item;
        this.transformControls.attach(item);
    }

    autoStageAll() {
        if (!this.currentData || !this.currentData.rooms) return;
        this.clearFurniture();
        this.currentData.rooms.forEach(r => {
            const b = r.bounds;
            const cx = b.x + b.w / 2;
            const cz = b.z + b.d / 2;
            if (r.name.includes('Bedroom')) {
                this.addFurnitureItem('bed', cx, cz);
            } else if (r.name.includes('Living')) {
                this.addFurnitureItem('sofa', cx, cz);
            } else if (r.name.includes('Kitchen') || r.name.includes('Dining')) {
                this.addFurnitureItem('dining', cx, cz);
            }
        });
    }

    clearFurniture() {
        this.transformControls.detach();
        this.selectedFurniture = null;
        this.clearGroup(this.furnitureGroup);
    }

    applyStagingTheme(themeKey) {
        const themes = {
            modern: { wallColor: 0xf5f5f4, furnitureFabric: 0x64748b, wood: 0xd4a373 },
            luxury: { wallColor: 0x1e293b, furnitureFabric: 0x0f172a, wood: 0x451a03 },
            industrial: { wallColor: 0x78716c, furnitureFabric: 0x27272a, wood: 0x713f12 },
            boho: { wallColor: 0xfef3c7, furnitureFabric: 0xd6d3d1, wood: 0xeab308 }
        };

        const cfg = themes[themeKey] || themes.modern;
        this.setWallColor(cfg.wallColor);

        this.furnitureGroup.traverse(child => {
            if (child.isMesh && child.material) {
                if (child.material.roughness > 0.75) {
                    child.material.color.setHex(cfg.furnitureFabric);
                } else {
                    child.material.color.setHex(cfg.wood);
                }
            }
        });
    }

    captureViewportImage() {
        this.transformControls.detach();
        this.renderer.render(this.scene, this.camera);
        if (this.selectedFurniture) this.transformControls.attach(this.selectedFurniture);
        return this.renderer.domElement.toDataURL('image/png');
    }

    showInspector(info) {
        const overlay = document.getElementById('inspector-overlay');
        const title = document.getElementById('insp-elem-title');
        const body = document.getElementById('insp-elem-body');
        if (!overlay || !title || !body) return;

        overlay.style.display = 'block';
        if (info.type === 'Wall') {
            const w = info.data;
            title.textContent = `WALL: ${w.id} (${w.type})`;
            body.innerHTML = `
                <div>Length: <strong>${w.length_m} m</strong> | Height: <strong>${w.height_m} m</strong></div>
                <div>Volume: <strong>${w.volume_m3} m³</strong> | Cost: <strong>₹${w.cost_inr.toLocaleString()}</strong></div>
                <div style="margin-top:4px; color:#38bdf8;"><strong>IS 456 Structural Solver:</strong></div>
                <div>Bending Moment: <strong>${w.structural_solver.bending_moment_knm} kNm</strong></div>
                <div>Deflection: <strong>${w.structural_solver.deflection_mm} mm</strong> (${w.structural_solver.status})</div>
            `;
        } else if (info.type === 'Room') {
            const r = info.data;
            title.textContent = `ROOM: ${r.name}`;
            body.innerHTML = `
                <div>Area: <strong>${r.area_sqm} m²</strong> (${r.area_sqft} sq ft)</div>
                <div>NBC 2016 Compliant: <strong>${r.nbc_compliant ? '✅ Yes' : '⚠️ Non-compliant'}</strong></div>
                <div>Daylight: <strong>${r.daylight.status}</strong> | Cross Vent: <strong>${r.ventilation.cross_vent ? 'Yes' : 'No'}</strong></div>
                <div style="margin-top:4px; color:#4ade80;"><strong>IoT Live Telemetry:</strong></div>
                <div>Temp: <strong>${r.iot_live.temp_c}°C</strong> | Humidity: <strong>${r.iot_live.humidity_pct}%</strong></div>
                <div>CO₂: <strong>${r.iot_live.co2_ppm} ppm</strong> | Status: <strong>${r.iot_live.occupancy}</strong></div>
            `;
        }
    }

    exportOBJ() {
        this.transformControls.detach();
        let objContent = "# Patrick Architect OBJ Export\n";
        let vOffset = 1;

        this.houseGroup.traverse(child => {
            if (child.isMesh && child.geometry) {
                const geom = child.geometry.isBufferGeometry ? child.geometry : new THREE.BufferGeometry().fromGeometry(child.geometry);
                const pos = geom.attributes.position;
                if (!pos) return;

                child.updateMatrixWorld();
                const matrix = child.matrixWorld;

                for (let i = 0; i < pos.count; i++) {
                    const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(matrix);
                    objContent += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}\n`;
                }

                for (let i = 0; i < pos.count; i += 3) {
                    objContent += `f ${vOffset + i} ${vOffset + i + 1} ${vOffset + i + 2}\n`;
                }
                vOffset += pos.count;
            }
        });

        const blob = new Blob([objContent], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "Patrick_Architect_Model.obj";
        a.click();
        if (this.selectedFurniture) this.transformControls.attach(this.selectedFurniture);
    }

    clearGroup(group) {
        while (group.children.length > 0) {
            const obj = group.children[0];
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
            group.remove(obj);
        }
    }

    onWindowResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.isWalkthrough && this.pointerLockControls.isLocked) {
            const time = performance.now();
            const delta = (time - this.prevTime) / 1000;

            this.velocity.x -= this.velocity.x * 10.0 * delta;
            this.velocity.z -= this.velocity.z * 10.0 * delta;

            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
            this.direction.normalize();

            if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * 40.0 * delta;
            if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * 40.0 * delta;

            this.pointerLockControls.moveRight(-this.velocity.x * delta);
            this.pointerLockControls.moveForward(-this.velocity.z * delta);
            this.camera.position.y = 1.65;

            this.prevTime = time;
        }

        if (this.orbitControls && !this.isWalkthrough) {
            this.orbitControls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }
}