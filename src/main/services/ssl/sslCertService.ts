/**
 * SSL Certificate Service
 *
 * Provides MITM SSL certificate generation and trust management
 * similar to Charles Proxy functionality. Enables HTTPS traffic
 * interception for debugging purposes.
 */

import { exec, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { app } from 'electron';
import { generateKeyPairSync, createSign, randomBytes, X509Certificate } from 'crypto';

const execAsync = promisify(exec);

export enum CertificateStatus {
  NOT_GENERATED = 'not_generated',
  GENERATED = 'generated',
  TRUSTED = 'trusted',
  EXPIRED = 'expired',
}

export interface CertificateInfo {
  commonName: string;
  organization?: string;
  organizationalUnit?: string;
  country?: string;
  state?: string;
  locality?: string;
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
  fingerprint: string;
  isCA: boolean;
  altNames?: string[];
}

export interface RootCAOptions {
  commonName?: string;
  organization?: string;
  organizationalUnit?: string;
  country?: string;
  state?: string;
  locality?: string;
  validityDays?: number;
}

export interface HostCertOptions {
  altNames?: string[];
  validityDays?: number;
}

export interface MitmProxyConfig {
  certPath: string;
  keyPath: string;
  sslInsecure: boolean;
  caPath: string;
}

interface CachedCertificate {
  cert: string;
  key: string;
  info: CertificateInfo;
  createdAt: Date;
}

export class SSLCertService {
  private certDir: string;
  private caCertPath: string;
  private caKeyPath: string;
  private hostCertCache: Map<string, CachedCertificate> = new Map();
  private rootCAInfo: CertificateInfo | null = null;
  private initialized = false;

  constructor() {
    // Use app data directory for certificates
    try {
      this.certDir = join(app.getPath('userData'), 'certificates');
    } catch {
      // Fallback for testing
      this.certDir = '/mock/app/data/certificates';
    }
    this.caCertPath = join(this.certDir, 'wiresniff-ca.crt');
    this.caKeyPath = join(this.certDir, 'wiresniff-ca.key');
  }

  /**
   * Initialize the certificate service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create certificate directory if it doesn't exist
    if (!existsSync(this.certDir)) {
      mkdirSync(this.certDir, { recursive: true });
    }

    // Load existing CA if present
    if (existsSync(this.caCertPath) && existsSync(this.caKeyPath)) {
      try {
        const certPem = readFileSync(this.caCertPath, 'utf-8');
        this.rootCAInfo = this.parseCertificateInfo(certPem, true);
      } catch (error) {
        console.error('Failed to load existing CA:', error);
      }
    }

    this.initialized = true;
  }

  /**
   * Generate a new Root CA certificate
   */
  async generateRootCA(options: RootCAOptions = {}): Promise<CertificateInfo> {
    const {
      commonName = 'WireSniff Root CA',
      organization = 'WireSniff',
      organizationalUnit = 'Development',
      country = 'US',
      state = 'California',
      locality = 'San Francisco',
      validityDays = 3650, // 10 years
    } = options;

    // Generate RSA key pair
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Generate serial number
    const serialNumber = randomBytes(16).toString('hex');

    // Calculate validity dates
    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + validityDays);

    // Create self-signed certificate using OpenSSL (for proper X.509 format)
    const subject = `/C=${country}/ST=${state}/L=${locality}/O=${organization}/OU=${organizationalUnit}/CN=${commonName}`;
    
    // Write temporary key file
    const tempKeyPath = join(this.certDir, 'temp-ca.key');
    writeFileSync(tempKeyPath, privateKey);

    try {
      // Generate self-signed CA certificate using OpenSSL
      const opensslConfig = `
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_ca
prompt = no

[req_distinguished_name]
C = ${country}
ST = ${state}
L = ${locality}
O = ${organization}
OU = ${organizationalUnit}
CN = ${commonName}

[v3_ca]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always, issuer:always
`;

      const configPath = join(this.certDir, 'ca.cnf');
      writeFileSync(configPath, opensslConfig);

      execSync(
        `openssl req -new -x509 -days ${validityDays} -key "${tempKeyPath}" -out "${this.caCertPath}" -config "${configPath}"`,
        { stdio: 'pipe' }
      );

      // Clean up temp files
      unlinkSync(configPath);
    } catch (error) {
      // Fallback: create a simple self-signed cert structure
      const certPem = this.createSimpleCertificate(
        commonName,
        organization,
        validFrom,
        validTo,
        serialNumber,
        publicKey,
        privateKey,
        true
      );
      writeFileSync(this.caCertPath, certPem);
    } finally {
      // Always save the private key
      writeFileSync(this.caKeyPath, privateKey, { mode: 0o600 });
      try {
        unlinkSync(tempKeyPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Create certificate info
    this.rootCAInfo = {
      commonName,
      organization,
      organizationalUnit,
      country,
      state,
      locality,
      validFrom,
      validTo,
      serialNumber,
      fingerprint: this.calculateFingerprint(readFileSync(this.caCertPath, 'utf-8')),
      isCA: true,
    };

    return this.rootCAInfo;
  }

  /**
   * Generate a certificate for a specific host
   */
  async generateHostCertificate(
    hostname: string,
    options: HostCertOptions = {}
  ): Promise<CertificateInfo> {
    // Check cache first
    const cached = this.hostCertCache.get(hostname);
    if (cached) {
      return cached.info;
    }

    if (!this.rootCAInfo) {
      throw new Error('Root CA not initialized. Call generateRootCA() first.');
    }

    const { altNames = [], validityDays = 365 } = options;

    // Always include the hostname in altNames
    const allAltNames = [hostname, ...altNames.filter((n) => n !== hostname)];

    // Generate key pair for host
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const serialNumber = randomBytes(16).toString('hex');
    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + validityDays);

    // Create host certificate
    const hostCertPath = join(this.certDir, `${hostname.replace(/\*/g, 'wildcard')}.crt`);
    const hostKeyPath = join(this.certDir, `${hostname.replace(/\*/g, 'wildcard')}.key`);

    try {
      // Generate CSR and sign with CA using OpenSSL
      const sanConfig = `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = ${hostname}

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
${allAltNames.map((name, i) => `DNS.${i + 1} = ${name}`).join('\n')}
`;

      const configPath = join(this.certDir, `${hostname.replace(/\*/g, 'wildcard')}.cnf`);
      writeFileSync(configPath, sanConfig);
      writeFileSync(hostKeyPath, privateKey, { mode: 0o600 });

      // Generate CSR
      const csrPath = join(this.certDir, `${hostname.replace(/\*/g, 'wildcard')}.csr`);
      execSync(
        `openssl req -new -key "${hostKeyPath}" -out "${csrPath}" -config "${configPath}"`,
        { stdio: 'pipe' }
      );

      // Sign with CA
      execSync(
        `openssl x509 -req -in "${csrPath}" -CA "${this.caCertPath}" -CAkey "${this.caKeyPath}" -CAcreateserial -out "${hostCertPath}" -days ${validityDays} -extensions v3_req -extfile "${configPath}"`,
        { stdio: 'pipe' }
      );

      // Clean up
      unlinkSync(configPath);
      unlinkSync(csrPath);
    } catch (error) {
      // Fallback: create simple certificate
      const certPem = this.createSimpleCertificate(
        hostname,
        'WireSniff',
        validFrom,
        validTo,
        serialNumber,
        publicKey,
        privateKey,
        false
      );
      writeFileSync(hostCertPath, certPem);
      writeFileSync(hostKeyPath, privateKey, { mode: 0o600 });
    }

    const certInfo: CertificateInfo = {
      commonName: hostname,
      validFrom,
      validTo,
      serialNumber,
      fingerprint: this.calculateFingerprint(readFileSync(hostCertPath, 'utf-8')),
      isCA: false,
      altNames: allAltNames,
    };

    // Cache the certificate
    this.hostCertCache.set(hostname, {
      cert: readFileSync(hostCertPath, 'utf-8'),
      key: privateKey,
      info: certInfo,
      createdAt: new Date(),
    });

    return certInfo;
  }

  /**
   * Trust the Root CA in the system trust store
   */
  async trustRootCA(): Promise<void> {
    if (!existsSync(this.caCertPath)) {
      throw new Error('Root CA certificate not found. Generate it first.');
    }

    const platform = process.platform;

    try {
      switch (platform) {
        case 'darwin':
          // macOS: Add to System Keychain
          await execAsync(
            `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${this.caCertPath}"`
          );
          break;

        case 'win32':
          // Windows: Add to Trusted Root Certification Authorities
          await execAsync(`certutil -addstore -user "Root" "${this.caCertPath}"`);
          break;

        case 'linux':
          // Linux: Copy to ca-certificates and update
          const destPath = '/usr/local/share/ca-certificates/wiresniff-ca.crt';
          await execAsync(`sudo cp "${this.caCertPath}" "${destPath}"`);
          await execAsync('sudo update-ca-certificates');
          break;

        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      throw new Error(`Failed to trust Root CA: ${(error as Error).message}`);
    }
  }

  /**
   * Remove the Root CA from the system trust store
   */
  async untrustRootCA(): Promise<void> {
    const platform = process.platform;

    try {
      switch (platform) {
        case 'darwin':
          await execAsync(
            `sudo security delete-certificate -c "WireSniff Root CA" /Library/Keychains/System.keychain`
          );
          break;

        case 'win32':
          await execAsync(`certutil -delstore -user "Root" "WireSniff Root CA"`);
          break;

        case 'linux':
          await execAsync('sudo rm -f /usr/local/share/ca-certificates/wiresniff-ca.crt');
          await execAsync('sudo update-ca-certificates --fresh');
          break;

        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      throw new Error(`Failed to untrust Root CA: ${(error as Error).message}`);
    }
  }

  /**
   * Get the current certificate status
   */
  async getCertificateStatus(): Promise<CertificateStatus> {
    if (!existsSync(this.caCertPath)) {
      return CertificateStatus.NOT_GENERATED;
    }

    // Check if certificate is expired
    if (this.rootCAInfo) {
      if (new Date() > this.rootCAInfo.validTo) {
        return CertificateStatus.EXPIRED;
      }
    }

    // Check if trusted in system store
    const isTrusted = await this.checkIfTrusted();
    if (isTrusted) {
      return CertificateStatus.TRUSTED;
    }

    return CertificateStatus.GENERATED;
  }

  /**
   * Check if the CA is trusted in the system store
   */
  private async checkIfTrusted(): Promise<boolean> {
    const platform = process.platform;

    try {
      switch (platform) {
        case 'darwin':
          const { stdout: macResult } = await execAsync(
            'security find-certificate -c "WireSniff Root CA" /Library/Keychains/System.keychain'
          );
          return macResult.includes('WireSniff Root CA');

        case 'win32':
          const { stdout: winResult } = await execAsync(
            'certutil -store -user "Root" | findstr "WireSniff"'
          );
          return winResult.includes('WireSniff');

        case 'linux':
          return existsSync('/usr/local/share/ca-certificates/wiresniff-ca.crt');

        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Export the Root CA certificate
   */
  async exportRootCA(format: 'pem' | 'der' | 'pkcs12', password?: string): Promise<string | Buffer> {
    if (!existsSync(this.caCertPath)) {
      throw new Error('Root CA certificate not found.');
    }

    const certPem = readFileSync(this.caCertPath, 'utf-8');

    switch (format) {
      case 'pem':
        return certPem;

      case 'der':
        const derOutput = execSync(`openssl x509 -in "${this.caCertPath}" -outform DER`);
        return derOutput;

      case 'pkcs12':
        if (!password) {
          throw new Error('Password required for PKCS12 export');
        }
        const p12Output = execSync(
          `openssl pkcs12 -export -in "${this.caCertPath}" -inkey "${this.caKeyPath}" -password pass:${password}`
        );
        return p12Output;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Get certificate information
   */
  async getCertificateInfo(): Promise<CertificateInfo | null> {
    if (!existsSync(this.caCertPath)) {
      return null;
    }

    if (!this.rootCAInfo) {
      const certPem = readFileSync(this.caCertPath, 'utf-8');
      this.rootCAInfo = this.parseCertificateInfo(certPem, true);
    }

    return this.rootCAInfo;
  }

  /**
   * Get a cached certificate for a host
   */
  getCachedCertificate(hostname: string): CachedCertificate | undefined {
    return this.hostCertCache.get(hostname);
  }

  /**
   * Clear the certificate cache
   */
  clearCertificateCache(): void {
    this.hostCertCache.clear();
  }

  /**
   * Get mitmproxy configuration
   */
  async getMitmProxyConfig(): Promise<MitmProxyConfig> {
    return {
      certPath: this.caCertPath,
      keyPath: this.caKeyPath,
      caPath: this.caCertPath,
      sslInsecure: false,
    };
  }

  /**
   * Parse certificate information from PEM
   */
  private parseCertificateInfo(certPem: string, isCA: boolean): CertificateInfo {
    try {
      const cert = new X509Certificate(certPem);
      
      return {
        commonName: this.extractCN(cert.subject) || 'Unknown',
        organization: this.extractField(cert.subject, 'O'),
        validFrom: new Date(cert.validFrom),
        validTo: new Date(cert.validTo),
        serialNumber: cert.serialNumber,
        fingerprint: cert.fingerprint256,
        isCA,
      };
    } catch {
      // Fallback for when X509Certificate is not available
      return {
        commonName: 'WireSniff Root CA',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        serialNumber: randomBytes(16).toString('hex'),
        fingerprint: 'unknown',
        isCA,
      };
    }
  }

  /**
   * Extract CN from subject string
   */
  private extractCN(subject: string): string | undefined {
    const match = subject.match(/CN=([^,]+)/);
    return match ? match[1] : undefined;
  }

  /**
   * Extract field from subject string
   */
  private extractField(subject: string, field: string): string | undefined {
    const regex = new RegExp(`${field}=([^,]+)`);
    const match = subject.match(regex);
    return match ? match[1] : undefined;
  }

  /**
   * Calculate certificate fingerprint
   */
  private calculateFingerprint(certPem: string): string {
    try {
      const cert = new X509Certificate(certPem);
      return cert.fingerprint256;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Create a simple certificate (fallback when OpenSSL is not available)
   */
  private createSimpleCertificate(
    commonName: string,
    organization: string,
    validFrom: Date,
    validTo: Date,
    serialNumber: string,
    publicKey: string,
    privateKey: string,
    isCA: boolean
  ): string {
    // This is a simplified certificate structure
    // In production, OpenSSL should be used for proper X.509 certificates
    const certData = {
      version: 3,
      serialNumber,
      issuer: { CN: commonName, O: organization },
      subject: { CN: commonName, O: organization },
      validity: {
        notBefore: validFrom.toISOString(),
        notAfter: validTo.toISOString(),
      },
      publicKey,
      extensions: {
        basicConstraints: { cA: isCA },
        keyUsage: isCA
          ? ['keyCertSign', 'cRLSign']
          : ['digitalSignature', 'keyEncipherment'],
      },
    };

    // Sign the certificate data
    const sign = createSign('SHA256');
    sign.update(JSON.stringify(certData));
    const signature = sign.sign(privateKey, 'base64');

    // Return as PEM-like format (not a real X.509 cert, but works for testing)
    return `-----BEGIN CERTIFICATE-----
${Buffer.from(JSON.stringify({ ...certData, signature })).toString('base64')}
-----END CERTIFICATE-----`;
  }
}

// Export singleton instance
export const sslCertService = new SSLCertService();