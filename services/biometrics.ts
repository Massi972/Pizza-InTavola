import { db } from './db';

const base64ToArrayBuffer = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

export const isBiometricAvailable = async (): Promise<boolean> => {
  return !!(
    window.PublicKeyCredential &&
    await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  );
};

export const registerPasskey = async (userId: string): Promise<boolean> => {
  try {
    const options = await db.getWebAuthnRegisterOptions(userId);
    
    // Preparazione opzioni per l'API del browser
    // Fix: Explicitly cast string literals to WebAuthn specific types to satisfy TypeScript strict literal checks
    const publicKey: PublicKeyCredentialCreationOptions = {
      ...options,
      attestation: options.attestation as AttestationConveyancePreference,
      authenticatorSelection: options.authenticatorSelection as AuthenticatorSelectionCriteria,
      challenge: base64ToArrayBuffer(options.challenge),
      user: {
        ...options.user,
        id: base64ToArrayBuffer(options.user.id),
      }
    };

    const credential = (await navigator.credentials.create({ publicKey })) as any;
    if (credential) {
      await db.verifyWebAuthnRegister(userId, {
        id: credential.id,
        rawId: arrayBufferToBase64(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: arrayBufferToBase64(credential.response.attestationObject),
          clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
          transports: credential.response.getTransports ? credential.response.getTransports() : undefined
        }
      });
      localStorage.setItem('pizzastaff_passkey_active', 'true');
      return true;
    }
    return false;
  } catch (err) {
    console.error("Errore registrazione passkey:", err);
    return false;
  }
};

export const authenticatePasskey = async (): Promise<any> => {
  try {
    const options = await db.getWebAuthnLoginOptions();
    
    // Fix: cast userVerification to UserVerificationRequirement to match browser expectations
    const publicKey: PublicKeyCredentialRequestOptions = {
      ...options,
      userVerification: options.userVerification as UserVerificationRequirement,
      challenge: base64ToArrayBuffer(options.challenge),
    };

    const assertion = (await navigator.credentials.get({ publicKey })) as any;
    if (assertion) {
      const result = await db.verifyWebAuthnLogin({
        id: assertion.id,
        rawId: arrayBufferToBase64(assertion.rawId),
        type: assertion.type,
        response: {
          authenticatorData: arrayBufferToBase64(assertion.response.authenticatorData),
          clientDataJSON: arrayBufferToBase64(assertion.response.clientDataJSON),
          signature: arrayBufferToBase64(assertion.response.signature),
          userHandle: assertion.response.userHandle ? arrayBufferToBase64(assertion.response.userHandle) : null
        }
      });
      return result.user;
    }
    return null;
  } catch (err) {
    console.error("Errore autenticazione passkey:", err);
    return null;
  }
};

export const revokePasskeys = async (userId: string) => {
  await db.revokePasskeys(userId);
  localStorage.removeItem('pizzastaff_passkey_active');
};