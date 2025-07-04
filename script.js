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

// DOM Elements
// Remove userIdDisplay as there's no Firebase user ID
// const userIdDisplay = document.getElementById('userIdDisplay');
// const currentUserIdSpan = document.getElementById('currentUserId');
const messageDisplay = document.getElementById('messageDisplay');
const unlockSection = document.getElementById('unlockSection');
const unlockCodeInput = document.getElementById('unlockCodeInput');
const unlockButton = document.getElementById('unlockButton');
const addClientSection = document.getElementById('addClientSection');
const newClientCodeInput = document.getElementById('newClientCode');
const newClientNameInput = document.getElementById('newClientName');
const newClientInitialBalanceInput = document.getElementById('newClientInitialBalance');
const addClientButton = document.getElementById('addClientButton');
const selectedClientCodeSelect = document.getElementById('selectedClientCode');
const discountValueInput = document.getElementById('discountValue');
const discountButton = document.getElementById('discountButton');
const clientsListContainer = document.getElementById('clientsListContainer');
const confirmModal = document.getElementById('confirmModal');
const clientToDeleteNameSpan = document.getElementById('clientToDeleteName');
const confirmDeleteButton = document.getElementById('confirmDeleteButton');
const cancelDeleteButton = document.getElementById('cancelDeleteButton');

// New DOM Elements for Add Money Functionality
const unlockDepositSection = document.getElementById('unlockDepositSection');
const unlockDepositCodeInput = document.getElementById('unlockDepositCodeInput');
const unlockDepositButton = document.getElementById('unlockDepositButton');
const addMoneySection = document.getElementById('addMoneySection');
const selectedClientDepositSelect = document.getElementById('selectedClientDepositSelect');
const depositValueInput = document.getElementById('depositValueInput');
const depositButton = document.getElementById('depositButton');

// New DOM Elements for Remove Client Unlock
const unlockRemoveClientSection = document.getElementById('unlockRemoveClientSection');
const unlockRemoveClientCodeInput = document.getElementById('unlockRemoveClientCodeInput');
const unlockRemoveClientButton = document.getElementById('unlockRemoveClientButton');


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
}

function renderClientsList(clients) {
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
        row.innerHTML = `
            <td class="py-3 px-4 text-sm text-gray-800 font-mono">${code}</td>
            <td class="py-3 px-4 text-sm text-gray-800">${client.nome}</td>
            <td class="py-3 px-4 text-sm text-gray-800 font-semibold">R$${client.saldo.toFixed(2)}</td>
            <td class="py-3 px-4 text-sm">
                <button data-client-code="${code}" class="remove-client-btn bg-red-500 text-white py-1 px-3 rounded-md hover:bg-red-600 transition duration-300 ease-in-out shadow-sm text-xs">
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
            if (!isRemoveClientUnlocked) { // Check if remove client function is unlocked
                showMessage("Por favor, desbloqueie a função de remover cliente primeiro.", 'error');
                return;
            }
            const code = event.target.dataset.clientCode;
            clientToDeleteCode = code;
            clientToDeleteNameSpan.textContent = clientsData[code]?.nome || code;
            confirmModal.classList.remove('hidden');
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

// Removed logTransactionToFirestore as it's a backend/database feature

// --- Event Handlers ---

// Event listener for Unlock Add Client button
unlockButton.addEventListener('click', () => {
    const enteredCode = unlockCodeInput.value.trim();
    console.log("Botão 'Desbloquear Adição de Cliente' clicado.");
    console.log("Código digitado (trim):", enteredCode);
    console.log("Código esperado:", REQUIRED_UNLOCK_CODE);

    if (enteredCode === REQUIRED_UNLOCK_CODE) {
        isAddClientUnlocked = true;
        addClientSection.classList.remove('hidden');
        unlockSection.classList.add('hidden');
        showMessage("✅ Função 'Adicionar Novo Cliente' desbloqueada!", 'info');
        unlockCodeInput.value = '';
    } else {
        showMessage("Erro: Código de desbloqueio incorreto.", 'error');
    }
});

// Event listener for Unlock Deposit button
unlockDepositButton.addEventListener('click', () => {
    const enteredCode = unlockDepositCodeInput.value.trim();
    console.log("Botão 'Desbloquear Adicionar Dinheiro' clicado.");
    console.log("Código digitado (trim):", enteredCode);
    console.log("Código esperado:", REQUIRED_DEPOSIT_UNLOCK_CODE);

    if (enteredCode === REQUIRED_DEPOSIT_UNLOCK_CODE) {
        isAddMoneyUnlocked = true;
        addMoneySection.classList.remove('hidden');
        unlockDepositSection.classList.add('hidden');
        showMessage("✅ Função 'Adicionar Dinheiro' desbloqueada!", 'info');
        unlockDepositCodeInput.value = '';
    } else {
        showMessage("Erro: Código de desbloqueio incorreto para adicionar dinheiro.", 'error');
    }
});

// New Event listener for Unlock Remove Client button
unlockRemoveClientButton.addEventListener('click', () => {
    const enteredCode = unlockRemoveClientCodeInput.value.trim();
    console.log("Botão 'Desbloquear Remover Cliente' clicado.");
    console.log("Código digitado (trim):", enteredCode);
    console.log("Código esperado:", REQUIRED_REMOVE_UNLOCK_CODE);

    if (enteredCode === REQUIRED_REMOVE_UNLOCK_CODE) {
        isRemoveClientUnlocked = true;
        unlockRemoveClientSection.classList.add('hidden'); // Hide the unlock section
        showMessage("✅ Função 'Remover Cliente' desbloqueada!", 'info');
        unlockRemoveClientCodeInput.value = '';
    } else {
        showMessage("Erro: Código de desbloqueio incorreto para remover cliente.", 'error');
    }
});


addClientButton.addEventListener('click', async () => {
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
});

discountButton.addEventListener('click', async () => {
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
});

// New Event listener for Deposit button
depositButton.addEventListener('click', async () => {
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
});


confirmDeleteButton.addEventListener('click', async () => {
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
        confirmModal.classList.add('hidden');
    }
});

cancelDeleteButton.addEventListener('click', () => {
    clientToDeleteCode = null;
    confirmModal.classList.add('hidden');
    showMessage("Remoção de cliente cancelada.");
});

// --- Initial Setup ---

window.onload = () => {
    // Load clients from local storage on page load
    clientsData = loadClientsFromLocalStorage();
    renderClientsList(clientsData); // Render initial list

    // Hide userIdDisplay as it's not relevant without Firebase Auth
    const userIdDisplayElement = document.getElementById('userIdDisplay');
    if (userIdDisplayElement) {
        userIdDisplayElement.classList.add('hidden');
    }

    // Initialize visibility of sections
    if (!isAddClientUnlocked) {
        addClientSection.classList.add('hidden');
    }
    if (!isAddMoneyUnlocked) {
        addMoneySection.classList.add('hidden');
    }
    if (!isRemoveClientUnlocked) { // Hide remove client unlock section initially
        // Note: The remove client buttons are always visible, but the action is blocked by the password.
        // This section is for the unlock input.
        unlockRemoveClientSection.classList.remove('hidden'); // Ensure it's visible for unlocking
    } else {
        unlockRemoveClientSection.classList.add('hidden'); // Hide if already unlocked (e.g., from previous session)
    }
};
