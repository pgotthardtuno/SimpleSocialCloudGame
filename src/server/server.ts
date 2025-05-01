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
    const SERVER_LOCAL_IP = process.env.LOCAL_IP || '192.168.0.37'; // Keep this for potential local IP access

    console.log("Configuring Express app...");

    // --- Adjust Helmet for HTTP ---
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    ...helmet.contentSecurityPolicy.getDefaultDirectives(),

                    // --- CHANGE: form-action for HTTP ---
                    "form-action": [
                        "'self'", // Allow forms to submit to the same origin
                        `http://${SERVER_LOCAL_IP}:${PORT}` // Use http://
                    ],

                    // --- CHANGE: connect-src for WS (WebSockets) ---
                    "connect-src": [
                        "'self'",
                        `ws://localhost:${PORT}`,          // Use ws:// for localhost
                        `ws://${SERVER_LOCAL_IP}:${PORT}`, // Use ws:// for specific IP
                    ],

                    "script-src": ["'self'", "https://unpkg.com", "'unsafe-inline'"],
                    "style-src": ["'self'", "'unsafe-inline'"],
                    "img-src": ["'self'", "data:"],

                    // --- REMOVE: upgrade-insecure-requests ---
                    // "upgrade-insecure-requests": [], // Not needed for HTTP
                },
            },
            // --- REMOVE or DISABLE HSTS ---
            hsts: false, // Disable HSTS as it's HTTPS-only
            // -----------------------------
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
        if (typeof (err as any).status === 'number') {
            statusCode = (err as any).status;
        } else if (typeof (err as any).statusCode === 'number') {
            statusCode = (err as any).statusCode;
        }
        let message = 'An internal server error occurred.';
        if (process.env.NODE_ENV !== 'production' || statusCode < 500) {
            message = err.message || message;
        }
        if (!res.headersSent) {
            res.status(statusCode).json({ message: message });
        } else {
            next(err);
        }
    });

    console.log("Express app configuration complete.");
    return app;
}