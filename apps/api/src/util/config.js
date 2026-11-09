/**
 * Configuration de l'instance autonome : tout vient des variables d'environnement
 * (chargées depuis `.env` par l'entrée du process). Les fonctions sont évaluées à l'appel
 * pour que les tests puissent modifier `process.env`.
 */
const stripTrailingSlash = (value) => (value ? value.replace(/\/+$/, '') : value);

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
};

module.exports = {
  resourceUid: () => process.env.RESOURCE_UID,
  /** Hôte public de l'interface web (liens dans les mails) : https://emailing.exemple.com */
  publicUrl: () => stripTrailingSlash(process.env.PUBLIC_URL || ''),
  /** URL publique de cette API : https://emailing.exemple.com/api/<uid> */
  apiPublicUrl: () => stripTrailingSlash(process.env.API_PUBLIC_URL || ''),
  /** Dossier des fichiers (uploads CSV, exports) */
  filesDir: () => process.env.FILES_DIR || '/data/files',
  /** URL publique des fichiers exportés : https://emailing.exemple.com/files/<uid> */
  filesPublicUrl: () => stripTrailingSlash(process.env.FILES_PUBLIC_URL || `${stripTrailingSlash(process.env.PUBLIC_URL || '')}/files/${process.env.RESOURCE_UID}`),
  accessApiUrl: () => process.env.ACCESS_API_URL || 'http://access:4000/graphql',
  jwtSecret: () => required('JWT_SECRET'),
  smtpUrl: () => process.env.SMTP_URL || null,
  mailFrom: () => process.env.MAIL_FROM || '"Toolso Emailing" <no-reply@localhost>',
  /** Destinataires des alertes internes (remplace it@toolso.io) ; liste vide si non configuré */
  supportEmails: () =>
    (process.env.SUPPORT_EMAIL || '')
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0),
  complaintScorerUrl: () => process.env.COMPLAINT_SCORER_URL || null,
  usageDatabaseUrl: () => process.env.USAGE_DATABASE_URL || null,
  ipApiKey: () => process.env.IP_API_KEY || null,
  recaptchaSecret: () => process.env.RECAPTCHA_SECRET || null,
  recaptchaSiteKey: () => process.env.RECAPTCHA_SITE_KEY || null,
  workerQueue: () => process.env.WORKER_QUEUE || 'default',
  workerConcurrency: () => parseInt(process.env.WORKER_CONCURRENCY || '10', 10),
  pgPoolMax: (fallback = 10) => parseInt(process.env.PG_POOL_MAX || `${fallback}`, 10),
  port: () => parseInt(process.env.PORT || '4001', 10),
  cronTimezone: () => process.env.CRON_TZ || 'UTC',
  /** Hôte (sans chemin) qui affiche la page de validation des clics (captcha) ; défaut : l'hôte de la requête */
  clickValidationHost: () => stripTrailingSlash(process.env.CLICK_VALIDATION_HOST || ''),
  isMirrorLink: (link) => {
    if (!link) {
      return false;
    }
    if (link.indexOf('vl0deu0vq8.execute-api.eu-west-1.amazonaws.com') >= 0) {
      return true;
    }
    return /^https?:\/\/[^/]+\/m\/[0-9a-fA-F-]{36}\/?$/.test(link.trim());
  }
};
