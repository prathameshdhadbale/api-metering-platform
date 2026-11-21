import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function integer(name, fallback, { min, max }) {
  const raw = process.env[name] ?? String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
  throw new Error('JWT_SECRET must contain at least 32 bytes');
}

const trustProxyValue = process.env.TRUST_PROXY;
const trustProxy = trustProxyValue === undefined || trustProxyValue === ''
  ? false
  : /^\d+$/.test(trustProxyValue)
    ? Number(trustProxyValue)
    : trustProxyValue;

export const config = Object.freeze({
  port: integer('PORT', 3000, { min: 0, max: 65535 }),
  database: Object.freeze({
    host: required('DB_HOST'),
    port: integer('DB_PORT', 5432, { min: 1, max: 65535 }),
    name: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    poolMax: integer('DB_POOL_MAX', 10, { min: 1, max: 100 })
  }),
  jwtSecret,
  trustProxy,
  authLoginMax: integer('AUTH_LOGIN_MAX', 10, { min: 1, max: 1000 }),
  authRegisterMax: integer('AUTH_REGISTER_MAX', 10, { min: 1, max: 1000 })
});
