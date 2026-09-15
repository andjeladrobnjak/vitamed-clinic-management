import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
    patientId?: number;
}

interface PatientTokenPayload {
    patientId: number;
}

export function authenticatePatient(req: Request, res: Response, next: NextFunction): void {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
        res.status(401).json({
            message: 'Niste prijavljeni.'
        });
        return;
    }

    const token = authorization.slice('Bearer '.length).trim();

    if (!token) {
        res.status(401).json({
            message: 'Niste prijavljeni.'
        });
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
        const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload & PatientTokenPayload;
        const patientId = Number(payload.patientId);

        if (!Number.isInteger(patientId) || patientId <= 0) {
            res.status(401).json({
                message: 'Niste prijavljeni.'
            });
            return;
        }

        (req as AuthenticatedRequest).patientId = patientId;
        next();
    } catch {
        res.status(401).json({
            message: 'Niste prijavljeni.'
        });
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
