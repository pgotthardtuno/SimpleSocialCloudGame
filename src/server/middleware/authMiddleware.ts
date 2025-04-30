// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET;

// ---> Define and Export UserPayload Interface <---
export interface UserPayload {
    userId: number;
    username: string;
    color: string;
    iat?: number; // Optional: standard JWT claim
    exp?: number; // Optional: standard JWT claim
}
// ---> End of Definition <---

// Define a custom interface extending Express's Request
// You can use UserPayload here too for consistency
export interface AuthenticatedRequest extends Request {
    user?: UserPayload; // Use the defined UserPayload type
}


export const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    let token;

    // Check for token in Authorization header (Bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header ('Bearer TOKEN_STRING')
            token = req.headers.authorization.split(' ')[1];

            if (!jwtSecret) {
                // It's better to throw an error here for consistency
                // console.error('JWT Secret not configured');
                // return res.status(500).json({ message: 'Server configuration error' });
                throw new Error('JWT Secret not configured');
            }

            // Verify token and use the UserPayload type for the assertion
            const decoded = jwt.verify(token, jwtSecret) as UserPayload; // Use UserPayload type

            // Attach user info to the request object
            // No need to manually pick properties if UserPayload matches what you need
            req.user = {
                userId: decoded.userId,
                username: decoded.username,
                color: decoded.color
                // iat and exp are automatically excluded unless you add them to req.user
            };

            next(); // Proceed to the next middleware/route handler
        } catch (error: any) { // Catch specific error types if known
            console.error('Token verification failed:', error.message);
            // Send appropriate status based on error type (e.g., TokenExpiredError)
            if (error.name === 'TokenExpiredError') {
                res.status(401).json({ message: 'Not authorized, token expired' });
            } else if (error.name === 'JsonWebTokenError') {
                res.status(401).json({ message: 'Not authorized, token invalid' });
            } else {
                res.status(401).json({ message: 'Not authorized, token failed' });
            }
        }
    } else if (!token) { // Moved the !token check to only run if the header wasn't processed
        res.status(401).json({ message: 'Not authorized, no token' });
    }
    // Note: If the header exists but doesn't start with 'Bearer', the request currently hangs.
    // You might want to add an 'else' to the 'if (req.headers.authorization && ...)'
    // or handle it differently depending on your requirements.
};