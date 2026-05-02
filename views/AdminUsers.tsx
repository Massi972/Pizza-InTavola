
import React, { useState, useEffect, useRef } from 'react';
import { User, Role } from '../types';
import { db } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, Input } from '../components/UI';
import { 
  Plus, Edit2, Trash2, X, AlertCircle, Check, Copy, MessageCircle, 
  RefreshCw, Search, FileDown, FileUp, MoreHorizontal, UserCheck, UserX,
  Smartphone, Lock, Unlock
} from '../components/Icons';
import * as XLSX from 'xlsx';

interface AdminUsers {
  onBack: () => void;
  currentUser?: User;
}

const AdminUsers: React.FC<AdminUsers> = ({ onBack, currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editing, setEditing] = useState<Partial<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatchMobile, setShowBatchMobile] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [broadcastQueue, setBroadcastQueue] = useState<User[] | null>(null);
  const [currentBroadcastIndex, setCurrentBroadcastIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single', user: User } | { type: 'bulk', count: number } | null>(null);
  const [masterCode, setMasterCode] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [updatingMasterCode, setUpdatingMasterCode] = useState(false);
  const [masterCodeEditing, setMasterCodeEditing] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [messageTarget, setMessageTarget] = useState<User | User[] | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.role === Role.ADMIN;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [usersData, settingsData] = await Promise.all([
        db.getUsers(),
        db.getSettings()
      ]);
      setUsers(usersData);
      setMasterCode(settingsData.registration_pin || '0000');
      setRegistrationOpen(settingsData.registration_open);
    } catch (err) {
      console.error("Errore fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const filteredUsers = users.filter(u => {
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || (u.email && u.email.toLowerCase().includes(search));
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsers.map(u => u.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBatchStatus = async (active: boolean) => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      await db.setUsersStatus(selectedIds, active);
      showToast(`Aggiornati ${selectedIds.length} utenti ✅`);
      await fetchUsers();
      setSelectedIds([]);
    } catch (err) {
      alert("Errore nell'aggiornamento bulk");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (selectedIds.includes(currentUser?.id || '')) {
      alert("Non puoi eliminare il tuo account amministratore nelle azioni di massa.");
      return;
    }
    setDeleteConfirm({ type: 'bulk', count: selectedIds.length });
  };

  const executeBatchDelete = async () => {
    const idsToDelete = [...selectedIds];
    const previousUsers = [...users];
    
    setDeleteConfirm(null);
    setLoading(true);
    
    // Ottimismo UI
    setUsers(prev => prev.filter(u => !idsToDelete.includes(u.id)));
    setSelectedIds([]);

    try {
      await db.deleteUsersBulk(idsToDelete);
      showToast(`Eliminati ${idsToDelete.length} utenti ✅`);
      await fetchUsers();
    } catch (err: any) {
      console.error("Errore eliminazione bulk:", err);
      setUsers(previousUsers);
      setSelectedIds(idsToDelete);
      alert("Errore nell'eliminazione di massa: " + (err.message || 'Errore database'));
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const dataToExport = users.map(u => ({
        Nome: u.firstName,
        Cognome: u.lastName,
        Email: u.email || '',
        Telefono: u.phone_e164,
        PIN: u.pin,
        Ruolo: u.role,
        Stato: u.active ? 'ATTIVO' : 'SOSPESO'
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dipendenti");
      XLSX.writeFile(wb, `Lista_Dipendenti_${new Date().toLocaleDateString('it-IT')}.xlsx`);
      showToast("File esportato! 📥");
    } catch (err) {
      alert("Errore durante l'esportazione");
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const newUsers: Partial<User>[] = [];
        const existingPhones = users.map(u => u.phone_e164);
        const existingPins = users.map(u => u.pin);

        for (const row of data) {
          const nome = (row.Nome || row.nome || '').trim();
          const cognome = (row.Cognome || row.cognome || '').trim();
          const email = (row.Email || row.email || '').trim();
          let tel = String(row.Telefono || row.telefono || '').trim();

          if (!nome || !cognome) continue;
          if (!tel.startsWith('+')) tel = '+39' + tel.replace(/\D/g, '');
          
          if (existingPhones.includes(tel)) continue;

          // Genera PIN
          let pin = '';
          while (!pin || existingPins.includes(pin)) {
            pin = Math.floor(1000 + Math.random() * 9000).toString();
          }
          existingPins.push(pin);

          newUsers.push({
            firstName: nome,
            lastName: cognome,
            phone_e164: tel,
            email: email,
            pin,
            role: Role.WORKER,
            active: true
          });
        }

        if (newUsers.length > 0) {
          await db.saveUsersBulk(newUsers);
          showToast(`Importati ${newUsers.length} nuovi utenti ✅`);
          await fetchUsers();
        } else {
          alert("Nessun nuovo utente da importare (controlla i dati o se i telefoni sono già presenti)");
        }
      } catch (err) {
        console.error("Errore import:", err);
        alert("Errore durante l'importazione del file. Assicurati che le colonne siano Nome, Cognome, Telefono.");
      } finally {
        setBulkImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleStartBroadcast = () => {
    if (selectedIds.length === 0) return;
    const selectedUsers = users.filter(u => selectedIds.includes(u.id));
    setBroadcastQueue(selectedUsers);
    setCurrentBroadcastIndex(0);
  };

  const sendNextBroadcast = () => {
    if (!broadcastQueue) return;
    const user = broadcastQueue[currentBroadcastIndex];
    sendWhatsApp(user);
    
    if (currentBroadcastIndex < broadcastQueue.length - 1) {
      setCurrentBroadcastIndex(prev => prev + 1);
    } else {
      setBroadcastQueue(null);
      showToast("Tutti i messaggi inviati! 🚀");
    }
  };

  const generateUniquePin = () => {
    let newPin = '';
    let isUnique = false;
    let attempts = 0;
    
    // Proviamo a generare un PIN univoco tra quelli presenti localmente (e quindi nel DB)
    while (!isUnique && attempts < 200) {
      // Generiamo un PIN di 4 cifre (es. da 1000 a 9999)
      newPin = Math.floor(1000 + Math.random() * 9000).toString();
      
      // Verifichiamo se esiste già tra gli utenti caricati
      const exists = users.some(u => u.pin === newPin);
      if (!exists) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (isUnique) {
      setEditing(prev => prev ? { ...prev, pin: newPin } : null);
      setError(''); // Puliamo eventuali errori di PIN duplicati precedenti
    } else {
      alert("Impossibile generare un PIN univoco dopo molti tentativi. Contatta l'assistenza.");
    }
  };

  const handleOpenMessageModal = (target: User | User[]) => {
    setMessageTarget(target);
    setCustomMessage(''); // Vuoto come richiesto
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const getPINMessage = (user: User) => {
    return `Ciao ${user.firstName}! Sono Luciano di InTavola.
Questo è il tuo codice personale per ordinare la pizza: ${user.pin} 

Accedi qui: https://pizza-in-tavola.vercel.app/

Per rendere l’accesso più veloce, ti consiglio di aggiungere l’app alla schermata Home del tuo telefono:

📱 Se hai Android
Apri il link con Google Chrome → premi i tre puntini in alto a destra → “Aggiungi a schermata Home”

🍎 Se hai iPhone
Apri il link con Safari → premi il tasto condividi (quello con la freccia in su) → “Aggiungi a Home”

Così avrai l’app sempre a portata di mano 👍`;
  };

  const copyToClipboard = async (user: User) => {
    const msg = getPINMessage(user);
    try {
      await navigator.clipboard.writeText(msg);
      showToast("Copiato ✅");
    } catch (err) {
      alert("Errore nella copia");
    }
  };

  const sendWhatsApp = (user: User) => {
    const phone = user.phone_e164 || '';
    if (!phone) {
      alert("Numero di telefono mancante!");
      return;
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length < 10) {
      alert("Il numero di telefono sembra incompleto o errato.");
      return;
    }

    const msg = encodeURIComponent(customMessage || getPINMessage(user));
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${msg}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const handleSendPromptedMessage = () => {
    if (!messageTarget) return;

    if (!customMessage.trim()) {
      if (!confirm("Il messaggio è vuoto. Vuoi inviare il messaggio standard con il PIN?")) {
        return;
      }
    }

    if (Array.isArray(messageTarget)) {
      // Invio multiplo (Broadcast)
      setBroadcastQueue(messageTarget);
      setCurrentBroadcastIndex(0);
      setMessageTarget(null);
    } else {
      // Invio singolo
      sendWhatsApp(messageTarget);
      setMessageTarget(null);
    }
  };

  const handleDelete = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert("Operazione non consentita: non puoi eliminare il tuo stesso account amministratore.");
      return;
    }
    setDeleteConfirm({ type: 'single', user });
  };

  const executeSingleDelete = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'single') return;
    const userToDelete = deleteConfirm.user;
    
    setDeleteConfirm(null);
    setLoading(true);

    // Ottimismo UI
    const previousUsers = [...users];
    setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
    setSelectedIds(prev => prev.filter(id => id !== userToDelete.id));

    try {
      await db.deleteUser(userToDelete.id);
      showToast("Utente eliminato ✅");
      await fetchUsers();
    } catch (err: any) {
      console.error("Errore eliminazione utente:", err);
      setUsers(previousUsers);
      alert(`Errore: ${err.message || "Impossibile eliminare l'utente"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMasterCode = async () => {
    if (!masterCode || !/^\d{4,6}$/.test(masterCode)) {
      alert("Il Codice di Registrazione deve essere un numero di 4-6 cifre.");
      return;
    }
    setUpdatingMasterCode(true);
    try {
      await db.updateSettings({ 
        registration_pin: masterCode,
        registration_open: registrationOpen
      });
      showToast("Configurazione aggiornata! 🔑");
      setMasterCodeEditing(false);
    } catch (err) {
      alert("Errore nell'aggiornamento della configurazione");
    } finally {
      setUpdatingMasterCode(false);
    }
  };

  const handleToggleRegistration = async (newValue: boolean) => {
    setUpdatingMasterCode(true);
    try {
      await db.updateSettings({ registration_open: newValue });
      setRegistrationOpen(newValue);
      showToast(newValue ? "Registrazioni APERTE ✅" : "Registrazioni CHIUSE 🔒");
    } catch (err) {
      alert("Errore durante l'aggiornamento");
    } finally {
      setUpdatingMasterCode(false);
    }
  };

  const handleSave = async () => {
    if (!editing?.firstName?.trim() || !editing?.lastName?.trim() || !editing?.pin || !editing?.phone_e164?.trim() || !editing?.email?.trim()) {
      setError('Tutti i campi (Nome, Cognome, Email, Telefono e PIN) sono obbligatori');
      return;
    }
    
    if (!editing.email.includes('@')) {
      setError('Inserisci un indirizzo email valido');
      return;
    }

    if (!editing.phone_e164.includes('+')) {
      setError('Inserisci il prefisso internazionale (es. +39 per Italia)');
      return;
    }

    if (editing.pin.length < 4 || editing.pin.length > 6 || !/^\d+$/.test(editing.pin)) {
      setError('Il PIN deve essere composto da 4-6 cifre numeriche');
      return;
    }

    if (editing.pin === masterCode) {
      setError('Il PIN personale non può essere uguale al Codice di Registrazione.');
      return;
    }

    setSaving(true);
    setError('');
    
    try {
      const [isPinAvailable, isEmailAvailable, isPhoneAvailable] = await Promise.all([
        db.isPinAvailable(editing.pin, editing.id),
        db.isEmailAvailable(editing.email, editing.id),
        db.isPhoneAvailable(editing.phone_e164, editing.id)
      ]);

      if (!isPinAvailable) {
        setError('Questo PIN è già in uso o riservato. Scegline o generane un altro.');
        setSaving(false);
        return;
      }

      if (!isEmailAvailable) {
        setError('Questa email è già registrata nel sistema.');
        setSaving(false);
        return;
      }

      if (!isPhoneAvailable) {
        setError('Questo numero di telefono è già registrato nel sistema.');
        setSaving(false);
        return;
      }

      const savedUser = { ...editing } as User;
      await db.saveUser(editing);
      await fetchUsers();
      
      showToast("Dati salvati correttamente ✅");
      setEditing(null);
      
      // Apri automaticamente il modal del messaggio per l'utente salvato
      setTimeout(() => {
        handleOpenMessageModal(savedUser);
      }, 500);
    } catch (err: any) {
      setError(err.message || "Errore nel salvataggio. Verifica i dati inseriti.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Gestione Personale" onBack={onBack}>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-black/80 text-white px-4 py-2 rounded-full text-sm font-bold animate-in fade-in zoom-in duration-200">
          {toast}
        </div>
      )}

      <div className="space-y-4">
        {/* Gestione PIN Master per Registrazione */}
        <Card className={`p-4 overflow-hidden relative transition-colors ${registrationOpen ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100 opacity-80'}`}>
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className={`font-black tracking-tight ${registrationOpen ? 'text-indigo-900' : 'text-gray-600'}`}>Registrazione Dipendenti</h3>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${registrationOpen ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-200 text-gray-500'}`}>
                  {registrationOpen ? 'APERTA' : 'CHIUSA'}
                </span>
              </div>
              <p className="text-xs text-[#8E8E93] leading-snug">
                {registrationOpen 
                  ? "Il Codice di Registrazione qui sotto permette ai dipendenti di registrarsi." 
                  : "Nessun nuovo dipendente può registrarsi finché non riapri l'accesso."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => handleToggleRegistration(!registrationOpen)}
                className={`p-2 rounded-xl transition-all shadow-sm active:scale-90 ${registrationOpen ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}
                title={registrationOpen ? "Chiudi registrazioni" : "Apri registrazioni"}
              >
                {registrationOpen ? <Lock size={18} /> : <Unlock size={18} />}
              </button>
              <button 
                onClick={() => setMasterCodeEditing(!masterCodeEditing)}
                className="p-2 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-colors"
                title="Modifica Codice"
              >
                <Edit2 size={18} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between">
            {masterCodeEditing ? (
              <div className="flex gap-2 flex-1 animate-in slide-in-from-top duration-300">
                <Input 
                  value={masterCode}
                  onChange={e => setMasterCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Nuovo Codice"
                  className="font-mono font-bold tracking-[0.2em] text-center"
                />
                <Button 
                  onClick={handleSaveMasterCode}
                  disabled={updatingMasterCode}
                  className="!bg-indigo-600"
                >
                  {updatingMasterCode ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
                </Button>
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black font-mono tracking-tighter ${registrationOpen ? 'text-indigo-900' : 'text-gray-400'}`}>{masterCode}</span>
                <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest">Codice Registrazione</span>
              </div>
            )}
          </div>
        </Card>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => { setEditing({ role: Role.WORKER, pin: '', active: true, phone_e164: '+39', email: '' }); setError(''); }}>
            <Plus size={20} /> Nuovo
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={bulkImporting} className="bg-emerald-50 text-emerald-600 border-emerald-100">
            {bulkImporting ? <RefreshCw size={20} className="animate-spin" /> : <FileUp size={20} />}
            <span className="hidden sm:inline ml-2">Importa</span>
          </Button>
          <Button variant="secondary" onClick={handleExportCSV} className="bg-indigo-50 text-indigo-600 border-indigo-100">
            <FileDown size={20} />
            <span className="hidden sm:inline ml-2">Esporta</span>
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportCSV} 
            accept=".csv,.xlsx,.xls" 
            className="hidden" 
          />
        </div>

        <div className="relative">
          <Input 
            placeholder="Cerca per nome o cognome..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]">
            <Search size={18} />
          </div>
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-[#8E8E93]/20 rounded-full text-[#8E8E93]"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex justify-between items-center px-1">
          <button 
            onClick={toggleSelectAll}
            className="text-[10px] font-bold text-[#007AFF] uppercase tracking-widest flex items-center gap-1"
          >
            {selectedIds.length === filteredUsers.length ? <UserX size={14} /> : <UserCheck size={14} />}
            {selectedIds.length === filteredUsers.length ? 'Deseleziona Tutti' : 'Seleziona Tutti'}
          </button>
          <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest">
            {selectedIds.length} Selezionati
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="loading-spinner" /></div>
        ) : (
          <div className="space-y-3 pb-24">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-[#8E8E93] py-10">
                {searchTerm ? "Nessun risultato trovato" : "Nessun dipendente registrato"}
              </p>
            ) : (
              filteredUsers.map(u => (
                <Card 
                  key={u.id} 
                  className={`p-4 transition-all ${!u.active ? 'opacity-50 grayscale' : ''} ${selectedIds.includes(u.id) ? 'ring-2 ring-indigo-500 shadow-lg translate-x-1' : ''}`}
                  onClick={() => toggleSelect(u.id)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.includes(u.id) ? 'bg-indigo-500 border-indigo-500' : 'border-[#C6C6C8]'}`}>
                        {selectedIds.includes(u.id) && <Check size={14} className="text-white" />}
                      </div>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                        u.role === Role.ADMIN ? 'bg-[#FF3B30]' : u.role === Role.SUPERVISOR ? 'bg-[#5856D6]' : 'bg-[#007AFF]'
                      }`}>
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div>
                        <h3 className="font-bold">{u.firstName} {u.lastName}</h3>
                        <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">{u.role}</p>
                      </div>
                    </div>
                      <div className="flex gap-2 relative z-10">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleOpenMessageModal(u);
                          }}
                          className="p-2 text-green-600 bg-green-50 rounded-full active:scale-90 transition-transform"
                          title="Invia messaggio personalizzato"
                        >
                          <MessageCircle size={16} />
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation(); 
                            setEditing(u); 
                            setError(''); 
                          }} 
                        className="p-2 text-[#007AFF] bg-[#F2F2F7] rounded-full active:scale-90 transition-transform"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => { 
                          e.preventDefault();
                          e.stopPropagation(); 
                          handleDelete(u); 
                        }} 
                        className="p-2 text-[#FF3B30] bg-red-50 rounded-full active:scale-90 transition-transform"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#F2F2F7] flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                        <Check size={14} /> PIN configurato
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditing({ ...u, pin: '' }); setError(''); }}
                        className="text-[10px] bg-[#F2F2F7] px-2 py-1 rounded-full font-bold uppercase flex items-center gap-1 hover:bg-[#E5E5EA]"
                      >
                        <RefreshCw size={10} /> Rigenera
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                       {u.phone_e164 && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100 font-medium">{u.phone_e164}</span>}
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.active ? 'ATTIVO' : 'SOSPESO'}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Barra Azioni di Massa */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white/80 backdrop-blur-xl border-t border-[#E5E5EA] animate-in slide-in-from-bottom duration-300">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-black text-indigo-500 uppercase leading-none">{selectedIds.length} Selezionati</p>
              <button onClick={() => setSelectedIds([])} className="text-[10px] font-bold text-[#8E8E93] uppercase hover:text-black">Annulla</button>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleOpenMessageModal(users.filter(u => selectedIds.includes(u.id)))}
                className="p-3 bg-[#25D366] text-white rounded-2xl shadow-lg active:scale-95 transition-transform"
                title="Invia Messaggio su WhatsApp"
              >
                <MessageCircle size={20} />
              </button>
              <button 
                onClick={() => handleBatchStatus(true)}
                className="p-3 bg-green-500 text-white rounded-2xl shadow-lg active:scale-95 transition-transform"
                title="Attiva selezionati"
              >
                <UserCheck size={20} />
              </button>
              <button 
                onClick={() => handleBatchStatus(false)}
                className="p-3 bg-[#FF9500] text-white rounded-2xl shadow-lg active:scale-95 transition-transform"
                title="Disattiva selezionati"
              >
                <UserX size={20} />
              </button>
              <button 
                onClick={handleBatchDelete}
                className="p-3 bg-[#FF3B30] text-white rounded-2xl shadow-lg active:scale-95 transition-transform"
                title="Elimina selezionati"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Messaggio Personalizzato */}
      {messageTarget && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-center items-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 space-y-4 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black tracking-tight">Crea Messaggio</h3>
              <button onClick={() => setMessageTarget(null)} className="p-2 bg-gray-100 rounded-full"><X size={18} /></button>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest pl-1">
                Destinatario: {Array.isArray(messageTarget) ? `${messageTarget.length} persone` : `${messageTarget.firstName} ${messageTarget.lastName}`}
              </p>
              <textarea 
                className="w-full h-40 p-4 bg-[#F2F2F7] rounded-2xl border-none outline-none text-sm font-medium resize-none focus:ring-2 ring-indigo-500/20"
                placeholder="Scrivi qui il tuo messaggio..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
              />
              <div className="flex justify-between px-1">
                <button 
                  onClick={() => setCustomMessage(Array.isArray(messageTarget) ? '' : getPINMessage(messageTarget as User))}
                  className="text-[10px] font-bold text-indigo-500 uppercase flex items-center gap-1"
                >
                  <RefreshCw size={10} /> Carica Messaggio PIN
                </button>
                <span className="text-[10px] font-bold text-[#8E8E93]">{customMessage.length} caratteri</span>
              </div>
            </div>

            <Button fullWidth className="!bg-[#25D366]" onClick={handleSendPromptedMessage}>
              <MessageCircle size={18} /> Invia su WhatsApp
            </Button>
          </div>
        </div>
      )}

      {/* Modal Broadcast Queue */}
      {broadcastQueue && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-center items-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 space-y-6 shadow-2xl animate-in zoom-in duration-300">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-black tracking-tight">Invio Multiplo PIN</h3>
                <button onClick={() => setBroadcastQueue(null)}><X /></button>
             </div>
             
             <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                   <Smartphone size={32} />
                </div>
                <p className="text-sm text-[#8E8E93]">
                   Stai inviando i PIN a <b>{broadcastQueue.length}</b> dipendenti.<br/>
                   Per ogni persona si aprirà WhatsApp, invia il messaggio e torna qui per il prossimo.
                </p>
             </div>

             <div className="bg-[#F2F2F7] p-4 rounded-2xl">
                <p className="text-[10px] font-bold text-[#8E8E93] uppercase">Prossimo in lista:</p>
                <p className="font-bold text-lg">{broadcastQueue[currentBroadcastIndex]?.firstName} {broadcastQueue[currentBroadcastIndex]?.lastName}</p>
                <p className="text-xs text-indigo-500 font-bold">{broadcastQueue[currentBroadcastIndex]?.phone_e164}</p>
             </div>

             <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-[#25D366] transition-all duration-500" 
                  style={{ width: `${((currentBroadcastIndex + 1) / broadcastQueue.length) * 100}%` }}
                />
             </div>

             <Button fullWidth className="!bg-[#25D366]" onClick={sendNextBroadcast}>
                <MessageCircle size={18} /> Invia Messaggio ({currentBroadcastIndex + 1}/{broadcastQueue.length})
             </Button>
          </div>
        </div>
      )}

      {/* Modal Convalida Eliminazione */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-center items-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-8 space-y-6 shadow-2xl animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-100 text-[#FF3B30] rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black tracking-tight">Conferma Eliminazione</h3>
              <p className="text-sm text-[#8E8E93]">
                {deleteConfirm.type === 'single' ? (
                  <>Sei sicuro di voler eliminare definitivamente <b>{deleteConfirm.user.firstName} {deleteConfirm.user.lastName}</b>?</>
                ) : (
                  <>Sei sicuro di voler eliminare definitivamente <b>{deleteConfirm.count}</b> dipendenti selezionati?</>
                )}
                <br />Questa operazione non può essere annullata.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                variant="secondary" 
                fullWidth 
                onClick={() => setDeleteConfirm(null)}
                className="!bg-[#F2F2F7] border-none"
              >
                Annulla
              </Button>
              <Button 
                variant="danger" 
                fullWidth 
                onClick={deleteConfirm.type === 'single' ? executeSingleDelete : executeBatchDelete}
              >
                Elimina
              </Button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setEditing(null)} />
          <div className="relative bg-white rounded-t-[32px] p-6 pb-10 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{editing.id ? 'Aggiorna Dipendente' : 'Nuovo Dipendente'}</h2>
              <button onClick={() => setEditing(null)} className="p-2 bg-[#F2F2F7] rounded-full">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex items-center gap-2 text-[#FF3B30] text-xs font-bold animate-in fade-in duration-200">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">Nome</label>
                  <Input placeholder="Nome" value={editing.firstName || ''} onChange={e => setEditing({...editing, firstName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">Cognome</label>
                  <Input placeholder="Cognome" value={editing.lastName || ''} onChange={e => setEditing({...editing, lastName: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">Email</label>
                <Input 
                  placeholder="mario.rossi@email.it"
                  type="email"
                  value={editing.email || ''} 
                  onChange={e => setEditing({...editing, email: e.target.value})} 
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">WhatsApp (es. +393331234567)</label>
                <Input 
                  placeholder="+39..."
                  type="tel"
                  value={editing.phone_e164 || ''} 
                  onChange={e => setEditing({...editing, phone_e164: e.target.value})} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">PIN Personale (4-6 cifre)</label>
                <div className="relative">
                  <Input 
                    type="text"
                    inputMode="numeric"
                    placeholder="Inserisci PIN"
                    className="font-mono tracking-widest text-lg pr-12"
                    value={editing.pin || ''} 
                    onChange={e => setEditing({...editing, pin: e.target.value.replace(/\D/g, '').slice(0, 6)})} 
                  />
                  <button 
                    type="button"
                    onClick={generateUniquePin}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#007AFF] hover:bg-[#F2F2F7] rounded-full transition-colors"
                    title="Genera PIN univoco"
                  >
                    <RefreshCw size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">Ruolo</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm font-medium"
                  value={editing.role}
                  onChange={e => setEditing({...editing, role: e.target.value as Role})}
                >
                  <option value={Role.WORKER}>Dipendente</option>
                  <option value={Role.SUPERVISOR}>Supervisor</option>
                  <option value={Role.ADMIN}>Amministratore</option>
                </select>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input 
                  type="checkbox" 
                  id="active_cb"
                  className="w-5 h-5 accent-[#007AFF]"
                  checked={editing.active !== false}
                  onChange={e => setEditing({...editing, active: e.target.checked})}
                />
                <label htmlFor="active_cb" className="text-sm font-bold text-[#1c1c1e]">Utente Attivo</label>
              </div>
            </div>

            <Button fullWidth onClick={handleSave} disabled={saving} className="mt-4">
              {saving ? <div className="loading-spinner border-white border-t-transparent" /> : 'Salva e Prepara Messaggio'}
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminUsers;
