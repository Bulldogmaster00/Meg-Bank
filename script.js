// Remove Firebase SDK imports as we are not using Firebase
// import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
// import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// import { getFirestore, doc, setDoc, deleteDoc, collection, query, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- INÍCIO DA CONFIGURAÇÃO (SEM FIREBASE) ---
// Não há configurações de Firebase aqui. O armazenamento é local.
// --- FIM DA CONFIGURAÇÃO (SEM FIREBASE) ---


// Remove Firebase Initialization variables
let app, db, auth; // These will remain undefined
let currentUserId = 'local_user'; // A user ID for local storage context
let isAuthReady = true; // Always ready for local storage

console.log("Script.js carregado e a iniciar (sem Firebase)...");

// Declare DOM Elements variables at a higher scope, but assign them inside DOMContentLoaded
let messageDisplay;
let unlockSection;
let unlockCodeInput;
let unlockButton;
let addClientSection;
let newClientCodeInput;
let newClientNameInput;
let newClientInitialBalanceInput;
let addClientButton;
let selectedClientCodeSelect;
let discountValueInput;
let discountButton;
let clientsListContainer;
let confirmModal;
let clientToDeleteNameSpan;
let confirmDeleteButton;
let cancelDeleteButton;

let unlockDepositSection;
let unlockDepositCodeInput;
let unlockDepositButton;
let addMoneySection;
let selectedClientDepositSelect;
let depositValueInput;
let depositButton;

let unlockRemoveClientSection;
let unlockRemoveClientCodeInput;
let unlockRemoveClientButton;


// Secret Unlock Codes
const REQUIRED_UNLOCK_CODE = '956523332996147453'; // Code for Add Client
const REQUIRED_DEPOSIT_UNLOCK_CODE = '1234567890'; // Code for Add Money
const REQUIRED_REMOVE_UNLOCK_CODE = '956523332996147453'; // New code for Remove Client

// State variables (managed by JavaScript directly)
let clientsData = {};
let clientToDeleteCode = null; // Stores the code of the client to be deleted
let isAddClientUnlocked = false; // State for add client unlock
let isAddMoneyUnlocked = false; // New state for add money unlock
let isRemoveClientUnlocked = false; // New state for remove client unlock

// --- Utility Functions ---

function showMessage(msg, type = 'info') {
    if (messageDisplay) { // Check if messageDisplay is assigned
        messageDisplay.textContent = msg;
        messageDisplay.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');
        if (type === 'error') {
            messageDisplay.classList.add('bg-red-100', 'text-red-700');
        } else {
            messageDisplay.classList.add('bg-green-100', 'text-green-700');
        }
        // Hide message after 5 seconds
        setTimeout(() => {
            messageDisplay.classList.add('hidden');
        }, 5000);
    } else {
        console.warn("showMessage: Element 'messageDisplay' not found.");
    }
}

function renderClientsList(clients) {
    if (!clientsListContainer || !selectedClientCodeSelect || !selectedClientDepositSelect) {
        console.error("renderClientsList: Um ou mais elementos DOM essenciais não foram encontrados.");
        return;
    }

    clientsListContainer.innerHTML = ''; // Clear previous list

    if (Object.keys(clients).length === 0) {
        clientsListContainer.innerHTML = '<p class="text-gray-600 text-center">Nenhum cliente registado ainda.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'min-w-full bg-white rounded-lg overflow-hidden shadow-md';
    table.innerHTML = `
        <thead class="bg-gray-200">
            <tr>
                <th class="py-3 px-4 text-left text-sm font-medium text-gray-700">Código</th>
                <th class="py-3 px-4 text-left text-sm font-medium text-gray-700">Nome</th>
                <th class="py-3 px-4 text-left text-sm font-medium text-gray-700">Saldo</th>
                <th class="py-3 px-4 text-left text-sm font-medium text-gray-700">Ações</th>
            </tr>
        </thead>
        <tbody id="clientsTableBody">
        </tbody>
    `;
    clientsListContainer.appendChild(table);

    const clientsTableBody = document.getElementById('clientsTableBody');
    selectedClientCodeSelect.innerHTML = '<option value="">Selecione um Cliente</option>'; // Clear and reset select for discount
    selectedClientDepositSelect.innerHTML = '<option value="">Selecione um Cliente</option>'; // Clear and reset select for deposit


    for (const code in clients) {
        const client = clients[code];
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 last:border-b-0 hover:bg-gray-50';
        // Add a class to disable the button visually if not unlocked
        const removeButtonClass = `remove-client-btn bg-red-500 text-white py-1 px-3 rounded-md hover:bg-red-600 transition duration-300 ease-in-out shadow-sm text-xs ${isRemoveClientUnlocked ? '' : 'opacity-50 cursor-not-allowed'}`;
        row.innerHTML = `
            <td class="py-3 px-4 text-sm text-gray-800 font-mono">${code}</td>
            <td class="py-3 px-4 text-sm text-gray-800">${client.nome}</td>
            <td class="py-3 px-4 text-sm text-gray-800 font-semibold">R$${client.saldo.toFixed(2)}</td>
            <td class="py-3 px-4 text-sm">
                <button data-client-code="${code}" class="${removeButtonClass}">
                    Remover
                </button>
            </td>
        `;
        clientsTableBody.appendChild(row);

        // Add option to select dropdown for discount
        const optionDiscount = document.createElement('option');
        optionDiscount.value = code;
        optionDiscount.textContent = `${client.nome} (R$${client.saldo.toFixed(2)})`;
        selectedClientCodeSelect.appendChild(optionDiscount);

        // Add option to select dropdown for deposit
        const optionDeposit = document.createElement('option');
        optionDeposit.value = code;
        optionDeposit.textContent = `${client.nome} (R$${client.saldo.toFixed(2)})`;
        selectedClientDepositSelect.appendChild(optionDeposit);
    }

    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-client-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            console.log("Botão 'Remover' clicado. isRemoveClientUnlocked:", isRemoveClientUnlocked); // Log do estado
            if (!isRemoveClientUnlocked) { // Check if remove client function is unlocked
                showMessage("Por favor, desbloqueie a função de remover cliente primeiro.", 'error');
                return;
            }
            const code = event.target.dataset.clientCode;
            clientToDeleteCode = code;
            if (clientToDeleteNameSpan) { // Check if element exists before using
                clientToDeleteNameSpan.textContent = clientsData[code]?.nome || code;
            }
            if (confirmModal) { // Check if element exists before using
                confirmModal.classList.remove('hidden');
            }
        });
    });
}

// --- Local Storage Operations (Replacing Firebase) ---

function loadClientsFromLocalStorage() {
    try {
        const storedClients = localStorage.getItem('megBankClients');
        return storedClients ? JSON.parse(storedClients) : {};
    } catch (e) {
        console.error("Erro ao carregar clientes do localStorage:", e);
        showMessage("Erro ao carregar dados locais. Os dados podem estar corrompidos.", 'error');
        return {};
    }
}

function saveClientsToLocalStorage(clients) {
    try {
        localStorage.setItem('megBankClients', JSON.stringify(clients));
        return true;
    } catch (e) {
        console.error("Erro ao guardar clientes no localStorage:", e);
        showMessage("Erro ao guardar dados locais. O armazenamento pode estar cheio.", 'error');
        return false;
    }
}

// New functions to manage unlock states in localStorage
function loadUnlockStatesFromLocalStorage() {
    try {
        const storedStates = localStorage.getItem('megBankUnlockStates');
        if (storedStates) {
            const parsedStates = JSON.parse(storedStates);
            isAddClientUnlocked = parsedStates.isAddClientUnlocked || false;
            isAddMoneyUnlocked = parsedStates.isAddMoneyUnlocked || false;
            isRemoveClientUnlocked = parsedStates.isRemoveClientUnlocked || false;
            console.log("Estados de desbloqueio carregados do localStorage:", parsedStates);
        } else {
            console.log("Nenhum estado de desbloqueio encontrado no localStorage. Usando valores padrão.");
        }
    } catch (e) {
        console.error("Erro ao carregar estados de desbloqueio do localStorage:", e);
    }
}

function saveUnlockStatesToLocalStorage() {
    try {
        const statesToSave = {
            isAddClientUnlocked,
            isAddMoneyUnlocked,
            isRemoveClientUnlocked
        };
        localStorage.setItem('megBankUnlockStates', JSON.stringify(statesToSave));
        console.log("Estados de desbloqueio guardados no localStorage:", statesToSave);
    } catch (e) {
        console.error("Erro ao guardar estados de desbloqueio no localStorage:", e);
    }
}


// Removed logTransactionToFirestore as it's a backend/database feature

// --- Event Handlers (Defined as functions to be attached in DOMContentLoaded) ---

const handleUnlockClick = () => {
    const enteredCode = unlockCodeInput.value.trim();
    console.log("Botão 'Desbloquear Adição de Cliente' clicado.");
    console.log("Código digitado (trim):", enteredCode);
    console.log("Código esperado:", REQUIRED_UNLOCK_CODE);

    if (enteredCode === REQUIRED_UNLOCK_CODE) {
        isAddClientUnlocked = true;
        saveUnlockStatesToLocalStorage(); // Save state
        if (addClientSection) addClientSection.classList.remove('hidden');
        if (unlockSection) unlockSection.classList.add('hidden');
        showMessage("✅ Função 'Adicionar Novo Cliente' desbloqueada!", 'info');
        if (unlockCodeInput) unlockCodeInput.value = '';
        console.log("isAddClientUnlocked após desbloqueio:", isAddClientUnlocked);
    } else {
        showMessage("Erro: Código de desbloqueio incorreto.", 'error');
        console.log("Tentativa de desbloqueio falhou. isAddClientUnlocked:", isAddClientUnlocked);
    }
};

const handleUnlockDepositClick = () => {
    const enteredCode = unlockDepositCodeInput.value.trim();
    console.log("Botão 'Desbloquear Adicionar Dinheiro' clicado.");
    console.log("Código digitado (trim):", enteredCode);
    console.log("Código esperado:", REQUIRED_DEPOSIT_UNLOCK_CODE);

    if (enteredCode === REQUIRED_DEPOSIT_UNLOCK_CODE) {
        isAddMoneyUnlocked = true;
        saveUnlockStatesToLocalStorage(); // Save state
        if (addMoneySection) addMoneySection.classList.remove('hidden');
        if (unlockDepositSection) unlockDepositSection.classList.add('hidden');
        showMessage("✅ Função 'Adicionar Dinheiro' desbloqueada!", 'info');
        if (unlockDepositCodeInput) unlockDepositCodeInput.value = '';
        console.log("isAddMoneyUnlocked após desbloqueio:", isAddMoneyUnlocked);
    } else {
        showMessage("Erro: Código de desbloqueio incorreto para adicionar dinheiro.", 'error');
        console.log("Tentativa de desbloqueio de depósito falhou. isAddMoneyUnlocked:", isAddMoneyUnlocked);
    }
};

const handleUnlockRemoveClientClick = () => {
    const enteredCode = unlockRemoveClientCodeInput.value.trim();
    console.log("Botão 'Desbloquear Remover Cliente' clicado.");
    console.log("Código digitado (trim):", enteredCode);
    console.log("Código esperado:", REQUIRED_REMOVE_UNLOCK_CODE);

    if (enteredCode === REQUIRED_REMOVE_UNLOCK_CODE) {
        isRemoveClientUnlocked = true;
        saveUnlockStatesToLocalStorage(); // Save state
        if (unlockRemoveClientSection) unlockRemoveClientSection.classList.add('hidden'); // Hide the unlock section
        showMessage("✅ Função 'Remover Cliente' desbloqueada!", 'info');
        if (unlockRemoveClientCodeInput) unlockRemoveClientCodeInput.value = '';
        console.log("isRemoveClientUnlocked após desbloqueio:", isRemoveClientUnlocked);
        renderClientsList(clientsData); // Re-render to update button state
    } else {
        showMessage("Erro: Código de desbloqueio incorreto para remover cliente.", 'error');
        console.log("Tentativa de desbloqueio de remoção falhou. isRemoveClientUnlocked:", isRemoveClientUnlocked);
    }
};


const handleAddClientClick = async () => {
    console.log("Botão 'Adicionar Cliente' clicado.");
    console.log("Estado atual de isAddClientUnlocked:", isAddClientUnlocked); // Log do estado antes da verificação

    if (!isAddClientUnlocked) {
        showMessage("Por favor, desbloqueie a função de adicionar cliente primeiro.", 'error');
        return;
    }

    const newClientCode = newClientCodeInput.value.trim();
    const newClientName = newClientNameInput.value.trim();
    const newClientInitialBalance = parseFloat(newClientInitialBalanceInput.value);

    if (!newClientCode || isNaN(newClientInitialBalance)) {
        showMessage("Código e Saldo Inicial são obrigatórios.", 'error');
        return;
    }
    if (newClientInitialBalance < 0) {
        showMessage("Saldo inicial inválido! Deve ser um número positivo ou zero.", 'error');
        return;
    }
    if (clientsData[newClientCode]) {
        showMessage("Erro: Código de cliente já existe!", 'error');
        return;
    }

    const newClient = {
        saldo: newClientInitialBalance,
        nome: newClientName || `Cliente ${newClientCode}`,
    };

    clientsData[newClientCode] = newClient; // Update local state
    const success = saveClientsToLocalStorage(clientsData); // Save to local storage

    if (success) {
        showMessage(`✅ Cliente ${newClientCode} (${newClient.nome}) adicionado com sucesso com saldo R$${newClientInitialBalance.toFixed(2)}.`);
        newClientCodeInput.value = '';
        newClientNameInput.value = '';
        newClientInitialBalanceInput.value = '';
        renderClientsList(clientsData); // Re-render UI
    } else {
        showMessage("Erro ao adicionar cliente. Tente novamente.", 'error');
        delete clientsData[newClientCode]; // Revert local state if save fails
    }
};

const handleDiscountClick = async () => {
    const selectedCode = selectedClientCodeSelect.value;
    const discountValue = parseFloat(discountValueInput.value);

    if (!selectedCode) {
        showMessage("Por favor, selecione um cliente.", 'error');
        return;
    }
    const client = clientsData[selectedCode];
    if (!client) {
        showMessage("Cliente não encontrado.", 'error');
        return;
    }

    if (isNaN(discountValue) || discountValue <= 0) {
        showMessage("Valor inválido! Use números positivos.", 'error');
        return;
    }
    if (discountValue > client.saldo) {
        showMessage("Saldo insuficiente!", 'error');
        return;
    }

    const saldoAnterior = client.saldo;
    const novoSaldo = saldoAnterior - discountValue;
    const updatedClientData = { ...client, saldo: novoSaldo };

    clientsData[selectedCode] = updatedClientData; // Update local state
    const success = saveClientsToLocalStorage(clientsData); // Save to local storage

    if (success) {
        showMessage(`✅ R$${discountValue.toFixed(2)} descontado de ${client.nome}. Novo saldo: R$${novoSaldo.toFixed(2)}`);
        // Removed logTransactionToFirestore
        discountValueInput.value = '';
        renderClientsList(clientsData); // Re-render UI
    } else {
        showMessage("Erro ao descontar saldo. Tente novamente.", 'error');
        clientsData[selectedCode].saldo = saldoAnterior; // Revert local state if save fails
    }
};

const handleDepositClick = async () => {
    if (!isAddMoneyUnlocked) {
        showMessage("Por favor, desbloqueie a função de adicionar dinheiro primeiro.", 'error');
        return;
    }

    const selectedCode = selectedClientDepositSelect.value;
    const depositValue = parseFloat(depositValueInput.value);

    if (!selectedCode) {
        showMessage("Por favor, selecione um cliente para adicionar dinheiro.", 'error');
        return;
    }
    const client = clientsData[selectedCode];
    if (!client) {
        showMessage("Cliente não encontrado.", 'error');
        return;
    }

    if (isNaN(depositValue) || depositValue <= 0) {
        showMessage("Valor inválido para depósito! Use números positivos.", 'error');
        return;
    }

    const saldoAnterior = client.saldo;
    const novoSaldo = saldoAnterior + depositValue;
    const updatedClientData = { ...client, saldo: novoSaldo };

    clientsData[selectedCode] = updatedClientData; // Update local state
    const success = saveClientsToLocalStorage(clientsData); // Save to local storage

    if (success) {
        showMessage(`✅ R$${depositValue.toFixed(2)} adicionado a ${client.nome}. Novo saldo: R$${novoSaldo.toFixed(2)}`);
        depositValueInput.value = '';
        renderClientsList(clientsData); // Re-render UI
    } else {
        showMessage("Erro ao adicionar dinheiro. Tente novamente.", 'error');
        clientsData[selectedCode].saldo = saldoAnterior; // Revert local state if save fails
    }
};


const handleConfirmDeleteClick = async () => {
    // The check for isRemoveClientUnlocked is now done in renderClientsList when the button is clicked
    // This ensures the modal only appears if unlocked.
    if (clientToDeleteCode) {
        // Delete from local state
        const clientName = clientsData[clientToDeleteCode]?.nome || clientToDeleteCode;
        delete clientsData[clientToDeleteCode];
        const success = saveClientsToLocalStorage(clientsData); // Save to local storage

        if (success) {
            showMessage(`✅ Cliente ${clientName} removido com sucesso!`);
            renderClientsList(clientsData); // Re-render UI
        } else {
            showMessage(`Erro ao remover cliente ${clientName}.`, 'error');
            // Revert if save fails (complex for delete, usually just let it fail)
        }
        clientToDeleteCode = null;
        if (confirmModal) confirmModal.classList.add('hidden');
    }
};

const handleCancelDeleteClick = () => {
    clientToDeleteCode = null;
    if (confirmModal) confirmModal.classList.add('hidden');
    showMessage("Remoção de cliente cancelada.");
};

// --- Initial Setup ---

document.addEventListener('DOMContentLoaded', () => {
    // Assign DOM Elements here to ensure they are loaded
    messageDisplay = document.getElementById('messageDisplay');
    console.log("messageDisplay:", messageDisplay); // DEBUG
    unlockSection = document.getElementById('unlockSection');
    console.log("unlockSection:", unlockSection); // DEBUG
    unlockCodeInput = document.getElementById('unlockCodeInput');
    console.log("unlockCodeInput:", unlockCodeInput); // DEBUG
    unlockButton = document.getElementById('unlockButton');
    console.log("unlockButton:", unlockButton); // DEBUG
    addClientSection = document.getElementById('addClientSection');
    console.log("addClientSection:", addClientSection); // DEBUG
    newClientCodeInput = document.getElementById('newClientCode');
    console.log("newClientCodeInput:", newClientCodeInput); // DEBUG
    newClientNameInput = document.getElementById('newClientName');
    console.log("newClientNameInput:", newClientNameInput); // DEBUG
    newClientInitialBalanceInput = document.getElementById('newClientInitialBalance');
    console.log("newClientInitialBalanceInput:", newClientInitialBalanceInput); // DEBUG
    addClientButton = document.getElementById('addClientButton');
    console.log("addClientButton:", addClientButton); // DEBUG
    selectedClientCodeSelect = document.getElementById('selectedClientCode');
    console.log("selectedClientCodeSelect:", selectedClientCodeSelect); // DEBUG
    discountValueInput = document.getElementById('discountValue');
    console.log("discountValueInput:", discountValueInput); // DEBUG
    discountButton = document.getElementById('discountButton');
    console.log("discountButton:", discountButton); // DEBUG
    clientsListContainer = document.getElementById('clientsListContainer');
    console.log("clientsListContainer:", clientsListContainer); // DEBUG
    confirmModal = document.getElementById('confirmModal');
    console.log("confirmModal:", confirmModal); // DEBUG
    clientToDeleteNameSpan = document.getElementById('clientToDeleteName');
    console.log("clientToDeleteNameSpan:", clientToDeleteNameSpan); // DEBUG
    confirmDeleteButton = document.getElementById('confirmDeleteButton');
    console.log("confirmDeleteButton:", confirmDeleteButton); // DEBUG
    cancelDeleteButton = document.getElementById('cancelDeleteButton');
    console.log("cancelDeleteButton:", cancelDeleteButton); // DEBUG

    unlockDepositSection = document.getElementById('unlockDepositSection');
    console.log("unlockDepositSection:", unlockDepositSection); // DEBUG
    unlockDepositCodeInput = document.getElementById('unlockDepositCodeInput');
    console.log("unlockDepositCodeInput:", unlockDepositCodeInput); // DEBUG
    unlockDepositButton = document.getElementById('unlockDepositButton');
    console.log("unlockDepositButton:", unlockDepositButton); // DEBUG
    addMoneySection = document.getElementById('addMoneySection');
    console.log("addMoneySection:", addMoneySection); // DEBUG
    selectedClientDepositSelect = document.getElementById('selectedClientDepositSelect');
    console.log("selectedClientDepositSelect:", selectedClientDepositSelect); // DEBUG
    depositValueInput = document.getElementById('depositValueInput');
    console.log("depositValueInput:", depositValueInput); // DEBUG
    depositButton = document.getElementById('depositButton');
    console.log("depositButton:", depositButton); // DEBUG

    unlockRemoveClientSection = document.getElementById('unlockRemoveClientSection');
    console.log("unlockRemoveClientSection:", unlockRemoveClientSection); // DEBUG
    unlockRemoveClientCodeInput = document.getElementById('unlockRemoveClientCodeInput');
    console.log("unlockRemoveClientCodeInput:", unlockRemoveClientCodeInput); // DEBUG
    unlockRemoveClientButton = document.getElementById('unlockRemoveClientButton');
    console.log("unlockRemoveClientButton:", unlockRemoveClientButton); // DEBUG


    // Attach Event Listeners here, AFTER elements are assigned
    if (unlockButton) unlockButton.addEventListener('click', handleUnlockClick);
    if (unlockDepositButton) unlockDepositButton.addEventListener('click', handleUnlockDepositClick);
    if (unlockRemoveClientButton) unlockRemoveClientButton.addEventListener('click', handleUnlockRemoveClientClick);
    if (addClientButton) addClientButton.addEventListener('click', handleAddClientClick);
    if (discountButton) discountButton.addEventListener('click', handleDiscountClick);
    if (depositButton) depositButton.addEventListener('click', handleDepositClick);
    if (confirmDeleteButton) confirmDeleteButton.addEventListener('click', handleConfirmDeleteClick);
    if (cancelDeleteButton) cancelDeleteButton.addEventListener('click', handleCancelDeleteClick);


    // Load clients from local storage on page load
    clientsData = loadClientsFromLocalStorage();
    loadUnlockStatesFromLocalStorage(); // Load unlock states

    renderClientsList(clientsData); // Render initial list

    // Hide userIdDisplay as it's not relevant without Firebase Auth
    const userIdDisplayElement = document.getElementById('userIdDisplay');
    if (userIdDisplayElement) {
        userIdDisplayElement.classList.add('hidden');
    }

    // Initialize visibility of sections based on loaded states
    if (!isAddClientUnlocked) {
        if (addClientSection) addClientSection.classList.add('hidden');
        if (unlockSection) unlockSection.classList.remove('hidden'); // Ensure unlock section is visible if not unlocked
    } else {
        if (addClientSection) addClientSection.classList.remove('hidden');
        if (unlockSection) unlockSection.classList.add('hidden');
    }

    if (!isAddMoneyUnlocked) {
        if (addMoneySection) addMoneySection.classList.add('hidden');
        if (unlockDepositSection) unlockDepositSection.classList.remove('hidden'); // Ensure unlock section is visible if not unlocked
    } else {
        if (addMoneySection) addMoneySection.classList.remove('hidden');
        if (unlockDepositSection) unlockDepositSection.classList.add('hidden');
    }

    if (!isRemoveClientUnlocked) {
        if (unlockRemoveClientSection) unlockRemoveClientSection.classList.remove('hidden'); // Ensure unlock section is visible if not unlocked
    } else {
        if (unlockRemoveClientSection) unlockRemoveClientSection.classList.add('hidden');
    }

    console.log("Estado inicial de isAddClientUnlocked (após DOMContentLoaded):", isAddClientUnlocked);
    console.log("Estado inicial de isAddMoneyUnlocked (após DOMContentLoaded):", isAddMoneyUnlocked);
    console.log("Estado inicial de isRemoveClientUnlocked (após DOMContentLoaded):", isRemoveClientUnlocked);
});
