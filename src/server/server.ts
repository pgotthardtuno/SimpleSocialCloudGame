// src/server/server.ts
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import helmet from 'helmet';
import authRoutes from './routes/auth';
import { protect, AuthenticatedRequest } from './middleware/authMiddleware';

const portFromEnv = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
export const PORT: number = (portFromEnv !== undefined && !isNaN(portFromEnv)) ? portFromEnv : 3000;

export function createExpressApp(): express.Application {
    const app: express.Application = express();
    // Use the host defined by the server listening address, or localhost for default
    const SERVER_HOST = process.env.HOST || '3.145.78.35'; // UPDATE HERE

    console.log("Configuring Express app for HTTPS...");

    // --- Adjust Helmet for HTTPS ---
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    ...helmet.contentSecurityPolicy.getDefaultDirectives(),

                    // --- CHANGE: form-action for HTTPS ---
                    "form-action": [
                        "'self'", // Allow forms to submit to the same origin
                        `https://${SERVER_HOST}:${PORT}` // Use https://
                    ],

                    // --- CHANGE: connect-src for WSS (Secure WebSockets) ---
                    "connect-src": [
                        "'self'",
                        `wss://localhost:${PORT}`,          // Use wss:// for localhost
                        `wss://${SERVER_HOST}:${PORT}`, // Use wss:// for specific host/IP/domain
                        // Add any other domains you connect to (e.g., APIs)
                    ],

                    // Allow scripts from self and unpkg
                    "script-src": ["'self'", "https://unpkg.com", "'unsafe-inline'"], // 'unsafe-inline' might be needed for some libraries, review if possible
                    // Allow styles from self and inline styles
                    "style-src": ["'self'", "'unsafe-inline'"], // 'unsafe-inline' is often needed for dynamically added styles, review if possible
                    // Allow images from self and data URIs
                    "img-src": ["'self'", "data:"],

                    // --- RE-ADD: upgrade-insecure-requests ---
                    // Tells browsers to try HTTPS first for any HTTP URLs
                    "upgrade-insecure-requests": [],
                },
            },
            // --- RE-ENABLE HSTS (Recommended for production) ---
            // Tells browsers to *only* connect via HTTPS for a specified time
            hsts: {
                maxAge: 31536000, // 1 year in seconds
                includeSubDomains: true, // Optional: Apply HSTS to subdomains too
                preload: false // Optional: Submit domain for HSTS preload list (requires careful setup)
            },
            // Remove or keep other Helmet middleware as needed
            // e.g., frameguard, hidePoweredBy, etc. are generally good to keep
        })
    );
    // -----------------------------

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    console.log("Setting up API routes...");
    app.get('/api/ping', (req: Request, res: Response) => {
        res.json({ message: 'pong' });
    });
    app.use('/api/auth', authRoutes);
    app.get('/api/game/data', protect, (req: AuthenticatedRequest, res: Response) => {
        res.json({
            message: `Protected data for ${req.user?.username ?? 'Unknown User'}!`,
            color: req.user?.color ?? '#ffffff'
        });
    });

    console.log("Setting up static file serving...");
    const publicPath = path.join(__dirname, '../../public');
    console.log(`Serving static files from: ${publicPath}`);
    app.use(express.static(publicPath));
    app.get('/', (req: Request, res: Response) => {
        res.sendFile(path.join(publicPath, 'index.html'));
    });

    console.log("Setting up final error handler...");
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error("Unhandled Error:", err.stack || err);
        let statusCode = 500;
        // Basic error type checking (can be expanded)
        if (err.name === 'UnauthorizedError') { // Example for JWT errors
            statusCode = 401;
        } else if (err.message.includes('Not Found')) { // Basic check for 404 type errors
            statusCode = 404;
        }
        // Add more specific error checks if needed

        if (!res.headersSent) {
            res.status(statusCode).json({ message: err.message || 'Internal Server Error' });
        } else {
            // If headers already sent, delegate to default Express error handler
            next(err);
        }
    });

    console.log("Express app configuration complete.");
    return app;
}