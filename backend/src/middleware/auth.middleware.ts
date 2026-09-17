import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
    patientId?: number;
    doctorId?: number;
    doctorAccountId?: number;
    adminId?: number;
}

interface TokenPayload extends jwt.JwtPayload {
    patientId?: unknown;
    doctorId?: unknown;
    accountId?: unknown;
    adminId?: unknown;
    role?: unknown;
}

interface TokenPayload extends jwt.JwtPayload {
    patientId?: unknown;
    doctorId?: unknown;
    accountId?: unknown;
    role?: unknown;
}

const UNAUTHORIZED_MESSAGE = 'Niste prijavljeni.';

export function authenticatePatient(req: Request, res: Response, next: NextFunction): void {
    const token = readBearerToken(req, res);
    if (token === null) {
        return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        res.status(500).json({
            message: 'Došlo je do greške na serveru. Pokušajte ponovo.'
        });
        return;
    }

    try {
        const payload = jwt.verify(token, jwtSecret) as TokenPayload;

        if (isDoctorSessionPayload(payload) || isAdminSessionPayload(payload)) {
            res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
            return;
        }

        if (payload.role !== undefined && payload.role !== 'patient') {
            res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
            return;
        }

        const patientId = Number(payload.patientId);
        if (!isPositiveId(patientId)) {
            res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
            return;
        }

        (req as AuthenticatedRequest).patientId = patientId;
        next();
    } catch {
        res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
    }
}

export function authenticateDoctor(req: Request, res: Response, next: NextFunction): void {
    const token = readBearerToken(req, res);
    if (token === null) {
        return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        res.status(500).json({
            message: 'Došlo je do greške na serveru. Pokušajte ponovo.'
        });
        return;
    }

    try {
        const payload = jwt.verify(token, jwtSecret) as TokenPayload;

        if (payload.role !== 'doctor') {
            res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
            return;
        }

        if (hasPresentClaim(payload.patientId) || isAdminSessionPayload(payload)) {
            res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
            return;
        }

        const doctorId = Number(payload.doctorId);
        const accountId = Number(payload.accountId);

        if (!isPositiveId(doctorId) || !isPositiveId(accountId)) {
            res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
            return;
        }

        (req as AuthenticatedRequest).doctorId = doctorId;
        (req as AuthenticatedRequest).doctorAccountId = accountId;
        next();
    } catch {
        res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
    }
}

export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
    const token = readBearerToken(req, res);
    if (token === null) {
        return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        res.status(500).json({
            message: 'Došlo je do greške na serveru. Pokušajte ponovo.'
        });
        return;
    }

    try {
        const payload = jwt.verify(token, jwtSecret) as TokenPayload;

        if (payload.role !== 'admin') {
            res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
            return;
        }

        if (
            hasPresentClaim(payload.patientId) ||
            hasPresentClaim(payload.doctorId) ||
            hasPresentClaim(payload.accountId)
        ) {
            res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
            return;
        }

        const adminId = Number(payload.adminId);
        if (!isPositiveId(adminId)) {
            res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
            return;
        }

        (req as AuthenticatedRequest).adminId = adminId;
        next();
    } catch {
        res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
    }
}

export function optionalAuthenticatePatient(req: Request, res: Response, next: NextFunction): void {
    const authorization = req.headers.authorization;

    if (!authorization) {
        next();
        return;
    }

    authenticatePatient(req, res, next);
}

function readBearerToken(req: Request, res: Response): string | null {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
        res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
        return null;
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
        res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
        return null;
    }

    return token;
}

function isAdminSessionPayload(payload: TokenPayload): boolean {
    if (payload.role === 'admin') {
        return true;
    }

    return hasPresentClaim(payload.adminId);
}

function isDoctorSessionPayload(payload: TokenPayload): boolean {
    if (payload.role === 'doctor') {
        return true;
    }

    if (hasPresentClaim(payload.doctorId) || hasPresentClaim(payload.accountId)) {
        return true;
    }

    return false;
}

function hasPresentClaim(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
}

function isPositiveId(value: number): boolean {
    return Number.isInteger(value) && value > 0;
}
