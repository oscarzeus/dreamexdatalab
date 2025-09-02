class PermitManager {
    constructor() {
        this.initializePermitTypes();
        this.initializeEventListeners();
        this.selectedPermitType = null;
    }

    initializePermitTypes() {
        this.permitTypeFields = {
            'hot-work': {
                title: 'Hot Work Requirements',
                fields: [
                    {
                        type: 'checkbox',
                        label: 'Fire watch required',
                        id: 'hot-work-fire-watch'
                    },
                    {
                        type: 'select',
                        label: 'Fire Extinguisher Type',
                        id: 'fire-extinguisher-type',
                        options: ['ABC Powder', 'CO2', 'Foam', 'Water']
                    },
                    {
                        type: 'textarea',
                        label: 'Hot Work Area Preparation',
                        id: 'hot-work-preparation'
                    }
                ]
            },
            'confined-space': {
                title: 'Confined Space Requirements',
                fields: [
                    {
                        type: 'checkbox',
                        label: 'Gas monitoring required',
                        id: 'confined-space-gas-monitor'
                    },
                    {
                        type: 'checkbox',
                        label: 'Ventilation system required',
                        id: 'confined-space-ventilation'
                    },
                    {
                        type: 'text',
                        label: 'Stand-by Person Name',
                        id: 'standby-person'
                    }
                ]
            },
            'electrical': {
                title: 'Electrical Work Requirements',
                fields: [
                    {
                        type: 'checkbox',
                        label: 'Lock-out/Tag-out required',
                        id: 'electrical-loto'
                    },
                    {
                        type: 'select',
                        label: 'Voltage Level',
                        id: 'voltage-level',
                        options: ['Low Voltage (<1000V)', 'Medium Voltage (1000V-33kV)', 'High Voltage (>33kV)']
                    }
                ]
            },
            'height': {
                title: 'Working at Height Requirements',
                fields: [
                    {
                        type: 'text',
                        label: 'Working Height (meters)',
                        id: 'working-height'
                    },
                    {
                        type: 'select',
                        label: 'Fall Protection Type',
                        id: 'fall-protection-type',
                        options: ['Full Body Harness', 'Safety Net', 'Guard Rails']
                    },
                    {
                        type: 'checkbox',
                        label: 'Anchor points inspected',
                        id: 'anchor-points-check'
                    }
                ]
            },
            'excavation': {
                title: 'Excavation Requirements',
                fields: [
                    {
                        type: 'text',
                        label: 'Excavation Depth (meters)',
                        id: 'excavation-depth'
                    },
                    {
                        type: 'select',
                        label: 'Soil Type',
                        id: 'soil-type',
                        options: ['Rock', 'Clay', 'Sand', 'Loam']
                    },
                    {
                        type: 'checkbox',
                        label: 'Underground services checked',
                        id: 'underground-services-check'
                    }
                ]
            }
        };
    }

    initializeEventListeners() {
        const permitTypeCards = document.querySelectorAll('.permit-type-card');
        permitTypeCards.forEach(card => {
            card.addEventListener('click', (e) => this.handlePermitTypeSelection(e));
        });

        // Add form submission listener
        const form = document.getElementById('ptwForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Initialize dynamic list handlers
        this.initializeWorkersList();
        this.initializeHazardsList();
        this.initializeControlsList();
        this.initializeIsolationPoints();
        this.initializeRiskCalculation();
    }

    initializeWorkersList() {
        const addWorkerBtn = document.getElementById('add-worker-btn');
        const workersList = document.getElementById('workers-list');

        if (addWorkerBtn && workersList) {
            addWorkerBtn.addEventListener('click', () => {
                const workerItem = document.createElement('div');
                workerItem.className = 'worker-item';
                const workerId = Date.now();
                
                workerItem.innerHTML = `
                    <div class="form-row" style="display: flex; gap: 10px; align-items: center;">
                        <div class="form-group" style="flex: 1;">
                            <input type="text" id="worker-name-${workerId}" class="form-control" placeholder="Worker Name" required>
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <input type="text" id="worker-position-${workerId}" class="form-control" placeholder="Position/Role" required>
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <select id="worker-training-${workerId}" class="form-control" required>
                                <option value="">Required Training Status</option>
                                <option value="complete">Complete</option>
                                <option value="incomplete">Incomplete</option>
                                <option value="not-required">Not Required</option>
                            </select>
                        </div>
                        <button type="button" class="btn btn-danger remove-worker">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;

                workersList.appendChild(workerItem);

                // Add remove handler
                workerItem.querySelector('.remove-worker').addEventListener('click', () => {
                    workerItem.remove();
                });
            });
        }
    }

    initializeHazardsList() {
        const addHazardBtn = document.getElementById('add-custom-hazard-btn');
        const hazardsList = document.getElementById('custom-hazards-list');

        if (addHazardBtn && hazardsList) {
            addHazardBtn.addEventListener('click', () => {
                const description = document.getElementById('custom-hazard-description').value;
                const severity = document.getElementById('custom-hazard-severity').value;

                if (!description || !severity) {
                    alert('Please fill in both hazard description and severity');
                    return;
                }

                const hazardItem = document.createElement('div');
                hazardItem.className = 'hazard-item';
                const hazardId = Date.now();

                hazardItem.innerHTML = `
                    <div class="form-row" style="display: flex; gap: 10px; align-items: center;">
                        <div class="form-group" style="flex: 1;">
                            <input type="text" class="form-control hazard-description" value="${description}" readonly>
                        </div>
                        <div class="form-group" style="width: 150px;">
                            <input type="text" class="form-control hazard-severity" value="${severity}" readonly>
                        </div>
                        <button type="button" class="btn btn-danger remove-hazard">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;

                hazardsList.appendChild(hazardItem);

                // Clear inputs
                document.getElementById('custom-hazard-description').value = '';
                document.getElementById('custom-hazard-severity').value = '';

                // Add remove handler
                hazardItem.querySelector('.remove-hazard').addEventListener('click', () => {
                    hazardItem.remove();
                });
            });
        }
    }

    initializeControlsList() {
        const addControlBtn = document.getElementById('add-custom-control-btn');
        const controlsList = document.getElementById('custom-controls-list');

        if (addControlBtn && controlsList) {
            addControlBtn.addEventListener('click', () => {
                const description = document.getElementById('custom-control-description').value;
                const type = document.getElementById('custom-control-type').value;

                if (!description || !type) {
                    alert('Please fill in both control description and type');
                    return;
                }

                const controlItem = document.createElement('div');
                controlItem.className = 'control-item';
                const controlId = Date.now();

                controlItem.innerHTML = `
                    <div class="form-row" style="display: flex; gap: 10px; align-items: center;">
                        <div class="form-group" style="flex: 1;">
                            <input type="text" class="form-control control-description" value="${description}" readonly>
                        </div>
                        <div class="form-group" style="width: 150px;">
                            <input type="text" class="form-control control-type" value="${type}" readonly>
                        </div>
                        <button type="button" class="btn btn-danger remove-control">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;

                controlsList.appendChild(controlItem);

                // Clear inputs
                document.getElementById('custom-control-description').value = '';
                document.getElementById('custom-control-type').value = '';

                // Add remove handler
                controlItem.querySelector('.remove-control').addEventListener('click', () => {
                    controlItem.remove();
                });
            });
        }
    }

    initializeIsolationPoints() {
        const addIsolationBtn = document.getElementById('add-isolation-btn');
        const isolationList = document.getElementById('isolation-points-list');

        if (addIsolationBtn && isolationList) {
            addIsolationBtn.addEventListener('click', () => {
                const type = document.getElementById('isolation-type').value;
                const location = document.getElementById('isolation-location').value;
                const method = document.getElementById('isolation-method').value;

                if (!type || !location || !method) {
                    alert('Please fill in all isolation point details');
                    return;
                }

                const isolationItem = document.createElement('div');
                isolationItem.className = 'isolation-point';
                const isolationId = Date.now();

                isolationItem.innerHTML = `
                    <div class="form-row" style="display: flex; gap: 10px; align-items: center;">
                        <div class="form-group" style="flex: 1;">
                            <input type="text" class="form-control isolation-type" value="${type}" readonly>
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <input type="text" class="form-control isolation-location" value="${location}" readonly>
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <input type="text" class="form-control isolation-method" value="${method}" readonly>
                        </div>
                        <button type="button" class="btn btn-danger remove-isolation">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;

                isolationList.appendChild(isolationItem);

                // Clear inputs
                document.getElementById('isolation-type').value = '';
                document.getElementById('isolation-location').value = '';
                document.getElementById('isolation-method').value = '';

                // Add remove handler
                isolationItem.querySelector('.remove-isolation').addEventListener('click', () => {
                    isolationItem.remove();
                });
            });
        }
    }

    initializeRiskCalculation() {
        const calculateRiskScore = (likelihood, severity) => {
            if (!likelihood || !severity) return '';
            return (parseInt(likelihood) * parseInt(severity)).toString();
        };

        // Initial Risk Score calculation
        const initialLikelihood = document.getElementById('initial-likelihood');
        const initialSeverity = document.getElementById('initial-severity');
        const initialRiskScore = document.getElementById('initial-risk-score');

        const updateInitialRiskScore = () => {
            initialRiskScore.value = calculateRiskScore(initialLikelihood.value, initialSeverity.value);
        };

        initialLikelihood?.addEventListener('change', updateInitialRiskScore);
        initialSeverity?.addEventListener('change', updateInitialRiskScore);

        // Residual Risk Score calculation
        const residualLikelihood = document.getElementById('residual-likelihood');
        const residualSeverity = document.getElementById('residual-severity');
        const residualRiskScore = document.getElementById('residual-risk-score');

        const updateResidualRiskScore = () => {
            residualRiskScore.value = calculateRiskScore(residualLikelihood.value, residualSeverity.value);
        };

        residualLikelihood?.addEventListener('change', updateResidualRiskScore);
        residualSeverity?.addEventListener('change', updateResidualRiskScore);
    }

    handlePermitTypeSelection(event) {
        const card = event.currentTarget;
        const permitType = card.dataset.type;

        // Remove selected class from all cards
        document.querySelectorAll('.permit-type-card').forEach(c => {
            c.classList.remove('selected');
        });

        // Add selected class to clicked card
        card.classList.add('selected');

        // Show specific fields for the selected permit type
        this.showPermitTypeFields(permitType);
        this.selectedPermitType = permitType;
    }

    showPermitTypeFields(permitType) {
        // Remove any existing permit-specific fields
        const existingFields = document.getElementById('permit-specific-fields');
        if (existingFields) {
            existingFields.remove();
        }

        // Get the fields configuration for this permit type
        const config = this.permitTypeFields[permitType];
        if (!config) return;

        // Create new section for permit-specific fields
        const section = document.createElement('div');
        section.id = 'permit-specific-fields';
        section.className = 'permit-section';

        // Add title
        const title = document.createElement('h2');
        title.className = 'section-header';
        title.textContent = config.title;
        section.appendChild(title);

        // Create form grid
        const formGrid = document.createElement('div');
        formGrid.className = 'form-grid';

        // Add fields
        config.fields.forEach(field => {
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';

            const label = document.createElement('label');
            label.htmlFor = field.id;
            label.textContent = field.label;
            formGroup.appendChild(label);

            let input;
            switch (field.type) {
                case 'text':
                case 'number':
                    input = document.createElement('input');
                    input.type = field.type;
                    input.className = 'form-control';
                    break;
                case 'select':
                    input = document.createElement('select');
                    input.className = 'form-control';
                    field.options.forEach(optionText => {
                        const option = document.createElement('option');
                        option.value = optionText.toLowerCase().replace(/\s+/g, '-');
                        option.textContent = optionText;
                        input.appendChild(option);
                    });
                    break;
                case 'checkbox':
                    input = document.createElement('input');
                    input.type = 'checkbox';
                    break;
                case 'textarea':
                    input = document.createElement('textarea');
                    input.className = 'form-control';
                    input.rows = 3;
                    break;
            }

            input.id = field.id;
            input.name = field.id;
            input.required = field.required || false;
            formGroup.appendChild(input);
            formGrid.appendChild(formGroup);
        });

        section.appendChild(formGrid);

        // Insert the new section after the permit type selection section
        const permitTypeSection = document.querySelector('.permit-type-card').closest('.permit-section');
        permitTypeSection.parentNode.insertBefore(section, permitTypeSection.nextSibling);
    }

    handleFormSubmit(event) {
        event.preventDefault();
        
        if (!this.selectedPermitType) {
            alert('Please select a permit type');
            return;
        }

        // Validate dates
        const validFrom = new Date(document.getElementById('validFrom').value);
        const validTo = new Date(document.getElementById('validTo').value);
        if (validTo < validFrom) {
            alert('Valid To date must be after Valid From date');
            return;
        }

        // Collect all form data
        const formData = {
            permitNumber: document.getElementById('permitNumber').value,
            permitType: this.selectedPermitType,
            requestDate: document.getElementById('requestDate').value,
            validFrom: document.getElementById('validFrom').value,
            validTo: document.getElementById('validTo').value,
            location: document.getElementById('location').value,
            description: document.getElementById('description').value,
            contractor: document.getElementById('contractor').value,
            supervisorName: document.getElementById('supervisorName').value,
            
            // PIC Information
            picInfo: {
                name: document.getElementById('picName').value,
                position: document.getElementById('picPosition').value,
                phone: document.getElementById('picPhone').value,
                email: document.getElementById('picEmail').value
            },
            
            // Workers Information
            workers: Array.from(document.getElementById('workers-list').children).map(worker => ({
                name: worker.querySelector('[id^="worker-name"]').value,
                position: worker.querySelector('[id^="worker-position"]').value,
                trainingStatus: worker.querySelector('[id^="worker-training"]').value
            })),
            
            // PPE Requirements
            ppe: {
                hardHat: document.getElementById('ppe-hard-hat').checked,
                safetyGlasses: document.getElementById('ppe-safety-glasses').checked,
                faceShield: document.getElementById('ppe-face-shield').checked,
                earProtection: document.getElementById('ppe-ear-protection').checked,
                safetyBoots: document.getElementById('ppe-safety-boots').checked,
                gloves: document.getElementById('ppe-gloves').checked,
                respirator: document.getElementById('ppe-respirator').checked,
                highVis: document.getElementById('ppe-high-vis').checked,
                fallProtection: document.getElementById('ppe-fall-protection').checked,
                chemicalSuit: document.getElementById('ppe-chemical-suit').checked,
                arcFlash: document.getElementById('ppe-arc-flash').checked,
                lifeJacket: document.getElementById('ppe-life-jacket').checked,
                additional: document.getElementById('additional-ppe').value
            },

            // Risk Assessment
            riskAssessment: {
                initialLikelihood: document.getElementById('initial-likelihood').value,
                initialSeverity: document.getElementById('initial-severity').value,
                initialRiskScore: document.getElementById('initial-risk-score').value,
                residualLikelihood: document.getElementById('residual-likelihood').value,
                residualSeverity: document.getElementById('residual-severity').value,
                residualRiskScore: document.getElementById('residual-risk-score').value
            },

            // Hazards
            hazards: Array.from(document.querySelectorAll('#custom-hazards-list .hazard-item')).map(hazard => ({
                description: hazard.querySelector('.hazard-description').value,
                severity: hazard.querySelector('.hazard-severity').value
            })),
            additionalHazards: document.getElementById('additional-hazards').value,

            // Control Measures
            controlMeasures: Array.from(document.querySelectorAll('#custom-controls-list .control-item')).map(control => ({
                description: control.querySelector('.control-description').value,
                type: control.querySelector('.control-type').value
            })),
            additionalControls: document.getElementById('additional-controls').value,

            // Energy Isolation
            energyIsolation: {
                isolationPoints: Array.from(document.querySelectorAll('#isolation-points-list .isolation-point')).map(point => ({
                    type: point.querySelector('.isolation-type').value,
                    location: point.querySelector('.isolation-location').value,
                    method: point.querySelector('.isolation-method').value
                })),
                verified: document.getElementById('isolation-verification').checked
            },

            // Emergency Response
            emergencyResponse: {
                contacts: document.getElementById('emergency-contacts').value,
                procedures: document.getElementById('emergency-procedures').value,
                equipment: {
                    firstAid: document.getElementById('emerg-first-aid').checked,
                    fireExtinguisher: document.getElementById('emerg-fire-extinguisher').checked,
                    eyeWash: document.getElementById('emerg-eye-wash').checked,
                    emergencyShower: document.getElementById('emerg-emergency-shower').checked,
                    spillKit: document.getElementById('emerg-spill-kit').checked,
                    rescueEquipment: document.getElementById('emerg-rescue-equipment').checked
                },
                nearestHospital: document.getElementById('nearest-hospital').value,
                briefingConfirmed: document.getElementById('emergency-plan-verification').checked
            },

            // Type-specific fields
            typeSpecificFields: this.collectTypeSpecificFields(this.selectedPermitType),

            // Metadata
            status: 'pending',
            createdAt: new Date().toISOString(),
            createdBy: firebase.auth().currentUser?.uid || null,
            lastModified: new Date().toISOString()
        };

        // Save to Firebase
        this.savePermit(formData);
    }

    collectTypeSpecificFields(permitType) {
        const fields = {};
        const specificFields = document.getElementById('permit-specific-fields');
        if (specificFields) {
            specificFields.querySelectorAll('input, select, textarea').forEach(field => {
                if (field.type === 'checkbox') {
                    fields[field.id] = field.checked;
                } else {
                    fields[field.id] = field.value;
                }
            });
        }
        return fields;
    }

    savePermit(permitData) {
        const db = firebase.database();
        const permitRef = db.ref('permits').push();
        
        permitRef.set(permitData)
            .then(() => {
                // Notify success
                window.notificationManager?.addNotification({
                    type: 'Success',
                    message: 'Permit request submitted successfully'
                });

                // Create notification for approvers
                window.notificationManager?.notifyFormSubmission('PTW', permitRef.key);

                // Redirect to permit board
                window.location.href = 'ptwboard.html';
            })
            .catch(error => {
                console.error('Error saving permit:', error);
                window.notificationManager?.addNotification({
                    type: 'Error',
                    message: `Failed to submit permit: ${error.message}`
                });
            });
    }
}

// Export the class for use in other files
window.PermitManager = PermitManager;