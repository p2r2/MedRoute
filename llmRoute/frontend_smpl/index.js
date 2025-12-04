// State Management
let currentUser = null;

// --- Authentication Logic ---
function handleLogin() {
    const email = document.getElementById('email').value;
    if (email) {
        currentUser = email;
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');
    }
}

function handleLogout() {
    currentUser = null;
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
    // Reset chat
    document.getElementById('chat-history').innerHTML = '';
    document.getElementById('chat-history').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
}

// --- Chat Logic ---
async function submitTextQuery() {
    const patientSelect = document.getElementById('patient-select');
    const userText = document.getElementById('user-text');
    const chatHistory = document.getElementById('chat-history');
    const emptyState = document.getElementById('empty-state');

    const query = userText.value.trim();
    const patientDetails = patientSelect.value;

    if (!query) return;

    // UI Updates
    emptyState.classList.add('hidden');
    chatHistory.classList.remove('hidden');

    // Add User Message
    appendMessage('user', query);
    userText.value = ''; // Clear input

    // Add Loading Message
    const loadingId = appendMessage('ai', '<i class="fas fa-spinner fa-spin"></i> Processing...', true);

    try {
        const ROUTER_API_ENDPOINT = '/api/route';
        const payload = {
            patient_details: patientDetails,
            query_text: query,
        };

        const response = await fetch(ROUTER_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('API Error');

        const result = await response.json();

        // Remove loading, add actual response
        removeMessage(loadingId);

        const aiContent = `
            <div class="response-header">
                <span class="badge">${result.router_decision}</span>
                <span class="model-name">${result.model_used}</span>
            </div>
            <div class="response-body">
                ${result.final_analysis.replace(/\n/g, '<br>')}
            </div>
        `;
        appendMessage('ai', aiContent);

    } catch (error) {
        removeMessage(loadingId);
        appendMessage('ai', `Error: ${error.message}`);
    }
}

function appendMessage(role, content, isLoading = false) {
    const chatHistory = document.getElementById('chat-history');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}-msg`;
    if (isLoading) msgDiv.id = `msg-${Date.now()}`;
    msgDiv.innerHTML = content;
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return msgDiv.id;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// Allow Enter key to submit
document.getElementById('user-text').addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitTextQuery();
    }
});
// --- Modal Logic ---
function openAddPatientModal() {
    document.getElementById('add-patient-modal').classList.remove('hidden');
}

function closeAddPatientModal() {
    document.getElementById('add-patient-modal').classList.add('hidden');
    // Clear inputs
    document.getElementById('p-name').value = '';
    document.getElementById('p-details').value = '';
    document.getElementById('p-condition').value = '';
}

async function savePatient() {
    const name = document.getElementById('p-name').value;
    const details = document.getElementById('p-details').value;
    const condition = document.getElementById('p-condition').value;

    if (!name || !details) {
        alert("Please enter at least Name and Age/Gender");
        return;
    }

    try {
        const response = await fetch('/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: name,
                medical_record_number: details,
                contact_email: condition || 'No Condition'
            })
        });

        if (!response.ok) throw new Error('Failed to save patient');

        await loadPatients(); // Refresh list
        closeAddPatientModal();

    } catch (error) {
        alert(`Error saving patient: ${error.message}`);
    }
}

async function loadPatients() {
    try {
        const response = await fetch('/api/patients');
        if (!response.ok) throw new Error('Failed to fetch patients');

        const patients = await response.json();
        const select = document.getElementById('patient-select');

        // Keep default option
        select.innerHTML = '<option value="">Select a patient...</option>';

        patients.forEach(p => {
            const option = document.createElement('option');
            // Map backend fields back to UI
            const name = p.full_name;
            const details = p.medical_record_number;
            const condition = p.contact_email;

            const value = `${name}, ${details}`;
            const text = `${name}, ${details} - ${condition}`;
            option.value = value;
            option.textContent = text;
            select.appendChild(option);
        });

    } catch (error) {
        console.error("Error loading patients:", error);
    }
}

// Load patients on startup
document.addEventListener('DOMContentLoaded', loadPatients);
// --- Speech Recognition Logic ---
let recognition;
let isRecording = false;

function toggleRecording() {
    const micBtn = document.getElementById('mic-btn');
    const userText = document.getElementById('user-text');

    if (!('webkitSpeechRecognition' in window)) {
        alert("Web Speech API is not supported in this browser. Please use Chrome or Edge.");
        return;
    }

    if (isRecording) {
        recognition.stop();
        return;
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = function () {
        isRecording = true;
        micBtn.classList.add('recording');
        micBtn.innerHTML = '<i class="fas fa-stop"></i>';
        userText.placeholder = "Listening...";
    };

    recognition.onend = function () {
        isRecording = false;
        micBtn.classList.remove('recording');
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        userText.placeholder = "Describe the medical task or speak...";
    };

    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript;
        userText.value += (userText.value ? ' ' : '') + transcript;
    };

    recognition.onerror = function (event) {
        console.error("Speech recognition error", event.error);
        isRecording = false;
        micBtn.classList.remove('recording');
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        alert("Error accessing microphone: " + event.error);
    };

    recognition.start();
}

// --- Sample Query Logic ---
function useSampleQuery(text) {
    if (!text) return;
    const userText = document.getElementById('user-text');
    userText.value = text;
    userText.focus();
}
