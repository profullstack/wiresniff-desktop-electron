/**
 * SSL Certificate Service Tests
 *
 * Tests for MITM SSL certificate generation and trust management
 * similar to Charles Proxy functionality.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  SSLCertService,
  CertificateInfo,
  CertificateStatus,
} from './sslCertService';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn(),
}));

// Mock crypto
vi.mock('crypto', () => ({
  generateKeyPairSync: vi.fn(() => ({
    publicKey: '-----BEGIN PUBLIC KEY-----\nMOCK_PUBLIC_KEY\n-----END PUBLIC KEY-----',
    privateKey: '-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----',
  })),
  createSign: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    sign: vi.fn(() => Buffer.from('mock-signature')),
  })),
  randomBytes: vi.fn(() => Buffer.from('0123456789abcdef')),
}));

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/app/data'),
  },
}));

import { exec, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';

describe('SSLCertService', () => {
  let sslService: SSLCertService;

  beforeEach(() => {
    vi.clearAllMocks();
    sslService = new SSLCertService();
    
    // Default mock implementations
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readdirSync).mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create certificate directory if it does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await sslService.initialize();

      expect(mkdirSync).toHaveBeenCalled();
    });

    it('should not create directory if it already exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----');

      await sslService.initialize();

      expect(mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('generateRootCA', () => {
    it('should generate a root CA certificate', async () => {
      const result = await sslService.generateRootCA({
        commonName: 'WireSniff Root CA',
        organization: 'WireSniff',
        validityDays: 3650,
      });

      expect(result).toBeDefined();
      expect(result.commonName).toBe('WireSniff Root CA');
      expect(result.isCA).toBe(true);
      expect(writeFileSync).toHaveBeenCalled();
    });

    it('should generate CA with default options', async () => {
      const result = await sslService.generateRootCA();

      expect(result).toBeDefined();
      expect(result.isCA).toBe(true);
    });

    it('should store CA certificate and private key', async () => {
      await sslService.generateRootCA();

      // Should write both cert and key files
      expect(writeFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateHostCertificate', () => {
    beforeEach(async () => {
      // Setup root CA first
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----');
      await sslService.initialize();
    });

    it('should generate a certificate for a specific host', async () => {
      const result = await sslService.generateHostCertificate('api.example.com');

      expect(result).toBeDefined();
      expect(result.commonName).toBe('api.example.com');
      expect(result.isCA).toBe(false);
    });

    it('should support wildcard certificates', async () => {
      const result = await sslService.generateHostCertificate('*.example.com');

      expect(result).toBeDefined();
      expect(result.commonName).toBe('*.example.com');
    });

    it('should include Subject Alternative Names', async () => {
      const result = await sslService.generateHostCertificate('api.example.com', {
        altNames: ['www.example.com', 'example.com'],
      });

      expect(result).toBeDefined();
      expect(result.altNames).toContain('www.example.com');
      expect(result.altNames).toContain('example.com');
    });

    it('should cache generated certificates', async () => {
      await sslService.generateHostCertificate('api.example.com');
      await sslService.generateHostCertificate('api.example.com');

      // Should only generate once due to caching
      const cacheHit = sslService.getCachedCertificate('api.example.com');
      expect(cacheHit).toBeDefined();
    });
  });

  describe('trustRootCA', () => {
    beforeEach(async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----');
      await sslService.initialize();
    });

    it('should detect platform and use appropriate trust command', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback: any) => {
        callback(null, '', '');
        return {} as any;
      });

      await sslService.trustRootCA();

      expect(exec).toHaveBeenCalled();
    });

    it('should handle trust installation errors', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback: any) => {
        callback(new Error('Permission denied'), '', 'Permission denied');
        return {} as any;
      });

      await expect(sslService.trustRootCA()).rejects.toThrow();
    });
  });

  describe('untrustRootCA', () => {
    beforeEach(async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----');
      await sslService.initialize();
    });

    it('should remove CA from system trust store', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback: any) => {
        callback(null, '', '');
        return {} as any;
      });

      await sslService.untrustRootCA();

      expect(exec).toHaveBeenCalled();
    });
  });

  describe('getCertificateStatus', () => {
    it('should return NOT_GENERATED when no CA exists', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const status = await sslService.getCertificateStatus();

      expect(status).toBe(CertificateStatus.NOT_GENERATED);
    });

    it('should return GENERATED when CA exists but not trusted', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----');
      vi.mocked(exec).mockImplementation((cmd, callback: any) => {
        callback(new Error('Not found'), '', '');
        return {} as any;
      });

      await sslService.initialize();
      const status = await sslService.getCertificateStatus();

      expect(status).toBe(CertificateStatus.GENERATED);
    });

    it('should return TRUSTED when CA is in system trust store', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----');
      vi.mocked(exec).mockImplementation((cmd, callback: any) => {
        callback(null, 'WireSniff Root CA', '');
        return {} as any;
      });

      await sslService.initialize();
      const status = await sslService.getCertificateStatus();

      expect(status).toBe(CertificateStatus.TRUSTED);
    });
  });

  describe('exportRootCA', () => {
    beforeEach(async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----');
      await sslService.initialize();
    });

    it('should export CA in PEM format', async () => {
      const result = await sslService.exportRootCA('pem');

      expect(result).toContain('-----BEGIN CERTIFICATE-----');
    });

    it('should export CA in DER format', async () => {
      const result = await sslService.exportRootCA('der');

      expect(result).toBeDefined();
    });

    it('should export CA in PKCS12 format', async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('mock-pkcs12'));

      const result = await sslService.exportRootCA('pkcs12', 'password');

      expect(result).toBeDefined();
    });
  });

  describe('getCertificateInfo', () => {
    beforeEach(async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----');
      await sslService.initialize();
    });

    it('should return certificate information', async () => {
      const info = await sslService.getCertificateInfo();

      expect(info).toBeDefined();
      expect(info?.commonName).toBeDefined();
    });

    it('should return null when no CA exists', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const newService = new SSLCertService();

      const info = await newService.getCertificateInfo();

      expect(info).toBeNull();
    });
  });

  describe('clearCertificateCache', () => {
    it('should clear all cached host certificates', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----');
      await sslService.initialize();

      await sslService.generateHostCertificate('api.example.com');
      expect(sslService.getCachedCertificate('api.example.com')).toBeDefined();

      sslService.clearCertificateCache();

      expect(sslService.getCachedCertificate('api.example.com')).toBeUndefined();
    });
  });

  describe('getMitmProxyConfig', () => {
    beforeEach(async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----');
      await sslService.initialize();
    });

    it('should return mitmproxy configuration', async () => {
      const config = await sslService.getMitmProxyConfig();

      expect(config).toBeDefined();
      expect(config.certPath).toBeDefined();
      expect(config.keyPath).toBeDefined();
    });

    it('should include SSL verification settings', async () => {
      const config = await sslService.getMitmProxyConfig();

      expect(config.sslInsecure).toBeDefined();
    });
  });

  describe('Platform-specific trust', () => {
    beforeEach(async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----');
      await sslService.initialize();
    });

    it('should use security command on macOS', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      vi.mocked(exec).mockImplementation((cmd, callback: any) => {
        expect(cmd).toContain('security');
        callback(null, '', '');
        return {} as any;
      });

      await sslService.trustRootCA();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should use certutil on Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      vi.mocked(exec).mockImplementation((cmd, callback: any) => {
        expect(cmd).toContain('certutil');
        callback(null, '', '');
        return {} as any;
      });

      await sslService.trustRootCA();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should use update-ca-certificates on Linux', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      vi.mocked(exec).mockImplementation((cmd, callback: any) => {
        callback(null, '', '');
        return {} as any;
      });

      await sslService.trustRootCA();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});