import { SensitiveInfo, SoftwareWalletInfo } from '@/types/WalletTypes.ts';
import QuickCrypto from 'react-native-quick-crypto';
const { randomBytes, pbkdf2, createCipheriv, createDecipheriv } = QuickCrypto;

export class WalletEncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly ITERATIONS = 100000;

  /**
   * Encrypt wallet data and store both key and data securely
   */
  static async encryptAndStore(
    sensitiveInfo: SensitiveInfo,
    userPassword: string,
  ): Promise<string> {
    // Generate crypto parameters
    const salt = randomBytes(32);
    const iv = randomBytes(16);

    // Derive encryption key from password
    const key = await new Promise<Buffer>((resolve, reject) => {
      pbkdf2(
        userPassword,
        salt,
        this.ITERATIONS,
        32,
        'sha256',
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        },
      );
    });

    // Encrypt the wallet data
    const cipher = createCipheriv(this.ALGORITHM, key, iv);
    const plaintext = Buffer.from(JSON.stringify(sensitiveInfo));

    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Package encrypted data with metadata
    const encryptedPackage = {
      data: encrypted.toString('base64'),
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: this.ALGORITHM,
      iterations: this.ITERATIONS,
      timestamp: Date.now(),
    };

    return JSON.stringify(encryptedPackage);
  }

  /**
   * Decrypt using password
   */
  static async decryptWithPassword(encryptedBlob: string, userPassword: string): Promise<SensitiveInfo> {

    const encryptedPackage = JSON.parse(encryptedBlob);

    // Re-derive the key from password
    const key = await new Promise<Buffer>((resolve, reject) => {
      pbkdf2(
        userPassword,
        Buffer.from(encryptedPackage.salt, 'base64'),
        encryptedPackage.iterations,
        32,
        'sha256',
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        },
      );
    });

    // Decrypt using re-derived key
    const decipher = createDecipheriv(
      encryptedPackage.algorithm,
      key,
      Buffer.from(encryptedPackage.iv, 'base64'),
    );

    decipher.setAuthTag(Buffer.from(encryptedPackage.authTag, 'base64'));

    try {
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedPackage.data, 'base64')),
        decipher.final(),
      ]);

      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      throw new Error('Invalid password or corrupted data');
    }
  }
}