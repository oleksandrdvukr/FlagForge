import { hashSync } from 'bcrypt';
import { TEST_ADMIN } from '../utils/auth';

// Runs in every test worker before the tests: deterministic admin credentials (ADR-0006).
// Cost 4 keeps bcrypt fast in tests; production hashes use cost 12.
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters';
process.env.ADMIN_EMAIL = TEST_ADMIN.email;
process.env.ADMIN_PASSWORD_HASH = hashSync(TEST_ADMIN.password, 4);
process.env.NODE_ENV = 'test';
