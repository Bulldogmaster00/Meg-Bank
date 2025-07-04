import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, query, onSnapshot, addDoc } from 'firebase/firestore';

// Define the Firebase configuration from the global variable
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Initialize Firebase outside of the component to avoid re-initialization
let app, db, auth;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.error("Erro ao inicializar Firebase:", error);
}

// Main App component
const App = () => {
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClientCode, setSelectedClientCode] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [newClientCode, setNewClientCode] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientInitialBalance, setNewClientInitialBalance] = useState('');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // New state for unlock functionality
  const [unlockCodeInput, setUnlockCodeInput] = useState('');
  const [isAddClientUnlocked, setIsAddClientUnlocked] = useState(false);
  // The specific code to unlock add client function (now kept secret from UI)
  const REQUIRED_UNLOCK_CODE = '956523332996147453'; 

  // State for confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  // Authenticate and set up Firestore listener
  useEffect(() => {
    const setupFirebase = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (user) => {
          if (user) {
            setUserId(user.uid);
            setIsAuthReady(true);
            console.log("Usuário autenticado:", user.uid);
          } else {
            console.log("Nenhum usuário autenticado.");
            setUserId(null);
            setIsAuthReady(true); // Still set ready even if no user, to proceed with anonymous access or handle unauthenticated state
          }
          setLoading(false);
        });
      } catch (e) {
        console.error("Erro de autenticação:", e);
        setError("Erro ao autenticar. Por favor, tente novamente.");
        setLoading(false);
        setIsAuthReady(true); // Mark as ready even on error
      }
    };

    if (auth && db && !isAuthReady) { // Only run once
      setupFirebase();
    }
  }, [isAuthReady]); // Depend on isAuthReady to ensure it runs once after auth check

  // Listen for real-time updates to clients collection
  useEffect(() => {
    if (!db || !isAuthReady || !userId) return; // Wait for Firebase and auth to be ready

    // Path for public data: /artifacts/{appId}/public/data/clients
    const clientsCollectionRef = collection(db, `artifacts/${appId}/public/data/clients`);
    const q = query(clientsCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updatedClients = {};
      snapshot.forEach((doc) => {
        updatedClients[doc.id] = doc.data();
      });
      setClients(updatedClients);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao carregar clientes do Firestore:", err);
      setError("Erro ao carregar dados dos clientes.");
      setLoading(false);
    });

    // Clean up listener on component unmount
    return () => unsubscribe();
  }, [db, isAuthReady, userId]); // Re-run if db, auth readiness, or userId changes

  // Function to save client data to Firestore
  const saveClientToFirestore = useCallback(async (clientCode, clientData) => {
    if (!db || !userId) {
      setMessage("Erro: Firebase não inicializado ou usuário não autenticado.");
      return false;
    }
    try {
      // Path for public data: /artifacts/${appId}/public/data/clients/{clientCode}
      await setDoc(doc(db, `artifacts/${appId}/public/data/clients`, clientCode), clientData);
      return true;
    } catch (e) {
      console.error("Erro ao salvar cliente no Firestore:", e);
      setMessage(`Erro ao salvar dados do cliente ${clientCode}: ${e.message}`);
      return false;
    }
  }, [db, userId]);

  // Function to delete client data from Firestore
  const deleteClientFromFirestore = useCallback(async (clientCode) => {
    if (!db || !userId) {
      setMessage("Erro: Firebase não inicializado ou usuário não autenticado.");
      return false;
    }
    try {
      // Path for public data: /artifacts/${appId}/public/data/clients/{clientCode}
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/clients`, clientCode));
      return true;
    } catch (e) {
      console.error("Erro ao remover cliente do Firestore:", e);
      setMessage(`Erro ao remover cliente ${clientCode}: ${e.message}`);
      return false;
    }
  }, [db, userId]);

  // Function to log transactions to Firestore
  const logTransactionToFirestore = useCallback(async (transactionData) => {
    if (!db || !userId) {
      console.error("Erro: Firebase não inicializado ou usuário não autenticado para registrar transação.");
      return;
    }
    try {
      // Path for public data: /artifacts/${appId}/public/data/transactions
      await addDoc(collection(db, `artifacts/${appId}/public/data/transactions`), {
        ...transactionData,
        timestamp: new Date().toISOString(), // Add a timestamp
        userId: userId // Log which user made the transaction
      });
    } catch (e) {
      console.error("Erro ao registrar transação no Firestore:", e);
    }
  }, [db, userId]);

  // Handle discounting saldo
  const handleDiscount = async () => {
    if (!selectedClientCode) {
      setMessage("Por favor, selecione um cliente.");
      return;
    }
    const client = clients[selectedClientCode];
    if (!client) {
      setMessage("Cliente não encontrado.");
      return;
    }

    const value = parseFloat(discountValue);
    if (isNaN(value) || value <= 0) {
      setMessage("Valor inválido! Use números positivos.");
      return;
    }
    if (value > client.saldo) {
      setMessage("Saldo insuficiente!");
      return;
    }

    const saldoAnterior = client.saldo;
    const novoSaldo = saldoAnterior - value;
    const updatedClientData = { ...client, saldo: novoSaldo };

    const success = await saveClientToFirestore(selectedClientCode, updatedClientData);
    if (success) {
      setMessage(`✅ R$${value.toFixed(2)} descontado de ${client.nome}. Novo saldo: R$${novoSaldo.toFixed(2)}`);
      logTransactionToFirestore({
        cliente: selectedClientCode,
        valor: value,
        saldo_anterior: saldoAnterior,
        saldo_novo: novoSaldo,
      });
      setDiscountValue(''); // Clear input after successful discount
    } else {
      setMessage("Erro ao descontar saldo. Tente novamente.");
    }
  };

  // Handle adding a new client
  const handleAddClient = async () => {
    if (!isAddClientUnlocked) {
      setMessage("Por favor, desbloqueie a função de adicionar cliente primeiro.");
      return;
    }
    if (!newClientCode || !newClientInitialBalance) {
      setMessage("Código e Saldo Inicial são obrigatórios.");
      return;
    }
    if (clients[newClientCode]) {
      setMessage("Erro: Código de cliente já existe!");
      return;
    }

    const initialBalance = parseFloat(newClientInitialBalance);
    if (isNaN(initialBalance) || initialBalance < 0) {
      setMessage("Saldo inicial inválido! Deve ser um número positivo ou zero.");
      return;
    }

    const newClientData = {
      saldo: initialBalance,
      nome: newClientName || `Cliente ${newClientCode}`,
    };

    const success = await saveClientToFirestore(newClientCode, newClientData);
    if (success) {
      setMessage(`✅ Cliente ${newClientCode} (${newClientData.nome}) adicionado com sucesso com saldo R$${initialBalance.toFixed(2)}.`);
      setNewClientCode('');
      setNewClientName('');
      setNewClientInitialBalance('');
    } else {
      setMessage("Erro ao adicionar cliente. Tente novamente.");
    }
  };

  // Handle unlock code submission
  const handleUnlock = () => {
    if (unlockCodeInput === REQUIRED_UNLOCK_CODE) {
      setIsAddClientUnlocked(true);
      setMessage("✅ Função 'Adicionar Novo Cliente' desbloqueada!");
      setUnlockCodeInput(''); // Clear input after successful unlock
    } else {
      setMessage("Erro: Código de desbloqueio incorreto.");
    }
  };

  // Handle delete client initiation (show confirmation modal)
  const handleDeleteClientClick = (clientCode) => {
    setClientToDelete(clientCode);
    setShowConfirmModal(true);
  };

  // Handle actual deletion after confirmation
  const handleConfirmDelete = async () => {
    if (clientToDelete) {
      const success = await deleteClientFromFirestore(clientToDelete);
      if (success) {
        setMessage(`✅ Cliente ${clientToDelete} removido com sucesso!`);
      } else {
        setMessage(`Erro ao remover cliente ${clientToDelete}.`);
      }
      setClientToDelete(null);
      setShowConfirmModal(false);
    }
  };

  // Handle cancel deletion
  const handleCancelDelete = () => {
    setClientToDelete(null);
    setShowConfirmModal(false);
    setMessage("Remoção de cliente cancelada.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-lg font-semibold text-gray-700">Carregando dados...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-700 p-4 rounded-lg">
        <div className="text-lg font-semibold">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-inter">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-xl p-6 sm:p-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-gray-800 mb-8">
          Meg Bank
        </h1>

        {userId && (
          <p className="text-sm text-gray-600 text-center mb-4">
            Seu ID de Usuário (para sincronização): <span className="font-mono bg-gray-200 px-2 py-1 rounded-md">{userId}</span>
          </p>
        )}

        {message && (
          <div className={`p-3 rounded-lg mb-6 text-center ${message.startsWith('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        {/* Unlock Add New Client Section */}
        {!isAddClientUnlocked && (
          <div className="mb-10 p-6 bg-yellow-50 rounded-lg shadow-inner">
            <h2 className="text-2xl font-semibold text-yellow-800 mb-4">Desbloquear Adição de Cliente</h2>
            <p className="text-gray-700 mb-4">
              Para adicionar novos clientes, insira o código de desbloqueio:
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="password" // Use type "password" for sensitive input
                placeholder="Insira o código de desbloqueio"
                value={unlockCodeInput}
                onChange={(e) => setUnlockCodeInput(e.target.value)}
                className="flex-grow p-3 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <button
                onClick={handleUnlock}
                className="bg-yellow-600 text-white py-3 px-6 rounded-md hover:bg-yellow-700 transition duration-300 ease-in-out shadow-md"
              >
                Desbloquear
              </button>
            </div>
          </div>
        )}

        {/* Adicionar Novo Cliente Section - Conditionally rendered */}
        {isAddClientUnlocked && (
          <div className="mb-10 p-6 bg-blue-50 rounded-lg shadow-inner">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4">Adicionar Novo Cliente</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <input
                type="text"
                placeholder="Código do Cliente (ex: 1003)"
                value={newClientCode}
                onChange={(e) => setNewClientCode(e.target.value)}
                className="p-3 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Nome do Cliente (opcional)"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="p-3 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Saldo Inicial (R$)"
                value={newClientInitialBalance}
                onChange={(e) => setNewClientInitialBalance(e.target.value)}
                className="p-3 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleAddClient}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition duration-300 ease-in-out shadow-md"
            >
              Adicionar Cliente
            </button>
          </div>
        )}

        {/* Descontar Saldo Section */}
        <div className="mb-10 p-6 bg-purple-50 rounded-lg shadow-inner">
          <h2 className="text-2xl font-semibold text-purple-800 mb-4">Descontar Saldo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <select
              value={selectedClientCode}
              onChange={(e) => setSelectedClientCode(e.target.value)}
              className="p-3 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
            >
              <option value="">Selecione um Cliente</option>
              {Object.entries(clients).map(([code, data]) => (
                <option key={code} value={code}>
                  {data.nome} (R${data.saldo.toFixed(2)})
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Valor a Descontar (R$)"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="p-3 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleDiscount}
            className="w-full bg-purple-600 text-white py-3 px-6 rounded-md hover:bg-purple-700 transition duration-300 ease-in-out shadow-md"
          >
            Descontar
          </button>
        </div>

        {/* Lista de Clientes Section */}
        <div className="p-6 bg-gray-50 rounded-lg shadow-inner">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Clientes Atuais</h2>
          {Object.keys(clients).length === 0 ? (
            <p className="text-gray-600 text-center">Nenhum cliente cadastrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Código</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Nome</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Saldo</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Ações</th> {/* New column for actions */}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(clients).map(([code, data]) => (
                    <tr key={code} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-800 font-mono">{code}</td>
                      <td className="py-3 px-4 text-sm text-gray-800">{data.nome}</td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">R${data.saldo.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm">
                        <button
                          onClick={() => handleDeleteClientClick(code)}
                          className="bg-red-500 text-white py-1 px-3 rounded-md hover:bg-red-600 transition duration-300 ease-in-out shadow-sm text-xs"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
              <h3 className="text-lg font-semibold mb-4">Confirmar Remoção</h3>
              <p className="mb-6">Tem certeza que deseja remover o cliente <span className="font-bold">{clientToDelete}</span>?</p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleConfirmDelete}
                  className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition duration-300"
                >
                  Confirmar
                </button>
                <button
                  onClick={handleCancelDelete}
                  className="bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 transition duration-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
