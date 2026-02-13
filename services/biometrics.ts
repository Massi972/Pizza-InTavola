
/**
 * Servizio per la gestione reale della biometria tramite WebAuthn
 */

export const isBiometricAvailable = async (): Promise<boolean> => {
  return !!(
    window.PublicKeyCredential &&
    await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  );
};

export const registerBiometrics = async (userId: string, userName: string): Promise<boolean> => {
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userID = new TextEncoder().encode(userId);

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: { name: "Pizza InTavola", id: window.location.hostname },
      user: {
        id: userID,
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60000,
    };

    const credential = await navigator.credentials.create({ publicKey });
    if (credential) {
      localStorage.setItem(`biometric_id_${userId}`, (credential as any).id);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Errore registrazione biometria:", err);
    return false;
  }
};

export const verifyBiometrics = async (userId: string): Promise<boolean> => {
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: "required",
      allowCredentials: [], // Vuoto permette l'uso di qualsiasi credenziale registrata sulla piattaforma
    };

    const assertion = await navigator.credentials.get({ publicKey });
    return !!assertion;
  } catch (err) {
    console.error("Errore verifica biometria:", err);
    return false;
  }
};
