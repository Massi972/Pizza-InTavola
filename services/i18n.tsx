import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'it' | 'en' | 'es' | 'ar' | 'ur';

export interface TranslationDict {
  enterPin: string;
  invalidPin: string;
  deleteKey: string;
  notOnList: string;
  securitySlogan: string;
  forgotPin: string;
  recoveryTitle: string;
  recoveryDesc: string;
  emailLabel: string;
  phoneLabel: string;
  mismatchError: string;
  genericError: string;
  verifyIdentity: string;
  verifiedIdentity: string;
  yourPersonalPin: string;
  recWarning: string;
  understandButton: string;
  
  // Register
  registerTitle: string;
  localCodeLabel: string;
  localCodePlaceholder: string;
  invalidLocalCode: string;
  registrationClosed: string;
  connectionError: string;
  requiredFields: string;
  phoneRequired: string;
  emailRequired: string;
  pinRequiredLength: string;
  pinMatchesMasterError: string;
  pinTaken: string;
  emailTaken: string;
  phoneTaken: string;
  regCompleteTitle: string;
  regCompleteDesc: string;
  addToHomeTitle: string;
  androidGuideTitle: string;
  androidGuideDesc: string;
  iosGuideTitle: string;
  iosGuideDesc: string;
  backToLoginBtn: string;
  firstNameLabel: string;
  lastNameLabel: string;
  firstNamePlaceholder: string;
  lastNamePlaceholder: string;
  emailPlaceholder: string;
  choosePinLabel: string;
  completeRegBtn: string;
  backBtn: string;
  continueBtn: string;
  
  // Worker Dashboard
  helloUser: string;
  choosePizzaToday: string;
  favOrderTitle: string;
  favOrderBtn: string;
  dbConfigNeeded: string;
  dbConfigDesc: string;
  serviceNotActive: string;
  ordersEndedAt: string;
  serviceNotAvailableToday: string;
  currentOrderTitle: string;
  changeSelectionBtn: string;
  searchPizzaPlaceholder: string;
  chooseLabel: string;
  historyTitle: string;
  historySubtitle: string;
  noOrdersYet: string;
  noOrdersDesc: string;
  backToDashboard: string;
  orderSentTitle: string;
  orderSentDesc: string;
  myOrderBtn: string;
  logoutBtn: string;
  profileTitle: string;
  historyTab: string;
  profileTab: string;
  pickupTimeLabel: string;
  addLabel: string;
  maxModsError: string;
  removeLabel: string;
  extraOptionsLabel: string;
  noAdditions: string;
  noRemovals: string;
  cancelBtn: string;
  confirmOrderBtn: string;
  recapTitle: string;
  recapVerifyDesc: string;
  recapPizzaLabel: string;
  recapTimeLabel: string;
  yesSubmitOrderBtn: string;
  selectTimeError: string;
  selectTimePlaceholder: string;
}

const translations: Record<Language, TranslationDict> = {
  it: {
    enterPin: "Inserisci il tuo PIN",
    invalidPin: "PIN non valido",
    deleteKey: "Cancella",
    notOnList: "Non sei in lista? Registrati",
    securitySlogan: "Sviluppato per la sicurezza dei tuoi dati",
    forgotPin: "Non ricordo il mio PIN",
    recoveryTitle: "Recupero Accesso",
    recoveryDesc: "Per visualizzare il tuo PIN, conferma i tuoi dati personali registrati.",
    emailLabel: "Email",
    phoneLabel: "Cellulare (WhatsApp)",
    mismatchError: "Dati non corrispondenti. Verifica email e telefono.",
    genericError: "Si è verificato un errore durante il recupero.",
    verifyIdentity: "VERIFICA IDENTITÀ",
    verifiedIdentity: "Identità Verificata",
    yourPersonalPin: "Il tuo PIN Personale è",
    recWarning: "Gentile dipendente, ricordati che il tuo PIN è strettamente personale e non deve essere condiviso con nessuno.",
    understandButton: "HO CAPITO, TORNA AL LOGIN",
    
    registerTitle: "Registrazione Staff",
    localCodeLabel: "Codice Locale di Registrazione",
    localCodePlaceholder: "0000",
    invalidLocalCode: "Codice di Registrazione non valido. Chiedi al responsabile.",
    registrationClosed: "Le registrazioni sono attualmente chiuse. Contatta l'amministratore.",
    connectionError: "Errore di connessione al sistema",
    requiredFields: "Nome e Cognome obbligatori",
    phoneRequired: "Numero di telefono obbligatorio",
    emailRequired: "Email valida obbligatoria",
    pinRequiredLength: "PIN di 4 cifre obbligatorio",
    pinMatchesMasterError: "Il PIN personale non può essere uguale al Codice di Registrazione.",
    pinTaken: "Questo PIN è già in uso o non disponibile. Scegline un altro.",
    emailTaken: "Questa email è già associata a un account esistente.",
    phoneTaken: "Questo numero di telefono è già associato a un account esistente.",
    regCompleteTitle: "Registrazione Completata!",
    regCompleteDesc: "Il tuo account è pronto. Ora rendilo facile da usare!",
    addToHomeTitle: "Aggiungi l'app alla tua schermata Home",
    androidGuideTitle: "📱 Se hai Android",
    androidGuideDesc: "Usa Chrome, premi i tre puntini in alto a destra e seleziona \"Aggiungi a schermata Home\".",
    iosGuideTitle: "Share Se hai iPhone",
    iosGuideDesc: "Usa Safari, premi il tasto Condividi (il quadrato con la freccia in alto) e seleziona \"Aggiungi a Home\".",
    backToLoginBtn: "Ho capito, vai al Login",
    firstNameLabel: "Nome",
    lastNameLabel: "Cognome",
    firstNamePlaceholder: "Es: Mario",
    lastNamePlaceholder: "Es: Rossi",
    emailPlaceholder: "mario.rossi@azienda.it",
    choosePinLabel: "Scegli il tuo PIN (4 cifre)",
    completeRegBtn: "Completa Registrazione",
    backBtn: "Indietro",
    continueBtn: "Continua",
    
    helloUser: "Ciao {name}!",
    choosePizzaToday: "Scegli la tua pizza di oggi.",
    favOrderTitle: "Pizza Preferita",
    favOrderBtn: "Ordina al Volo",
    dbConfigNeeded: "Configurazione Database Necessaria",
    dbConfigDesc: "Le tabelle del database non sono state trovate. Contatta l'amministratore per eseguire lo script di setup in Supabase.",
    serviceNotActive: "Servizio non attivo",
    ordersEndedAt: "Gli ordini sono terminati alle {time}.",
    serviceNotAvailableToday: "Servizio non disponibile per oggi.",
    currentOrderTitle: "Il tuo ordine attuale",
    changeSelectionBtn: "Cambia Scelta",
    searchPizzaPlaceholder: "Cerca pizza...",
    chooseLabel: "Scegli",
    historyTitle: "Cronologia",
    historySubtitle: "I tuoi ordini recenti",
    noOrdersYet: "Ancora nessun ordine...",
    noOrdersDesc: "Gli ordini che farai appariranno qui.",
    backToDashboard: "Torna al Gestionale",
    orderSentTitle: "Ordine Inviato!",
    orderSentDesc: "Troverai la pizza pronta all'orario scelto.",
    myOrderBtn: "Torna al Menu",
    logoutBtn: "Esci dall'App",
    profileTitle: "Profilo",
    historyTab: "Ordini",
    profileTab: "Profilo",
    pickupTimeLabel: "Orario di ritiro",
    addLabel: "Aggiungi (+)",
    maxModsError: "Max 2 variazioni totali",
    removeLabel: "Togli (-)",
    extraOptionsLabel: "Opzioni Speciali (Extra)",
    noAdditions: "Nessuna aggiunta",
    noRemovals: "Nessuna rimozione",
    cancelBtn: "Annulla",
    confirmOrderBtn: "Conferma Ordine",
    recapTitle: "Riepilogo",
    recapVerifyDesc: "Verifica prima di inviare",
    recapPizzaLabel: "La tua pizza",
    recapTimeLabel: "Orario di ritiro",
    yesSubmitOrderBtn: "SÌ, INVIA ORDINE",
    selectTimeError: "Seleziona obbligatoriamente un orario per la pizza!",
    selectTimePlaceholder: "-- Seleziona l'Orario --"
  },
  en: {
    enterPin: "Enter your PIN",
    invalidPin: "Invalid PIN",
    deleteKey: "Delete",
    notOnList: "Not on the list? Register",
    securitySlogan: "Developed for your data security",
    forgotPin: "I forgot my PIN",
    recoveryTitle: "Access Recovery",
    recoveryDesc: "To view your PIN, please confirm your registered personal details.",
    emailLabel: "Email address",
    phoneLabel: "Phone number (WhatsApp)",
    mismatchError: "Data mismatch. Please check email and phone number.",
    genericError: "An error occurred during recovery.",
    verifyIdentity: "VERIFY IDENTITY",
    verifiedIdentity: "Identity Verified",
    yourPersonalPin: "Your Personal PIN is",
    recWarning: "Dear employee, remember that your PIN is strictly personal and must not be shared with anyone.",
    understandButton: "I UNDERSTAND, BACK TO LOGIN",
    
    registerTitle: "Staff Registration",
    localCodeLabel: "Local Registration Code",
    localCodePlaceholder: "0000",
    invalidLocalCode: "Invalid Registration Code. Ask your manager.",
    registrationClosed: "Registrations are currently closed. Please contact the administrator.",
    connectionError: "System connection error",
    requiredFields: "First and last name are required",
    phoneRequired: "Phone number is required",
    emailRequired: "Valid email address is required",
    pinRequiredLength: "A 4-digit PIN is required",
    pinMatchesMasterError: "Personal PIN cannot be the same as the Registration Code.",
    pinTaken: "This PIN is already in use or unavailable. Please choose another.",
    emailTaken: "This email is already associated with an existing account.",
    phoneTaken: "This phone number is already associated with an existing account.",
    regCompleteTitle: "Registration Completed!",
    regCompleteDesc: "Your account is ready. Now let's make it easy to use!",
    addToHomeTitle: "Add the app to your Home screen",
    androidGuideTitle: "📱 If you have Android",
    androidGuideDesc: "Use Chrome, tap the three dots in the top right, and select \"Add to Home screen\".",
    iosGuideTitle: "Share If you have iPhone",
    iosGuideDesc: "Use Safari, tap the Share button (square with an upward arrow) and select \"Add to Home Screen\".",
    backToLoginBtn: "I understand, go to Login",
    firstNameLabel: "First Name",
    lastNameLabel: "Last Name",
    firstNamePlaceholder: "E.g. John",
    lastNamePlaceholder: "E.g. Smith",
    emailPlaceholder: "john.smith@company.com",
    choosePinLabel: "Choose your PIN (4 digits)",
    completeRegBtn: "Complete Registration",
    backBtn: "Back",
    continueBtn: "Continue",
    
    helloUser: "Hello {name}!",
    choosePizzaToday: "Choose your pizza for today.",
    favOrderTitle: "Favorite Pizza",
    favOrderBtn: "Order Instantly",
    dbConfigNeeded: "Database Setup Required",
    dbConfigDesc: "Database tables were not found. Please contact the administrator to run the setup script in Supabase.",
    serviceNotActive: "Service disabled",
    ordersEndedAt: "Orders closed at {time}.",
    serviceNotAvailableToday: "Service is not available today.",
    currentOrderTitle: "Your current order",
    changeSelectionBtn: "Change Pizza",
    searchPizzaPlaceholder: "Search pizza...",
    chooseLabel: "Select",
    historyTitle: "History",
    historySubtitle: "Your recent orders",
    noOrdersYet: "No orders yet...",
    noOrdersDesc: "The orders you place will appear here.",
    backToDashboard: "Admin Panel",
    orderSentTitle: "Order Sent!",
    orderSentDesc: "Your pizza will be ready at the selected time.",
    myOrderBtn: "Back to Menu",
    logoutBtn: "Log Out",
    profileTitle: "Profile",
    historyTab: "Orders",
    profileTab: "Profile",
    pickupTimeLabel: "Pick-up time",
    addLabel: "Add (+)",
    maxModsError: "Max 2 variations total",
    removeLabel: "Remove (-)",
    extraOptionsLabel: "Special Options (Extra)",
    noAdditions: "No additions",
    noRemovals: "No removals",
    cancelBtn: "Cancel",
    confirmOrderBtn: "Confirm Order",
    recapTitle: "Order Summary",
    recapVerifyDesc: "Verify your request before sending",
    recapPizzaLabel: "Your pizza",
    recapTimeLabel: "Pick-up time",
    yesSubmitOrderBtn: "YES, SEND ORDER",
    selectTimeError: "Please select a pickup time for your pizza!",
    selectTimePlaceholder: "-- Select Pickup Time --"
  },
  es: {
    enterPin: "Scegli il tuo PIN / Introduce tu PIN",
    invalidPin: "PIN no válido",
    deleteKey: "Borrar",
    notOnList: "¿No estás en la lista? Regístrate",
    securitySlogan: "Desarrollado para la seguridad de tus datos",
    forgotPin: "No recuerdo mi PIN",
    recoveryTitle: "Recuperar Acceso",
    recoveryDesc: "Para ver tu PIN, confirma tus datos personales registrados.",
    emailLabel: "Correo electrónico",
    phoneLabel: "Número de teléfono (WhatsApp)",
    mismatchError: "Los datos no coinciden. Verifica el correo y el teléfono.",
    genericError: "Ocurrió un error al intentar recuperar el PIN.",
    verifyIdentity: "VERIFICAR IDENTIDAD",
    verifiedIdentity: "Identidad Verificada",
    yourPersonalPin: "Tu PIN Personal es",
    recWarning: "Estimado empleado, recuerda que tu PIN es estrictamente personal y no debe compartirse con nadie.",
    understandButton: "ENTENDIDO, VOLVER AL LOGIN",
    
    registerTitle: "Registro de Personal",
    localCodeLabel: "Código Local de Registro",
    localCodePlaceholder: "0000",
    invalidLocalCode: "Código de registro inválido. Pregunta a tu encargado.",
    registrationClosed: "El registro está cerrado actualmente. Contacta al administrador.",
    connectionError: "Error de conexión al sistema",
    requiredFields: "Nombre y apellido son obligatorios",
    phoneRequired: "El número de teléfono es obligatorio",
    emailRequired: "El correo electrónico es obligatorio",
    pinRequiredLength: "Se requiere un PIN de 4 dígitos",
    pinMatchesMasterError: "El PIN personal no puede ser igual al Código de Registro.",
    pinTaken: "Este PIN ya está en uso. Por favor, elige otro.",
    emailTaken: "Este correo electrónico ya está registrado.",
    phoneTaken: "Este número de teléfono ya está registrado.",
    regCompleteTitle: "¡Registro Completado!",
    regCompleteDesc: "Tu cuenta está lista. ¡Hagámosla fácil de usar!",
    addToHomeTitle: "Añade la app a tu pantalla de inicio",
    androidGuideTitle: "📱 Si tienes Android",
    androidGuideDesc: "Usa Chrome, presiona los tres puntos en la esquina superior derecha y selecciona \"Añadir a pantalla de inicio\".",
    iosGuideTitle: "Share Si tienes iPhone",
    iosGuideDesc: "Usa Safari, presiona Compartir (el cuadrado con la flecha hacia arriba) y selecciona \"Añadir a pantalla de inicio\".",
    backToLoginBtn: "Entendido, ir al Login",
    firstNameLabel: "Nombre",
    lastNameLabel: "Apellido",
    firstNamePlaceholder: "Ej: Mario",
    lastNamePlaceholder: "Ej: Pérez",
    emailPlaceholder: "mario@empresa.com",
    choosePinLabel: "Elige tu PIN (4 dígitos)",
    completeRegBtn: "Completar Registro",
    backBtn: "Atrás",
    continueBtn: "Continuar",
    
    helloUser: "¡Hola {name}!",
    choosePizzaToday: "Elige tu pizza para hoy.",
    favOrderTitle: "Pizza Favorita",
    favOrderBtn: "Pedir al Instante",
    dbConfigNeeded: "Configuración de Base de Datos requerida",
    dbConfigDesc: "No se encontraron las tablas. Contacta al administrador para ejecutar el script en Supabase.",
    serviceNotActive: "Servicio no activo",
    ordersEndedAt: "Pedidos finalizados a las {time}.",
    serviceNotAvailableToday: "El servicio no está disponible hoy.",
    currentOrderTitle: "Tu pedido actual",
    changeSelectionBtn: "Cambiar Pizza",
    searchPizzaPlaceholder: "Buscar pizza...",
    chooseLabel: "Elegir",
    historyTitle: "Mis Pedidos",
    historySubtitle: "Tus pedidos recientes",
    noOrdersYet: "Sin pedidos aún...",
    noOrdersDesc: "Los pedidos que realices aparecerán aquí.",
    backToDashboard: "Volver a Administración",
    orderSentTitle: "¡Pedido Enviado!",
    orderSentDesc: "Tu pizza estará lista a la hora elegida.",
    myOrderBtn: "Volver al Menú",
    logoutBtn: "Cerrar Sesión",
    profileTitle: "Perfil",
    historyTab: "Pedidos",
    profileTab: "Perfil",
    pickupTimeLabel: "Hora de recogida",
    addLabel: "Añadir (+)",
    maxModsError: "Máximo 2 modificaciones en total",
    removeLabel: "Quitar (-)",
    extraOptionsLabel: "Opciones Especiales (Extra)",
    noAdditions: "Sin adiciones",
    noRemovals: "Sin variaciones",
    cancelBtn: "Cancelar",
    confirmOrderBtn: "Confirmar Pedido",
    recapTitle: "Resumen de Pedido",
    recapVerifyDesc: "Verifica antes de enviar",
    recapPizzaLabel: "Tu pizza",
    recapTimeLabel: "Hora de recogida",
    yesSubmitOrderBtn: "SÍ, ENVIAR PEDIDO",
    selectTimeError: "¡Por favor, selecciona una hora para la pizza!",
    selectTimePlaceholder: "-- Selecciona la hora --"
  },
  ar: {
    enterPin: "أدخل رمز PIN الخاص بك",
    invalidPin: "رمز PIN غير صحيح",
    deleteKey: "مسح",
    notOnList: "هل أنت ليس في القائمة؟ سجل الآن",
    securitySlogan: "تم تطويره لحماية وسرية بياناتك",
    forgotPin: "لقد نسيت رقم PIN الخاص بي",
    recoveryTitle: "استرداد الحساب",
    recoveryDesc: "لعرض رمز PIN الخاص بك، يرجى تأكيد بياناتك الشخصية المسجلة لدينا.",
    emailLabel: "البريد الإلكتروني",
    phoneLabel: "رقم الهاتف والواتساب",
    mismatchError: "البيانات غير متطابقة. يرجى التحقق من البريد والهاتف.",
    genericError: "حدث خطأ أثناء محاولة استرداد الحساب.",
    verifyIdentity: "التحقق من الهوية",
    verifiedIdentity: "تم التحقق من الهوية بنجاح",
    yourPersonalPin: "رمز PIN الشخصي الخاص بك هو",
    recWarning: "عزيزي الموظف، يرجى تذكر أن رمز PIN هذا سري للغاية وشخصي ولا يجب مشاركته مع أي شخص.",
    understandButton: "فهمت، العودة لتسجيل الدخول",
    
    registerTitle: "تسجيل حساب موظف",
    localCodeLabel: "رمز تسجيل الموقع",
    localCodePlaceholder: "0000",
    invalidLocalCode: "رمز التسجيل غير صحيح. يرجى الاستفسار من المشرف.",
    registrationClosed: "التسجيل مغلق حاليًا. يرجى التواصل مع المسؤول.",
    connectionError: "فشل الاتصال بالنظام",
    requiredFields: "الاسم الأول واللقب مطلوبان",
    phoneRequired: "رقم الهاتف مطلوب",
    emailRequired: "البريد الإلكتروني مطلوب",
    pinRequiredLength: "رمز PIN المكون من 4 أرقام مطلوب",
    pinMatchesMasterError: "لا يمكن لـ PIN الشخصي أن يكون مطابقًا لرمز التسجيل.",
    pinTaken: "رقم PIN هذا مستخدم بالفعل. يرجى اختيار رقم آخر.",
    emailTaken: "البريد الإلكتروني مرتبط بالفعل بحساب آخر.",
    phoneTaken: "رقم الهاتف مرتبط بالفعل بحساب آخر.",
    regCompleteTitle: "تم التسجيل بنجاح!",
    regCompleteDesc: "حسابك جاهز الآن. لنجعل استخدامه سهلاً للغاية!",
    addToHomeTitle: "أضف التطبيق لشاشتك الرئيسية",
    androidGuideTitle: "📱 إذا كان لديك جهاز أندرويد",
    androidGuideDesc: "افتح متصفح كروم، اضغط على النقاط الثلاث بالأعلى واختر \"إضافة إلى الشاشة الرئيسية\".",
    iosGuideTitle: "Share إذا كان لديك جهاز آيفون",
    iosGuideDesc: "افتح متصفح سفاري، ثم اضغط على زر ومربع \"مشاركة\" بالأسفل واختر \ إضافة إلى الشاشة الرئيسية \.",
    backToLoginBtn: "فهمت، الذهاب لتسجيل الدخول",
    firstNameLabel: "الاسم الأول",
    lastNameLabel: "النسب (اسم العائلة)",
    firstNamePlaceholder: "مثال: محمد",
    lastNamePlaceholder: "مثال: العلوي",
    emailPlaceholder: "mohammed@company.com",
    choosePinLabel: "اختر رقم PIN الخاص بك (4 أرقام)",
    completeRegBtn: "إتمام التسجيل",
    backBtn: "رجوع",
    continueBtn: "متابعة",
    
    helloUser: "مرحباً {name}!",
    choosePizzaToday: "اختر بيتزا اليوم الخاصة بك.",
    favOrderTitle: "البيتزا المفضلة",
    favOrderBtn: "اطلب فوراً",
    dbConfigNeeded: "تجهيز قاعدة البيانات مطلوب",
    dbConfigDesc: "لم يتم العثور على جداول قاعدة البيانات. يرجى التحدث للمسؤول لتشغيل كود التهيئة.",
    serviceNotActive: "الخدمة غير مفعلة حالياً",
    ordersEndedAt: "تم إغلاق طلبات اليوم عند الساعة {time}.",
    serviceNotAvailableToday: "الخدمة غير متوفرة اليوم.",
    currentOrderTitle: "طلبك الحالي",
    changeSelectionBtn: "تعديل الطلب",
    searchPizzaPlaceholder: "ابحث عن بيتزا...",
    chooseLabel: "اختيار",
    historyTitle: "سجل الطلبات",
    historySubtitle: "طلباتك الأخيرة",
    noOrdersYet: "لا توجد أي طلبات بعد...",
    noOrdersDesc: "الطلبات التي تقوم بها ستظهر هنا لاحقاً.",
    backToDashboard: "رجوع للوحة التحكم",
    orderSentTitle: "تم إرسال الطلب!",
    orderSentDesc: "ستجد بيتزا اليوم جاهزة في الوقت المختار.",
    myOrderBtn: "العودة للقائمة الرئيسية",
    logoutBtn: "تسجيل الخروج",
    profileTitle: "الحساب الشخصي",
    historyTab: "الطلبات",
    profileTab: "الحساب",
    pickupTimeLabel: "وقت الاستلام",
    addLabel: "إضافة (+)",
    maxModsError: "أقصى تغييرين مسموح بهما فقط",
    removeLabel: "إلغاء (-)",
    extraOptionsLabel: "خيارات خاصة وإضافية",
    noAdditions: "لا توجد إضافات",
    noRemovals: "لا توجد تعديلات",
    cancelBtn: "إلغاء",
    confirmOrderBtn: "تأكيد الطلب",
    recapTitle: "ملخص الطلب",
    recapVerifyDesc: "يرجى مراجعة وتأكيد طلبك قبل الإرسال",
    recapPizzaLabel: "البيتزا المختارة",
    recapTimeLabel: "وقت الاستلام المحدد",
    yesSubmitOrderBtn: "نعم، أرسل الطلب الآن",
    selectTimeError: "يرجى تحديد وقت استلام البيتزا الخاص بك!",
    selectTimePlaceholder: "-- اختر وقت الاستلام --"
  },
  ur: {
    enterPin: "اپنا ذاتی پن درج کریں",
    invalidPin: "غلط پن کوڈ",
    deleteKey: "مٹائیں",
    notOnList: "کیا آپ لسٹ میں نہیں ہیں؟ رجسٹر کریں",
    securitySlogan: "آپ کے ڈیٹا اور سیکیورٹی کی حفاظت کے لیے تیار کیا گیا ہے",
    forgotPin: "مجھے اپنا پن یاد نہیں ہے",
    recoveryTitle: "اکاؤنٹ کی بحالی",
    recoveryDesc: "اپنا پن کوڈ دیکھنے کے لیے، اپنے رجسٹرڈ موبائل نمبر اور ای میل کی تصدیق کریں۔",
    emailLabel: "ای میل پتہ",
    phoneLabel: "موبائل یا واٹس ایپ نمبر",
    mismatchError: "درج کردہ معلومات غلط ہیں۔ براہ کرم ای میل اور فون چیک کریں۔",
    genericError: "بحالی کے دوران سسٹم میں کوئی خرابی پیش آئی ہے۔",
    verifyIdentity: "شناخت کی تصدیق کریں",
    verifiedIdentity: "شناخت کی تصدیق ہو گئی",
    yourPersonalPin: "آپ کا ذاتی پن یہ ہے",
    recWarning: "محترم ملازم، یاد رکھیں کہ آپ کا پن کوڈ انتہائی خفیہ ہے اور اسے کسی کے ساتھ شیئر نہ کریں۔",
    understandButton: "سمجھ گیا، لاگ ان پر واپس جائیں",
    
    registerTitle: "سٹاف رجسٹریشن",
    localCodeLabel: "لوکل رجسٹریشن کوڈ",
    localCodePlaceholder: "0000",
    invalidLocalCode: "رجسٹریشن کوڈ غلط ہے۔ اپنے مینیجر سے معلوم کریں۔",
    registrationClosed: "رجسٹریشن فی الحال بند ہے۔ مینیجر سے رابطہ کریں۔",
    connectionError: "سسٹم کنکشن کی خرابی",
    requiredFields: "نام اور خاندانی نام لازمی ہے",
    phoneRequired: "فون نمبر فراہم کرنا لازمی ہے",
    emailRequired: "درست ای میل فراہم کرنا لازمی ہے",
    pinRequiredLength: "4 ہندسوں کا پن کوڈ لازمی ہے",
    pinMatchesMasterError: "ذاتی پن رجسٹریشن کوڈ جیسا نہیں ہو سکتا۔",
    pinTaken: "یہ پن پہلے سے استعمال میں ہے۔ کوئی دوسرا منتخب کریں۔",
    emailTaken: "یہ ای میل پہلے سے رجسٹرڈ ہے۔",
    phoneTaken: "یہ فون نمبر پہلے سے رجسٹرڈ ہے۔",
    regCompleteTitle: "رجسٹریشن کامیابی سے مکمل ہوگئی!",
    regCompleteDesc: "آپ کا اکاؤنٹ تیار ہے۔ اب اسے ہوم اسکرین پر شامل کریں!",
    addToHomeTitle: "ایپ کو اپنی ہوم اسکرین پر لاؤ",
    androidGuideTitle: "📱 اگر آپ کے پاس اینڈرائیڈ فون ہے",
    androidGuideDesc: "کروم براؤزر کھولیں، اوپر دائیں کونے میں تین نقطوں پر کلک کریں اور \"ہوم اسکرین پر شامل کریں\" کو منتخب کریں۔",
    iosGuideTitle: "Share اگر آپ کے پاس آئی فون ہے",
    iosGuideDesc: "سفاری براؤزر کھولیں، شیئر بٹن (اوپر تیر والا ڈبہ) پر کلک کریں اور \"ہوم اسکرین پر شامل کریں\" کو دبائیں۔",
    backToLoginBtn: "سمجھ گیا، لاگ ان پر جائیں",
    firstNameLabel: "پہلا نام",
    lastNameLabel: "آخری نام",
    firstNamePlaceholder: "مثال کے طور پر: علی",
    lastNamePlaceholder: "مثال کے طور پر: خان",
    emailPlaceholder: "ali@company.com",
    choosePinLabel: "اپنا پن چنیں (4 ہندسے)",
    completeRegBtn: "رجسٹریشن مکمل کریں",
    backBtn: "پیچھے",
    continueBtn: "آگے",
    
    helloUser: "السلام علیکم {name}!",
    choosePizzaToday: "آج کے لیے اپنی پسندیدہ پیزا چنیں۔",
    favOrderTitle: "پسندیدہ پیزا",
    favOrderBtn: "فوری آرڈر کریں",
    dbConfigNeeded: "ڈیٹا بیس سیٹ اپ درکار ہے",
    dbConfigDesc: "ڈیٹا بیس کی معلومات نہیں ملی۔ براہ کرم ڈیٹا بیس ری سیٹ کے لیے ایڈمن سے کہیں۔",
    serviceNotActive: "سروس فی الحال بند ہے",
    ordersEndedAt: "آرڈرز کا وقت {time} پر ختم ہو گیا تھا۔",
    serviceNotAvailableToday: "آج سروس دستیاب نہیں ہے۔",
    currentOrderTitle: "آپ کا موجودہ آرڈر",
    changeSelectionBtn: "آرڈر تبدیل کریں",
    searchPizzaPlaceholder: "پیزا تلاش کریں...",
    chooseLabel: "منتخب کریں",
    historyTitle: "آرڈر کی ہسٹری",
    historySubtitle: "آپ کے حالیہ آرڈرز",
    noOrdersYet: "کوئی آرڈر نہیں ملا...",
    noOrdersDesc: "آپ کے کیے گئے نئے آرڈرز یہاں دکھائی دیں گے۔",
    backToDashboard: "ایڈمن پینل پر واپس جائیں",
    orderSentTitle: "آرڈر بھیج دیا گیا ہے!",
    orderSentDesc: "آپ کا پیزا منتخب کردہ وقت پر تیار ملے گا۔",
    myOrderBtn: "مینو پر واپس جائیں",
    logoutBtn: "لاگ آؤٹ کریں",
    profileTitle: "پروفایل",
    historyTab: "آرڈرز",
    profileTab: "پروفائل",
    pickupTimeLabel: "پیزا اٹھانے کا وقت",
    addLabel: "مزید ڈالیں (+)",
    maxModsError: "زیادہ سے زیادہ 2 تبدیلیاں ممکن ہیں",
    removeLabel: "نکالیں (-)",
    extraOptionsLabel: "خصوصی آپشنز (ایکسٹرا)",
    noAdditions: "کوئی اضافہ نہیں",
    noRemovals: "کوئی تبدیلی نہیں",
    cancelBtn: "کینسل کریں",
    confirmOrderBtn: "آرڈر کی تصدیق کریں",
    recapTitle: "آرڈر کی تفصیل",
    recapVerifyDesc: "آرڈر بھیجنے سے پہلے تفصیلات اچھی طرح دیکھ لیں",
    recapPizzaLabel: "منتخب کردہ پیزا",
    recapTimeLabel: "اٹھانے کا وقت",
    yesSubmitOrderBtn: "ہاں، آرڈر بھیجیں",
    selectTimeError: "براہ کرم پیزا اٹھانے کا وقت منتخب کریں!",
    selectTimePlaceholder: "-- وقت منتخب کریں --"
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationDict, replace?: Record<string, string>) => string;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('pizzastaff_lang');
    return (saved as Language) || 'it';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('pizzastaff_lang', lang);
  };

  const isRtl = language === 'ar' || language === 'ur';

  // Sincronizza l'attributo dir sulla pagina html globale
  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRtl]);

  const t = (key: keyof TranslationDict, replace?: Record<string, string>): string => {
    const dict = translations[language] || translations['it'];
    let text = dict[key] || translations['it'][key] || '';
    if (replace) {
      Object.entries(replace).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation or useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const FLAGS: Record<Language, string> = {
  it: "🇮🇹 IT",
  en: "🇬🇧 EN",
  es: "🇪🇸 ES",
  ar: "🇲🇦 AR",
  ur: "🇵🇰 UR"
};
