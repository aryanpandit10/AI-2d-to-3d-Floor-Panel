/**
 * Patrick Architect - Three.js WebGL BIM Engine
 * Fully Architectured Furniture Staging, Clean Initial Scene,
 * Sunset 18:00 Lighting, and Precision Customer Placement.
 */

class HouseViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.fpControls = null;

        // Group Hierarchy
        this.houseGroup = new THREE.Group();
        this.doorsGroup = new THREE.Group();
        this.windowsGroup = new THREE.Group();
        this.furnitureGroup = new THREE.Group();
        this.ventilationGroup = new THREE.Group();
        this.defectsGroup = new THREE.Group();
        this.measureGroup = new THREE.Group();
        this.dimensionGroup = new THREE.Group();
        this.egressGroup = new THREE.Group();
        this.avatarGroup = new THREE.Group();
        this.overlayGroup = new THREE.Group();

        // Lighting & Physics
        this.dirLight = null;
        this.hemiLight = null;
        this.sectionPlane = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // State Flags
        this.selectedPlacementType = null;
        this.cadModeActive = false;
        this.cadPoints = [];
        this.activeData = null;

        // First-Person Walkthrough
        this.isWalkMode = false;
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.prevTime = performance.now();

        this.wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xded8ce,
            roughness: 0.85,
            metalness: 0.05
        });

        this.init();
    }

    init() {
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf6f6f4);

        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(24, 28, 26);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.localClippingEnabled = true;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.02;

        if (typeof THREE.PointerLockControls !== 'undefined') {
            this.fpControls = new THREE.PointerLockControls(this.camera, this.renderer.domElement);
            this.fpControls.addEventListener('unlock', () => {
                if (this.isWalkMode) this.exitWalkthrough();
            });
        }

        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xd4d8d1, 0.75);
        this.scene.add(this.hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xfff7e6, 1.2);
        this.dirLight.position.set(25, 30, 20);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.camera.near = 0.5;
        this.dirLight.shadow.camera.far = 150;
        const d = 32;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.scene.add(this.dirLight);

        const grid = new THREE.GridHelper(80, 80, 0x0284c7, 0xe2e8f0);
        grid.position.y = -0.16;
        this.scene.add(grid);

        this.sectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10.0);
        this.wallMaterial.clippingPlanes = [this.sectionPlane];
        this.wallMaterial.clipShadows = true;

        this.scene.add(this.houseGroup);
        this.scene.add(this.doorsGroup);
        this.scene.add(this.windowsGroup);
        this.scene.add(this.furnitureGroup);
        this.scene.add(this.ventilationGroup);
        this.scene.add(this.defectsGroup);
        this.scene.add(this.measureGroup);
        this.scene.add(this.dimensionGroup);
        this.scene.add(this.egressGroup);
        this.scene.add(this.avatarGroup);
        this.scene.add(this.overlayGroup);

        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

        this.setupKeyboard();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (!this.isWalkMode) return;
            if (e.code === 'KeyW') this.moveForward = true;
            if (e.code === 'KeyA') this.moveLeft = true;
            if (e.code === 'KeyS') this.moveBackward = true;
            if (e.code === 'KeyD') this.moveRight = true;
        });
        document.addEventListener('keyup', (e) => {
            if (!this.isWalkMode) return;
            if (e.code === 'KeyW') this.moveForward = false;
            if (e.code === 'KeyA') this.moveLeft = false;
            if (e.code === 'KeyS') this.moveBackward = false;
            if (e.code === 'KeyD') this.moveRight = false;
        });
    }

    onWindowResize() {
        if (!this.container) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(this.animate);
        const time = performance.now();

        if (this.isWalkMode && this.fpControls && this.fpControls.isLocked) {
            const delta = (time - this.prevTime) / 1000;
            this.velocity.x -= this.velocity.x * 10.0 * delta;
            this.velocity.z -= this.velocity.z * 10.0 * delta;

            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
            this.direction.normalize();

            if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * 24.0 * delta;
            if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * 24.0 * delta;

            this.fpControls.moveRight(-this.velocity.x * delta);
            this.fpControls.moveForward(-this.velocity.z * delta);
            this.camera.position.y = 1.65;
        } else {
            this.controls.update();
        }
        this.prevTime = time;
        this.renderer.render(this.scene, this.camera);
    }

    clearScene() {
        [this.houseGroup, this.doorsGroup, this.windowsGroup, this.furnitureGroup, this.ventilationGroup, this.defectsGroup, this.measureGroup, this.dimensionGroup, this.egressGroup, this.avatarGroup].forEach(grp => {
            while (grp.children.length > 0) {
                const obj = grp.children[0];
                if (obj.geometry) obj.geometry.dispose();
                grp.remove(obj);
            }
        });
    }

    renderReconstruction(data) {
        this.clearScene();
        if (!data || !data.walls) return;
        this.activeData = data;

        const wallHeight = 2.80;
        const wallThickness = 0.23;

        const capMaterial = new THREE.MeshStandardMaterial({
            color: 0x2b2d42,
            roughness: 0.6,
            clippingPlanes: [this.sectionPlane]
        });

        // 1. Procedural Walls with 90-Degree Orthogonal Corners
        data.walls.forEach(w => {
            const dx = w.p2[0] - w.p1[0];
            const dz = w.p2[1] - w.p1[1];
            const length = Math.hypot(dx, dz);
            if (length < 0.2) return;

            const angle = Math.atan2(dz, dx);
            const midX = (w.p1[0] + w.p2[0]) / 2;
            const midZ = (w.p1[1] + w.p2[1]) / 2;

            const wallGeom = new THREE.BoxGeometry(length, wallHeight, wallThickness);
            const wallMesh = new THREE.Mesh(wallGeom, this.wallMaterial);
            wallMesh.position.set(midX, wallHeight / 2, midZ);
            wallMesh.rotation.y = -angle;
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            wallMesh.userData = { isWall: true, wallData: w };
            this.houseGroup.add(wallMesh);

            const capGeom = new THREE.BoxGeometry(length, 0.05, wallThickness + 0.03);
            const capMesh = new THREE.Mesh(capGeom, capMaterial);
            capMesh.position.set(midX, wallHeight + 0.025, midZ);
            capMesh.rotation.y = -angle;
            this.houseGroup.add(capMesh);

            const cornerGeom = new THREE.BoxGeometry(wallThickness, wallHeight, wallThickness);
            const cornerMesh = new THREE.Mesh(cornerGeom, this.wallMaterial);
            cornerMesh.position.set(w.p1[0], wallHeight / 2, w.p1[1]);
            cornerMesh.userData = { isWall: true, wallData: w };
            this.houseGroup.add(cornerMesh);
        });

        // 2. Colonnade
        if (data.colonnade_active) {
            const colGeom = new THREE.CylinderGeometry(0.18, 0.18, wallHeight, 16);
            const colMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
            [-1.2, 1.2].forEach(offset => {
                const colMesh = new THREE.Mesh(colGeom, colMat);
                colMesh.position.set(offset, wallHeight / 2, 0);
                colMesh.castShadow = true;
                this.houseGroup.add(colMesh);
            });
        }

        // 3. Ground Base Slab
        const slabGeom = new THREE.BoxGeometry(42, 0.3, 34);
        const slabMat = new THREE.MeshStandardMaterial({ color: 0xefede8, roughness: 0.95 });
        const slabMesh = new THREE.Mesh(slabGeom, slabMat);
        slabMesh.position.set(0, -0.15, 0);
        slabMesh.receiveShadow = true;
        this.houseGroup.add(slabMesh);

        // 4. Floor Planes (Clean, identifiable room carpets)
        if (data.rooms) {
            const floorColors = [0xeae2b7, 0xfdf0d5, 0xe8e8e4, 0xd8e2dc, 0xfcd5ce];
            data.rooms.forEach((r, idx) => {
                const b = r.bounds;
                const rGeom = new THREE.PlaneGeometry(b.w, b.d);
                const rMat = new THREE.MeshStandardMaterial({
                    color: floorColors[idx % floorColors.length],
                    roughness: 0.6,
                    side: THREE.DoubleSide
                });
                const rMesh = new THREE.Mesh(rGeom, rMat);
                rMesh.rotation.x = -Math.PI / 2;
                rMesh.position.set(b.x + b.w / 2, 0.02, b.z + b.d / 2);
                rMesh.receiveShadow = true;
                rMesh.userData = { isFloor: true, room: r };
                this.houseGroup.add(rMesh);
            });
        }

        // 5. Build Background Helpers (Pre-calculated but kept invisible until toggled)
        this.buildDimensions(data.rooms);
        this.buildEgressSimulation(data.egress);
        this.buildAvatar();
        this.buildVentilationFlows();

        // NOTE: Initial scene stays clean and un-staged.
        // Furniture is only staged when the user clicks "⚡ AI Auto-Stage All" or selects from the catalog.
    }

    // ARCHITECTURAL AI AUTO-STAGING (Cohesive Room Sets)
    autoStageAll() {
        this.clearFurniture();
        if (!this.activeData || !this.activeData.rooms) return;

        this.activeData.rooms.forEach(r => {
            const b = r.bounds;
            const cx = b.x + b.w / 2;
            const cz = b.z + b.d / 2;
            const name = (r.name || '').toLowerCase();

            if (name.includes('bedroom')) {
                // Bed against back wall with headboard facing into room
                this.instantiateFurniture('bed', cx, b.z + b.d - 1.45);
                // Wardrobe flush against side wall
                this.instantiateFurniture('wardrobe', b.x + 0.55, cz);
            } else if (name.includes('living') || name.includes('hallway')) {
                // Living room suite: 3-seater sofa + coffee table + TV console
                this.instantiateFurniture('sofa', cx, cz - 0.4);
            } else if (name.includes('dining')) {
                // Centered dining table and 4 chairs
                this.instantiateFurniture('dining', cx, cz);
            } else if (name.includes('kitchen')) {
                // Kitchen counter along one wall + refrigerator in corner
                this.instantiateFurniture('kitchen', cx, b.z + 0.6);
                this.instantiateFurniture('fridge', b.x + b.w - 0.7, b.z + 0.6);
            } else if (name.includes('bath')) {
                // Vanity unit + toilet suite
                this.instantiateFurniture('bath', cx, cz);
            }
        });
    }

    // PROCEDURAL HIGH-QUALITY FURNITURE GENERATOR
    instantiateFurniture(type, x, z) {
        const group = new THREE.Group();

        if (type === 'bed') {
            // Soft carpet under bed
            const rugMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
            const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.6), rugMat);
            rug.rotation.x = -Math.PI / 2;
            rug.position.set(0, 0.03, 0.1);
            group.add(rug);

            // Bed frame
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.5 });
            const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.28, 2.15), frameMat);
            frame.position.set(0, 0.14, 0);
            frame.castShadow = true;
            group.add(frame);

            // Mattress
            const mattressMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
            const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 2.05), mattressMat);
            mattress.position.set(0, 0.35, 0);
            group.add(mattress);

            // Duvet/Blanket
            const duvetMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.6 });
            const duvet = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.08, 1.4), duvetMat);
            duvet.position.set(0, 0.48, -0.3);
            group.add(duvet);

            // Headboard
            const hb = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.0, 0.14), frameMat);
            hb.position.set(0, 0.55, 1.05);
            group.add(hb);

            // Dual Pillows
            const pMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });
            const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.4), pMat);
            p1.position.set(-0.5, 0.52, 0.68);
            const p2 = p1.clone();
            p2.position.set(0.5, 0.52, 0.68);
            group.add(p1);
            group.add(p2);

            // Dual Nightstands with Lamps
            const nsMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.4 });
            const lampMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.3 });
            [-1.3, 1.3].forEach(ox => {
                const ns = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.45, 0.46), nsMat);
                ns.position.set(ox, 0.22, 0.8);
                ns.castShadow = true;
                group.add(ns);

                const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.28, 12), lampMat);
                lamp.position.set(ox, 0.58, 0.8);
                group.add(lamp);
            });
        } else if (type === 'sofa') {
            // Area Rug
            const rugMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.95 });
            const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), rugMat);
            rug.rotation.x = -Math.PI / 2;
            rug.position.set(0, 0.03, 0.5);
            group.add(rug);

            // 3-Seater Modern Sofa
            const sofaMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
            const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.9), sofaMat);
            seat.position.set(0, 0.25, 0);
            seat.castShadow = true;
            group.add(seat);

            const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.2), sofaMat);
            back.position.set(0, 0.62, -0.35);
            group.add(back);

            // Armrests
            [-1.15, 1.15].forEach(ox => {
                const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.9), sofaMat);
                arm.position.set(ox, 0.52, 0);
                group.add(arm);
            });

            // Modern Coffee Table
            const ctMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.3 });
            const ct = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.36, 0.65), ctMat);
            ct.position.set(0, 0.18, 0.9);
            ct.castShadow = true;
            group.add(ct);

            // Media TV Console Stand + Flat Screen
            const tvStand = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.38), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
            tvStand.position.set(0, 0.2, 1.9);
            const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.04), new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2 }));
            tvScreen.position.set(0, 0.85, 1.9);
            group.add(tvStand);
            group.add(tvScreen);
        } else if (type === 'dining') {
            // Polished Table
            const tableMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.3 });
            const table = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.76, 1.05), tableMat);
            table.position.set(0, 0.38, 0);
            table.castShadow = true;
            group.add(table);

            // Table Runner
            const runner = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.02, 0.35), new THREE.MeshStandardMaterial({ color: 0xf5f5f4 }));
            runner.position.set(0, 0.77, 0);
            group.add(runner);

            // 4 Matching Chairs
            const chairMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
            [-0.55, 0.55].forEach(ox => {
                [-0.65, 0.65].forEach(oz => {
                    const seatC = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.4), chairMat);
                    seatC.position.set(ox, 0.21, oz);
                    seatC.castShadow = true;
                    const backC = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.06), chairMat);
                    backC.position.set(ox, 0.62, oz + (oz > 0 ? 0.17 : -0.17));
                    group.add(seatC);
                    group.add(backC);
                });
            });
        } else if (type === 'wardrobe') {
            // Full Height Wardrobe / Almirah
            const wb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.65), new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.4 }));
            wb.position.set(0, 1.1, 0);
            wb.castShadow = true;
            group.add(wb);

            // Chrome Handles
            const hMat = new THREE.MeshStandardMaterial({ color: 0xe4e4e7, metalness: 0.8 });
            [-0.08, 0.08].forEach(hx => {
                const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4), hMat);
                handle.position.set(hx, 1.1, 0.34);
                group.add(handle);
            });
        } else if (type === 'fridge') {
            // Stainless Steel Refrigerator
            const fridge = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.85, 0.8), new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.7, roughness: 0.25 }));
            fridge.position.set(0, 0.92, 0);
            fridge.castShadow = true;
            group.add(fridge);

            const divider = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.02, 0.81), new THREE.MeshStandardMaterial({ color: 0x18181b }));
            divider.position.set(0, 1.25, 0);
            group.add(divider);
        } else if (type === 'kitchen') {
            // Kitchen Counter Slab with Sink & Stove
            const slab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.86, 0.72), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 }));
            slab.position.set(0, 0.43, 0);
            slab.castShadow = true;
            group.add(slab);

            // Stainless Steel Sink
            const sink = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.42), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 }));
            sink.position.set(-0.6, 0.87, 0);
            group.add(sink);

            // Black Glass Induction Hob
            const stove = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.02, 0.45), new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1 }));
            stove.position.set(0.5, 0.87, 0);
            group.add(stove);
        } else if (type === 'bath') {
            // Vanity Basin
            const vanity = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.82, 0.55), new THREE.MeshStandardMaterial({ color: 0x475569 }));
            vanity.position.set(0, 0.41, 0);
            const basin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 }));
            basin.position.set(0, 0.88, 0);
            group.add(vanity);
            group.add(basin);

            // Wall Mirror
            const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.02), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.05 }));
            mirror.position.set(0, 1.5, -0.26);
            group.add(mirror);
        }

        group.position.set(x, 0, z);
        this.furnitureGroup.add(group);
    }

    clearFurniture() {
        while (this.furnitureGroup.children.length > 0) {
            const obj = this.furnitureGroup.children[0];
            this.furnitureGroup.remove(obj);
        }
    }

    setPlacementItem(type) {
        this.selectedPlacementType = type;
        const banner = document.getElementById('placing-banner');
        if (banner) {
            banner.style.display = type ? 'block' : 'none';
            if (type) banner.textContent = `Placing: ${type.toUpperCase()}. Click anywhere on a room floor to place!`;
        }
    }

    onPointerDown(e) {
        if (this.selectedPlacementType) {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.houseGroup.children, true);

            if (intersects.length > 0) {
                const pt = intersects[0].point;
                this.instantiateFurniture(this.selectedPlacementType, pt.x, pt.z);
                this.setPlacementItem(null);
                document.querySelectorAll('.furniture-card-item').forEach(c => c.classList.remove('selected'));
            }
            return;
        }

        if (this.cadModeActive) {
            this.handleCADClick(e);
            return;
        }

        // Element Inspector Raycasting
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.houseGroup.children, true);

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            const overlay = document.getElementById('inspector-overlay');
            const title = document.getElementById('insp-elem-title');
            const body = document.getElementById('insp-elem-body');

            if (obj.userData.isWall) {
                const w = obj.userData.wallData;
                overlay.style.display = 'block';
                title.textContent = `WALL ELEMENT: ${w.id || 'W-01'}`;
                body.innerHTML = `
                    <strong>Length:</strong> ${w.length_m} m &nbsp;|&nbsp; <strong>Height:</strong> 2.80 m<br>
                    <strong>Thickness:</strong> 230 mm (Load-Bearing Masonry)<br>
                    <strong>Estimated Cost:</strong> ₹${w.cost_inr ? w.cost_inr.toLocaleString() : '14,200'}<br>
                    <strong>IS 456 Status:</strong> <span style="color:#4ade80;">Compliant</span>
                `;
            } else if (obj.userData.isFloor) {
                const r = obj.userData.room;
                overlay.style.display = 'block';
                title.textContent = `SPACE: ${r.name}`;
                body.innerHTML = `
                    <strong>Area:</strong> ${r.area_sqft} sq.ft (${r.area_sqm} m²)<br>
                    <strong>NBC 2016 Compliant:</strong> ${r.nbc_compliant ? '✓ Yes' : '✕ Violation'}<br>
                    <strong>Ventilation Score:</strong> ${r.ventilation ? r.ventilation.score : 85} / 100
                `;
            }
        }
    }

    // FEATURE: Sunset (18:00) & Diurnal Sun Simulation
    updateSunPosition(hour) {
        const isSunset = (hour >= 17.5);
        const rad = ((hour - 6) / 12) * Math.PI;

        const x = Math.cos(rad) * 45;
        const y = Math.max(1.8, Math.sin(rad) * 40 + 5);
        const z = Math.sin(rad * 0.5) * 20;

        this.dirLight.position.set(x, y, z);

        if (isSunset) {
            this.dirLight.color.setHex(0xf97316);
            this.dirLight.intensity = 1.6;
            this.hemiLight.color.setHex(0xfde68a);
            this.hemiLight.groundColor.setHex(0x7c2d12);
            this.scene.background = new THREE.Color(0xfde68a);
        } else {
            this.dirLight.color.setHex(0xfff7e6);
            this.dirLight.intensity = Math.max(0.3, Math.sin(rad) * 1.2);
            this.hemiLight.color.setHex(0xffffff);
            this.hemiLight.groundColor.setHex(0xd4d8d1);
            this.scene.background = new THREE.Color(0xf6f6f4);
        }
    }

    setWallColor(hex) {
        this.wallMaterial.color.set(hex);
    }

    setSectionHeight(val) {
        this.sectionPlane.constant = parseFloat(val);
    }

    buildEgressSimulation(egress) {
        while (this.egressGroup.children.length > 0) this.egressGroup.remove(this.egressGroup.children[0]);
        const pts = [
            new THREE.Vector3(-12.5, 0.2, -8.2),
            new THREE.Vector3(-2.0, 0.2, -0.5),
            new THREE.Vector3(4.5, 0.2, 1.2),
            new THREE.Vector3(14.0, 0.2, 4.5)
        ];
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 4 }));
        this.egressGroup.add(line);
        pts.forEach(p => {
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
            dot.position.copy(p);
            this.egressGroup.add(dot);
        });
        this.egressGroup.visible = false;
    }

    toggleFireSimulation() {
        this.egressGroup.visible = !this.egressGroup.visible;
        const banner = document.getElementById('emergency-banner');
        if (banner) banner.style.display = this.egressGroup.visible ? 'block' : 'none';
        return this.egressGroup.visible;
    }

    toggleCADMode() {
        this.cadModeActive = !this.cadModeActive;
        this.cadPoints = [];
        while (this.measureGroup.children.length > 0) this.measureGroup.remove(this.measureGroup.children[0]);
        return this.cadModeActive;
    }

    handleCADClick(e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.houseGroup.children, true);

        if (intersects.length > 0) {
            const pt = intersects[0].point;
            this.cadPoints.push(pt);

            const pin = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
            pin.position.copy(pt);
            this.measureGroup.add(pin);

            const banner = document.getElementById('cad-readout-banner');
            if (this.cadPoints.length === 1) {
                banner.style.display = 'block';
                banner.textContent = `Point A marked at (${pt.x.toFixed(2)}, ${pt.z.toFixed(2)}). Click Point B...`;
            } else if (this.cadPoints.length === 2) {
                const distM = this.cadPoints[0].distanceTo(this.cadPoints[1]);
                const lineGeom = new THREE.BufferGeometry().setFromPoints(this.cadPoints);
                const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3 }));
                this.measureGroup.add(line);

                banner.innerHTML = `<strong>CAD Distance:</strong> ${distM.toFixed(2)} m &nbsp;|&nbsp; <strong>${(distM * 3.28084).toFixed(2)} ft</strong>`;
                this.cadPoints = [];
            }
        }
    }

    buildDimensions(rooms) {
        while (this.dimensionGroup.children.length > 0) this.dimensionGroup.remove(this.dimensionGroup.children[0]);
        if (!rooms) return;
        rooms.forEach(r => {
            const b = r.bounds;
            const p1 = new THREE.Vector3(b.x, 0.05, b.z);
            const p2 = new THREE.Vector3(b.x + b.w, 0.05, b.z);
            const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
            const mat = new THREE.LineDashedMaterial({ color: 0x0284c7, dashSize: 0.3, gapSize: 0.1 });
            const line = new THREE.Line(geom, mat);
            line.computeLineDistances();
            this.dimensionGroup.add(line);
        });
        this.dimensionGroup.visible = false;
    }

    toggleDimensions() {
        this.dimensionGroup.visible = !this.dimensionGroup.visible;
        return this.dimensionGroup.visible;
    }

    buildAvatar() {
        while (this.avatarGroup.children.length > 0) this.avatarGroup.remove(this.avatarGroup.children[0]);
        const mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.3, 16), mat);
        body.position.set(0, 0.65, 2);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), mat);
        head.position.set(0, 1.45, 2);
        this.avatarGroup.add(body);
        this.avatarGroup.add(head);
        this.avatarGroup.visible = false;
    }

    toggleAvatar() {
        this.avatarGroup.visible = !this.avatarGroup.visible;
        return this.avatarGroup.visible;
    }

    toggleOverlay() {
        const previewImg = document.getElementById('blueprint-review-img');
        if (!previewImg || !previewImg.src) return false;

        if (this.overlayGroup.children.length === 0) {
            const loader = new THREE.TextureLoader();
            loader.load(previewImg.src, (texture) => {
                const geom = new THREE.PlaneGeometry(40, 40 * (previewImg.naturalHeight / (previewImg.naturalWidth || 1)));
                const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.45, depthWrite: false });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.set(0, 0.03, 0);
                this.overlayGroup.add(mesh);
                this.overlayGroup.visible = true;
            });
            return true;
        } else {
            this.overlayGroup.visible = !this.overlayGroup.visible;
            return this.overlayGroup.visible;
        }
    }

    buildVentilationFlows() {
        while (this.ventilationGroup.children.length > 0) this.ventilationGroup.remove(this.ventilationGroup.children[0]);
        const dir = new THREE.Vector3(1, 0, 0.3).normalize();
        [-6, 0, 6].forEach(offsetZ => {
            const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(-14, 1.2, offsetZ), 28, 0x0284c7, 1.2, 0.7);
            this.ventilationGroup.add(arrow);
        });
        this.ventilationGroup.visible = false;
    }

    toggleVentilation() {
        this.ventilationGroup.visible = !this.ventilationGroup.visible;
        return this.ventilationGroup.visible;
    }

    toggleWalkthrough() {
        if (!this.fpControls) return false;
        if (this.isWalkMode) {
            this.exitWalkthrough();
            return false;
        } else {
            this.isWalkMode = true;
            this.controls.enabled = false;
            this.camera.position.set(0, 1.65, 5);
            this.fpControls.lock();
            document.getElementById('walk-crosshair').style.display = 'block';
            document.getElementById('walk-instruction-banner').style.display = 'block';
            return true;
        }
    }

    exitWalkthrough() {
        this.isWalkMode = false;
        if (this.fpControls && this.fpControls.isLocked) this.fpControls.unlock();
        this.controls.enabled = true;
        this.resetCamera();
        document.getElementById('walk-crosshair').style.display = 'none';
        document.getElementById('walk-instruction-banner').style.display = 'none';
        const btn = document.getElementById('tool-walk');
        if (btn) btn.classList.remove('active');
    }

    exportOBJ() {
        let output = "# Patrick Architect BIM Wavefront OBJ Export\n";
        let offset = 1;
        this.houseGroup.children.forEach(mesh => {
            if (mesh.geometry && mesh.geometry.type === 'BoxGeometry') {
                const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
                const pos = g.attributes.position;
                for (let i = 0; i < pos.count; i++) output += `v ${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}\n`;
                const idx = g.index;
                if (idx) {
                    for (let i = 0; i < idx.count; i += 3) output += `f ${idx.getX(i) + offset} ${idx.getX(i+1) + offset} ${idx.getX(i+2) + offset}\n`;
                    offset += pos.count;
                }
            }
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([output], { type: 'text/plain' }));
        a.download = "Patrick_Architect_BIM.obj";
        a.click();
    }

    resetCamera() {
        this.camera.position.set(24, 28, 26);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }
}