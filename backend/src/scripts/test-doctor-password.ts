import { generateTemporaryPassword, suggestVitamedEmail, validateDoctorPassword } from '../auth/doctor-password';

function assert(name: string, condition: boolean): void {
    if (!condition) {
        throw new Error(`FAIL ${name}`);
    }
    console.log(`PASS ${name}`);
}

const password = generateTemporaryPassword();
assert('temp password length', password.length >= 12);
assert('temp password mixed', /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[#@$%&!?]/.test(password));
assert('temp passwords differ', generateTemporaryPassword() !== generateTemporaryPassword());
assert('email suggestion', suggestVitamedEmail('Teodora', 'Milić') === 'teodora.milic@vitamed.rs');
assert('dj mapping', suggestVitamedEmail('Đorđe', 'Đorđević') === 'djordje.djordjevic@vitamed.rs');
assert('policy short', validateDoctorPassword('Ab1') !== null);
assert('policy ok', validateDoctorPassword('Clinic91') === null);
console.log('Password helper checks passed.');
