/**
 * SSL Certificate Service Module
 *
 * Exports SSL certificate management functionality for MITM proxy support.
 */

export {
  SSLCertService,
  sslCertService,
  CertificateStatus,
} from './sslCertService';

export type {
  CertificateInfo,
  RootCAOptions,
  HostCertOptions,
  MitmProxyConfig,
} from './sslCertService';