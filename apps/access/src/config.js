// Lecture centralisée de la configuration (process.env, chargé par dotenv dans l'entrée).

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
};

// Hôte public de l'UI, sans slash final (ex. https://emailing.exemple.com).
const publicUrl = () => required('PUBLIC_URL').replace(/\/+$/, '');

module.exports = {
  required,
  publicUrl,
  port: () => parseInt(process.env.PORT, 10) || 4000,
  jwtSecret: () => required('JWT_SECRET'),
  databaseUrl: () => required('DATABASE_URL'),
  pgSsl: () => /^(1|true|yes)$/i.test(process.env.PGSSL || ''),
  smtpUrl: () => process.env.SMTP_URL || null,
  mailFrom: () => process.env.MAIL_FROM || '"Toolso" <no-reply@toolso.io>'
};
