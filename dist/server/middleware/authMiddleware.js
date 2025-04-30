"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwtSecret = process.env.JWT_SECRET;
const protect = (req, res, next) => {
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
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret); // Use UserPayload type
            // Attach user info to the request object
            // No need to manually pick properties if UserPayload matches what you need
            req.user = {
                userId: decoded.userId,
                username: decoded.username,
                color: decoded.color
                // iat and exp are automatically excluded unless you add them to req.user
            };
            next(); // Proceed to the next middleware/route handler
        }
        catch (error) { // Catch specific error types if known
            console.error('Token verification failed:', error.message);
            // Send appropriate status based on error type (e.g., TokenExpiredError)
            if (error.name === 'TokenExpiredError') {
                res.status(401).json({ message: 'Not authorized, token expired' });
            }
            else if (error.name === 'JsonWebTokenError') {
                res.status(401).json({ message: 'Not authorized, token invalid' });
            }
            else {
                res.status(401).json({ message: 'Not authorized, token failed' });
            }
        }
    }
    else if (!token) { // Moved the !token check to only run if the header wasn't processed
        res.status(401).json({ message: 'Not authorized, no token' });
    }
    // Note: If the header exists but doesn't start with 'Bearer', the request currently hangs.
    // You might want to add an 'else' to the 'if (req.headers.authorization && ...)'
    // or handle it differently depending on your requirements.
};
exports.protect = protect;
