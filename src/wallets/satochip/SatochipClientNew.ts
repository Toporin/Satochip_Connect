 
import { Platform } from 'react-native';
import { SatochipCard, SatochipCardError } from 'satochip-react-native';
import NfcManager from 'react-native-nfc-manager';

const getCardXpub = async (card: SatochipCard, pin: string, path: string) => {

  await card.verifyPIN(0, pin);

  // fetch master fingerprint
  const xfp = await card.getMasterXfp();

  // get xpub for path
  let xpub = await card.getXpub(path,'standard'); // using mainnet

  return {
    xpub,
    masterFingerprint: xfp.toUpperCase(),
    path,
  };
};

export const getSatochipDetails = async (
  card: SatochipCard,
  pin: string,
  path: string
) => {
  const status = await card.getStatus();

  if (!status.setup_done) {
    throw Error("SATOCHIP not setup. Set a new PIN and seed in the setup options.");
  }

  if (!status.is_seeded) {
    throw Error("SATOCHIP not seeded. Import a seed in the setup options.");
  }

  // Verify PIN for operations
  await card.verifyPIN(0, pin);

  return await getCardXpub(card, pin, path);
};

export const getCardInfo = async (card: SatochipCard, pin?: string) => {
  const status = await card.getStatus();

  if (!status.setup_done) {
    return {
      setupDone: false,
      isSeeded: false,
      isAuthentic: false,
      authenticityMsg: 'Card setup required!',
    };
  }

  // PIN required for authenticity check currently
  if (pin) {
    await card.verifyPIN(0, pin);
  }

  // check authenticity
  let isAuthentic: boolean | null = null;
  let authenticityMsg: string = '';
  try {
    const resCertValid = await card.verifyCertificateChain();
    if (resCertValid.isValid) {
      const resChalresp = await card.cardChallengeResponsePki();
      if (resChalresp.success) {
        isAuthentic = true;
        authenticityMsg = 'Card is authentic';
      } else {
        isAuthentic = false;
        authenticityMsg = resChalresp.error;
      }
    } else {
      isAuthentic = false;
      authenticityMsg = resCertValid.txtError;
    }
  } catch (error) {
    console.error('satochip/index getCardInfo Chain validation error: ', error);

    if (error instanceof SatochipCardError) {
      const sw = error.statusWord;
      if (sw == 0x9C02){
        isAuthentic = null;
        authenticityMsg = "Wrong PIN!";
      } else if ((sw & 0xFFF0) == 0x63C0 ){
        const remainingTry = sw &0x000F;
        isAuthentic = null;
        authenticityMsg = `Wrong PIN! ${remainingTry} tries remaining.`;
      } else if (sw == 0x9C06){
        isAuthentic = null;
        authenticityMsg = `You must provide a PIN code!`;
      } else if (sw == 0x9C0C){
        isAuthentic = null;
        authenticityMsg = `Your card is blocked!`;
      } else {
        isAuthentic = false;
        authenticityMsg = error.message;
      }
    } else {
      isAuthentic = false;
      authenticityMsg = error.message || error;
    }

  }

  return {
    setupDone: status.setup_done,
    isSeeded: status.is_seeded,
    isAuthentic: isAuthentic,
    authenticityMsg,
  };
};

export const setupCard = async (card: SatochipCard, newPIN: string) => {
  // do setup
  await card.setup(newPIN, 5)
  return;
};

export const changePin = async (card: SatochipCard, oldPIN: string, newPIN: string) => {
  // Verify current PIN first
  await card.verifyPIN(0, oldPIN);

  // Change PIN
  await card.changePIN(0, oldPIN, newPIN);
  return;
};

export const importSeed = async (card: SatochipCard, pin: string, seedBytes: Buffer) => {
  // Verify current PIN first
  await card.verifyPIN(0, pin);
  // import seed
  await card.importSeed(seedBytes);
  return;
};

export const resetSeed = async (card: SatochipCard, pin: string) => {
  // Verify current PIN first
  await card.verifyPIN(0, pin);
  // reset seed
  await card.resetSeed(pin);
  return;
};

export const signWithSatochip = async (
  card: SatochipCard,
  cardMfp: string,
  path: string,
  hashToSign: Buffer,
  pin: string,
) => {
  // console.log(`SatochipClient signWithSatochip cardMfp: ${cardMfp}`);
  // console.log(`SatochipClient signWithSatochip hashToSign: ${hashToSign.toString('hex')}`);

  // select applet
  await card.selectApplet();

  // Verify PIN first
  await card.verifyPIN(0, pin);

  // Verify we're using the correct card
  if (cardMfp) {
    // fetch master fingerprint
    const xfp = await card.getMasterXfp();
    if (xfp.toUpperCase() !== cardMfp.toUpperCase()) {
      throw Error(
        'Wrong SATOCHIP used, please ensure you use the same one selected for signing.'
      );
    }
  }

  try {

    // derive extended key
    const {pubkey, chaincode} = await card.getExtendedKey(path);

    // Sign the digest using Satochip
    //const digest = Buffer.from(input.digest, 'hex');
    const dersigBytes =  await card.signTransactionHash(0xff, hashToSign);
    // console.log(`SatochipClient signWithSatochip dersigBytes: ${dersigBytes.toString('hex')}`);

    // convert DER signature to compact signature
    //const sigBytes = converDerSignatureTo64bytesSignature(dersigBytes);

    return dersigBytes;
  } catch (e) {
    throw e; // todo: useless try/catch
  }
};

// For test purposes only
export const readSatochip = async (card: SatochipCard, pin: string) => {
  await card.verifyPIN(0, pin);
  const status = await card.getStatus();
  return status;
};

export const handleSatochipError = (error) => {
  let errorMessage = error.toString();

  if (!errorMessage) {
    errorMessage = 'Something went wrong, please try again!';
  }

  if (Platform.OS === 'ios') NfcManager.invalidateSessionWithErrorIOS(errorMessage); //NFC.showiOSErrorMessage(errorMessage);

  return errorMessage;
};

/**
 * convert a DER-encoded signature to 64-byte signature (r,s)
 *
 * @param sigin - the signature in DER format (70-72 bytes)
 * @returns Buffer containing the compact signature (64-byte format)
 */
const converDerSignatureTo64bytesSignature = (sigin: Buffer) => {

  // Validate DER format
  if (sigin[0] !== 0x30) {
    throw new Error("converDerSignatureTo64bytesSignature: wrong first byte!");
  }

  // Extract r component
  if (sigin[2] !== 0x02) {
    throw new Error("converDerSignatureTo64bytesSignature: r should start with 0x02");
  }

  const rLength = sigin[3];

  // Extract r bytes manually to avoid Buffer compatibility issues
  const rBytes = Buffer.alloc(32);
  const rStart = 4;

  // Handle leading zero in r if present
  let rDataStart = rStart;
  let rDataLength = rLength;
  if (rLength === 33 && sigin[rStart] === 0x00) {
    rDataStart = rStart + 1;
    rDataLength = 32;
  }

  // Copy r data, right-aligned in 32-byte buffer
  const rOffset = 32 - rDataLength;
  for (let i = 0; i < rDataLength; i++) {
    rBytes[rOffset + i] = sigin[rDataStart + i];
  }

  // Extract s component
  const sOffset = 4 + rLength;
  if (sigin[sOffset] !== 0x02) {
    throw new Error("converDerSignatureTo64bytesSignature: s should start with 0x02");
  }

  const sLength = sigin[sOffset + 1];

  // Extract s bytes manually
  const sRawBytes = Buffer.alloc(32);
  const sStart = sOffset + 2;

  // Handle leading zero in s if present
  let sDataStart = sStart;
  let sDataLength = sLength;
  if (sLength === 33 && sigin[sStart] === 0x00) {
    sDataStart = sStart + 1;
    sDataLength = 32;
  }

  // Copy s data, right-aligned in 32-byte buffer
  const sOffsetInBuffer = 32 - sDataLength;
  for (let i = 0; i < sDataLength; i++) {
    sRawBytes[sOffsetInBuffer + i] = sigin[sDataStart + i];
  }

  // Apply BIP62 low-S rule
  const sBytes = enforceLowS(sRawBytes);

  return Buffer.concat([rBytes, sBytes]);
};

const CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const HALF_CURVE_ORDER = CURVE_ORDER / 2n;

function enforceLowS(sBytes: Buffer): Buffer {
  let s = BigInt('0x' + sBytes.toString('hex'));

  if (s > HALF_CURVE_ORDER) {
    s = CURVE_ORDER - s;
  }

  const hex = s.toString(16).padStart(64, '0');

  return Buffer.from(hex, 'hex');
}

// validate bip32path
function validateBip32Path(path: string): void {
  // Complete pattern matching the entire structure
  const regex = /^m\/(\d+'?\/)*(\d+'?\/?)?$/;

  // Breaking down the pattern:
  //   ^ - Start of string
  // m\/ - Literal "m/" (required)
  // (\d+'?\/)* - Zero or more occurrences of: digits, optional quote, slash
  // (\d+'?\/?)? - Optional last segment with digits, optional quote, optional slash
  // $ - End of string

  if (!regex.test(path)) {
    throw new Error(`Invalid format: "${path}" - must match regex: [m/]<digits>[']/<digits>[']/...`);
  }
}
