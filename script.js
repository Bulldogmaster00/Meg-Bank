// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, deleteDoc, collection, query, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Firebase Initialization
let app, db, auth;
let currentUserId = null;
let isAuthReady = false;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase inicializado com sucesso.");
} catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
    showMessage(`Erro ao inicializar Firebase: ${error.message}`, 'error');
}

// DOM Elements
const userIdDisplay = document.getElementById('userIdDisplay');
const currentUserIdSpan = document.getElementById('currentUserId');
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

// Secret Unlock Code
const REQUIRED_UNLOCK_CODE = '956523332996147453';

// State variables (managed by JavaScript directly)
let clientsData = {};
let clientToDeleteCode = null; // Stores the code of the client to be deleted

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
        clientsListContainer.innerHTML = '<p class="text-gray-600 text-center">Nenhum cliente cadastrado ainda.</p>';
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
    selectedClientCodeSelect.innerHTML = '<option value="">Selecione um Cliente</option>'; // Clear and reset select

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

        // Add option to select dropdown
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${client.nome} (R$${client.saldo.toFixed(2)})`;
        selectedClientCodeSelect.appendChild(option);
    }

    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-client-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const code = event.target.dataset.clientCode;
            clientToDeleteCode = code;
            clientToDeleteNameSpan.textContent = clientsData[code]?.nome || code;
            confirmModal.classList.remove('hidden');
        });
    });
}

// --- Firebase Operations ---

async function saveClientToFirestore(clientCode, clientData) {
    if (!db || !currentUserId) {
        showMessage("Erro: Firebase não inicializado ou usuário não autenticado.", 'error');
        console.error("Erro: saveClientToFirestore - DB ou userId ausente.");
        return false;
    }
    try {
        console.log(`Tentando salvar cliente ${clientCode} no Firestore...`);
        await setDoc(doc(db, `artifacts/${appId}/public/data/clients`, clientCode), clientData);
        console.log(`Cliente ${clientCode} salvo com sucesso.`);
        return true;
    } catch (e) {
        console.error(`Erro ao salvar cliente ${clientCode} no Firestore:`, e);
        showMessage(`Erro ao salvar dados do cliente ${clientCode}: ${e.message}`, 'error');
        return false;
    }
}

async function deleteClientFromFirestore(clientCode) {
    if (!db || !currentUserId) {
        showMessage("Erro: Firebase não inicializado ou usuário não autenticado.", 'error');
        console.error("Erro: deleteClientFromFirestore - DB ou userId ausente.");
        return false;
    }
    try {
        console.log(`Tentando remover cliente ${clientCode} do Firestore...`);
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/clients`, clientCode));
        console.log(`Cliente ${clientCode} removido com sucesso.`);
        return true;
    } catch (e) {
        console.error(`Erro ao remover cliente ${clientCode} do Firestore:`, e);
        showMessage(`Erro ao remover cliente ${clientCode}: ${e.message}`, 'error');
        return false;
    }
}

async function logTransactionToFirestore(transactionData) {
    if (!db || !currentUserId) {
        console.error("Erro: logTransactionToFirestore - Firebase não inicializado ou usuário não autenticado para registrar transação.");
        return;
    }
    try {
        console.log("Registrando transação no Firestore...");
        await addDoc(collection(db, `artifacts/${appId}/public/data/transactions`), {
            ...transactionData,
            timestamp: new Date().toISOString(),
            userId: currentUserId
        });
        console.log("Transação registrada com sucesso.");
    } catch (e) {
        console.error("Erro ao registrar transação no Firestore:", e);
    }
}

// --- Event Handlers ---

unlockButton.addEventListener('click', () => {
    if (unlockCodeInput.value === REQUIRED_UNLOCK_CODE) {
        addClientSection.classList.remove('hidden');
        unlockSection.classList.add('hidden');
        showMessage("✅ Função 'Adicionar Novo Cliente' desbloqueada!");
        unlockCodeInput.value = '';
    } else {
        showMessage("Erro: Código de desbloqueio incorreto.", 'error');
    }
});

addClientButton.addEventListener('click', async () => {
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

    const success = await saveClientToFirestore(newClientCode, newClient);
    if (success) {
        showMessage(`✅ Cliente ${newClientCode} (${newClient.nome}) adicionado com sucesso com saldo R$${newClientInitialBalance.toFixed(2)}.`);
        newClientCodeInput.value = '';
        newClientNameInput.value = '';
        newClientInitialBalanceInput.value = '';
    } else {
        showMessage("Erro ao adicionar cliente. Tente novamente.", 'error');
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

    const success = await saveClientToFirestore(selectedCode, updatedClientData);
    if (success) {
        showMessage(`✅ R$${discountValue.toFixed(2)} descontado de ${client.nome}. Novo saldo: R$${novoSaldo.toFixed(2)}`);
        logTransactionToFirestore({
            cliente: selectedCode,
            valor: discountValue,
            saldo_anterior: saldoAnterior,
            saldo_novo: novoSaldo,
        });
        discountValueInput.value = '';
    } else {
        showMessage("Erro ao descontar saldo. Tente novamente.", 'error');
    }
});

confirmDeleteButton.addEventListener('click', async () => {
    if (clientToDeleteCode) {
        const success = await deleteClientFromFirestore(clientToDeleteCode);
        if (success) {
            showMessage(`✅ Cliente ${clientToDeleteCode} removido com sucesso!`);
        } else {
            showMessage(`Erro ao remover cliente ${clientToDeleteCode}.`, 'error');
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

// --- Initial Setup and Firebase Listeners ---

window.onload = () => {
    // Authentication
    if (!app || !db || !auth) {
        console.error("Firebase não inicializado na carga da janela.");
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            isAuthReady = true;
            currentUserIdSpan.textContent = currentUserId;
            userIdDisplay.classList.remove('hidden');
            console.log("Usuário autenticado:", currentUserId);

            // Setup Firestore listener after authentication
            const clientsCollectionRef = collection(db, `artifacts/${appId}/public/data/clients`);
            const q = query(clientsCollectionRef);

            onSnapshot(q, (snapshot) => {
                console.log("Dados de clientes recebidos do Firestore (onSnapshot).");
                const updatedClients = {};
                snapshot.forEach((doc) => {
                    updatedClients[doc.id] = doc.data();
                });
                clientsData = updatedClients; // Update local state
                renderClientsList(clientsData); // Re-render UI
            }, (err) => {
                console.error("Erro ao carregar clientes do Firestore (onSnapshot):", err);
                showMessage(`Erro ao carregar dados dos clientes: ${err.message}.`, 'error');
            });

        } else {
            console.log("Nenhum usuário autenticado. Tentando autenticação inicial.");
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                    console.log("Autenticado com token personalizado após onAuthStateChanged.");
                } else {
                    await signInAnonymously(auth);
                    console.log("Autenticado anonimamente após onAuthStateChanged.");
                }
            } catch (e) {
                console.error("Erro na autenticação inicial (signIn):", e);
                showMessage(`Erro na autenticação inicial: ${e.message}`, 'error');
            }
        }
    });
};
