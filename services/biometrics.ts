import { db } from './db';

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
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
    
    // Costruzione esplicita per soddisfare i tipi strict di TypeScript
    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: base64ToArrayBuffer(options.challenge),
      rp: options.rp,
      user: {
        id: base64ToArrayBuffer(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams.map((p: any) => ({
        alg: p.alg,
        type: p.type as "public-key"
      })),
      timeout: options.timeout,
      attestation: options.attestation as AttestationConveyancePreference,
      authenticatorSelection: options.authenticatorSelection as AuthenticatorSelectionCriteria,
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
    
    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: base64ToArrayBuffer(options.challenge),
      timeout: options.timeout,
      userVerification: options.userVerification as UserVerificationRequirement,
      rpId: options.rpId,
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